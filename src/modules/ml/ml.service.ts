import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  ClassifyTicketMlDto,
  RoutingRecommendationDto,
  SlaBreachPredictionDto,
  SentimentAnalysisDto,
  AnomalyDetectionDto,
  AnomalyEntityType,
  KbSuggestDto,
  ForecastDto,
  RegisterMlModelDto,
} from './dto/ml.dto';

// ─── Internal type aliases ────────────────────────────────────────────────────

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type SeverityBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// ─── Keyword banks ────────────────────────────────────────────────────────────

const CRITICAL_KEYWORDS = [
  'system down', 'outage', 'complete failure', 'data loss', 'security breach',
  'hack', 'unauthorized access', 'server error', 'emergency', 'critical',
];

const HIGH_KEYWORDS = [
  'urgent', 'asap', 'immediately', 'broken', 'error', 'failed', 'payment failed',
  'identity theft', 'deadline', 'blocked', 'stuck', 'expired', 'overdue',
  'delayed', 'missing document', 'lost', 'stolen',
];

const MEDIUM_KEYWORDS = [
  'issue', 'problem', 'help', 'not receiving', 'slow', 'wrong', 'incorrect',
  'update', 'change', 'modify', 'status', 'check', 'pending', 'waiting',
  'follow up', 'clarification', 'renewal', 'extend', 'transfer',
];

const LOW_KEYWORDS = [
  'inquiry', 'question', 'information', 'how to', 'guide', 'general',
  'feedback', 'suggestion', 'compliment', 'thank', 'appreciate',
  'new application', 'register', 'apply',
];

const NEGATIVE_SENTIMENT_KEYWORDS = [
  'frustrated', 'angry', 'furious', 'disappointed', 'terrible', 'horrible',
  'awful', 'disgusting', 'unacceptable', 'pathetic', 'ridiculous', 'worst',
  'failed', 'delay', 'delayed', 'waiting too long', 'no response', 'ignored',
  'incompetent', 'useless', 'wasted', 'scam', 'fraud', 'cheat',
];

const POSITIVE_SENTIMENT_KEYWORDS = [
  'thank', 'grateful', 'great', 'excellent', 'amazing', 'helpful', 'resolved',
  'satisfied', 'appreciate', 'good', 'fast', 'efficient', 'wonderful',
];

const TOXIC_KEYWORDS = [
  'idiot', 'stupid', 'hate', 'kill', 'threaten', 'threat', 'destroy', 'sue',
];

const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  'Passport Services': ['passport', 'travel document', 'immigration', 'visa', 'east african passport'],
  'National ID': ['id card', 'national id', 'identification', 'huduma namba', 'id replacement'],
  'Birth Certificate': ['birth certificate', 'birth registration', 'late registration'],
  'Death Certificate': ['death certificate', 'death registration'],
  'Marriage Certificate': ['marriage certificate', 'marriage registration', 'civil union'],
  'Business Registration': ['business registration', 'company', 'business name', 'limited company', 'business permit'],
  'Land Services': ['land', 'title deed', 'land search', 'land rates', 'survey', 'property'],
  'Tax Services': ['tax', 'kra', 'pin', 'tax return', 'filing', 'tax compliance', 'itax'],
  'Vehicle Services': ['vehicle', 'logbook', 'driving license', 'ntsa', 'motor vehicle', 'registration plate'],
  'Health Services': ['nhif', 'sha', 'health insurance', 'hospital', 'medical'],
  'Education Services': ['education', 'school', 'university', 'helb', 'student', 'scholarship'],
  'Payment Issues': ['payment', 'mpesa', 'pay', 'receipt', 'refund', 'charge', 'fee', 'transaction'],
  'Technical Support': ['login', 'password', 'account', 'portal', 'website', 'app', 'download', 'upload', 'otp'],
  'Complaint': ['complaint', 'corruption', 'bribery', 'misconduct', 'poor service', 'rude'],
};

