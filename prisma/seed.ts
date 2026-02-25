import { PrismaClient, UserType, TicketStatusName, TicketPriorityName, AgencyType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding eCitizen SCC database...');

  // ==========================================
  // 1. Create Ticket Statuses
  // ==========================================
  const statuses = [
    { name: TicketStatusName.OPEN, isClosedStatus: false, isSystemStatus: true },
    { name: TicketStatusName.ASSIGNED, isClosedStatus: false, isSystemStatus: true },
    { name: TicketStatusName.IN_PROGRESS, isClosedStatus: false, isSystemStatus: true },
    { name: TicketStatusName.ESCALATED, isClosedStatus: false, isSystemStatus: true },
    { name: TicketStatusName.PENDING_CITIZEN, isClosedStatus: false, isSystemStatus: true },
    { name: TicketStatusName.RESOLVED, isClosedStatus: false, isSystemStatus: true },
    { name: TicketStatusName.CLOSED, isClosedStatus: true, isSystemStatus: true },
    { name: TicketStatusName.REOPENED, isClosedStatus: false, isSystemStatus: true },
    { name: TicketStatusName.REJECTED, isClosedStatus: true, isSystemStatus: true },
  ];

  for (const status of statuses) {
    await prisma.ticketStatus.upsert({
      where: { name: status.name },
      update: {},
      create: status,
    });
  }
  console.log('✅ Ticket statuses seeded');

  // ==========================================
  // 2. Create Ticket Priority Levels
  // ==========================================
  const priorities = [
    { name: TicketPriorityName.LOW, severityScore: 1, description: 'Low priority - general inquiries' },
    { name: TicketPriorityName.MEDIUM, severityScore: 2, description: 'Medium priority - standard service issues' },
    { name: TicketPriorityName.HIGH, severityScore: 3, description: 'High priority - urgent service disruptions' },
    { name: TicketPriorityName.CRITICAL, severityScore: 4, description: 'Critical priority - national service outages' },
  ];

  for (const priority of priorities) {
    await prisma.ticketPriorityLevel.upsert({
      where: { name: priority.name },
      update: {},
      create: priority,
    });
  }
  console.log('✅ Ticket priorities seeded');

  // ==========================================
  // 3. Create System Roles
  // ==========================================
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Full system access across all agencies', isSystemRole: true },
    { name: 'COMMAND_CENTER_ADMIN', description: 'National command center operator', isSystemRole: true },
    { name: 'AGENCY_ADMIN', description: 'Agency-level administrator', isSystemRole: true },
    { name: 'L1_SUPERVISOR', description: 'Level 1 support supervisor', isSystemRole: true },
    { name: 'L1_AGENT', description: 'Level 1 support agent', isSystemRole: true },
    { name: 'L2_PROVIDER', description: 'Level 2 service provider agent', isSystemRole: true },
    { name: 'CITIZEN', description: 'Registered citizen', isSystemRole: true },
    { name: 'AUDITOR', description: 'Compliance and audit viewer', isSystemRole: true },
    { name: 'ANALYST', description: 'Analytics and reporting viewer', isSystemRole: true },
    { name: 'EXECUTIVE_VIEWER', description: 'Executive read-only dashboard access', isSystemRole: true },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }
  console.log('✅ Roles seeded');

  // ==========================================
  // 4. Create Permissions
  // ==========================================
  const permissions = [
    // Ticket permissions
    { name: 'Create Ticket', resource: 'ticket', action: 'create' },
    { name: 'Read Ticket', resource: 'ticket', action: 'read' },
    { name: 'Update Ticket', resource: 'ticket', action: 'update' },
    { name: 'Assign Ticket', resource: 'ticket', action: 'assign' },
    { name: 'Escalate Ticket', resource: 'ticket', action: 'escalate' },
    { name: 'Close Ticket', resource: 'ticket', action: 'close' },
    { name: 'Delete Ticket', resource: 'ticket', action: 'delete' },
    // User permissions
    { name: 'Create User', resource: 'user', action: 'create' },
    { name: 'Read User', resource: 'user', action: 'read' },
    { name: 'Update User', resource: 'user', action: 'update' },
    { name: 'Delete User', resource: 'user', action: 'delete' },
    { name: 'Manage Roles', resource: 'user', action: 'manage_roles' },
    // Agency permissions
    { name: 'Create Agency', resource: 'agency', action: 'create' },
    { name: 'Read Agency', resource: 'agency', action: 'read' },
    { name: 'Update Agency', resource: 'agency', action: 'update' },
    { name: 'Configure Agency', resource: 'agency', action: 'configure' },
    // SLA permissions
    { name: 'View SLA', resource: 'sla', action: 'read' },
    { name: 'Configure SLA', resource: 'sla', action: 'configure' },
    { name: 'Override SLA', resource: 'sla', action: 'override' },
    // Audit permissions
    { name: 'View Audit', resource: 'audit', action: 'read' },
    { name: 'Export Audit', resource: 'audit', action: 'export' },
    // AI permissions
    { name: 'View AI', resource: 'ai', action: 'read' },
    { name: 'Override AI', resource: 'ai', action: 'override' },
    // Dashboard permissions
    { name: 'View Dashboard', resource: 'dashboard', action: 'read' },
    // Report permissions
    { name: 'View Reports', resource: 'report', action: 'read' },
    { name: 'Export Reports', resource: 'report', action: 'export' },
    // KB permissions
    { name: 'Create KB Article', resource: 'knowledge_base', action: 'create' },
    { name: 'Read KB Article', resource: 'knowledge_base', action: 'read' },
    { name: 'Update KB Article', resource: 'knowledge_base', action: 'update' },
    // Notification permissions
    { name: 'View Notifications', resource: 'notification', action: 'read' },
    { name: 'Send Notifications', resource: 'notification', action: 'send' },
    { name: 'Configure Templates', resource: 'notification', action: 'configure' },
    // Media permissions
    { name: 'Upload Media', resource: 'media', action: 'upload' },
    { name: 'View Media', resource: 'media', action: 'read' },
    { name: 'Delete Media', resource: 'media', action: 'delete' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { uq_permissions: { resource: perm.resource, action: perm.action } },
      update: {},
      create: perm,
    });
  }
  console.log('✅ Permissions seeded');

  // ==========================================
  // 5. Assign Permissions to Roles
  // ==========================================
  const allPermissions = await prisma.permission.findMany();
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });

  if (superAdminRole) {
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: superAdminRole.id, permissionId: perm.id },
      });
    }
  }

  // Citizen role permissions
  const citizenRole = await prisma.role.findUnique({ where: { name: 'CITIZEN' } });
  const citizenPermNames = ['ticket:create', 'ticket:read', 'knowledge_base:read', 'media:upload', 'media:read'];
  if (citizenRole) {
    const citizenPerms = allPermissions.filter(p => citizenPermNames.includes(`${p.resource}:${p.action}`));
    for (const perm of citizenPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: citizenRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: citizenRole.id, permissionId: perm.id },
      });
    }
  }

  // L1 Agent permissions
  const l1AgentRole = await prisma.role.findUnique({ where: { name: 'L1_AGENT' } });
  const l1PermNames = ['ticket:create', 'ticket:read', 'ticket:update', 'ticket:assign', 'ticket:escalate', 'ticket:close', 'knowledge_base:read', 'media:upload', 'media:read', 'notification:read', 'sla:read', 'ai:read'];
  if (l1AgentRole) {
    const l1Perms = allPermissions.filter(p => l1PermNames.includes(`${p.resource}:${p.action}`));
    for (const perm of l1Perms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: l1AgentRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: l1AgentRole.id, permissionId: perm.id },
      });
    }
  }

  console.log('✅ Role permissions assigned');

  // ==========================================
  // 6. Create Super Admin User
  // ==========================================
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@ecitizen.go.ke' },
    update: {},
    create: {
      email: 'admin@ecitizen.go.ke',
      firstName: 'System',
      lastName: 'Administrator',
      userType: UserType.SUPER_ADMIN,
      passwordHash,
      isActive: true,
      isVerified: true,
    },
  });

  if (superAdminRole) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: superAdmin.id, roleId: superAdminRole.id, agencyId: null },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: superAdmin.id, roleId: superAdminRole.id },
      });
    }
  }
  console.log('✅ Super Admin user created (admin@ecitizen.go.ke / Admin@123456)');

  // ==========================================
  // 7. Create Sample Agency
  // ==========================================
  const sampleAgency = await prisma.agency.upsert({
    where: { agencyCode: 'ICT-AUTH' },
    update: {},
    create: {
      agencyCode: 'ICT-AUTH',
      agencyName: 'ICT Authority',
      agencyType: AgencyType.REGULATORY_BODY,
      officialEmail: 'support@icta.go.ke',
      officialPhone: '+254 20 2089061',
      county: 'Nairobi',
      isActive: true,
      onboardingStatus: 'COMPLETED',
    },
  });

  // Create departments
  await prisma.department.upsert({
    where: { uq_department: { agencyId: sampleAgency.id, departmentName: 'Technical Support' } },
    update: {},
    create: {
      agencyId: sampleAgency.id,
      departmentName: 'Technical Support',
      departmentCode: 'TECH-SUP',
      description: 'Technical support and service desk',
    },
  });

  await prisma.department.upsert({
    where: { uq_department: { agencyId: sampleAgency.id, departmentName: 'Customer Service' } },
    update: {},
    create: {
      agencyId: sampleAgency.id,
      departmentName: 'Customer Service',
      departmentCode: 'CUST-SVC',
      description: 'Customer service and complaints',
    },
  });

  // Create ticket categories for the agency
  const categories = [
    { name: 'Payment Issues', description: 'Payment-related complaints and queries' },
    { name: 'Account Access', description: 'Login, registration, and access issues' },
    { name: 'Service Delays', description: 'Delayed processing of applications' },
    { name: 'Document Errors', description: 'Errors in issued documents' },
    { name: 'Technical Issues', description: 'Platform technical problems' },
    { name: 'General Inquiry', description: 'General information requests' },
  ];

  for (const cat of categories) {
    await prisma.ticketCategory.upsert({
      where: { uq_ticket_category: { agencyId: sampleAgency.id, name: cat.name } },
      update: {},
      create: { agencyId: sampleAgency.id, ...cat },
    });
  }

  // Create SLA policy
  const slaPolicy = await prisma.slaPolicy.upsert({
    where: { uq_sla_policy: { agencyId: sampleAgency.id, policyName: 'Default SLA Policy' } },
    update: {},
    create: {
      agencyId: sampleAgency.id,
      policyName: 'Default SLA Policy',
      description: 'Default SLA policy for ICT Authority',
      isActive: true,
      appliesBusinessHours: true,
    },
  });

  // SLA rules per priority
  const priorityLevels = await prisma.ticketPriorityLevel.findMany();
  const slaConfig = {
    LOW: { response: 480, resolution: 2880 },      // 8h response, 48h resolution
    MEDIUM: { response: 240, resolution: 1440 },    // 4h response, 24h resolution
    HIGH: { response: 60, resolution: 480 },         // 1h response, 8h resolution
    CRITICAL: { response: 15, resolution: 120 },     // 15m response, 2h resolution
  };

  for (const pl of priorityLevels) {
    const config = slaConfig[pl.name];
    if (config) {
      await prisma.slaRule.create({
        data: {
          slaPolicyId: slaPolicy.id,
          priorityId: pl.id,
          responseTimeMinutes: config.response,
          resolutionTimeMinutes: config.resolution,
          escalationAfterMinutes: Math.round(config.resolution * 0.75),
        },
      });
    }
  }

  console.log('✅ Sample agency, departments, categories, and SLA seeded');

  // ==========================================
  // 7b. Seed Core Kenyan Government Agencies
  // ==========================================
  const coreAgencies = [
    {
      agencyCode: 'KRA',
      agencyName: 'Kenya Revenue Authority',
      agencyType: AgencyType.REGULATORY_BODY,
      officialEmail: 'callcentre@kra.go.ke',
      officialPhone: '+254 20 4999999',
      county: 'Nairobi',
      description: 'National tax collection and revenue administration authority',
      categories: [
        { name: 'PIN Registration', description: 'KRA PIN registration and issues' },
        { name: 'Tax Compliance', description: 'Tax compliance certificates and queries' },
        { name: 'VAT Issues', description: 'VAT registration and refund queries' },
        { name: 'Customs & Excise', description: 'Customs clearance and excise duty' },
        { name: 'iTax Support', description: 'iTax portal technical support' },
      ],
    },
    {
      agencyCode: 'IMMIGRATION',
      agencyName: 'Department of Immigration Services',
      agencyType: AgencyType.MINISTRY,
      officialEmail: 'info@immigration.go.ke',
      officialPhone: '+254 20 2222022',
      county: 'Nairobi',
      description: 'Passport, visa, and citizenship services',
      categories: [
        { name: 'Passport Application', description: 'New passport applications and renewals' },
        { name: 'Visa Services', description: 'Visa applications and extensions' },
        { name: 'Citizenship', description: 'Citizenship and naturalization' },
        { name: 'Work Permit', description: 'Work permits and alien cards' },
        { name: 'Travel Document', description: 'Emergency travel document queries' },
      ],
    },
    {
      agencyCode: 'NTSA',
      agencyName: 'National Transport and Safety Authority',
      agencyType: AgencyType.REGULATORY_BODY,
      officialEmail: 'customercare@ntsa.go.ke',
      officialPhone: '+254 20 2848000',
      county: 'Nairobi',
      description: 'Vehicle registration, driving licences and road safety',
      categories: [
        { name: 'Driving Licence', description: 'Driving licence applications and renewals' },
        { name: 'Vehicle Registration', description: 'New registration and transfers' },
        { name: 'Motor Vehicle Inspection', description: 'Inspection certificates' },
        { name: 'PSV Licensing', description: 'Public service vehicle licensing' },
        { name: 'Accident Reporting', description: 'Road accident reports' },
      ],
    },
    {
      agencyCode: 'NHIF',
      agencyName: 'National Hospital Insurance Fund',
      agencyType: AgencyType.PARASTATAL,
      officialEmail: 'info@nhif.or.ke',
      officialPhone: '+254 20 2727101',
      county: 'Nairobi',
      description: 'National health insurance fund',
      categories: [
        { name: 'Registration', description: 'NHIF member registration' },
        { name: 'Contributions', description: 'Contribution queries and updates' },
        { name: 'Claims', description: 'Medical claim submissions and status' },
        { name: 'Beneficiary Update', description: 'Update of dependants' },
        { name: 'Card Replacement', description: 'Lost or damaged NHIF card' },
      ],
    },
    {
      agencyCode: 'NSSF',
      agencyName: 'National Social Security Fund',
      agencyType: AgencyType.PARASTATAL,
      officialEmail: 'info@nssf.or.ke',
      officialPhone: '+254 20 2729000',
      county: 'Nairobi',
      description: 'National social security and pension fund',
      categories: [
        { name: 'Member Registration', description: 'NSSF member number issuance' },
        { name: 'Contribution Statement', description: 'Statement of contributions' },
        { name: 'Benefits Claim', description: 'Pension and withdrawal claims' },
        { name: 'Employer Registration', description: 'Employer onboarding' },
        { name: 'Card Issues', description: 'NSSF card replacement' },
      ],
    },
    {
      agencyCode: 'NRB',
      agencyName: 'National Registration Bureau',
      agencyType: AgencyType.MINISTRY,
      officialEmail: 'info@nrb.go.ke',
      officialPhone: '+254 20 2223600',
      county: 'Nairobi',
      description: 'National ID card issuance and civil registration',
      categories: [
        { name: 'National ID Application', description: 'First-time ID card applications' },
        { name: 'ID Replacement', description: 'Lost or damaged ID replacement' },
        { name: 'Birth Certificate', description: 'Birth certificate applications' },
        { name: 'Death Certificate', description: 'Death certificate applications' },
        { name: 'Change of Details', description: 'Correction of personal details' },
      ],
    },
    {
      agencyCode: 'HELB',
      agencyName: 'Higher Education Loans Board',
      agencyType: AgencyType.PARASTATAL,
      officialEmail: 'helb@helb.co.ke',
      officialPhone: '+254 711 052 000',
      county: 'Nairobi',
      description: 'Student loan applications and repayment management',
      categories: [
        { name: 'Loan Application', description: 'University loan application process' },
        { name: 'Loan Repayment', description: 'Repayment queries and clearance' },
        { name: 'Clearance Certificate', description: 'HELB clearance certificate' },
        { name: 'Bursary', description: 'Bursary applications and disbursement' },
        { name: 'Account Queries', description: 'Account balance and statement' },
      ],
    },
    {
      agencyCode: 'KNEC',
      agencyName: 'Kenya National Examinations Council',
      agencyType: AgencyType.PARASTATAL,
      officialEmail: 'info@knec.ac.ke',
      officialPhone: '+254 20 3317412',
      county: 'Nairobi',
      description: 'National examinations body for Kenya',
      categories: [
        { name: 'Certificate Collection', description: 'KCSE/KCPE certificate collection' },
        { name: 'Result Verification', description: 'Examination result verification' },
        { name: 'Re-marking', description: 'Re-marking and appeals' },
        { name: 'Registration', description: 'Exam registration and centre queries' },
        { name: 'Replacement Certificate', description: 'Lost certificate replacement' },
      ],
    },
    {
      agencyCode: 'BRS',
      agencyName: 'Business Registration Service',
      agencyType: AgencyType.REGULATORY_BODY,
      officialEmail: 'info@brs.go.ke',
      officialPhone: '+254 20 2213043',
      county: 'Nairobi',
      description: 'Business name and company registration',
      categories: [
        { name: 'Business Name Registration', description: 'Sole proprietor and partnership registration' },
        { name: 'Company Registration', description: 'Limited company registration' },
        { name: 'Annual Returns', description: 'Annual return filing' },
        { name: 'Certificate of Compliance', description: 'Compliance certificate requests' },
        { name: 'Deregistration', description: 'Business closure and winding up' },
      ],
    },
    {
      agencyCode: 'DCI',
      agencyName: 'Directorate of Criminal Investigations',
      agencyType: AgencyType.MINISTRY,
      officialEmail: 'info@dci.go.ke',
      officialPhone: '+254 20 3343333',
      county: 'Nairobi',
      description: 'Police clearance certificates and criminal investigations',
      categories: [
        { name: 'Police Clearance', description: 'Certificate of good conduct applications' },
        { name: 'Character Certificate', description: 'Character reference certificates' },
        { name: 'Report an Incident', description: 'Report criminal activity or fraud' },
        { name: 'Status Inquiry', description: 'Track clearance certificate application' },
      ],
    },
  ];

  for (const agency of coreAgencies) {
    const { categories: agencyCats, description: _desc, ...agencyData } = agency;
    const createdAgency = await prisma.agency.upsert({
      where: { agencyCode: agencyData.agencyCode },
      update: {},
      create: {
        ...agencyData,
        isActive: true,
        onboardingStatus: 'COMPLETED',
      },
    });

    // Seed categories for each agency
    for (const cat of agencyCats) {
      await prisma.ticketCategory.upsert({
        where: { uq_ticket_category: { agencyId: createdAgency.id, name: cat.name } },
        update: {},
        create: { agencyId: createdAgency.id, ...cat },
      });
    }

    // Seed departments for each agency
    const agencyDepartments: Record<string, { departmentName: string; departmentCode: string }[]> = {
      KRA: [
        { departmentName: 'Domestic Taxes', departmentCode: 'KRA-DTD' },
        { departmentName: 'Customs & Border Control', departmentCode: 'KRA-CBD' },
        { departmentName: 'Taxpayer Services', departmentCode: 'KRA-TPS' },
        { departmentName: 'Enforcement & Compliance', departmentCode: 'KRA-ENF' },
      ],
      IMMIGRATION: [
        { departmentName: 'Passport & Travel Documents', departmentCode: 'IMM-PAS' },
        { departmentName: 'Visa & Permits', departmentCode: 'IMM-VIS' },
        { departmentName: 'Citizenship & Naturalization', departmentCode: 'IMM-CTZ' },
        { departmentName: 'Border Management', departmentCode: 'IMM-BOR' },
      ],
      NTSA: [
        { departmentName: 'Driving Licences', departmentCode: 'NTSA-DL' },
        { departmentName: 'Vehicle Registration', departmentCode: 'NTSA-VR' },
        { departmentName: 'Motor Vehicle Inspection', departmentCode: 'NTSA-MVI' },
        { departmentName: 'PSV & Enforcement', departmentCode: 'NTSA-PSV' },
      ],
      NHIF: [
        { departmentName: 'Member Registration', departmentCode: 'NHIF-REG' },
        { departmentName: 'Claims Processing', departmentCode: 'NHIF-CLM' },
        { departmentName: 'Contributions', departmentCode: 'NHIF-CON' },
        { departmentName: 'Customer Service', departmentCode: 'NHIF-CS' },
      ],
      NSSF: [
        { departmentName: 'Member Services', departmentCode: 'NSSF-MS' },
        { departmentName: 'Benefits & Pensions', departmentCode: 'NSSF-BEN' },
        { departmentName: 'Employer Relations', departmentCode: 'NSSF-EMP' },
        { departmentName: 'Finance & Contributions', departmentCode: 'NSSF-FIN' },
      ],
      NRB: [
        { departmentName: 'National ID Issuance', departmentCode: 'NRB-NID' },
        { departmentName: 'Civil Registration', departmentCode: 'NRB-CVR' },
        { departmentName: 'Records & Archives', departmentCode: 'NRB-REC' },
      ],
      HELB: [
        { departmentName: 'Loan Applications', departmentCode: 'HELB-LA' },
        { departmentName: 'Loan Repayment', departmentCode: 'HELB-LR' },
        { departmentName: 'Bursaries & Scholarships', departmentCode: 'HELB-BUR' },
        { departmentName: 'Customer Support', departmentCode: 'HELB-CS' },
      ],
      KNEC: [
        { departmentName: 'Examinations Administration', departmentCode: 'KNEC-EXM' },
        { departmentName: 'Certificates & Results', departmentCode: 'KNEC-CRT' },
        { departmentName: 'Assessment & Research', departmentCode: 'KNEC-RES' },
      ],
      BRS: [
        { departmentName: 'Business Name Registration', departmentCode: 'BRS-BNR' },
        { departmentName: 'Company Registration', departmentCode: 'BRS-COR' },
        { departmentName: 'Compliance & Returns', departmentCode: 'BRS-CPL' },
      ],
      DCI: [
        { departmentName: 'Police Clearance', departmentCode: 'DCI-PCL' },
        { departmentName: 'Cybercrime', departmentCode: 'DCI-CYB' },
        { departmentName: 'Investigations', departmentCode: 'DCI-INV' },
        { departmentName: 'Public Liaison', departmentCode: 'DCI-PUB' },
      ],
    };

    const depts = agencyDepartments[agencyData.agencyCode] ?? [];
    for (const dept of depts) {
      await prisma.department.upsert({
        where: { uq_department: { agencyId: createdAgency.id, departmentName: dept.departmentName } },
        update: {},
        create: { agencyId: createdAgency.id, ...dept, isActive: true },
      });
    }

    // Seed default SLA policy per agency
    const agencySla = await prisma.slaPolicy.upsert({
      where: { uq_sla_policy: { agencyId: createdAgency.id, policyName: 'Default SLA Policy' } },
      update: {},
      create: {
        agencyId: createdAgency.id,
        policyName: 'Default SLA Policy',
        description: `Default SLA policy for ${agencyData.agencyName}`,
        isActive: true,
        appliesBusinessHours: true,
      },
    });

    const priorities = await prisma.ticketPriorityLevel.findMany();
    for (const pl of priorities) {
      const slaCfg = { LOW: { response: 480, resolution: 2880 }, MEDIUM: { response: 240, resolution: 1440 }, HIGH: { response: 60, resolution: 480 }, CRITICAL: { response: 15, resolution: 120 } };
      const cfg = slaCfg[pl.name as keyof typeof slaCfg];
      if (cfg) {
        const exists = await prisma.slaRule.findFirst({ where: { slaPolicyId: agencySla.id, priorityId: pl.id } });
        if (!exists) {
          await prisma.slaRule.create({
            data: { slaPolicyId: agencySla.id, priorityId: pl.id, responseTimeMinutes: cfg.response, resolutionTimeMinutes: cfg.resolution, escalationAfterMinutes: Math.round(cfg.resolution * 0.75) },
          });
        }
      }
    }
  }

  console.log(`✅ ${coreAgencies.length} core Kenyan government agencies seeded`);

  // ==========================================
  // 7c. Enrich all agencies: contacts, business hours, settings, agents, service providers
  // ==========================================

  // Collect all agencies
  const allAgencies = await prisma.agency.findMany({ include: { departments: { take: 1 } } });

  // Per-agency contact data
  const agencyContactMap: Record<string, { contactName: string; roleTitle: string; email: string; phone: string; escalationLevel: number }[]> = {
    'ICT-AUTH': [
      { contactName: 'David Njoroge', roleTitle: 'Director of Customer Service', email: 'djoroge@icta.go.ke', phone: '+254 20 2089062', escalationLevel: 1 },
      { contactName: 'Mary Wanjiru', roleTitle: 'Head of Public Relations', email: 'pr@icta.go.ke', phone: '+254 20 2089063', escalationLevel: 2 },
    ],
    KRA: [
      { contactName: 'Peter Mwangi', roleTitle: 'Head of Customer Service', email: 'cs@kra.go.ke', phone: '+254 20 4999901', escalationLevel: 1 },
      { contactName: 'Grace Akinyi', roleTitle: 'Deputy Commissioner – Taxpayer Services', email: 'taxpayerservices@kra.go.ke', phone: '+254 20 4999902', escalationLevel: 2 },
    ],
    IMMIGRATION: [
      { contactName: 'Fatuma Hassan', roleTitle: 'Director of Passport Services', email: 'passports@immigration.go.ke', phone: '+254 20 2222023', escalationLevel: 1 },
      { contactName: 'Moses Kipkemoi', roleTitle: 'Head of Visa & Permits', email: 'visas@immigration.go.ke', phone: '+254 20 2222024', escalationLevel: 2 },
    ],
    NTSA: [
      { contactName: 'Lucy Otieno', roleTitle: 'Customer Experience Manager', email: 'cx@ntsa.go.ke', phone: '+254 20 2848001', escalationLevel: 1 },
      { contactName: 'David Kimani', roleTitle: 'Head of Vehicle Licensing', email: 'licensing@ntsa.go.ke', phone: '+254 20 2848002', escalationLevel: 2 },
    ],
    NHIF: [
      { contactName: 'Ann Wambui', roleTitle: 'Head of Member Services', email: 'members@nhif.or.ke', phone: '+254 20 2727102', escalationLevel: 1 },
      { contactName: 'John Omondi', roleTitle: 'Claims Manager', email: 'claims@nhif.or.ke', phone: '+254 20 2727103', escalationLevel: 2 },
    ],
    NSSF: [
      { contactName: 'Rose Auma', roleTitle: 'Head of Member Services', email: 'members@nssf.or.ke', phone: '+254 20 2729001', escalationLevel: 1 },
      { contactName: 'Patrick Muiru', roleTitle: 'Benefits & Pensions Manager', email: 'benefits@nssf.or.ke', phone: '+254 20 2729002', escalationLevel: 2 },
    ],
    NRB: [
      { contactName: 'Esther Chebet', roleTitle: 'Director of Civil Registration', email: 'registration@nrb.go.ke', phone: '+254 20 2223601', escalationLevel: 1 },
      { contactName: 'Samuel Njoroge', roleTitle: 'Head of National ID Issuance', email: 'nationalid@nrb.go.ke', phone: '+254 20 2223602', escalationLevel: 2 },
    ],
    HELB: [
      { contactName: 'Violet Awino', roleTitle: 'Head of Loan Services', email: 'loans@helb.co.ke', phone: '+254 711 052 001', escalationLevel: 1 },
      { contactName: 'Eric Muriithi', roleTitle: 'Bursaries Manager', email: 'bursaries@helb.co.ke', phone: '+254 711 052 002', escalationLevel: 2 },
    ],
    KNEC: [
      { contactName: 'Gladys Makena', roleTitle: 'Head of Examinations', email: 'exams@knec.ac.ke', phone: '+254 20 3317413', escalationLevel: 1 },
      { contactName: 'Peter Kamau', roleTitle: 'Certificates Manager', email: 'certificates@knec.ac.ke', phone: '+254 20 3317414', escalationLevel: 2 },
    ],
    BRS: [
      { contactName: 'Jennifer Muthoni', roleTitle: 'Head of Registration Services', email: 'registration@brs.go.ke', phone: '+254 20 2213044', escalationLevel: 1 },
      { contactName: 'Michael Ongeri', roleTitle: 'Compliance Manager', email: 'compliance@brs.go.ke', phone: '+254 20 2213045', escalationLevel: 2 },
    ],
    DCI: [
      { contactName: 'Sharon Kerubo', roleTitle: 'Head of Police Clearance', email: 'clearance@dci.go.ke', phone: '+254 20 3343334', escalationLevel: 1 },
      { contactName: 'Anthony Simiyu', roleTitle: 'Public Liaison Officer', email: 'public@dci.go.ke', phone: '+254 20 3343335', escalationLevel: 2 },
    ],
  };

  // Per-agency sample agents
  const agencyAgentMap: Record<string, { firstName: string; lastName: string; email: string; phone: string }[]> = {
    'ICT-AUTH': [
      { firstName: 'Brian', lastName: 'Otieno', email: 'brian.otieno@icta.go.ke', phone: '+254710001001' },
      { firstName: 'Cynthia', lastName: 'Wanjiku', email: 'cynthia.wanjiku@icta.go.ke', phone: '+254710001002' },
    ],
    KRA: [
      { firstName: 'Salome', lastName: 'Njeri', email: 'salome.njeri@kra.go.ke', phone: '+254710002001' },
      { firstName: 'James', lastName: 'Odhiambo', email: 'james.odhiambo@kra.go.ke', phone: '+254710002002' },
    ],
    IMMIGRATION: [
      { firstName: 'Amina', lastName: 'Mohamed', email: 'amina.mohamed@immigration.go.ke', phone: '+254710003001' },
      { firstName: 'Victor', lastName: 'Kipchoge', email: 'victor.kipchoge@immigration.go.ke', phone: '+254710003002' },
    ],
    NTSA: [
      { firstName: 'Faith', lastName: 'Kemunto', email: 'faith.kemunto@ntsa.go.ke', phone: '+254710004001' },
      { firstName: 'Collins', lastName: 'Mutua', email: 'collins.mutua@ntsa.go.ke', phone: '+254710004002' },
    ],
    NHIF: [
      { firstName: 'Irene', lastName: 'Achieng', email: 'irene.achieng@nhif.or.ke', phone: '+254710005001' },
      { firstName: 'Dennis', lastName: 'Wekesa', email: 'dennis.wekesa@nhif.or.ke', phone: '+254710005002' },
    ],
    NSSF: [
      { firstName: 'Hellen', lastName: 'Moraa', email: 'hellen.moraa@nssf.or.ke', phone: '+254710006001' },
      { firstName: 'Geoffrey', lastName: 'Rono', email: 'geoffrey.rono@nssf.or.ke', phone: '+254710006002' },
    ],
    NRB: [
      { firstName: 'Alice', lastName: 'Chepkoech', email: 'alice.chepkoech@nrb.go.ke', phone: '+254710007001' },
      { firstName: 'Edwin', lastName: 'Kiprotich', email: 'edwin.kiprotich@nrb.go.ke', phone: '+254710007002' },
    ],
    HELB: [
      { firstName: 'Winnie', lastName: 'Adhiambo', email: 'winnie.adhiambo@helb.co.ke', phone: '+254710008001' },
      { firstName: 'Kevin', lastName: 'Karimi', email: 'kevin.karimi@helb.co.ke', phone: '+254710008002' },
    ],
    KNEC: [
      { firstName: 'Pauline', lastName: 'Wangari', email: 'pauline.wangari@knec.ac.ke', phone: '+254710009001' },
      { firstName: 'Stanley', lastName: 'Mwenda', email: 'stanley.mwenda@knec.ac.ke', phone: '+254710009002' },
    ],
    BRS: [
      { firstName: 'Lilian', lastName: 'Nyawira', email: 'lilian.nyawira@brs.go.ke', phone: '+254710010001' },
      { firstName: 'Oscar', lastName: 'Wafula', email: 'oscar.wafula@brs.go.ke', phone: '+254710010002' },
    ],
    DCI: [
      { firstName: 'Diana', lastName: 'Nasimiyu', email: 'diana.nasimiyu@dci.go.ke', phone: '+254710011001' },
      { firstName: 'Simon', lastName: 'Gitonga', email: 'simon.gitonga@dci.go.ke', phone: '+254710011002' },
    ],
    KEBS: [
      { firstName: 'Joyce', lastName: 'Kamau', email: 'joyce.kamau@kebs.go.ke', phone: '+254710012001' },
      { firstName: 'Robert', lastName: 'Ochieng', email: 'robert.ochieng@kebs.go.ke', phone: '+254710012002' },
      { firstName: 'Faith', lastName: 'Njoroge', email: 'faith.njoroge@kebs.go.ke', phone: '+254710012003' },
    ],
    CAK: [
      { firstName: 'Mark', lastName: 'Maina', email: 'mark.maina@cak.go.ke', phone: '+254710013001' },
      { firstName: 'Susan', lastName: 'Akinyi', email: 'susan.akinyi@cak.go.ke', phone: '+254710013002' },
    ],
    NEMA: [
      { firstName: 'George', lastName: 'Waweru', email: 'george.waweru@nema.go.ke', phone: '+254710014001' },
      { firstName: 'Carol', lastName: 'Chepkemoi', email: 'carol.chepkemoi@nema.go.ke', phone: '+254710014002' },
    ],
    MOE: [
      { firstName: 'Philip', lastName: 'Karanja', email: 'philip.karanja@education.go.ke', phone: '+254710015001' },
      { firstName: 'Mercy', lastName: 'Atieno', email: 'mercy.atieno@education.go.ke', phone: '+254710015002' },
    ],
    MOH: [
      { firstName: 'Daniel', lastName: 'Mwangi', email: 'daniel.mwangi@health.go.ke', phone: '+254710016001' },
      { firstName: 'Beatrice', lastName: 'Wanjiru', email: 'beatrice.wanjiru@health.go.ke', phone: '+254710016002' },
    ],
    NLC: [
      { firstName: 'Linet', lastName: 'Omondi', email: 'linet.omondi@nlc.go.ke', phone: '+254710017001' },
      { firstName: 'Francis', lastName: 'Mutua', email: 'francis.mutua@nlc.go.ke', phone: '+254710017002' },
    ],
  };

  const enrichAgentPwd = await bcrypt.hash('Agent@123', 10);
  const enrichL1Role = await prisma.role.findUnique({ where: { name: 'L1_AGENT' } });

  for (const ag of allAgencies) {
    const code = ag.agencyCode;
    const firstDeptId = ag.departments[0]?.id ?? null;

    // ── Contacts (delete + recreate for idempotency) ──────────────────────────
    const contacts = agencyContactMap[code];
    if (contacts) {
      await prisma.agencyContact.deleteMany({ where: { agencyId: ag.id } });
      for (const c of contacts) {
        await prisma.agencyContact.create({
          data: { agencyId: ag.id, contactName: c.contactName, roleTitle: c.roleTitle, email: c.email, phone: c.phone, escalationLevel: c.escalationLevel },
        });
      }
    }

    // ── Business Hours Mon–Fri 08:00–17:00, Sat 09:00–13:00 ──────────────────
    const hours = [
      { dayOfWeek: 1, startTime: '08:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 2, startTime: '08:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 3, startTime: '08:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 4, startTime: '08:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 5, startTime: '08:00', endTime: '17:00', isActive: true },
      { dayOfWeek: 6, startTime: '09:00', endTime: '13:00', isActive: true },
    ];
    for (const h of hours) {
      await prisma.agencyBusinessHour.upsert({
        where: { uq_business_hours: { agencyId: ag.id, dayOfWeek: h.dayOfWeek } },
        update: { startTime: h.startTime, endTime: h.endTime, isActive: h.isActive },
        create: { agencyId: ag.id, ...h },
      });
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    const defaultSettings = [
      { settingKey: 'auto_assign_enabled', settingValue: 'true' },
      { settingKey: 'sla_notifications_enabled', settingValue: 'true' },
      { settingKey: 'max_tickets_per_agent', settingValue: '50' },
      { settingKey: 'default_ticket_priority', settingValue: 'MEDIUM' },
      { settingKey: 'citizen_feedback_enabled', settingValue: 'true' },
    ];
    for (const s of defaultSettings) {
      await prisma.agencySetting.upsert({
        where: { uq_agency_setting: { agencyId: ag.id, settingKey: s.settingKey } },
        update: {},
        create: { agencyId: ag.id, ...s },
      });
    }

    // ── Sample Agents ─────────────────────────────────────────────────────────
    const agents = agencyAgentMap[code] ?? [];
    for (const a of agents) {
      const user = await prisma.user.upsert({
        where: { email: a.email },
        update: {},
        create: { email: a.email, firstName: a.firstName, lastName: a.lastName, phoneNumber: a.phone, userType: UserType.AGENCY_AGENT, passwordHash: enrichAgentPwd, isActive: true, isVerified: true },
      });
      await prisma.agencyUser.upsert({
        where: { uq_agency_user: { userId: user.id, agencyId: ag.id } },
        update: {},
        create: { userId: user.id, agencyId: ag.id, departmentId: firstDeptId },
      });
      if (enrichL1Role) {
        const existingRole = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: enrichL1Role.id, agencyId: ag.id } });
        if (!existingRole) {
          await prisma.userRole.create({ data: { userId: user.id, roleId: enrichL1Role.id, agencyId: ag.id } });
        }
      }
    }
  }

  // ── Global Service Providers ──────────────────────────────────────────────
  const serviceProviders = [
    { providerName: 'Safaricom PLC', providerType: 'PAYMENT_GATEWAY', contactEmail: 'enterprise@safaricom.co.ke', contactPhone: '+254722000000' },
    { providerName: 'Equity Bank Kenya', providerType: 'PAYMENT_GATEWAY', contactEmail: 'eazzyapi@equitybank.co.ke', contactPhone: '+254763000000' },
    { providerName: 'Kenya Post Corporation', providerType: 'DELIVERY', contactEmail: 'info@posta.co.ke', contactPhone: '+254 20 2324000' },
  ];

  const createdProviders: { id: string }[] = [];
  for (const sp of serviceProviders) {
    const provider = await prisma.serviceProvider.upsert({
      where: { providerName: sp.providerName },
      update: {},
      create: sp,
    });
    createdProviders.push(provider);
  }

  // Link all 3 providers to every agency
  for (const ag of allAgencies) {
    for (const provider of createdProviders) {
      const exists = await prisma.agencyServiceMapping.findFirst({ where: { agencyId: ag.id, serviceProviderId: provider.id } });
      if (!exists) {
        await prisma.agencyServiceMapping.create({
          data: { agencyId: ag.id, serviceProviderId: provider.id, isPrimary: provider === createdProviders[0] },
        });
      }
    }
  }

  // ── Escalation Matrices (4 priority levels per agency) ───────────────────
  const escalationPriorities = [
    { priorityLevel: 'CRITICAL', maxResponseTimeMinutes: 15, maxResolutionTimeMinutes: 120 },
    { priorityLevel: 'HIGH',     maxResponseTimeMinutes: 60, maxResolutionTimeMinutes: 480 },
    { priorityLevel: 'MEDIUM',   maxResponseTimeMinutes: 240, maxResolutionTimeMinutes: 1440 },
    { priorityLevel: 'LOW',      maxResponseTimeMinutes: 480, maxResolutionTimeMinutes: 2880 },
  ];

  for (const ag of allAgencies) {
    for (const ep of escalationPriorities) {
      // Upsert by agency + priorityLevel
      let matrix = await prisma.escalationMatrix.findFirst({ where: { agencyId: ag.id, priorityLevel: ep.priorityLevel } });
      if (!matrix) {
        matrix = await prisma.escalationMatrix.create({
          data: { agencyId: ag.id, priorityLevel: ep.priorityLevel, maxResponseTimeMinutes: ep.maxResponseTimeMinutes, maxResolutionTimeMinutes: ep.maxResolutionTimeMinutes, autoEscalationEnabled: true },
        });
      }
      // 3 escalation levels: L1_AGENT → L1_SUPERVISOR → AGENCY_ADMIN
      const levels = [
        { levelNumber: 1, escalationRole: 'L1_AGENT', notifyViaEmail: true, notifyViaSms: false },
        { levelNumber: 2, escalationRole: 'L1_SUPERVISOR', notifyViaEmail: true, notifyViaSms: true },
        { levelNumber: 3, escalationRole: 'AGENCY_ADMIN', notifyViaEmail: true, notifyViaSms: true },
      ];
      for (const lv of levels) {
        const exists = await prisma.escalationLevel.findFirst({ where: { escalationMatrixId: matrix.id, levelNumber: lv.levelNumber } });
        if (!exists) {
          await prisma.escalationLevel.create({ data: { escalationMatrixId: matrix.id, ...lv } });
        }
      }
    }
  }

  console.log('✅ Contacts, business hours, settings, agents, and service providers seeded for all agencies');

  // ==========================================
  // 8. Create Sample Citizen User
  // ==========================================
  const citizenPassword = await bcrypt.hash('Citizen@123', 10);
  const citizenUser = await prisma.user.upsert({
    where: { email: 'citizen@example.com' },
    update: {},
    create: {
      email: 'citizen@example.com',
      firstName: 'John',
      lastName: 'Mwangi',
      userType: UserType.CITIZEN,
      phoneNumber: '+254712345678',
      nationalId: '12345678',
      passwordHash: citizenPassword,
      isActive: true,
      isVerified: true,
    },
  });

  if (citizenRole) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: citizenUser.id, roleId: citizenRole.id, agencyId: null },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: citizenUser.id, roleId: citizenRole.id },
      });
    }
  }

  // ==========================================
  // 9. Create Sample L1 Agent
  // ==========================================
  const agentPassword = await bcrypt.hash('Agent@123', 10);
  const agentUser = await prisma.user.upsert({
    where: { email: 'agent@icta.go.ke' },
    update: {},
    create: {
      email: 'agent@icta.go.ke',
      firstName: 'Jane',
      lastName: 'Wanjiku',
      userType: UserType.AGENCY_AGENT,
      phoneNumber: '+254723456789',
      passwordHash: agentPassword,
      isActive: true,
      isVerified: true,
    },
  });

  if (l1AgentRole) {
    const existing = await prisma.userRole.findFirst({
      where: { userId: agentUser.id, roleId: l1AgentRole.id },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: agentUser.id, roleId: l1AgentRole.id, agencyId: sampleAgency.id },
      });
    }
  }

  await prisma.agencyUser.upsert({
    where: { uq_agency_user: { userId: agentUser.id, agencyId: sampleAgency.id } },
    update: {},
    create: { userId: agentUser.id, agencyId: sampleAgency.id },
  });

  console.log('✅ Sample users seeded');

  // ==========================================
  // 10. Create Notification Templates
  // ==========================================
  const templates = [
    {
      templateName: 'ticket_created',
      channel: 'EMAIL' as const,
      subjectTemplate: 'Ticket Created - {{ticketNumber}}',
      bodyTemplate: 'Dear {{citizenName}}, your ticket {{ticketNumber}} has been received. We will get back to you shortly. Subject: {{subject}}',
    },
    {
      templateName: 'ticket_created',
      channel: 'SMS' as const,
      subjectTemplate: null,
      bodyTemplate: 'eCitizen: Ticket {{ticketNumber}} received. Track at ecitizen.go.ke/track/{{ticketNumber}}',
    },
    {
      templateName: 'ticket_assigned',
      channel: 'EMAIL' as const,
      subjectTemplate: 'Ticket Assigned - {{ticketNumber}}',
      bodyTemplate: 'Ticket {{ticketNumber}} has been assigned to {{agentName}} for resolution.',
    },
    {
      templateName: 'ticket_resolved',
      channel: 'EMAIL' as const,
      subjectTemplate: 'Ticket Resolved - {{ticketNumber}}',
      bodyTemplate: 'Dear {{citizenName}}, your ticket {{ticketNumber}} has been resolved. Please rate your experience.',
    },
    {
      templateName: 'ticket_resolved',
      channel: 'SMS' as const,
      subjectTemplate: null,
      bodyTemplate: 'eCitizen: Ticket {{ticketNumber}} resolved. Rate your experience at ecitizen.go.ke/feedback/{{ticketNumber}}',
    },
    {
      templateName: 'sla_breach_warning',
      channel: 'EMAIL' as const,
      subjectTemplate: 'SLA Breach Warning - {{ticketNumber}}',
      bodyTemplate: 'Warning: Ticket {{ticketNumber}} is approaching SLA breach. Due at {{dueDate}}. Current assignee: {{assignee}}.',
    },
    {
      templateName: 'ticket_escalated',
      channel: 'EMAIL' as const,
      subjectTemplate: 'Ticket Escalated - {{ticketNumber}}',
      bodyTemplate: 'Ticket {{ticketNumber}} has been escalated to Level {{escalationLevel}}. Reason: {{reason}}',
    },
  ];

  for (const t of templates) {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { agencyId: null, templateName: t.templateName, channel: t.channel },
    });
    if (!existing) {
      await prisma.notificationTemplate.create({ data: t });
    }
  }
  console.log('✅ Notification templates seeded');

  // ==========================================
  // 11. Create AI Model record
  // ==========================================
  await prisma.aiModel.upsert({
    where: { uq_ai_model: { modelName: 'escc-classifier', modelVersion: '1.0.0' } },
    update: {},
    create: {
      modelName: 'escc-classifier',
      modelVersion: '1.0.0',
      modelType: 'classification',
      deploymentEnvironment: 'production',
      isActive: true,
    },
  });
  console.log('✅ AI model record seeded');

  // ==========================================
  // 12. Retention Policies
  // ==========================================
  const retentionPolicies = [
    { entityType: 'tickets', retentionPeriodDays: 2555, archiveAfterDays: 1095 },
    { entityType: 'audit_logs', retentionPeriodDays: 3650, archiveAfterDays: 1825 },
    { entityType: 'authentication_logs', retentionPeriodDays: 1095, archiveAfterDays: 365 },
    { entityType: 'notification_delivery_logs', retentionPeriodDays: 1095, archiveAfterDays: 365 },
    { entityType: 'kb_article_views', retentionPeriodDays: 1825, archiveAfterDays: 730 },
  ];

  for (const rp of retentionPolicies) {
    await prisma.retentionPolicy.upsert({
      where: { entityType: rp.entityType },
      update: {},
      create: rp,
    });
  }
  console.log('✅ Retention policies seeded');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Test credentials:');
  console.log('   Super Admin: admin@ecitizen.go.ke / Admin@123456');
  console.log('   Citizen:     citizen@example.com / Citizen@123');
  console.log('   L1 Agent:    agent@icta.go.ke / Agent@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
