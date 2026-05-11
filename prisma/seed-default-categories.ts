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
}

main()
  .catch((err) => {
    console.error('❌ seed-default-categories failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
