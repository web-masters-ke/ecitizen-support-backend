import { PrismaClient, OnboardingStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'agency-update-data.json'), 'utf-8'),
  ) as Array<{
    agencyCode: string;
    agencyName: string;
    servicesIdentified: number | null;
    servicesLive: number | null;
    onboardingStatus: string;
    onboardingRemarks: string | null;
  }>;

  let updated = 0;
  let notFound = 0;

  for (const rec of data) {
    const agency = await prisma.agency.findUnique({ where: { agencyCode: rec.agencyCode } });
    if (!agency) {
      console.warn(`  ⚠ Not found: ${rec.agencyCode}`);
      notFound++;
      continue;
    }

    await prisma.agency.update({
      where: { agencyCode: rec.agencyCode },
      data: {
        servicesIdentified: rec.servicesIdentified,
        servicesLive: rec.servicesLive,
        onboardingStatus: rec.onboardingStatus as OnboardingStatus,
        onboardingRemarks: rec.onboardingRemarks,
      },
    });
    updated++;
  }

  console.log(`\n✅ Done — ${updated} updated, ${notFound} not found`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