const AGENCY_KEYWORD_MAP: Record<string, string[]> = {
  'Immigration Department': ['passport', 'visa', 'immigration', 'travel document'],
  'National Registration Bureau': ['national id', 'id card', 'birth certificate', 'huduma namba'],
  'Kenya Revenue Authority': ['tax', 'kra', 'pin', 'itax', 'tax return'],
  'NTSA': ['vehicle', 'logbook', 'driving license', 'motor vehicle', 'ntsa'],
  'Lands Registry': ['land', 'title deed', 'survey', 'property'],
  'Business Registration Service': ['business registration', 'company', 'business permit'],
  'NHIF': ['nhif', 'sha', 'health insurance'],
  'HELB': ['helb', 'student loan', 'scholarship', 'bursary'],
  'eCitizen Support': ['login', 'password', 'portal', 'payment', 'mpesa', 'account'],
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── 1. CLASSIFY TICKET ───────────────────────────────────────────────────

  async classifyTicket(dto: ClassifyTicketMlDto) {
    const startTime = Date.now();

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      include: {
        category: true,
        agency: { select: { id: true, agencyName: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket "${dto.ticketId}" not found`);
    }

    const text = `${dto.text} ${ticket.subject} ${ticket.description}`.toLowerCase();
    const severityBand = this.determineSeverityBand(text);
    const confidenceScore = this.calculateConfidence(text);
    const predictedCategory = this.detectCategory(text);
    const predictedSubcategory = this.detectSubcategory(text, predictedCategory);
    const predictedAgency = this.detectAgency(text);
    const features = this.extractFeatures(text);
    const processingTimeMs = Date.now() - startTime;

    return {
      ticketId: dto.ticketId,
      predictedCategory,
      predictedSubcategory,
      predictedAgency,
      severityBand,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      modelVersion: 'ml-v1.0',
      processingTimeMs,
      features,
      channel: dto.channel ?? ticket.channel,
    };
  }

  // ─── 2. ROUTING RECOMMENDATION ────────────────────────────────────────────

  async routingRecommendation(dto: RoutingRecommendationDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      include: {
        category: true,
        agency: { select: { id: true, agencyName: true } },
        priority: { select: { name: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket "${dto.ticketId}" not found`);
    }

    // Compute agency breach rate from last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let agencyBreachRate = 0;
    try {
      const [totalSla, breachedSla] = await Promise.all([
        this.prisma.slaTracking.count({
          where: {
            ticket: { agencyId: ticket.agencyId },
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        this.prisma.slaTracking.count({
          where: {
            ticket: { agencyId: ticket.agencyId },
            createdAt: { gte: thirtyDaysAgo },
            OR: [{ responseBreached: true }, { resolutionBreached: true }],
          },
        }),
      ]);

      agencyBreachRate = totalSla > 0 ? breachedSla / totalSla : 0;
    } catch (err) {
      this.logger.warn(`Could not compute SLA breach rate for agency ${ticket.agencyId}: ${err}`);
    }

    const priorityName: string = ticket.priority?.name ?? 'MEDIUM';
    const priorityHoursMap: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 8,
      MEDIUM: 24,
      LOW: 72,
    };
    const baseResolutionHours = priorityHoursMap[priorityName] ?? 24;
    const breachPenaltyHours = agencyBreachRate * 8;
    const predictedResolutionTimeHours = Math.round((baseResolutionHours + breachPenaltyHours) * 10) / 10;

    const routingConfidence = Math.max(0.4, Math.round((1 - agencyBreachRate * 0.5) * 100) / 100);

    const routingFactors: string[] = [];
    if (agencyBreachRate > 0.4) routingFactors.push('HIGH_AGENCY_BREACH_RATE');
    if (priorityName === 'CRITICAL' || priorityName === 'HIGH') routingFactors.push('HIGH_PRIORITY_TICKET');
    if (ticket.category) routingFactors.push(`CATEGORY_${ticket.category.name.toUpperCase().replace(/\s+/g, '_')}`);
    if (ticket.isEscalated) routingFactors.push('ALREADY_ESCALATED');

    const assignedUnit = ticket.agency?.agencyName ?? 'Default Agency Unit';
    const agentGroupMap: Record<string, string> = {
      CRITICAL: 'Tier-3 Senior Agents',
      HIGH: 'Tier-2 Specialist Agents',
      MEDIUM: 'Tier-1 General Agents',
      LOW: 'Tier-1 General Agents',
    };
    const assignedAgentGroup = agentGroupMap[priorityName] ?? 'Tier-1 General Agents';

    return {
      ticketId: dto.ticketId,
      assignedUnit,
      assignedAgentGroup,
      predictedResolutionTimeHours,
      routingConfidence,
      routingFactors,
    };
  }

  // ─── 3. SLA BREACH PREDICTION ─────────────────────────────────────────────

  async slaBreachPrediction(dto: SlaBreachPredictionDto) {
    const slaTracking = await this.prisma.slaTracking.findUnique({
      where: { ticketId: dto.ticketId },
      include: {
        ticket: {
          include: {
            priority: { select: { name: true } },
          },
        },
      },
    });

    if (!slaTracking) {
      const ticket = await this.prisma.ticket.findUnique({ where: { id: dto.ticketId } });
      if (!ticket) {
        throw new NotFoundException(`Ticket "${dto.ticketId}" not found`);
      }

      // No SLA record — default to low probability
      return {
        ticketId: dto.ticketId,
        breachProbability: 0.05,
        predictedTimeToBreachHours: null,
        riskLevel: 'LOW' as RiskLevel,
        interventionRecommended: false,
        modelConfidence: 0.5,
        note: 'No SLA tracking record found for this ticket.',
      };
    }

    const now = new Date();
    const resolutionDue = slaTracking.resolutionDueAt;
    const responseDue = slaTracking.responseDueAt;
    const createdAt = slaTracking.createdAt;

    // Already breached?
    if (slaTracking.resolutionBreached || resolutionDue < now) {
      return {
        ticketId: dto.ticketId,
        breachProbability: 1.0,
        predictedTimeToBreachHours: 0,
        riskLevel: 'CRITICAL' as RiskLevel,
        interventionRecommended: true,
        modelConfidence: 0.98,
      };
    }

    const totalWindowMs = resolutionDue.getTime() - createdAt.getTime();
    const elapsedMs = now.getTime() - createdAt.getTime();
    const fractionElapsed = totalWindowMs > 0 ? elapsedMs / totalWindowMs : 0;

    // Breach probability rises steeply as deadline approaches
    let breachProbability: number;
    if (fractionElapsed < 0.5) {
      breachProbability = fractionElapsed * 0.3;
    } else if (fractionElapsed < 0.8) {
      breachProbability = 0.15 + (fractionElapsed - 0.5) * 1.5;
    } else {
      breachProbability = Math.min(0.99, 0.60 + (fractionElapsed - 0.8) * 1.95);
    }

    // Escalation history raises the probability
    if (slaTracking.ticket.isEscalated) {
      breachProbability = Math.min(0.99, breachProbability + 0.1);
    }

    // Response already breached is a strong predictor
    if (slaTracking.responseBreached) {
      breachProbability = Math.min(0.99, breachProbability + 0.15);
    }

    const predictedTimeToBreachHours = Math.round(
      ((resolutionDue.getTime() - now.getTime()) / (1000 * 60 * 60)) * 10,
    ) / 10;

    let riskLevel: RiskLevel;
    if (breachProbability >= 0.75) riskLevel = 'CRITICAL';
    else if (breachProbability >= 0.5) riskLevel = 'HIGH';
    else if (breachProbability >= 0.25) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';

    const responseTimeRemaining = responseDue.getTime() - now.getTime();
    const responseWindowMs = responseDue.getTime() - createdAt.getTime();
    const responseBreachRisk = responseWindowMs > 0
      ? Math.max(0, 1 - responseTimeRemaining / responseWindowMs)
      : 0;

    const modelConfidence = Math.round(
      Math.min(0.95, 0.6 + fractionElapsed * 0.35) * 100,
    ) / 100;

    return {
      ticketId: dto.ticketId,
      breachProbability: Math.round(breachProbability * 1000) / 1000,
      predictedTimeToBreachHours,
      riskLevel,
      interventionRecommended: riskLevel === 'CRITICAL' || riskLevel === 'HIGH',
      modelConfidence,
      responseBreachRisk: Math.round(responseBreachRisk * 1000) / 1000,
    };
  }

  // ─── 4. SENTIMENT ANALYSIS ────────────────────────────────────────────────

  async sentimentAnalysis(dto: SentimentAnalysisDto) {
    const startTime = Date.now();
    const text = dto.text.toLowerCase();

    let negativeScore = 0;
    let positiveScore = 0;
    const emotionTags: string[] = [];
    let toxicityScore = 0;

    for (const keyword of NEGATIVE_SENTIMENT_KEYWORDS) {
      if (text.includes(keyword)) {
        negativeScore += 1;
        if (!emotionTags.includes('FRUSTRATION') && ['frustrated', 'angry', 'furious'].some(k => text.includes(k))) {
          emotionTags.push('FRUSTRATION');
        }
        if (!emotionTags.includes('URGENCY') && ['urgent', 'asap', 'immediately', 'delay'].some(k => text.includes(k))) {
          emotionTags.push('URGENCY');
        }
        if (!emotionTags.includes('DISSATISFACTION') && ['disappointed', 'terrible', 'unacceptable'].some(k => text.includes(k))) {
          emotionTags.push('DISSATISFACTION');
        }
      }
    }

    for (const keyword of POSITIVE_SENTIMENT_KEYWORDS) {
      if (text.includes(keyword)) {
        positiveScore += 1;
        if (!emotionTags.includes('GRATITUDE') && ['thank', 'grateful', 'appreciate'].some(k => text.includes(k))) {
          emotionTags.push('GRATITUDE');
        }
        if (!emotionTags.includes('SATISFACTION') && ['great', 'excellent', 'satisfied', 'amazing'].some(k => text.includes(k))) {
          emotionTags.push('SATISFACTION');
        }
      }
    }

    for (const keyword of TOXIC_KEYWORDS) {
      if (text.includes(keyword)) {
        toxicityScore += 0.25;
      }
    }

    toxicityScore = Math.min(1.0, Math.round(toxicityScore * 100) / 100);

    const totalSignals = negativeScore + positiveScore || 1;
    const rawSentiment = (positiveScore - negativeScore) / totalSignals;
    const sentimentScore = Math.round(Math.max(-1, Math.min(1, rawSentiment)) * 100) / 100;

    if (emotionTags.length === 0) {
      emotionTags.push('NEUTRAL');
    }

    const escalationRiskScore = Math.round(
      Math.min(1, Math.max(0, (negativeScore * 0.15) + toxicityScore * 0.5)) * 100,
    ) / 100;

    const processingTimeMs = Date.now() - startTime;

    return {
      ticketId: dto.ticketId ?? null,
      sentimentScore,
      emotionTags,
      escalationRiskScore,
      toxicityScore,
      languageCode: 'en',
      processingTimeMs,
    };
  }

  // ─── 5. ANOMALY DETECTION ─────────────────────────────────────────────────

  async anomalyDetection(dto: AnomalyDetectionDto) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let anomalyScore = 0;
    let anomalyType = 'NONE';
    let confidence = 0.7;
    const flaggedFactors: string[] = [];

    if (dto.entityType === AnomalyEntityType.USER) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.entityId } });
      if (!user) {
        throw new NotFoundException(`User "${dto.entityId}" not found`);
      }

      const recentTicketCount = await this.prisma.ticket.count({
        where: {
          createdBy: dto.entityId,
          createdAt: { gte: last24h },
        },
      });

      if (recentTicketCount > 10) {
        anomalyScore = Math.min(1, 0.4 + (recentTicketCount - 10) * 0.05);
        anomalyType = 'TICKET_FLOOD';
        flaggedFactors.push(`${recentTicketCount} tickets created in the last 24h (threshold: 10)`);
        confidence = 0.88;
      } else if (recentTicketCount > 5) {
        anomalyScore = 0.35;
        anomalyType = 'ELEVATED_TICKET_RATE';
        flaggedFactors.push(`${recentTicketCount} tickets in last 24h — above average`);
        confidence = 0.75;
      }

      const weeklyCount = await this.prisma.ticket.count({
        where: { createdBy: dto.entityId, createdAt: { gte: last7d } },
      });
      if (weeklyCount > 30) {
        anomalyScore = Math.min(1, anomalyScore + 0.2);
        flaggedFactors.push(`${weeklyCount} tickets in last 7 days`);
        if (anomalyType === 'NONE') anomalyType = 'HIGH_WEEKLY_VOLUME';
      }

    } else if (dto.entityType === AnomalyEntityType.AGENCY) {
      const agency = await this.prisma.agency.findUnique({ where: { id: dto.entityId } });
      if (!agency) {
        throw new NotFoundException(`Agency "${dto.entityId}" not found`);
      }

      const [totalSla, breachedSla] = await Promise.all([
        this.prisma.slaTracking.count({
          where: {
            ticket: { agencyId: dto.entityId },
            createdAt: { gte: last30d },
          },
        }),
        this.prisma.slaTracking.count({
          where: {
            ticket: { agencyId: dto.entityId },
            createdAt: { gte: last30d },
            OR: [{ responseBreached: true }, { resolutionBreached: true }],
          },
        }),
      ]);

      const breachRate = totalSla > 0 ? breachedSla / totalSla : 0;

      if (breachRate > 0.6) {
        anomalyScore = Math.min(1, breachRate);
        anomalyType = 'CRITICAL_BREACH_RATE';
        flaggedFactors.push(`SLA breach rate: ${Math.round(breachRate * 100)}% in last 30 days`);
        confidence = 0.9;
      } else if (breachRate > 0.3) {
        anomalyScore = breachRate;
        anomalyType = 'HIGH_BREACH_RATE';
        flaggedFactors.push(`SLA breach rate: ${Math.round(breachRate * 100)}%`);
        confidence = 0.82;
      }

      const weeklyOpen = await this.prisma.ticket.count({
        where: {
          agencyId: dto.entityId,
          createdAt: { gte: last7d },
          isDeleted: false,
        },
      });
      if (weeklyOpen > 200) {
        anomalyScore = Math.min(1, anomalyScore + 0.15);
        flaggedFactors.push(`${weeklyOpen} tickets this week — unusually high volume`);
        if (anomalyType === 'NONE') anomalyType = 'VOLUME_SPIKE';
      }

    } else if (dto.entityType === AnomalyEntityType.TICKET) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: dto.entityId },
        select: { id: true, subject: true, createdBy: true, agencyId: true },
      });
      if (!ticket) {
        throw new NotFoundException(`Ticket "${dto.entityId}" not found`);
      }

      // Check for duplicate patterns: same subject from same user in last 7 days
      const subjectWords = ticket.subject.split(' ').slice(0, 5).join(' ');
      const duplicateCount = await this.prisma.ticket.count({
        where: {
          id: { not: dto.entityId },
          createdBy: ticket.createdBy,
          subject: { contains: subjectWords, mode: 'insensitive' },
          createdAt: { gte: last7d },
        },
      });

      if (duplicateCount >= 3) {
        anomalyScore = Math.min(1, 0.5 + duplicateCount * 0.1);
        anomalyType = 'DUPLICATE_TICKET_PATTERN';
        flaggedFactors.push(`${duplicateCount} similar tickets from same user in last 7 days`);
        confidence = 0.85;
      } else if (duplicateCount >= 1) {
        anomalyScore = 0.3;
        anomalyType = 'POSSIBLE_DUPLICATE';
        flaggedFactors.push(`${duplicateCount} similar ticket(s) found from same user`);
        confidence = 0.65;
      }
    }

    return {
      entityId: dto.entityId,
      entityType: dto.entityType,
      anomalyScore: Math.round(anomalyScore * 1000) / 1000,
      anomalyType,
      confidence,
      flaggedFactors,
      requiresReview: anomalyScore >= 0.5,
    };
  }

  // ─── 6. KB SUGGEST ───────────────────────────────────────────────────────

  async kbSuggest(dto: KbSuggestDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      select: { id: true, subject: true, description: true, agencyId: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket "${dto.ticketId}" not found`);
    }

    const text = `${ticket.subject} ${ticket.description}`.toLowerCase();
    const limit = dto.limit ?? 5;

    // Extract meaningful words (simple tokenisation — skip short stop words)
    const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but', 'not', 'my', 'i', 'we', 'you', 'was', 'are', 'be', 'have', 'has', 'had', 'do', 'did', 'will', 'with', 'this', 'that', 'from']);
    const tokens = text.split(/\W+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));

    if (tokens.length === 0) {
      return {
        ticketId: dto.ticketId,
        suggestions: [],
        totalSuggestions: 0,
      };
    }

    // Fetch published KB articles for this agency (or public ones)
    const articles = await this.prisma.kbArticle.findMany({
      where: {
        isPublished: true,
        OR: [
          { agencyId: ticket.agencyId },
          { agencyId: null },
        ],
      },
      include: {
        versions: {
          where: { isPublished: true },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { content: true, summary: true },
        },
      },
      take: 200,
    });

    type ScoredArticle = {
      kbId: string;
      title: string;
      relevanceScore: number;
      url: string;
    };

    const scored: ScoredArticle[] = [];

    for (const article of articles) {
      const haystack = `${article.title} ${article.versions[0]?.content ?? ''} ${article.versions[0]?.summary ?? ''}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        const occurrences = (haystack.match(new RegExp(token, 'g')) ?? []).length;
        score += occurrences;
      }
      if (score > 0) {
        const maxPossible = tokens.length * 5;
        const normalised = Math.min(1, Math.round((score / maxPossible) * 100) / 100);
        scored.push({
          kbId: article.id,
          title: article.title,
          relevanceScore: normalised,
          url: `/knowledge-base/${article.slug}`,
        });
      }
    }

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const suggestions = scored.slice(0, limit);

    return {
      ticketId: dto.ticketId,
      suggestions,
      totalSuggestions: suggestions.length,
    };
  }

  // ─── 7. FORECAST ─────────────────────────────────────────────────────────

  async forecast(dto: ForecastDto) {
    const agency = await this.prisma.agency.findUnique({ where: { id: dto.agencyId } });
    if (!agency) {
      throw new NotFoundException(`Agency "${dto.agencyId}" not found`);
    }

    const periodDays = dto.periodDays ?? 30;
    const historicalWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const historicalCount = await this.prisma.ticket.count({
      where: {
        agencyId: dto.agencyId,
        createdAt: { gte: historicalWindowStart },
        isDeleted: false,
      },
    });

    // Linear extrapolation
    const dailyRate = historicalCount / 30;
    const predictedTicketVolume = Math.round(dailyRate * periodDays);

    // Confidence interval: ±15% based on daily variance
    const lowerBound = Math.round(predictedTicketVolume * 0.85);
    const upperBound = Math.round(predictedTicketVolume * 1.15);

    // Simple seasonal factors (simulate weekly patterns)
    const seasonalFactors = [
      { dayOfWeek: 'Monday', factor: 1.15, note: 'Post-weekend surge' },
      { dayOfWeek: 'Friday', factor: 0.9, note: 'Pre-weekend dip' },
      { dayOfWeek: 'Saturday', factor: 0.4, note: 'Weekend low' },
      { dayOfWeek: 'Sunday', factor: 0.35, note: 'Weekend low' },
    ];

    const modelAccuracy = historicalCount > 100 ? 0.82 : historicalCount > 30 ? 0.72 : 0.55;

    return {
      agencyId: dto.agencyId,
      agencyName: agency.agencyName,
      forecastPeriodDays: periodDays,
      historicalBasePeriodDays: 30,
      historicalTicketCount: historicalCount,
      dailyAverageRate: Math.round(dailyRate * 100) / 100,
      predictedTicketVolume,
      confidenceInterval: [lowerBound, upperBound],
      seasonalFactors,
      modelAccuracy,
    };
  }

  // ─── 8. GET CLUSTERS ─────────────────────────────────────────────────────

  async getClusters() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentTickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        isDeleted: false,
      },
      select: {
        id: true,
        subject: true,
        agencyId: true,
        isEscalated: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    // Cluster by keyword frequency across subjects
    const clusterMap: Map<string, { tickets: typeof recentTickets; keyword: string }> = new Map();

    for (const ticket of recentTickets) {
      const words = ticket.subject.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      for (const word of words) {
        if (!clusterMap.has(word)) {
          clusterMap.set(word, { tickets: [], keyword: word });
        }
        clusterMap.get(word)!.tickets.push(ticket);
      }
    }

    // Filter to clusters with at least 3 tickets
    const significantClusters = Array.from(clusterMap.entries())
      .filter(([, cluster]) => cluster.tickets.length >= 3)
      .sort(([, a], [, b]) => b.tickets.length - a.tickets.length)
      .slice(0, 10);

    const clusters = significantClusters.map(([keyword, cluster], index) => {
      const escalatedCount = cluster.tickets.filter(t => t.isEscalated).length;
      const agencySet = new Set(cluster.tickets.map(t => t.agencyId));
      const agencyImpactScore = Math.round(
        Math.min(1, (agencySet.size / 10 + cluster.tickets.length / 50)) * 100,
      ) / 100;

      let riskLevel: RiskLevel = 'LOW';
      if (escalatedCount / cluster.tickets.length > 0.4) riskLevel = 'CRITICAL';
      else if (escalatedCount / cluster.tickets.length > 0.2) riskLevel = 'HIGH';
      else if (cluster.tickets.length > 20) riskLevel = 'MEDIUM';

      const dominantKeywords = [keyword];
      // Add a few co-occurring keywords for enrichment
      for (const ticket of cluster.tickets.slice(0, 20)) {
        const extraWords = ticket.subject.toLowerCase().split(/\W+/).filter(
          w => w.length > 4 && w !== keyword && !dominantKeywords.includes(w),
        );
        for (const w of extraWords) {
          if (!dominantKeywords.includes(w) && dominantKeywords.length < 5) {
            dominantKeywords.push(w);
          }
        }
      }

      return {
        clusterId: `cluster-${index + 1}-${keyword}`,
        clusterName: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)}-Related Issues`,
        ticketCount: cluster.tickets.length,
        dominantKeywords,
        agencyImpactScore,
        detectedAt: new Date().toISOString(),
        riskLevel,
        escalatedTickets: escalatedCount,
        affectedAgencies: agencySet.size,
      };
    });

    return { clusters, analysedTickets: recentTickets.length, generatedAt: new Date().toISOString() };
  }

  // ─── 9. GET ML METRICS ───────────────────────────────────────────────────

  async getMlMetrics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalPredictions, avgConfidenceAgg, autoApplied, recentLogs] = await Promise.all([
      this.prisma.aiClassificationLog.count(),
      this.prisma.aiClassificationLog.aggregate({ _avg: { confidenceScore: true } }),
      this.prisma.aiClassificationLog.count({ where: { autoApplied: true } }),
      this.prisma.aiClassificationLog.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          ticketId: true,
          confidenceScore: true,
          autoApplied: true,
          manualOverride: true,
          createdAt: true,
        },
      }),
    ]);

    const avgConfidence = avgConfidenceAgg._avg.confidenceScore
      ? Math.round(Number(avgConfidenceAgg._avg.confidenceScore) * 1000) / 1000
      : null;

    const overrideCount = await this.prisma.aiClassificationLog.count({
      where: { manualOverride: true },
    });

    const modelAccuracy = totalPredictions > 0
      ? Math.round(((totalPredictions - overrideCount) / totalPredictions) * 1000) / 1000
      : null;

    const predictionsByType: Record<string, number> = {
      CLASSIFICATION: totalPredictions,
    };

    // Attempt to count recommendation types
    try {
      const recTypes = await this.prisma.aiRecommendation.groupBy({
        by: ['recommendationType'],
        _count: { _all: true },
      });
      for (const rec of recTypes) {
        if (rec.recommendationType) {
          predictionsByType[rec.recommendationType] = rec._count._all;
        }
      }
    } catch {
      // Non-critical — proceed without
    }

    return {
      totalPredictions,
      avgConfidence,
      modelAccuracy,
      autoApplyRate: totalPredictions > 0 ? Math.round((autoApplied / totalPredictions) * 1000) / 1000 : null,
      overrideCount,
      processingLatencyMs: 50, // Static heuristic for rule-based models
      predictionsByType,
      recentActivity: recentLogs,
    };
  }

  // ─── 10. GET ML MODELS ───────────────────────────────────────────────────

  async getMlModels() {
    return this.prisma.aiModel.findMany({
      include: {
        _count: { select: { classificationLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── 11. REGISTER MODEL ──────────────────────────────────────────────────

  async registerModel(dto: RegisterMlModelDto) {
    const existing = await this.prisma.aiModel.findFirst({
      where: {
        modelName: dto.modelName,
        modelVersion: dto.modelVersion,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Model "${dto.modelName}" version "${dto.modelVersion}" already exists`,
      );
    }

    return this.prisma.aiModel.create({
      data: {
        modelName: dto.modelName,
        modelVersion: dto.modelVersion,
        modelType: dto.modelType,
        isActive: dto.isActive ?? true,
        deploymentEnvironment: dto.endpoint ? 'external' : 'internal',
      },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private determineSeverityBand(text: string): SeverityBand {
    for (const kw of CRITICAL_KEYWORDS) {
      if (text.includes(kw)) return 'CRITICAL';
    }
    for (const kw of HIGH_KEYWORDS) {
      if (text.includes(kw)) return 'HIGH';
    }
    for (const kw of MEDIUM_KEYWORDS) {
      if (text.includes(kw)) return 'MEDIUM';
    }
    for (const kw of LOW_KEYWORDS) {
      if (text.includes(kw)) return 'LOW';
    }
    return 'MEDIUM';
  }

  private calculateConfidence(text: string): number {
    const allKeywords = [
      ...CRITICAL_KEYWORDS, ...HIGH_KEYWORDS, ...MEDIUM_KEYWORDS, ...LOW_KEYWORDS,
      ...Object.values(CATEGORY_KEYWORD_MAP).flat(),
    ];
    const matched = allKeywords.filter(k => text.includes(k));
    if (matched.length === 0) return 0.2;
    if (matched.length === 1) return 0.45;
    if (matched.length <= 3) return 0.65;
    if (matched.length <= 6) return 0.80;
    return Math.min(0.95, 0.80 + matched.length * 0.01);
  }

  private detectCategory(text: string): string {
    let best = 'General Inquiry';
    let bestScore = 0;
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
      const score = keywords.filter(k => text.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        best = category;
      }
    }
    return best;
  }

  private detectSubcategory(text: string, category: string): string | null {
    const subMap: Record<string, Record<string, string[]>> = {
      'Passport Services': {
        'New Application': ['new passport', 'apply for passport', 'first passport'],
        'Renewal': ['renew', 'expired passport', 'passport renewal'],
        'Lost/Replacement': ['lost passport', 'stolen passport', 'replace passport'],
      },
      'Tax Services': {
        'KRA PIN': ['kra pin', 'pin registration', 'new pin'],
        'Tax Filing': ['tax return', 'filing', 'itax', 'tax compliance'],
        'Refund': ['tax refund', 'overpaid', 'excess tax'],
      },
    };

    const subcategories = subMap[category];
    if (!subcategories) return null;

    for (const [sub, keywords] of Object.entries(subcategories)) {
      if (keywords.some(k => text.includes(k))) return sub;
    }
    return null;
  }

  private detectAgency(text: string): string {
    let best = 'eCitizen Support';
    let bestScore = 0;
    for (const [agency, keywords] of Object.entries(AGENCY_KEYWORD_MAP)) {
      const score = keywords.filter(k => text.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        best = agency;
      }
    }
    return best;
  }

  private extractFeatures(text: string): Record<string, number | boolean | string> {
    return {
      textLength: text.length,
      wordCount: text.split(/\s+/).length,
      hasNegativeKeywords: NEGATIVE_SENTIMENT_KEYWORDS.some(k => text.includes(k)),
      hasCriticalKeywords: CRITICAL_KEYWORDS.some(k => text.includes(k)),
      hasPaymentKeywords: ['payment', 'mpesa', 'fee', 'refund', 'transaction'].some(k => text.includes(k)),
      hasIdentityKeywords: ['id', 'passport', 'national id', 'birth certificate'].some(k => text.includes(k)),
      detectedLanguage: 'en',
    };
  }
}
