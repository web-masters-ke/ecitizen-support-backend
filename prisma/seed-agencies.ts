import { PrismaClient, AgencyType, OnboardingStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface AgencyRow {
  agencyCode: string;
  agencyName: string;
  agencyType: string;
  ministryName: string | null;
  stateDepartment: string | null;
  servicesIdentified: number | null;
  servicesLive: number | null;
  onboardingStatus: string;
  onboardingRemarks: string | null;
  isActive: boolean;
}

async function main() {
  const dataPath = path.join(__dirname, 'agencies-data.json');
  const agencies: AgencyRow[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  console.log(`🌱 Seeding ${agencies.length} eCitizen Kenya agencies...`);

  let count = 0;
  for (const a of agencies) {
    await prisma.agency.upsert({
      where: { agencyCode: a.agencyCode },
      create: {
        agencyCode: a.agencyCode,
        agencyName: a.agencyName,
        agencyType: a.agencyType as AgencyType,
        ministryName: a.ministryName,
        stateDepartment: a.stateDepartment,
        servicesIdentified: a.servicesIdentified,
        servicesLive: a.servicesLive,
        onboardingStatus: a.onboardingStatus as OnboardingStatus,
        onboardingRemarks: a.onboardingRemarks,
        isActive: a.isActive,
      },
      update: {
        agencyName: a.agencyName,
        agencyType: a.agencyType as AgencyType,
        ministryName: a.ministryName,
        stateDepartment: a.stateDepartment,
        servicesIdentified: a.servicesIdentified,
        servicesLive: a.servicesLive,
        onboardingStatus: a.onboardingStatus as OnboardingStatus,
        onboardingRemarks: a.onboardingRemarks,
        isActive: a.isActive,
      },
    });
    count++;
    if (count % 50 === 0) console.log(`  ... ${count}/${agencies.length}`);
  }

  console.log(`✅ Done — ${count} agencies upserted`);
  console.log(`   COMPLETED (LIVE): ${agencies.filter(a => a.onboardingStatus === 'COMPLETED').length}`);
  console.log(`   IN_PROGRESS:      ${agencies.filter(a => a.onboardingStatus === 'IN_PROGRESS').length}`);
  console.log(`   PENDING:          ${agencies.filter(a => a.onboardingStatus === 'PENDING').length}`);
  console.log(`   SUSPENDED:        ${agencies.filter(a => a.onboardingStatus === 'SUSPENDED').length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
