/**
 * Backfill default ticket categories for any agency that has zero.
 *
 * The original seed (seed.ts) only attaches categories to a handful of named
 * agencies (NTSA, NHIF, NSSF, etc.). The 583 agencies loaded from the
 * onboarding report have no categories — so the citizen Submit Ticket page
 * and the admin Escalate modal both show empty category dropdowns.
 *
 * This script is idempotent. It runs on every pod start as part of
 * docker-entrypoint.sh and only inserts categories for agencies that
 * currently have none.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES: Array<{ name: string; description: string }> = [
  { name: 'General Inquiry', description: 'General questions about agency services' },
  { name: 'Service Request', description: 'Request for a specific government service' },
  { name: 'Application Status', description: 'Follow-up on the status of an existing application' },
  { name: 'Document Request', description: 'Request for certificates, letters or copies of documents' },
  { name: 'Payment & Billing', description: 'Payment issues, receipts and refunds' },
  { name: 'Complaint', description: 'Formal complaint about service quality or conduct' },
  { name: 'Technical Issue', description: 'Problems with the eCitizen platform or agency portal' },
  { name: 'Other', description: 'Anything not covered by the categories above' },
];

// POC scope — the eCitizen-themed routing agency (the one citizens land
// on when they don't pick an agency on the public report form) gets
// these three categories on top of the defaults. Matches the live notes
// in docs/SYSTEM_PRESENTATION_TO_CLIENT.md §2.2.
const ECITIZEN_POC_CATEGORIES: Array<{ name: string; description: string }> = [
  { name: 'eCitizen Account', description: 'Phone number change, email change, password / SSO issues, account lockouts' },
  { name: 'eCitizen Payment', description: 'Failed payments, missing receipts, refunds, double charges' },
  { name: 'General Inquiry', description: 'Where do I find service X, link guidance, general guidance' },
];

async function main() {
  const agencies = await prisma.agency.findMany({
    where: { isActive: true },
    select: {
      id: true,
      agencyName: true,
      _count: { select: { ticketCategories: true } },
    },
  });

  const agenciesMissingCategories = agencies.filter((a) => a._count.ticketCategories === 0);

  console.log(
    `Found ${agenciesMissingCategories.length} active agencies with no ticket categories (of ${agencies.length} total)`,
  );

  if (agenciesMissingCategories.length === 0) {
    console.log('✅ Nothing to backfill — every active agency already has categories.');
    return;
  }

  let inserted = 0;
  for (const agency of agenciesMissingCategories) {
    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.ticketCategory.create({
        data: {
          agencyId: agency.id,
          name: cat.name,
          description: cat.description,
          isActive: true,
        },
      });
      inserted += 1;
    }
  }

  console.log(
    `✅ Inserted ${inserted} default category rows across ${agenciesMissingCategories.length} agencies`,
  );

  // Ensure the eCitizen routing agency has the three POC categories from
  // the client walkthrough notes, idempotently. We look for an agency
  // tagged with the routing code (env-driven; defaults to ECITIZEN) and
  // upsert each category by (agencyId, name).
  const routingCode = process.env.DEFAULT_ROUTING_AGENCY_CODE || 'ECITIZEN';
  const routingAgency = await prisma.agency.findFirst({
    where: { agencyCode: routingCode, isActive: true },
    select: { id: true, agencyName: true },
  });
  if (!routingAgency) {
    console.log(
      `ℹ️  No agency with code "${routingCode}" found — skipping POC category seed. ` +
        `Create that agency to make /report-issue route unassigned tickets to it.`,
    );
    return;
  }
  let pocInserted = 0;
  for (const cat of ECITIZEN_POC_CATEGORIES) {
    const existing = await prisma.ticketCategory.findFirst({
      where: { agencyId: routingAgency.id, name: cat.name },
    });
    if (existing) continue;
    await prisma.ticketCategory.create({
      data: {
        agencyId: routingAgency.id,
        name: cat.name,
        description: cat.description,
        isActive: true,
      },
    });
    pocInserted += 1;
  }
  if (pocInserted > 0) {
    console.log(
      `✅ Seeded ${pocInserted} POC categories on ${routingAgency.agencyName} (${routingCode})`,
    );
  } else {
    console.log(`✅ POC categories already present on ${routingAgency.agencyName}`);
  }
}

main()
  .catch((err) => {
    console.error('❌ seed-default-categories failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
