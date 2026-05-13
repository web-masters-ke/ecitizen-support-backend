// Anthropic Claude integration for the AI module.
//
// Wraps three call sites where Claude does meaningfully better than the
// rule-based fallbacks we ship by default:
//
//   1. classifyTicket — categorize + prioritize a new ticket from its text
//   2. pickAgency     — route an unassigned public-report ticket to the best
//                       agency given a roster of {id, name, code, ministry,
//                       categories[]}
//   3. draftKbArticle — summarize a resolved ticket's conversation into a
//                       draft KB article an admin can approve later
//
// Structured outputs are requested via tool-use schemas, so the caller
// receives parsed objects, not free-text JSON. Prompt caching is enabled on
// the agency-roster system prompt for #2 because the roster is stable across
// calls; saves substantial input tokens once the cache is warm.
//
// The provider no-ops gracefully when ANTHROPIC_API_KEY is missing — the
// `available()` guard returns false, the call sites fall back to the existing
// rule-based path, and the build still works in dev without the key.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

// ─── Public result types ───────────────────────────────────────────────────

export interface ClaudeClassification {
  categoryName: string;
  priorityName: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  sentiment: number;
  matchedKeywords: string[];
}

export interface ClaudeAgencyChoice {
  agencyId: string | null;
  confidence: number;
  reason: string;
}

export interface ClaudeKbDraft {
  title: string;
  body: string;
  tags: string[];
}

export interface AgencyForRouting {
  id: string;
  name: string;
  code?: string | null;
  ministry?: string | null;
  categories: string[];
}

// ─── Tool schemas (structured outputs) ─────────────────────────────────────
//
// Defined once at module scope so the JSON bytes are stable — important for
// the cache hash on pickAgency's request.

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'record_classification',
  description:
    'Record the category, priority, sentiment, and matched signal keywords for a citizen support ticket.',
  input_schema: {
    type: 'object',
    properties: {
      categoryName: {
        type: 'string',
        description:
          'Best-fit category name. Pick a short human-readable label like "Payment Issue", "Login Problem", "Service Status".',
      },
      priorityName: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        description:
          'Priority. CRITICAL = system-wide outage or safety-of-life; HIGH = blocked on service; MEDIUM = inconvenience; LOW = info request.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence in the classification, 0..1. Be honest — vague tickets should be ≤0.5.',
      },
      sentiment: {
        type: 'number',
        description: 'Citizen sentiment, -1 (angry) … 0 (neutral) … 1 (positive).',
      },
      matchedKeywords: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Up to 8 short phrases from the ticket that drove the decision. Useful for audit + debugging.',
      },
    },
    required: ['categoryName', 'priorityName', 'confidence', 'sentiment', 'matchedKeywords'],
  },
};

const PICK_AGENCY_TOOL: Anthropic.Tool = {
  name: 'record_agency_choice',
  description: 'Record which agency in the provided roster should own this ticket.',
  input_schema: {
    type: 'object',
    properties: {
      agencyId: {
        type: 'string',
        description:
          'The exact `id` value from the roster the ticket should route to. If no agency clearly fits, return the empty string.',
      },
      confidence: {
        type: 'number',
        description: 'Confidence in the choice, 0..1. Use ≤0.5 when the ticket is vague or could fit multiple agencies.',
      },
      reason: {
        type: 'string',
        description:
          'One short sentence (≤200 chars) explaining the match — which keywords or mandate signals tied the ticket to this agency.',
      },
    },
    required: ['agencyId', 'confidence', 'reason'],
  },
};

const KB_DRAFT_TOOL: Anthropic.Tool = {
  name: 'record_kb_article_draft',
  description:
    'Record a draft Knowledge-Base article summarizing how a resolved citizen ticket was handled, so other agents can reuse the solution.',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'A short, search-friendly headline (≤80 chars). Phrase as the problem, not the solution.',
      },
      body: {
        type: 'string',
        description:
          'Markdown body. Structure: ## Problem (1-2 sentences) → ## Resolution (numbered steps) → ## Notes (gotchas, links, agency-specific bits). Strip citizen PII (names, emails, ID numbers).',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 6 short lowercase tags for filtering (e.g. "payment", "password-reset", "kra").',
      },
    },
    required: ['title', 'body', 'tags'],
  },
};

// ─── Provider ──────────────────────────────────────────────────────────────

