/**
 * Backfill `SlaTracking` rows for tickets that pre-date their agency's
 * SLA policy.
 *
 * Why: SLA tracking is created when a ticket is created, *only if* the
 * agency has an active SlaPolicy with a rule matching the ticket's
 * priority/category at that moment. Tickets created before the policy
 * existed never get a tracking row, so the ticket-detail SLA panel
 * shows "Due —" forever, the breach checker skips them, and reports
 * understate compliance counts.
 *
 * This script scans every non-deleted ticket without an SlaTracking
 * row, finds the agency's current active policy + best-matching rule,
 * computes due dates from `ticket.createdAt + rule.minutes` (plain
 * calendar time — business-hours math is not replicated here; for
 * historical tickets the deadlines are usually already in the past
 * anyway, so the breach detector will just flag them on its next
 * sweep), then inserts the tracking row and patches
 * `ticket.slaResponseDueAt` / `slaResolutionDueAt` to match.
 *
 * Idempotent. Safe to re-run.
 *
 * Run:  npx ts-node prisma/backfill-sla-tracking.ts
 *       npx ts-node prisma/backfill-sla-tracking.ts --agency <agencyId>   (scope to one agency)
 *       npx ts-node prisma/backfill-sla-tracking.ts --dry-run             (report-only, no writes)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SlaRuleLite {
  id: string;
  priorityId: string | null;
  categoryId: string | null;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
}

function findBestMatchingRule(
  rules: SlaRuleLite[],
  priorityId: string | null,
  categoryId: string | null,
): SlaRuleLite | undefined {
  // Same precedence as sla.service.ts findBestMatchingRule: exact >
  // priority-only > category-only > catch-all.
  return (
    rules.find((r) => r.priorityId === priorityId && r.categoryId === categoryId) ||
    rules.find((r) => r.priorityId === priorityId && r.categoryId === null) ||
    rules.find((r) => r.categoryId === categoryId && r.priorityId === null) ||
    rules.find((r) => r.priorityId === null && r.categoryId === null)
  );
}

async function main() {
  const args = process.argv.slice(2);
  const agencyArgIdx = args.indexOf('--agency');
  const onlyAgencyId = agencyArgIdx >= 0 ? args[agencyArgIdx + 1] : null;
  const dryRun = args.includes('--dry-run');

  console.log(
    `[sla-backfill] starting${onlyAgencyId ? ` (agency=${onlyAgencyId})` : ''}${dryRun ? ' [DRY RUN]' : ''}`,
  );

  // Cache policies + rules per agency so we don't refetch for every ticket.
  const policyCache = new Map<
    string,
    { policyId: string; rules: SlaRuleLite[] } | null
  >();

  const loadPolicy = async (agencyId: string) => {
    if (policyCache.has(agencyId)) return policyCache.get(agencyId)!;
    const policy = await prisma.slaPolicy.findFirst({
      where: { agencyId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slaRules: {
          select: {
            id: true,
            priorityId: true,
            categoryId: true,
            responseTimeMinutes: true,
            resolutionTimeMinutes: true,
          },
        },
      },
    });
    const value = policy && policy.slaRules.length
      ? { policyId: policy.id, rules: policy.slaRules as SlaRuleLite[] }
      : null;
    policyCache.set(agencyId, value);
    return value;
  };

  let scanned = 0;
  let created = 0;
  let skippedNoPolicy = 0;
  let skippedNoRule = 0;
  const skippedAgencies = new Set<string>();

  const BATCH = 500;
  let cursor: string | undefined;

  while (true) {
    const batch = await prisma.ticket.findMany({
      where: {
        isDeleted: false,
        slaTracking: null,
        ...(onlyAgencyId ? { agencyId: onlyAgencyId } : {}),
      },
      select: {
        id: true,
        agencyId: true,
        priorityId: true,
        categoryId: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (batch.length === 0) break;

    for (const ticket of batch) {
      scanned += 1;
      const policy = await loadPolicy(ticket.agencyId);
      if (!policy) {
        skippedNoPolicy += 1;
        skippedAgencies.add(ticket.agencyId);
        continue;
      }
      const rule = findBestMatchingRule(
        policy.rules,
        ticket.priorityId,
        ticket.categoryId,
      );
      if (!rule) {
        skippedNoRule += 1;
        continue;
      }

      const responseDueAt = new Date(
        ticket.createdAt.getTime() + rule.responseTimeMinutes * 60_000,
      );
      const resolutionDueAt = new Date(
        ticket.createdAt.getTime() + rule.resolutionTimeMinutes * 60_000,
      );

      if (dryRun) {
        created += 1;
        continue;
      }

      // Belt and braces: createMany would 23505 if a tracking row was added
      // by the live service between the findMany() and now. Tolerate that.
      try {
        await prisma.$transaction([
          prisma.slaTracking.create({
            data: {
              ticketId: ticket.id,
              slaPolicyId: policy.policyId,
              responseDueAt,
              resolutionDueAt,
            },
          }),
          prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              slaResponseDueAt: responseDueAt,
              slaResolutionDueAt: resolutionDueAt,
            },
          }),
        ]);
        created += 1;
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'P2002') continue; // unique violation — already exists
        throw err;
      }
    }

    cursor = batch[batch.length - 1].id;
    console.log(
      `[sla-backfill] scanned=${scanned} created=${created} skippedNoPolicy=${skippedNoPolicy} skippedNoRule=${skippedNoRule}`,
    );
  }

  console.log('');
  console.log('[sla-backfill] done.');
  console.log(`  tickets scanned:       ${scanned}`);
  console.log(`  tracking rows created: ${created}${dryRun ? ' (dry run — not written)' : ''}`);
  console.log(`  skipped (no policy):   ${skippedNoPolicy}`);
  console.log(`  skipped (no rule):     ${skippedNoRule}`);
  if (skippedAgencies.size && skippedAgencies.size <= 20) {
    console.log('  agencies without an active SLA policy:');
    for (const a of skippedAgencies) console.log(`    - ${a}`);
  } else if (skippedAgencies.size) {
    console.log(`  ${skippedAgencies.size} agencies are missing an active SLA policy.`);
  }
}

main()
  .catch((err) => {
    console.error('[sla-backfill] failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
