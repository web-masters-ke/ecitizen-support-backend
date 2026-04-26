import { PrismaClient, UserType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'agency-users-data.json'), 'utf-8'),
  ) as Array<{
    agencyCode: string;
    agencyName: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }>;

  const agencyAdminRole = await prisma.role.findUnique({ where: { name: 'AGENCY_ADMIN' } });
  if (!agencyAdminRole) throw new Error('AGENCY_ADMIN role not found — run main seed first');

  let created = 0;
  let skipped = 0;
  let noAgency = 0;

  for (let i = 0; i < data.length; i++) {
    const rec = data[i];

    const agency = await prisma.agency.findUnique({ where: { agencyCode: rec.agencyCode } });
    if (!agency) {
      console.warn(`  ⚠ Agency not found: ${rec.agencyCode}`);
      noAgency++;
      continue;
    }

    const passwordHash = await bcrypt.hash(rec.password, 10);

    const user = await prisma.user.upsert({
      where: { email: rec.email },
      create: {
        userType: UserType.AGENCY_AGENT,
        firstName: rec.firstName,
        lastName: rec.lastName,
        email: rec.email,
        passwordHash,
        isActive: true,
        isVerified: true,
      },
      update: {
        firstName: rec.firstName,
        lastName: rec.lastName,
        isActive: true,
        isVerified: true,
      },
    });

    // Assign AGENCY_ADMIN role scoped to the agency
    await prisma.userRole.upsert({
      where: {
        uq_user_role: { userId: user.id, roleId: agencyAdminRole.id, agencyId: agency.id },
      },
      create: {
        userId: user.id,
        roleId: agencyAdminRole.id,
        agencyId: agency.id,
      },
      update: {},
    });

    // Link user to agency
    await prisma.agencyUser.upsert({
      where: { uq_agency_user: { userId: user.id, agencyId: agency.id } },
      create: { userId: user.id, agencyId: agency.id, employmentStatus: 'active' },
      update: {},
    });

    if (user.createdAt.toISOString() === user.updatedAt.toISOString()) {
      created++;
    } else {
      skipped++;
    }

    if ((i + 1) % 50 === 0) console.log(`  ... processed ${i + 1}/${data.length}`);
  }

  console.log(`\n✅ Done — ${created} created, ${skipped} already existed, ${noAgency} agencies not found`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