@Injectable()
export class AnthropicProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly client: Anthropic | null;

  // Models picked per latency / cost tradeoff:
  //   • Haiku 4.5 (cheap + fast) for the per-ticket calls (classify, route)
  //   • Sonnet 4.6 for KB drafting — runs once per resolution, quality matters
  private static readonly FAST_MODEL = 'claude-haiku-4-5';
  private static readonly DRAFT_MODEL = 'claude-sonnet-4-6';

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!key) {
      this.client = null;
      this.logger.warn(
        'ANTHROPIC_API_KEY is not set — Claude-backed classification, routing, and KB drafts are disabled. Falling back to rule-based heuristics.',
      );
      return;
    }
    this.client = new Anthropic({ apiKey: key });
    this.logger.log('Anthropic provider ready (haiku-4-5 for fast paths, sonnet-4-6 for KB drafts).');
  }

  /** Whether the provider can make real calls. Callers fall back when false. */
  available(): boolean {
    return this.client !== null;
  }

  // ─── 1. Ticket auto-classification ───────────────────────────────────────

  async classifyTicket(text: string): Promise<ClaudeClassification | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.create({
        model: AnthropicProvider.FAST_MODEL,
        max_tokens: 512,
        system: [
          {
            type: 'text',
            text: `You triage citizen support tickets for the eCitizen Service Command Centre in Kenya.
For each ticket: (1) name the best-fit category (your own concise label), (2) assign a priority,
(3) score your confidence, (4) score citizen sentiment, (5) list the short phrases that drove the call.

Priority rubric:
  CRITICAL — system-wide outage, citizen at risk, fraud in progress, dependent service blocked
  HIGH     — citizen blocked from a needed government service with a deadline
  MEDIUM   — degraded experience or non-blocking complaint
  LOW      — general inquiry, info request, satisfaction comment

Always invoke the record_classification tool with all five fields. Never reply with free text.`,
          },
        ],
        tools: [CLASSIFY_TOOL],
        tool_choice: { type: 'tool', name: CLASSIFY_TOOL.name },
        messages: [{ role: 'user', content: this.truncate(text, 4000) }],
      });
      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === CLASSIFY_TOOL.name,
      );
      if (!toolUse) {
        this.logger.warn('Claude classifyTicket returned no tool_use block; falling back.');
        return null;
      }
      const input = toolUse.input as Partial<ClaudeClassification>;
      // Light validation — the schema is enforced server-side, but defend
      // against transient malformed responses rather than crashing the
      // ticket creation flow.
      if (
        typeof input.categoryName !== 'string' ||
        typeof input.priorityName !== 'string' ||
        typeof input.confidence !== 'number' ||
        typeof input.sentiment !== 'number' ||
        !Array.isArray(input.matchedKeywords)
      ) {
        this.logger.warn(`Claude classifyTicket: malformed input shape: ${JSON.stringify(input)}`);
        return null;
      }
      return {
        categoryName: input.categoryName,
        priorityName: input.priorityName as ClaudeClassification['priorityName'],
        confidence: Math.max(0, Math.min(1, input.confidence)),
        sentiment: Math.max(-1, Math.min(1, input.sentiment)),
        matchedKeywords: input.matchedKeywords.slice(0, 12).filter((k) => typeof k === 'string'),
      };
    } catch (err) {
      this.logger.warn(`Claude classifyTicket failed: ${(err as Error)?.message}`);
      return null;
    }
  }

  // ─── 2. AI agency routing ────────────────────────────────────────────────

  async pickAgency(text: string, agencies: AgencyForRouting[]): Promise<ClaudeAgencyChoice | null> {
    if (!this.client) return null;
    if (agencies.length === 0) return null;

    // Render the roster once into a deterministic markdown table that we
    // cache. The bytes must be byte-stable across calls or the cache key
    // changes — sort the agency list by id and keep field order fixed.
    const roster = [...agencies]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((a) => {
        const code = a.code ? ` (${a.code})` : '';
        const ministry = a.ministry ? `  Ministry: ${a.ministry}\n` : '';
        const cats = a.categories.length > 0 ? `  Categories: ${a.categories.join(', ')}\n` : '';
        return `- id: ${a.id}\n  name: ${a.name}${code}\n${ministry}${cats}`;
      })
      .join('\n');

    try {
      const response = await this.client.messages.create({
        model: AnthropicProvider.FAST_MODEL,
        max_tokens: 512,
        system: [
          {
            type: 'text',
            text: `You route citizen support tickets to the best-fit Kenyan government agency from the roster below.

Rules:
  - Choose the single best agency. If two are plausible, prefer the one whose mandate (categories / ministry / name) most directly handles the citizen's described problem.
  - The agencyId you return MUST be exactly one of the ids from the roster — do not invent one.
  - If nothing in the roster fits, return an empty agencyId and confidence ≤0.3.
  - Set confidence to your honest belief in the match (0..1). Vague tickets that could fit several agencies should score ≤0.5.
  - reason: one short sentence explaining which signals drove the match.

Always invoke the record_agency_choice tool. Never reply with free text.

ROSTER:
${roster}`,
            // Cache the roster + system instructions. The roster only changes
            // when agencies are added / renamed, so subsequent routing calls
            // pay ~0.1× the input cost on the cached prefix.
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [PICK_AGENCY_TOOL],
        tool_choice: { type: 'tool', name: PICK_AGENCY_TOOL.name },
        messages: [{ role: 'user', content: this.truncate(text, 4000) }],
      });

      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === PICK_AGENCY_TOOL.name,
      );
      if (!toolUse) {
        this.logger.warn('Claude pickAgency returned no tool_use block; falling back.');
        return null;
      }
      const input = toolUse.input as Partial<ClaudeAgencyChoice>;
      if (
        typeof input.agencyId !== 'string' ||
        typeof input.confidence !== 'number' ||
        typeof input.reason !== 'string'
      ) {
        this.logger.warn(`Claude pickAgency: malformed input shape: ${JSON.stringify(input)}`);
        return null;
      }
      // Verify the returned id is actually in the roster — defend against
      // the model inventing an id that looks plausible.
      const chosen = input.agencyId.trim();
      const validId = chosen && agencies.some((a) => a.id === chosen) ? chosen : null;
      const cacheRead = (response.usage as { cache_read_input_tokens?: number })?.cache_read_input_tokens ?? 0;
      if (cacheRead > 0) {
        this.logger.debug(`pickAgency cache hit: ${cacheRead} tokens read from cache.`);
      }
      return {
        agencyId: validId,
        confidence: Math.max(0, Math.min(1, input.confidence)),
        reason: input.reason.slice(0, 240),
      };
    } catch (err) {
      this.logger.warn(`Claude pickAgency failed: ${(err as Error)?.message}`);
      return null;
    }
  }

  // ─── 3. KB auto-draft on resolved tickets ────────────────────────────────

  async draftKbArticle(opts: {
    subject: string;
    description: string;
    messages: Array<{ role: 'citizen' | 'agent' | 'system'; text: string }>;
    resolutionNotes?: string | null;
    agencyName?: string | null;
  }): Promise<ClaudeKbDraft | null> {
    if (!this.client) return null;

    const transcript = opts.messages
      .filter((m) => m.text && m.text.trim().length > 0)
      .map((m) => `[${m.role.toUpperCase()}] ${m.text.trim()}`)
      .join('\n\n');

    const payload = [
      `Subject: ${opts.subject}`,
      opts.agencyName ? `Agency: ${opts.agencyName}` : null,
      '',
      'Original ticket description:',
      opts.description,
      '',
      'Conversation:',
      transcript || '(no agent/citizen messages on file)',
      opts.resolutionNotes ? `\nResolution notes from the agent:\n${opts.resolutionNotes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.client.messages.create({
        model: AnthropicProvider.DRAFT_MODEL,
        max_tokens: 1500,
        system: [
          {
            type: 'text',
            text: `You write Knowledge-Base articles for the eCitizen Service Command Centre. Other agents will read these to resolve similar tickets faster, so the article must be:

  - Generalised (strip the specific citizen's name, email, ID number, phone number).
  - Action-oriented (numbered resolution steps an agent can follow).
  - Honest about gaps — if the resolution wasn't clean, say so under Notes.

Body structure (markdown):
  ## Problem      — 1-2 sentences in the citizen's voice
  ## Resolution   — numbered steps the agent took to fix it
  ## Notes        — optional: gotchas, links to other systems, agency-specific rules

Always invoke the record_kb_article_draft tool. Never reply with free text.`,
          },
        ],
        tools: [KB_DRAFT_TOOL],
        tool_choice: { type: 'tool', name: KB_DRAFT_TOOL.name },
        messages: [{ role: 'user', content: this.truncate(payload, 12000) }],
      });
      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === KB_DRAFT_TOOL.name,
      );
      if (!toolUse) {
        this.logger.warn('Claude draftKbArticle returned no tool_use block.');
        return null;
      }
      const input = toolUse.input as Partial<ClaudeKbDraft>;
      if (
        typeof input.title !== 'string' ||
        typeof input.body !== 'string' ||
        !Array.isArray(input.tags)
      ) {
        this.logger.warn(`Claude draftKbArticle: malformed input shape: ${JSON.stringify(input)}`);
        return null;
      }
      return {
        title: input.title.slice(0, 120).trim(),
        body: input.body.trim(),
        tags: input.tags
          .slice(0, 8)
          .filter((t) => typeof t === 'string')
          .map((t) => t.toLowerCase().trim()),
      };
    } catch (err) {
      this.logger.warn(`Claude draftKbArticle failed: ${(err as Error)?.message}`);
      return null;
    }
  }

  private truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    return s.slice(0, max) + '\n\n[…truncated…]';
  }
}
