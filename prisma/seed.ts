import { PrismaClient, UserType, TicketStatusName, TicketPriorityName, AgencyType, TicketChannel, KbVisibility, BreachType, EscalationTrigger } from '@prisma/client';
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

  // ─── Personal super admin (Benjamin Kakai) ─────────────────────────────────
  const bkHash = await bcrypt.hash('BKakai@SCC2026!', 10);
  const bkAdmin = await prisma.user.upsert({
    where: { email: 'b.kakai@wasaachat.com' },
    update: { passwordHash: bkHash, isActive: true, isVerified: true, userType: UserType.SUPER_ADMIN, firstName: 'Benjamin', lastName: 'Kakai' },
    create: {
      email: 'b.kakai@wasaachat.com',
      firstName: 'Benjamin',
      lastName: 'Kakai',
      userType: UserType.SUPER_ADMIN,
      passwordHash: bkHash,
      isActive: true,
      isVerified: true,
    },
  });
  // Force-update password in case upsert matched an existing row with stale hash
  await prisma.user.update({ where: { email: 'b.kakai@wasaachat.com' }, data: { passwordHash: bkHash, isActive: true, isVerified: true } });
  if (superAdminRole) {
    const bkRoleExists = await prisma.userRole.findFirst({ where: { userId: bkAdmin.id, roleId: superAdminRole.id } });
    if (!bkRoleExists) await prisma.userRole.create({ data: { userId: bkAdmin.id, roleId: superAdminRole.id } });
  }
  console.log('✅ Personal super admin created (b.kakai@wasaachat.com / BKakai@SCC2026!)');

  // ─── Call test super admin ─────────────────────────────────────────────────
  const callHash = await bcrypt.hash('CallTest2026', 10);
  const callAdmin = await prisma.user.upsert({
    where: { email: 'call.test@ecitizen.go.ke' },
    update: { passwordHash: callHash, isActive: true, isVerified: true, userType: UserType.SUPER_ADMIN, firstName: 'Call', lastName: 'Test' },
    create: {
      email: 'call.test@ecitizen.go.ke',
      firstName: 'Call',
      lastName: 'Test',
      userType: UserType.SUPER_ADMIN,
      passwordHash: callHash,
      isActive: true,
      isVerified: true,
    },
  });
  // Force-update password in case upsert matched an existing row with stale hash
  await prisma.user.update({ where: { email: 'call.test@ecitizen.go.ke' }, data: { passwordHash: callHash, isActive: true, isVerified: true } });
  if (superAdminRole) {
    const callRoleExists = await prisma.userRole.findFirst({ where: { userId: callAdmin.id, roleId: superAdminRole.id } });
    if (!callRoleExists) await prisma.userRole.create({ data: { userId: callAdmin.id, roleId: superAdminRole.id } });
  }
  console.log('✅ Call test super admin created (call.test@ecitizen.go.ke / CallTest2026)');

  // ─── Caller test super admin (fresh account — call.test was unreliable) ───
  const callerHash = await bcrypt.hash('Caller2026', 10);
  const callerAdmin = await prisma.user.upsert({
    where: { email: 'caller@ecitizen.go.ke' },
    update: { passwordHash: callerHash, isActive: true, isVerified: true, userType: UserType.SUPER_ADMIN, firstName: 'Caller', lastName: 'Test' },
    create: {
      email: 'caller@ecitizen.go.ke',
      firstName: 'Caller',
      lastName: 'Test',
      userType: UserType.SUPER_ADMIN,
      passwordHash: callerHash,
      isActive: true,
      isVerified: true,
    },
  });
  await prisma.user.update({ where: { email: 'caller@ecitizen.go.ke' }, data: { passwordHash: callerHash, isActive: true, isVerified: true } });
  if (superAdminRole) {
    const callerRoleExists = await prisma.userRole.findFirst({ where: { userId: callerAdmin.id, roleId: superAdminRole.id } });
    if (!callerRoleExists) await prisma.userRole.create({ data: { userId: callerAdmin.id, roleId: superAdminRole.id } });
  }
  console.log('✅ Caller test super admin created (caller@ecitizen.go.ke / Caller2026)');

  // ─── PesaFlow company accounts ────────────────────────────────────────────
  const pfPassword = 'PesaFlow@SCC2026!';
  const pfHash = await bcrypt.hash(pfPassword, 10);

  const pesaflowAccounts = [
    { email: 'pesaflow@ecitizen.go.ke',      firstName: 'PesaFlow',     lastName: 'Admin',    label: 'main' },
    { email: 'pesaflow.sla@ecitizen.go.ke',  firstName: 'PesaFlow',     lastName: 'SLA',      label: 'SLA test' },
    { email: 'pesaflow.chat@ecitizen.go.ke', firstName: 'PesaFlow',     lastName: 'Chat',     label: 'chat test' },
  ];

  for (const acc of pesaflowAccounts) {
    const u = await prisma.user.upsert({
      where: { email: acc.email },
      update: { passwordHash: pfHash, isActive: true, isVerified: true, userType: UserType.SUPER_ADMIN, firstName: acc.firstName, lastName: acc.lastName },
      create: { email: acc.email, firstName: acc.firstName, lastName: acc.lastName, userType: UserType.SUPER_ADMIN, passwordHash: pfHash, isActive: true, isVerified: true },
    });
    await prisma.user.update({ where: { email: acc.email }, data: { passwordHash: pfHash, isActive: true, isVerified: true } });
    if (superAdminRole) {
      const roleExists = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: superAdminRole.id } });
      if (!roleExists) await prisma.userRole.create({ data: { userId: u.id, roleId: superAdminRole.id } });
    }
    console.log(`✅ PesaFlow ${acc.label} account created (${acc.email} / ${pfPassword})`);
  }

  // ==========================================
  // Staff agents — for group chat testing
  // ==========================================
  const agentRole = await prisma.role.findUnique({ where: { name: 'L1_AGENT' } });
  const supervisorRole = await prisma.role.findUnique({ where: { name: 'L1_SUPERVISOR' } });
  const agencyAdminRole = await prisma.role.findUnique({ where: { name: 'AGENCY_ADMIN' } });

  const staffUsers = [
    { email: 'amina.wanjiku@ecitizen.go.ke',   firstName: 'Amina',   lastName: 'Wanjiku',   role: agentRole,      pw: 'Agent@2026!' },
    { email: 'brian.otieno@ecitizen.go.ke',     firstName: 'Brian',   lastName: 'Otieno',    role: agentRole,      pw: 'Agent@2026!' },
    { email: 'grace.mutua@ecitizen.go.ke',      firstName: 'Grace',   lastName: 'Mutua',     role: agentRole,      pw: 'Agent@2026!' },
    { email: 'david.kamau@ecitizen.go.ke',      firstName: 'David',   lastName: 'Kamau',     role: supervisorRole, pw: 'Super@2026!' },
    { email: 'fatuma.ali@ecitizen.go.ke',       firstName: 'Fatuma',  lastName: 'Ali',       role: agentRole,      pw: 'Agent@2026!' },
    { email: 'james.mwangi@ecitizen.go.ke',     firstName: 'James',   lastName: 'Mwangi',    role: supervisorRole, pw: 'Super@2026!' },
    { email: 'lucy.njeri@ecitizen.go.ke',       firstName: 'Lucy',    lastName: 'Njeri',     role: agentRole,      pw: 'Agent@2026!' },
    { email: 'peter.odhiambo@ecitizen.go.ke',   firstName: 'Peter',   lastName: 'Odhiambo',  role: agencyAdminRole,pw: 'AgAdmin@2026!' },
  ];

  for (const s of staffUsers) {
    const hash = await bcrypt.hash(s.pw, 10);
    const u = await prisma.user.upsert({
      where: { email: s.email },
      update: { passwordHash: hash, isActive: true, isVerified: true },
      create: { email: s.email, firstName: s.firstName, lastName: s.lastName, userType: UserType.AGENT, passwordHash: hash, isActive: true, isVerified: true },
    });
    if (s.role) {
      const exists = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: s.role.id } });
      if (!exists) await prisma.userRole.create({ data: { userId: u.id, roleId: s.role.id } });
    }
    console.log(`✅ Staff: ${s.firstName} ${s.lastName} (${s.email} / ${s.pw})`);
  }

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
    { providerName: 'Safaricom PLC',          providerType: 'PAYMENT_GATEWAY',     contactEmail: 'enterprise@safaricom.co.ke', contactPhone: '+254722000000' },
    { providerName: 'Equity Bank Kenya',      providerType: 'PAYMENT_GATEWAY',     contactEmail: 'eazzyapi@equitybank.co.ke', contactPhone: '+254763000000' },
    { providerName: 'Kenya Post Corporation', providerType: 'DELIVERY',            contactEmail: 'info@posta.co.ke',           contactPhone: '+254 20 2324000' },
    { providerName: 'PesaFlow',               providerType: 'PAYMENT_AGGREGATOR',  contactEmail: 'support@pesaflow.com',       contactPhone: '+254 709 920000' },
    { providerName: 'Webmasters Kenya Ltd',   providerType: 'TECHNOLOGY_PARTNER',  contactEmail: 'info@webmasters.co.ke',      contactPhone: '+254 700 000000' },
    { providerName: 'Olive Tree Media',       providerType: 'MERCHANT',            contactEmail: 'support@olivetree.co.ke',    contactPhone: '+254 720 000000' },
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

  // ==========================================
  // 13. Sample Tickets
  // ==========================================

  const [allTicketStatuses, allTicketPriorities, citizenForTickets] = await Promise.all([
    prisma.ticketStatus.findMany(),
    prisma.ticketPriorityLevel.findMany(),
    prisma.user.findUnique({ where: { email: 'citizen@example.com' } }),
  ]);

  const statusIdMap = Object.fromEntries(allTicketStatuses.map(s => [s.name, s.id]));
  const priorityIdMap = Object.fromEntries(allTicketPriorities.map(p => [p.name, p.id]));

  const agenciesForTickets = await prisma.agency.findMany({
    include: {
      ticketCategories: { take: 3 },
      departments: { take: 1 },
      agencyUsers: { take: 3, include: { user: true } },
    },
  });
  const agencyByCode = Object.fromEntries(agenciesForTickets.map(a => [a.agencyCode, a]));

  const ticketDefs: Array<{
    agencyCode: string;
    subject: string;
    description: string;
    status: TicketStatusName;
    priority: TicketPriorityName;
    channel: TicketChannel;
  }> = [
    // KRA
    { agencyCode: 'KRA', subject: 'Unable to file VAT returns on iTax', description: 'I have been trying to file my VAT returns for March 2026 but iTax keeps showing "Invalid PIN format". My PIN is A123456789X and has worked fine for 5 years.', status: TicketStatusName.OPEN, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'KRA', subject: 'PIN certificate not received after 3 weeks', description: 'Applied for KRA PIN certificate on 1st April 2026. Three weeks later no email or postal delivery. Reference: PIN/2026/04/00123.', status: TicketStatusName.ASSIGNED, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.WEB },
    { agencyCode: 'KRA', subject: 'Tax compliance certificate needed urgently for tender', description: 'Tax compliance certificate expired 15th March 2026. Renewal submitted 10th March but not updated. Needed urgently for government tender closing 30th April.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.CRITICAL, channel: TicketChannel.MOBILE },
    { agencyCode: 'KRA', subject: 'Customs duty dispute on imported laboratory equipment', description: 'Imported lab equipment valued at KES 2.5M from Germany. Assessment shows duty of KES 1.2M but educational equipment should attract 0% under EAC tariff schedules.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.HIGH, channel: TicketChannel.EMAIL },
    { agencyCode: 'KRA', subject: 'iTax password reset email not arriving', description: 'Requested password reset for iTax account but reset link has not arrived. Checked spam folder. Registered email: john.mwangi@gmail.com.', status: TicketStatusName.RESOLVED, priority: TicketPriorityName.LOW, channel: TicketChannel.WEB },
    { agencyCode: 'KRA', subject: 'PAYE remittance discrepancy of KES 45,000', description: 'Company PAYE remittances for Q1 2026 show KES 45,000 discrepancy on iTax versus our payroll records. Company PIN: P051234567X.', status: TicketStatusName.CLOSED, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.EMAIL },

    // NTSA
    { agencyCode: 'NTSA', subject: 'Driving licence renewal delayed 6 weeks', description: 'Renewed driving licence 1st March 2026, paid KES 3,000. Physical licence not delivered after 6 weeks. Application ref: DL/2026/03/45678.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'NTSA', subject: 'Vehicle logbook transfer stalled for 2 months', description: 'Purchased vehicle KCA 123X in February 2026 and submitted all transfer documents. Ownership still not updated in NTSA system after 2 months.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'NTSA', subject: 'Wrong engine capacity on vehicle inspection certificate', description: 'Inspection certificate for KBZ 456Y shows 1500cc engine instead of the correct 2000cc. Error made at Mombasa inspection station during March 2026 inspection.', status: TicketStatusName.ASSIGNED, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.MOBILE },
    { agencyCode: 'NTSA', subject: 'PSV licence application pending for 2 months', description: 'Applied for PSV licence for 14-seater matatu KDG 789Z on 15th February 2026. All documents submitted. No update received.', status: TicketStatusName.OPEN, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'NTSA', subject: 'Accident report reference not found on NTSA portal', description: 'Reported accident involving KCF 321W on 5th April 2026 at Nakuru-Nairobi highway. Reference ACC/2026/04/0089 not visible on NTSA online system.', status: TicketStatusName.RESOLVED, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.CALL_CENTER },

    // NHIF
    { agencyCode: 'NHIF', subject: 'Inpatient claim at Nairobi Hospital rejected', description: 'NHIF claim for inpatient treatment at Nairobi Hospital rejected as "Facility not in NHIF panel". Nairobi Hospital is an accredited NHIF facility. Treatment: 10-15 March 2026. Claim No: CLM/2026/03/78912.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.CRITICAL, channel: TicketChannel.WEB },
    { agencyCode: 'NHIF', subject: 'Newborn beneficiary not showing on NHIF smart card', description: 'Added newborn baby as beneficiary on NHIF portal 3 weeks ago. Baby not appearing at any accredited hospital on smart card reader. NHIF No: 1234567.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.HIGH, channel: TicketChannel.MOBILE },
    { agencyCode: 'NHIF', subject: 'Monthly contributions not posted for January and February', description: 'Employer deducting NHIF from salary since January 2026 but statement shows no contributions for January and February. Employer: ABC Company Ltd.', status: TicketStatusName.ASSIGNED, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'NHIF', subject: 'Urgent NHIF card replacement — surgery scheduled', description: 'NHIF card stolen on 20th March 2026. Need replacement urgently as surgery is scheduled at Kenyatta National Hospital on 10th May 2026.', status: TicketStatusName.RESOLVED, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.WEB },

    // IMMIGRATION
    { agencyCode: 'IMMIGRATION', subject: 'Passport renewal delayed 8 weeks — urgent travel', description: 'Applied for passport renewal on 1st February 2026. Eight weeks with no update. Application No: PP/2026/02/123456. Required for work travel on 30th May 2026.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.CRITICAL, channel: TicketChannel.WEB },
    { agencyCode: 'IMMIGRATION', subject: 'Work permit renewal rejected — filing appeal', description: 'Work permit renewal rejected citing "insufficient documentation" despite submitting all required documents including employment contract, academic certificates and tax compliance. Reference: WP/2026/03/89012.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.HIGH, channel: TicketChannel.EMAIL },
    { agencyCode: 'IMMIGRATION', subject: 'Business visitor visa not processed after 3 weeks', description: 'Applied business visa for South Korean partner Kim Jong-su (passport M12345678) on 5th April 2026. No response after 3 weeks. Guest must arrive 5th May for board meeting.', status: TicketStatusName.ASSIGNED, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'IMMIGRATION', subject: 'Original citizenship documents lost at immigration office', description: 'Submitted citizenship by naturalization application 15th January 2026 with original documents worth KES 50,000 including degree and birth certificate. Office says file cannot be located.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.CRITICAL, channel: TicketChannel.CALL_CENTER },
    { agencyCode: 'IMMIGRATION', subject: 'Name misspelled on newly issued passport', description: 'Newly issued passport shows "MWANGI JOHNE" instead of "MWANGI JOHN". Error by the department. Passport No: BK123456.', status: TicketStatusName.OPEN, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },

    // NSSF
    { agencyCode: 'NSSF', subject: 'Cannot access NSSF self service portal', description: 'Unable to log into NSSF self service portal. System shows "Account not found" despite being a member since 2015. NSSF No: 2234567.', status: TicketStatusName.OPEN, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.WEB },
    { agencyCode: 'NSSF', subject: 'Retirement benefits claim unprocessed for 6 months', description: 'Retired October 2025 and submitted retirement benefits claim. Six months with no payment or update. Ref: RET/2025/10/03456. Age 60, urgently need these funds.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.CRITICAL, channel: TicketChannel.WEB },
    { agencyCode: 'NSSF', subject: 'Employer not remitting NSSF contributions', description: 'Employer XYZ Manufacturing Ltd has been deducting NSSF from my payslip but not remitting. KES 6,000 in deductions from Jan-Mar 2026 not received by NSSF.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.HIGH, channel: TicketChannel.EMAIL },

    // NRB
    { agencyCode: 'NRB', subject: 'National ID application rejected without clear reason', description: 'Son aged 18 applied for first national ID at Westlands office on 20th March 2026. Application rejected without clear reason. All documents including birth certificate and school leaving cert were provided.', status: TicketStatusName.OPEN, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.WEB },
    { agencyCode: 'NRB', subject: 'Wrong date of birth on newly issued birth certificate', description: 'Birth certificate shows DOB as 15/06/1990 instead of 15/06/1995. Error is affecting university admission. Certificate No: BCK/2026/00123.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.HIGH, channel: TicketChannel.MOBILE },
    { agencyCode: 'NRB', subject: 'Lost ID replacement pending for 2 months', description: 'Reported lost ID and applied for replacement on 25th February 2026. Reference: LID/2026/02/4567. Two months have passed. Cannot access bank account or vote in the upcoming by-election.', status: TicketStatusName.ASSIGNED, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },

    // HELB
    { agencyCode: 'HELB', subject: 'Semester 2 loan disbursement not received', description: 'HELB loan approved for second semester but KES 45,000 disbursement not received. Institution confirmed funds sent to my account on 15th March 2026. Nothing has reflected. Student No: UN/20/12345.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'HELB', subject: 'HELB clearance blocked due to employer reporting error', description: 'Clearance certificate blocked because former employer ABC Ltd reported incorrect repayment amounts. Have receipts showing KES 280,000 repaid over 5 years.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'HELB', subject: 'Bursary application not visible on portal after submission', description: 'Submitted bursary application for 2026/2027 on 5th March 2026. Reference BUR/2026/03/78901. Application is not visible when logging in to check status.', status: TicketStatusName.OPEN, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.MOBILE },

    // ICT-AUTH
    { agencyCode: 'ICT-AUTH', subject: 'eCitizen portal services page blank on mobile browsers', description: 'The eCitizen portal does not load properly on Chrome and Safari on Android devices. Services page shows blank content. Reproduced on multiple devices and different networks.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'ICT-AUTH', subject: 'Kiambu County revenue API integration failure', description: 'Kiambu County revenue collection system integration with national eCitizen API has been failing since 1st April 2026. Citizens cannot pay county rates or business permit fees online. Estimated revenue impact: KES 2M/day.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.CRITICAL, channel: TicketChannel.API },
    { agencyCode: 'ICT-AUTH', subject: 'NGO training centre accreditation unanswered since January', description: 'Digital Kenya Foundation applied for ICT Authority accredited training centre status in January 2026. No response after 3 months despite meeting all requirements including certified trainers and equipment.', status: TicketStatusName.ASSIGNED, priority: TicketPriorityName.LOW, channel: TicketChannel.EMAIL },

    // KNEC
    { agencyCode: 'KNEC', subject: 'KCSE certificate not available for collection after 6 months', description: 'Sat KCSE in November 2025. It has been 6 months and my certificate is still not available for collection at Kiambu Boys High School. Index No: 012345/025.', status: TicketStatusName.OPEN, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'KNEC', subject: 'Wrong grade on KCSE certificate — re-marking appeal', description: 'My KCSE certificate shows a D+ in Mathematics but I scored B+ in my school mock exams and the KNEC online results showed B-. Applied for re-marking in February 2026 but no feedback. Index No: 023456/025.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.HIGH, channel: TicketChannel.EMAIL },

    // BRS
    { agencyCode: 'BRS', subject: 'Business name registration certificate not issued after 4 weeks', description: 'Registered business name "Pamoja Traders" on eCitizen on 1st March 2026 and paid KES 950. Certificate of registration not issued after 4 weeks. Transaction ref: BRS/2026/03/45123.', status: TicketStatusName.IN_PROGRESS, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.WEB },
    { agencyCode: 'BRS', subject: 'Company annual returns filing system error', description: 'Trying to file annual returns for Mwangi Holdings Ltd (CR/2020/123456) for year 2025. System shows "Company not found" when entering company number on the portal.', status: TicketStatusName.OPEN, priority: TicketPriorityName.MEDIUM, channel: TicketChannel.WEB },

    // DCI
    { agencyCode: 'DCI', subject: 'Certificate of good conduct pending for 10 weeks', description: 'Applied for certificate of good conduct on 10th February 2026, paid KES 1,050, fingerprints taken at DCI headquarters. Ten weeks with no update. Needed for employment background check. Reference: CGC/2026/02/78901.', status: TicketStatusName.ESCALATED, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
    { agencyCode: 'DCI', subject: 'Online fraud report — no acknowledgement received', description: 'Reported online fraud on the DCI online portal on 20th March 2026. Lost KES 85,000 to a fake investment scheme. Have evidence including transaction records and WhatsApp screenshots. No acknowledgement received.', status: TicketStatusName.ASSIGNED, priority: TicketPriorityName.HIGH, channel: TicketChannel.WEB },
  ];

  let ticketCounter = 1;
  let ticketsSeeded = 0;

  for (const def of ticketDefs) {
    const agency = agencyByCode[def.agencyCode];
    if (!agency || !citizenForTickets) continue;

    const ticketNum = `TKT-2026-${String(ticketCounter).padStart(6, '0')}`;

    const existing = await prisma.ticket.findUnique({ where: { ticketNumber: ticketNum } });
    if (existing) {
      ticketCounter++;
      continue;
    }

    const daysAgo = (ticketCounter * 2) % 75;
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(8 + (ticketCounter % 9), ticketCounter % 60, 0, 0);

    const agentUser = agency.agencyUsers[ticketCounter % Math.max(agency.agencyUsers.length, 1)]?.user ?? null;
    const assigneeId = def.status !== TicketStatusName.OPEN ? (agentUser?.id ?? null) : null;

    let resolvedAt: Date | null = null;
    let closedAt: Date | null = null;
    let firstResponseAt: Date | null = null;

    if (assigneeId) {
      firstResponseAt = new Date(createdAt);
      firstResponseAt.setHours(firstResponseAt.getHours() + 3);
    }
    if (def.status === TicketStatusName.RESOLVED || def.status === TicketStatusName.CLOSED) {
      resolvedAt = new Date(createdAt);
      resolvedAt.setDate(resolvedAt.getDate() + 2);
    }
    if (def.status === TicketStatusName.CLOSED) {
      closedAt = new Date(resolvedAt!);
      closedAt.setDate(closedAt.getDate() + 1);
    }

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: ticketNum,
        agencyId: agency.id,
        departmentId: agency.departments[0]?.id ?? null,
        categoryId: agency.ticketCategories[ticketCounter % Math.max(agency.ticketCategories.length, 1)]?.id ?? null,
        createdBy: citizenForTickets.id,
        currentAssigneeId: assigneeId,
        priorityId: priorityIdMap[def.priority],
        statusId: statusIdMap[def.status],
        channel: def.channel,
        subject: def.subject,
        description: def.description,
        firstResponseAt,
        resolvedAt,
        closedAt,
        isEscalated: def.status === TicketStatusName.ESCALATED,
        createdAt,
        updatedAt: createdAt,
      },
    });

    // Citizen's opening message
    await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: citizenForTickets.id,
        messageType: 'COMMENT',
        messageText: def.description,
        isInternal: false,
        createdAt,
      },
    });

    // Agent acknowledgement for non-open tickets
    if (assigneeId && firstResponseAt) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: assigneeId,
          messageType: 'COMMENT',
          messageText: `Thank you for contacting us. We have received your complaint regarding "${def.subject}" and assigned it for review. You will receive a detailed update within 24 hours.`,
          isInternal: false,
          createdAt: firstResponseAt,
        },
      });
    }

    // Resolution message
    if (resolvedAt && assigneeId) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: assigneeId,
          messageType: 'STATUS_CHANGE',
          messageText: 'Your complaint has been reviewed and resolved. Please confirm if the issue has been addressed to your satisfaction. If not, you may request a re-opening within 7 days.',
          isInternal: false,
          createdAt: resolvedAt,
        },
      });
    }

    ticketCounter++;
    ticketsSeeded++;
  }

  console.log(`✅ ${ticketsSeeded} sample tickets seeded (skipped existing)`);

  // ==========================================
  // 14. Additional Diverse Users
  // ==========================================
  const diversePwd = await bcrypt.hash('Staff@123', 10);
  const [
    agencyAdminRole, l1SupervisorRole, l2ProviderRole,
    commandCenterAdminRole, auditorRole, analystRole, executiveViewerRole,
  ] = await Promise.all([
    prisma.role.findUnique({ where: { name: 'AGENCY_ADMIN' } }),
    prisma.role.findUnique({ where: { name: 'L1_SUPERVISOR' } }),
    prisma.role.findUnique({ where: { name: 'L2_PROVIDER' } }),
    prisma.role.findUnique({ where: { name: 'COMMAND_CENTER_ADMIN' } }),
    prisma.role.findUnique({ where: { name: 'AUDITOR' } }),
    prisma.role.findUnique({ where: { name: 'ANALYST' } }),
    prisma.role.findUnique({ where: { name: 'EXECUTIVE_VIEWER' } }),
  ]);

  const globalStaff = [
    { email: 'cc.admin@ecitizen.go.ke', firstName: 'Command', lastName: 'Center', userType: UserType.COMMAND_CENTER_ADMIN, role: commandCenterAdminRole },
    { email: 'auditor@ecitizen.go.ke', firstName: 'Compliance', lastName: 'Auditor', userType: UserType.COMMAND_CENTER_ADMIN, role: auditorRole },
    { email: 'analyst@ecitizen.go.ke', firstName: 'Data', lastName: 'Analyst', userType: UserType.COMMAND_CENTER_ADMIN, role: analystRole },
    { email: 'executive@ecitizen.go.ke', firstName: 'Executive', lastName: 'Viewer', userType: UserType.COMMAND_CENTER_ADMIN, role: executiveViewerRole },
  ];
  for (const s of globalStaff) {
    const u = await prisma.user.upsert({ where: { email: s.email }, update: {}, create: { email: s.email, firstName: s.firstName, lastName: s.lastName, userType: s.userType, passwordHash: diversePwd, isActive: true, isVerified: true } });
    if (s.role) {
      const ex = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: s.role.id, agencyId: null } });
      if (!ex) await prisma.userRole.create({ data: { userId: u.id, roleId: s.role.id } });
    }
  }

  const keyAgencyCodes = ['KRA', 'NTSA', 'NHIF', 'IMMIGRATION', 'NSSF', 'NRB'];
  const agenciesForStaff = await prisma.agency.findMany({ where: { agencyCode: { in: keyAgencyCodes } } });
  for (const ag of agenciesForStaff) {
    const code = ag.agencyCode.toLowerCase().replace(/-/g, '');
    const domain = ['nhif', 'nssf', 'helb', 'knec'].includes(code) ? `${code}.or.ke` : `${code}.go.ke`;

    for (const [roleRef, suffix, firstName] of [
      [l1SupervisorRole, 'supervisor', 'L1 Supervisor'],
      [agencyAdminRole, 'admin', 'Agency Admin'],
    ] as [typeof l1SupervisorRole, string, string][]) {
      if (!roleRef) continue;
      const email = `${suffix}@${domain}`;
      const u = await prisma.user.upsert({ where: { email }, update: {}, create: { email, firstName, lastName: ag.agencyCode, userType: UserType.AGENCY_AGENT, passwordHash: diversePwd, isActive: true, isVerified: true } });
      const ex = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: roleRef.id, agencyId: ag.id } });
      if (!ex) await prisma.userRole.create({ data: { userId: u.id, roleId: roleRef.id, agencyId: ag.id } });
      await prisma.agencyUser.upsert({ where: { uq_agency_user: { userId: u.id, agencyId: ag.id } }, update: {}, create: { userId: u.id, agencyId: ag.id } });
    }
  }
  console.log('✅ Additional diverse users seeded');

  // ==========================================
  // 15. Role Permissions for All Remaining Roles
  // ==========================================
  const allPermsNow = await prisma.permission.findMany();
  const rolePermConfig: Record<string, string[]> = {
    COMMAND_CENTER_ADMIN: ['ticket:create','ticket:read','ticket:update','ticket:assign','ticket:escalate','ticket:close','user:read','agency:read','sla:read','sla:configure','ai:read','ai:override','dashboard:read','report:read','report:export','knowledge_base:read','knowledge_base:create','knowledge_base:update','notification:read','notification:send','audit:read','media:upload','media:read'],
    AGENCY_ADMIN: ['ticket:create','ticket:read','ticket:update','ticket:assign','ticket:escalate','ticket:close','ticket:delete','user:create','user:read','user:update','user:manage_roles','agency:read','agency:update','agency:configure','sla:read','sla:configure','ai:read','dashboard:read','report:read','report:export','knowledge_base:create','knowledge_base:read','knowledge_base:update','notification:read','notification:send','notification:configure','audit:read','media:upload','media:read','media:delete'],
    L1_SUPERVISOR: ['ticket:create','ticket:read','ticket:update','ticket:assign','ticket:escalate','ticket:close','user:read','agency:read','sla:read','ai:read','dashboard:read','report:read','knowledge_base:read','knowledge_base:create','notification:read','audit:read','media:upload','media:read'],
    L2_PROVIDER: ['ticket:read','ticket:update','ticket:close','agency:read','sla:read','knowledge_base:read','notification:read','media:upload','media:read'],
    AUDITOR: ['ticket:read','user:read','agency:read','sla:read','audit:read','audit:export','report:read','report:export','dashboard:read','knowledge_base:read','media:read'],
    ANALYST: ['ticket:read','agency:read','sla:read','ai:read','dashboard:read','report:read','report:export','knowledge_base:read','media:read'],
    EXECUTIVE_VIEWER: ['ticket:read','agency:read','sla:read','dashboard:read','report:read','media:read'],
  };
  for (const [roleName, permKeys] of Object.entries(rolePermConfig)) {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) continue;
    for (const perm of allPermsNow.filter(p => permKeys.includes(`${p.resource}:${p.action}`))) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } }, update: {}, create: { roleId: role.id, permissionId: perm.id } });
    }
  }
  console.log('✅ Role permissions for all roles seeded');

  // ==========================================
  // 16. Knowledge Base — Categories, Articles, Tags
  // ==========================================
  const kbAdmin = await prisma.user.findUnique({ where: { email: 'admin@ecitizen.go.ke' } });

  const globalKbCats = [
    { name: 'Getting Started', description: 'How to use the eCitizen portal' },
    { name: 'Account & Registration', description: 'Login, registration and account management' },
    { name: 'Payments & Fees', description: 'Payment methods, receipts and fee disputes' },
    { name: 'Technical Issues', description: 'Portal errors, browser issues and system problems' },
    { name: 'Service Status', description: 'Planned maintenance and service availability' },
    { name: 'Appeals & Escalations', description: 'How to appeal decisions or escalate complaints' },
    { name: 'Passport & Immigration', description: 'Passport applications, renewals and immigration services' },
    { name: 'Business Registration', description: 'Company registration, business permits and licences' },
    { name: 'Land & Property', description: 'Land title deeds, searches, transfers and rates' },
    { name: 'Health Services', description: 'NHIF, NHCR, MOH health services and facilities' },
    { name: 'Education & HELB', description: 'HELB loans, bursaries and education services' },
    { name: 'Civil Registration', description: 'Birth, death and marriage certificates' },
    { name: 'County Services', description: 'County permits, rates and local government services' },
    { name: 'Driving & Vehicles', description: 'NTSA vehicle registration, licences and transfers' },
    { name: 'Tax Compliance', description: 'KRA tax returns, compliance certificates and payments' },
  ];
  const kbCatIds: Record<string, string> = {};
  for (const c of globalKbCats) {
    const ex = await prisma.kbCategory.findFirst({ where: { agencyId: null, name: c.name } });
    const rec = ex ?? await prisma.kbCategory.create({ data: { name: c.name, description: c.description, isActive: true } });
    kbCatIds[c.name] = rec.id;
  }

  const globalTagNames = ['eCitizen', 'portal', 'payments', 'technical', 'account', 'password', 'registration', 'complaints', 'escalation', 'online-services', 'passport', 'immigration', 'business', 'company', 'land', 'title-deed', 'NHIF', 'health', 'HELB', 'loan', 'birth-certificate', 'marriage', 'county', 'permits', 'NTSA', 'vehicle', 'KRA', 'tax', 'driving-licence', 'civil-registration'];
  const kbTagIds: Record<string, string> = {};
  for (const name of globalTagNames) {
    const ex = await prisma.kbTag.findFirst({ where: { agencyId: null, name } });
    const rec = ex ?? await prisma.kbTag.create({ data: { name } });
    kbTagIds[name] = rec.id;
  }

  const kbArticles = [
    {
      title: 'How to Create a Support Ticket',
      slug: 'how-to-create-support-ticket',
      category: 'Getting Started',
      tags: ['eCitizen', 'portal'],
      summary: 'Step-by-step guide to creating a support ticket on the eCitizen portal.',
      content: `## Creating a Support Ticket\n\nIf you are experiencing issues with any government service, raise a ticket through the eCitizen portal.\n\n### Steps\n1. Log in at ecitizen.go.ke\n2. Click **My Tickets** → **New Ticket**\n3. Select the government agency\n4. Choose the service category\n5. Provide a clear subject and description\n6. Attach supporting documents if available\n7. Click **Submit Ticket**\n\n### Expected Response Times\n| Priority | First Response | Resolution |\n|----------|---------------|------------|\n| Critical | 15 minutes | 2 hours |\n| High | 1 hour | 8 hours |\n| Medium | 4 hours | 24 hours |\n| Low | 8 hours | 48 hours |`,
    },
    {
      title: 'Understanding Ticket Status Meanings',
      slug: 'ticket-status-meanings',
      category: 'Getting Started',
      tags: ['eCitizen', 'complaints'],
      summary: 'What each ticket status means and what action to take.',
      content: `## Ticket Status Guide\n\n| Status | Meaning |\n|--------|--------|\n| **Open** | Received, awaiting assignment |\n| **Assigned** | Agent assigned, will contact you shortly |\n| **In Progress** | Actively being worked on |\n| **Escalated** | Elevated to senior team |\n| **Pending Citizen** | We need more information from you |\n| **Resolved** | Issue resolved — please confirm within 7 days |\n| **Closed** | Complete |\n| **Reopened** | Reopened after you raised a concern |`,
    },
    {
      title: 'How to Pay Government Service Fees Online',
      slug: 'paying-government-fees-online',
      category: 'Payments & Fees',
      tags: ['payments', 'portal', 'eCitizen'],
      summary: 'How to pay government fees using M-Pesa, cards, or internet banking.',
      content: `## Paying Government Fees on eCitizen\n\n### Payment Methods\n- **M-Pesa** (Lipa na M-Pesa / Pay Bill)\n- **Visa / Mastercard** credit and debit cards\n- **KCB, Equity, Co-op** internet banking\n- **Pesalink** bank transfers\n\n### Pay via M-Pesa\n1. Select **M-Pesa** on the payment page\n2. Enter your M-Pesa registered phone number\n3. Enter your M-Pesa PIN on the STK push\n4. Receipt sent to your registered email\n\n### Fee Disputes\nRaise a support ticket under the relevant agency, category: **Payment Issues**.`,
    },
    {
      title: 'eCitizen Portal Not Loading — Troubleshooting',
      slug: 'portal-not-loading-troubleshooting',
      category: 'Technical Issues',
      tags: ['technical', 'portal'],
      summary: 'Fix common portal loading issues on desktop and mobile.',
      content: `## eCitizen Portal Troubleshooting\n\n### Step 1: Clear Browser Cache\nPress **Ctrl+Shift+Delete** → select All time → clear Cookies and Cache.\n\n### Step 2: Try a Different Browser\nRecommended: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+. IE is not supported.\n\n### Step 3: Try Incognito Mode\nDisables extensions that may interfere.\n\n### Step 4: Check Internet\nTry another website. Switch from mobile data to WiFi if needed.\n\n### Still Not Working?\nRaise a ticket under **ICT Authority → Technical Issues** and include your browser version and a screenshot.`,
    },
    {
      title: 'How to Reset Your eCitizen Password',
      slug: 'reset-ecitizen-password',
      category: 'Account & Registration',
      tags: ['password', 'account'],
      summary: 'Reset your password via email OTP or phone number.',
      content: `## Resetting Your Password\n\n### Method 1: Email Reset\n1. Click **Forgot Password?** on the login page\n2. Enter your registered email\n3. Click the reset link in your email (check spam)\n4. Set a new password (min 8 chars, uppercase, number, special character)\n\n### Method 2: Phone Reset\n1. Click **Forgot Password? → Reset via Phone**\n2. Enter your registered phone number\n3. Enter the OTP sent via SMS\n\n### Email No Longer Active?\nVisit any Huduma Centre with your National ID.`,
    },
    {
      title: 'How to Escalate a Complaint',
      slug: 'how-to-escalate-complaint',
      category: 'Appeals & Escalations',
      tags: ['escalation', 'complaints'],
      summary: 'When and how to escalate a complaint to a supervisor.',
      content: `## Escalating Your Complaint\n\n### When to Escalate\n- Ticket open longer than expected resolution time\n- Unsatisfied with response\n- Involves a legal matter or significant financial impact\n\n### Steps\n1. Open your ticket from **My Tickets**\n2. Click **Request Escalation**\n3. Select reason and add context\n4. Click **Submit Escalation**\n\n### Escalation Levels\n| Level | Team | Response Time |\n|-------|------|---------------|\n| Level 1 | Support Agent | Per SLA |\n| Level 2 | Supervisor | 4 hours |\n| Level 3 | Agency Director | 24 hours |`,
    },
    {
      title: 'eCitizen Maintenance Schedule',
      slug: 'maintenance-schedule',
      category: 'Service Status',
      tags: ['technical', 'portal'],
      summary: 'Regular maintenance windows and how to check service status.',
      content: `## Service Maintenance\n\n### Regular Window\nEvery **Sunday 01:00–05:00 EAT**. Some services may be unavailable.\n\n### How to Check Status\n- Check the homepage for banner notifications\n- Follow **@eCitizenKe** on social media\n\n### Emergency Maintenance\nNotice displayed at least 2 hours in advance where possible.\n\n### Agency Systems\nKRA iTax, NTSA TIMS, and NHIF portal have independent maintenance windows managed by each agency.`,
    },
    {
      title: 'Tracking Your KRA PIN Application',
      slug: 'tracking-kra-pin-application',
      category: 'Getting Started',
      tags: ['eCitizen', 'registration'],
      summary: 'How to track your KRA PIN certificate application status.',
      content: `## KRA PIN Application Tracking\n\n### Online Tracking\n1. Go to itax.kra.go.ke\n2. Click **PIN Checker**\n3. Enter your ID number or previous application reference\n\n### Common Issues\n- **"Invalid PIN format"**: Ensure your PIN starts with a letter (A/P) and ends with a letter\n- **Certificate not received**: Allow 5 business days. If not received after 7 days, raise a ticket under **KRA → PIN Registration**\n- **Wrong details on PIN**: Raise a ticket under **KRA → Tax Compliance** with your ID number and correct details\n\n### New PIN vs Renewal\nFirst-time applicants register at any KRA office or online. Renewals are done online only.`,
    },
    {
      title: 'NTSA Driving Licence — Application and Renewal',
      slug: 'ntsa-driving-licence-guide',
      category: 'Getting Started',
      tags: ['eCitizen', 'registration'],
      summary: 'Complete guide for NTSA driving licence application and renewal.',
      content: `## Driving Licence Guide\n\n### New Application\n1. Book a driving test at any NTSA-accredited driving school\n2. Pass the test and obtain a Test Pass Certificate\n3. Apply at NTSA eCitizen portal: select **Driving Licence Application**\n4. Pay KES 3,000\n5. Physical licence delivered within 21 days\n\n### Renewal\n1. Log in to eCitizen, select **NTSA → Renew Driving Licence**\n2. Confirm your details\n3. Pay KES 3,000\n4. Licence renewed for 3 years\n\n### Not Received?\nAllow 21 business days. If not delivered, raise a ticket under **NTSA → Driving Licence** with your application reference.`,
    },
    {
      title: 'NHIF Membership — Registration and Benefits',
      slug: 'nhif-membership-guide',
      category: 'Health Services',
      tags: ['NHIF', 'health', 'registration'],
      summary: 'How to register for NHIF and understand your benefits.',
      content: `## NHIF Membership\n\n### Registration\n1. Visit nhif.or.ke or any NHIF office\n2. For formal employment: your employer registers you automatically\n3. For self-employment/informal sector: apply for **Voluntary Member** status\n   - Pay KES 500/month for individuals\n   - Covers you and up to 4 immediate family members\n\n### Adding Beneficiaries\n1. Log in to NHIF portal\n2. Click **Manage Beneficiaries → Add Beneficiary**\n3. Enter name, ID/birth certificate number, relationship\n4. Changes reflect within 48 hours\n\n### Checking Contributions\nLog in to nhif.or.ke → **Statement of Contributions** for a full history.\n\n### Hospital Cover\nNHIF covers inpatient and outpatient services at accredited hospitals. Present your NHIF card and national ID at the facility.\n\n### Common Issues\n- **Card not working**: Verify your contributions are up-to-date (3 consecutive months minimum)\n- **Wrong beneficiary details**: Visit nearest NHIF office with your ID and birth certificate\n- **Employer not remitting**: File a complaint under **NHIF → Employer Compliance**`,
    },
    // ── Passport & Immigration ────────────────────────────────────────────────
    {
      title: 'Passport Application — New & Renewal',
      slug: 'passport-application-guide',
      category: 'Passport & Immigration',
      tags: ['passport', 'immigration', 'eCitizen'],
      summary: 'How to apply for or renew a Kenyan passport on eCitizen.',
      content: `## Kenyan Passport Application\n\n### Fees\n| Type | Fee |\n|------|-----|\n| 34-page Ordinary | KES 4,550 |\n| 50-page Ordinary | KES 7,550 |\n| Urgent (5 working days) | KES 9,100 |\n| East African e-Passport | KES 6,550 |\n\n### Steps\n1. Log in at ecitizen.go.ke → **Department of Immigration → Passport**\n2. Select **New Passport** or **Renewal**\n3. Fill in personal details (must match your National ID exactly)\n4. Upload a clear photo (white background, no glasses)\n5. Upload a scanned copy of your National ID\n6. Pay via M-Pesa, card, or bank transfer\n7. Book an appointment at your preferred Huduma Centre or immigration office\n8. Attend with original documents for biometric capture\n\n### Processing Time\n- Standard: 10–21 business days\n- Urgent: 5 business days (available at Nyayo House and major Huduma Centres)\n\n### Collection\nPassport is collected at the office where biometrics were taken. Bring your receipt and national ID.\n\n### Child Passport\nChildren under 18 require:\n- Birth certificate\n- Both parents' IDs / passports\n- Declaration of consent if one parent is absent\n\n### Common Issues\n- **"Details mismatch"**: Your eCitizen profile name must match your national ID\n- **Payment confirmed but not reflecting**: Wait 30 minutes, then raise a ticket under **Immigration → Payment Issues**\n- **Appointment not available**: Try different offices or check back next day — slots refresh daily`,
    },
    {
      title: 'East African Tourist Visa — How to Apply',
      slug: 'east-african-tourist-visa',
      category: 'Passport & Immigration',
      tags: ['passport', 'immigration'],
      summary: 'Apply for an East African Tourist Visa covering Kenya, Uganda, and Rwanda.',
      content: `## East African Tourist Visa\n\nThe **East African Tourist Visa (EATV)** allows a single entry into Kenya, Uganda, and Rwanda for USD 100.\n\n### Eligibility\nCitizens of countries that are not EAC member states or do not have bilateral visa-free agreements.\n\n### How to Apply\n1. Visit evisa.go.ke\n2. Select **East African Tourist Visa**\n3. Fill in personal and travel details\n4. Upload passport bio-data page, photo, return ticket, hotel booking, and bank statement\n5. Pay USD 100 via card\n6. Visa issued within 3–5 business days\n\n### Validity\n- 90 days from date of issue\n- Multiple entry across Kenya, Uganda, Rwanda\n\n### Kenya Single Entry\nIf visiting Kenya only, apply for a **Kenya Single Entry Visa** at USD 50.\n\n### Issues\n- **Visa rejected**: Application must show sufficient funds (min USD 100/day) and a valid return ticket\n- **Processing delay**: Raise a ticket under **Immigration → Visa Processing**`,
    },
    // ── Business Registration ─────────────────────────────────────────────────
    {
      title: 'How to Register a Business in Kenya',
      slug: 'business-registration-kenya',
      category: 'Business Registration',
      tags: ['business', 'registration', 'company', 'eCitizen'],
      summary: 'Step-by-step guide to registering a sole proprietorship, partnership, or limited company.',
      content: `## Business Registration\n\n### Types of Business Entities\n| Type | Min. Directors | Registration Fee |\n|------|---------------|------------------|\n| Sole Proprietorship | 1 | KES 950 |\n| Partnership | 2–20 | KES 2,000 |\n| Private Limited Company | 1 | KES 17,000 |\n| Public Limited Company | 7 | KES 67,000 |\n\n### Sole Proprietorship\n1. Log in at ecitizen.go.ke → **Business Registration Service (BRS)**\n2. Select **Business Name Registration**\n3. Run a name search (KES 100)\n4. Fill in business details, nature, and location\n5. Pay KES 950\n6. Certificate issued within 3 business days\n\n### Private Limited Company\n1. Reserve company name: KES 100\n2. Fill in Memorandum and Articles of Association\n3. Provide ID and PIN for each director/shareholder\n4. Pay KES 17,000\n5. Certificate of Incorporation issued within 5–10 business days\n\n### Annual Returns\nAll registered companies must file annual returns:\n- Sole Proprietorship: KES 100/year\n- Limited Company: KES 2,000/year\nFiling via ecitizen.go.ke → BRS → Annual Returns\n\n### Business Permit\nAfter registration, obtain a county single business permit from your County Government.`,
    },
    {
      title: 'Single Business Permit — County Government',
      slug: 'single-business-permit-county',
      category: 'County Services',
      tags: ['business', 'county', 'permits'],
      summary: 'How to obtain or renew a Single Business Permit from your county government.',
      content: `## Single Business Permit\n\n### What is it?\nA **Single Business Permit (SBP)** consolidates all county business licences into one. Required by all businesses operating within a county.\n\n### Requirements\n- National ID / Certificate of Incorporation\n- Business registration certificate (BRS)\n- KRA PIN\n- Completed application form\n\n### Application\n1. Visit your county government portal (e.g., nairobi.go.ke, mombasa.go.ke)\n2. Select **Single Business Permit**\n3. Fill in business details and premises address\n4. Pay the applicable fee (varies by county and business type)\n5. Health inspection may be required for food businesses\n6. Permit issued within 5–10 business days\n\n### Nairobi Fee Structure (sample)\n| Category | Annual Fee |\n|----------|------------|\n| Small trader (under KES 500K turnover) | KES 5,000 |\n| Medium business (KES 500K–5M) | KES 10,000 |\n| Large business (over KES 5M) | KES 20,000+ |\n\n### Renewal\nPermits expire 31 December annually. Renew by 31 March to avoid penalties.`,
    },
    // ── Land & Property ───────────────────────────────────────────────────────
    {
      title: 'How to Do a Land Title Search',
      slug: 'land-title-search',
      category: 'Land & Property',
      tags: ['land', 'title-deed', 'eCitizen'],
      summary: 'How to verify land ownership online via the Ardhisasa platform.',
      content: `## Land Title Search\n\nA title search confirms ownership, encumbrances, and caveats on a parcel of land.\n\n### Online (Ardhisasa)\n1. Visit ardhisasa.go.ke and register/log in\n2. Select **Title Search**\n3. Enter the Title Deed number or parcel number\n4. Pay KES 500\n5. Report available instantly\n\n### What the Report Shows\n- Registered owner(s) name\n- Date of registration\n- Any charges, cautions, or caveats\n- Historical transfers\n\n### Common Issues\n- **"Parcel not found"**: Older titles on green/blue cards may not yet be digitized. Visit the nearest Land Registry office\n- **Multiple owners listed**: Land was co-registered — all owners must consent to any transaction\n- **Caution/Caveat on title**: Do not proceed with purchase until caution is lifted\n\n### Title Transfer (Buying Land)\n1. Conduct a title search\n2. Engage a licensed advocate for conveyancing\n3. Sign the sale agreement\n4. File consent to transfer with the Lands Board if applicable\n5. Pay stamp duty (2% in municipalities, 4% in rural areas)\n6. Register transfer at Land Registry (Ardhisasa for digitized parcels)\n\n### Land Rates\nCounty land rates must be cleared before any transfer. Obtain a clearance certificate from the county government.`,
    },
    {
      title: 'Replacing a Lost or Destroyed Title Deed',
      slug: 'replace-lost-title-deed',
      category: 'Land & Property',
      tags: ['land', 'title-deed'],
      summary: 'How to apply for a replacement title deed if the original is lost or destroyed.',
      content: `## Replacing a Lost Title Deed\n\n### Requirements\n- Statutory Declaration (sworn before a commissioner for oaths)\n- Police abstract (OB number from nearest police station)\n- Application letter to the Land Registrar\n- Copy of ID/PIN\n- 2 passport photos\n- Application fee\n\n### Process\n1. Obtain a police abstract reporting the lost title\n2. Swear a statutory declaration before a Commissioner for Oaths (advocate)\n3. Place a **Gazette Notice** (advertised for 30 days — KES 1,500 via the Government Press)\n4. Submit all documents to the Land Registry for your area\n5. Wait 30 days (objection period)\n6. If no objection, new title issued within 30–60 days\n\n### Fees\n- Application: KES 500\n- Gazette Notice: KES 1,500\n- New title: KES 2,000\n\n### Fraud Warning\nNever share title deed details with strangers. Always use a licensed advocate for land transactions.`,
    },
    // ── Education & HELB ──────────────────────────────────────────────────────
    {
      title: 'HELB Loan Application Guide',
      slug: 'helb-loan-application',
      category: 'Education & HELB',
      tags: ['HELB', 'loan', 'registration'],
      summary: 'How to apply for a HELB student loan for undergraduate and TVET students.',
      content: `## HELB Loan Application\n\n### Undergraduate Loan\n**Eligibility**: Kenyan citizen admitted to a public or accredited private university.\n\n#### Application Steps\n1. Register at helb.co.ke → **Portal → New Application**\n2. Fill in personal details (must match National ID)\n3. Enter admission letter details and course\n4. Provide parent/guardian income details\n5. Attach:\n   - National ID\n   - Admission letter\n   - Previous year KCSE/KUCCPS results\n   - Parent/guardian ID and KRA PIN\n6. Submit — no payment required\n\n#### Loan Bands\n| Household Income | Loan Amount/Year |\n|-----------------|------------------|\n| Under KES 30,000 | KES 60,000 |\n| KES 30,001–60,000 | KES 53,000 |\n| KES 60,001–120,000 | KES 46,000 |\n| Over KES 120,000 | KES 36,000 |\n\n#### Disbursement\nLoan is disbursed directly to your university account each semester after confirmation of registration.\n\n### TVET Loan\n- TVET students: KES 20,000–30,000/year\n- Apply via helb.co.ke → **TVET Portal**\n\n### Loan Repayment\nRepayment begins 1 year after graduation or after securing employment (whichever is sooner). Minimum KES 1,000/month.\n\n### Common Issues\n- **Application rejected**: Check that parent income details are accurate and supporting documents are legible\n- **Loan not disbursed**: Confirm registration status with your university — HELB disburses only to registered students\n- **Wrong loan band**: Appeal via helb.co.ke → **Appeals** with updated income documents`,
    },
    {
      title: 'HELB Loan Repayment — How to Pay',
      slug: 'helb-loan-repayment',
      category: 'Education & HELB',
      tags: ['HELB', 'loan', 'payments'],
      summary: 'How to repay your HELB loan via M-Pesa, bank, or salary deduction.',
      content: `## HELB Loan Repayment\n\n### Repayment Methods\n\n#### M-Pesa\n1. Go to **M-Pesa → Pay Bill**\n2. Business Number: **200999**\n3. Account Number: Your National ID number\n4. Amount: KES 1,000 minimum\n\n#### Bank Transfer\n- Bank: KCB\n- Account Name: Higher Education Loans Board\n- Account Number: **1109162753**\n- Reference: Your National ID number\n\n#### Salary Deduction (Employed)\nEmployers are required by law to deduct HELB from your salary. Submit your HELB certificate (obtained from helb.co.ke) to your HR/Payroll department.\n\n### Checking Your Balance\n1. SMS your National ID to **21101**\n2. Or log in to helb.co.ke → **Loan Statement**\n\n### Clearance Certificate\nRequested after full repayment. Apply at helb.co.ke → **Clearance Certificate** (KES 600 fee).\nNeeded for: \n- Some job applications in government\n- Professional licensing boards\n\n### Common Issues\n- **Paid but balance not updated**: Allow 3 business days. If not resolved, raise a ticket under **HELB → Payment Issues** with your M-Pesa confirmation code`,
    },
    // ── Civil Registration ────────────────────────────────────────────────────
    {
      title: 'Birth Certificate Application',
      slug: 'birth-certificate-application',
      category: 'Civil Registration',
      tags: ['birth-certificate', 'civil-registration', 'eCitizen'],
      summary: 'How to apply for a birth certificate online or at a Huduma Centre.',
      content: `## Birth Certificate\n\n### New Birth (Under 6 Months)\n1. Obtain a **Notification of Birth** from the hospital/nurse within 28 days\n2. Visit the Civil Registration office in your area (or Sub-County hospital)\n3. Bring both parents' national IDs and the notification form\n4. Certificate issued within 7 days\n\n### Online Application (eCitizen)\n1. Log in at ecitizen.go.ke → **Department of Civil Registration → Birth Certificate**\n2. Enter the child's birth notification number\n3. Verify details and submit\n4. Pay KES 50 (standard) or KES 200 (same day)\n5. Collect at any Huduma Centre\n\n### Late Registration (Over 1 Year)\n1. Obtain an affidavit from a Chief/Sub-Chief confirming the birth\n2. Bring parent IDs, clinic card, and immunization record\n3. Visit the Civil Registration office\n4. KES 1,000 late registration fee applies\n\n### Certified Copy of Existing Certificate\n- Apply online at ecitizen.go.ke → **Civil Registration → Certified Copy**\n- Fee: KES 50 (standard), KES 200 (urgent)\n- Collection at Huduma Centre or by post\n\n### Common Issues\n- **Name spelling error**: Submit a correction form at the Civil Registration office with your parents' IDs and hospital records\n- **Father not listed**: Can be added later with an affidavit and both parents present`,
    },
    {
      title: 'Marriage Certificate — Application and Recognition',
      slug: 'marriage-certificate',
      category: 'Civil Registration',
      tags: ['marriage', 'civil-registration'],
      summary: 'How to register a marriage and obtain a marriage certificate in Kenya.',
      content: `## Marriage Registration\n\n### Types of Marriage in Kenya\n1. **Civil Marriage** (Attorney General's Office)\n2. **Christian Marriage** (licensed churches)\n3. **Islamic Marriage** (Kadhi's Courts)\n4. **Customary Marriage** (traditional)\n5. **Hindu Marriage** (licensed venues)\n\n### Registering a Civil Marriage\n1. Give **21 days notice** at any Civil Registry\n2. Both parties must be 18+ and not previously married\n3. Bring national IDs and 2 witnesses\n4. Pay KES 2,000\n5. Certificate issued same day\n\n### Online Certificate Order\n1. Log in at ecitizen.go.ke → **Civil Registration → Marriage Certificate**\n2. Enter marriage reference number\n3. Pay KES 50\n4. Collect at Huduma Centre\n\n### Foreign Marriage Recognition\nKenyan citizens married abroad must register the marriage at the AG's office within 90 days of return.\n\n### Common Issues\n- **Partner's name not matching ID**: Affidavit required from both parties with the correct names\n- **Old marriage certificate lost**: Apply for a certified copy at ecitizen.go.ke`,
    },
    // ── Driving & Vehicles ────────────────────────────────────────────────────
    {
      title: 'Motor Vehicle Transfer — Buying a Second-Hand Car',
      slug: 'motor-vehicle-transfer',
      category: 'Driving & Vehicles',
      tags: ['NTSA', 'vehicle', 'registration'],
      summary: 'How to transfer vehicle ownership after buying a second-hand car in Kenya.',
      content: `## Motor Vehicle Transfer\n\n### Before Buying\n1. Verify ownership via NTSA portal (ntsa.go.ke → **Vehicle Search**) — confirm registered owner and check for encumbrances (logbook loans)\n2. Ensure there are no outstanding fines or NTSA penalties\n3. Confirm the vehicle has valid insurance\n\n### Transfer Process\n1. Seller and buyer must both log in to ecitizen.go.ke → **NTSA → Transfer of Ownership**\n2. Both parties fill in and sign the **Motor Vehicle Transfer Form (Form 3)**\n3. Attach:\n   - Original logbook\n   - Both parties' national IDs\n   - Certificate of Insurance\n   - KRA PIN for both parties\n4. Pay stamp duty: 2% of vehicle value for vehicles under 5 years; 1% for older\n5. Pay NTSA transfer fee: KES 2,400\n6. New logbook issued within 5–10 business days\n\n### Logbook Loan Warning\nIf the vehicle has an active log-book loan, the bank must provide a **Clearance Letter** before transfer can proceed.\n\n### Inspection\nVehicles over 4 years old require a vehicle inspection at any NTSA-approved garage.\n\n### Common Issues\n- **"Transfer blocked"**: Outstanding fines or loan on vehicle — seller must clear before transfer\n- **Seller unavailable**: Cannot complete transfer — NTSA requires both parties online`,
    },
    {
      title: 'Traffic Fines — How to Check and Pay',
      slug: 'traffic-fines-payment',
      category: 'Driving & Vehicles',
      tags: ['NTSA', 'payments', 'driving-licence'],
      summary: 'How to check outstanding traffic fines and pay them online.',
      content: `## Traffic Fines\n\n### Checking Outstanding Fines\n1. Visit ecitizen.go.ke → **NTSA → Traffic Fines**\n2. Enter your **National ID** or **Driving Licence number**\n3. All outstanding fines and pending cases will be listed\n\n### Payment via M-Pesa\n1. M-Pesa → Pay Bill\n2. Business Number: **300800**\n3. Account: Your ID number or fine reference number\n4. Amount: Fine amount\n\n### Fine Amounts (Common)\n| Offence | Fine |\n|---------|------|\n| Speeding (10–30 km/h over limit) | KES 10,000 |\n| Speeding (over 30 km/h) | KES 20,000 |\n| Using phone while driving | KES 10,000 |\n| No seatbelt | KES 5,000 |\n| Overloading | KES 30,000 |\n| No valid licence | KES 50,000 |\n\n### Disputed Fines\n1. Raise a ticket under **NTSA → Traffic Fine Dispute**\n2. Attach a copy of the fine notice and your ID\n3. NTSA investigation takes 10–21 business days\n\n### Effect on Driving Licence Renewal\nOutstanding fines will block your driving licence renewal until cleared.`,
    },
    // ── Tax Compliance ────────────────────────────────────────────────────────
    {
      title: 'KRA Tax Compliance Certificate',
      slug: 'kra-tax-compliance-certificate',
      category: 'Tax Compliance',
      tags: ['KRA', 'tax', 'eCitizen'],
      summary: 'How to apply for a KRA Tax Compliance Certificate (TCC) online.',
      content: `## Tax Compliance Certificate (TCC)\n\n### What is it?\nA **Tax Compliance Certificate** confirms that a taxpayer is up-to-date with all KRA tax obligations. Required for:\n- Tenders and government contracts\n- Professional board membership\n- Some employment applications\n- Import/Export licences\n\n### Requirements for Issuance\n- All tax returns filed (Income Tax, VAT, PAYE if applicable)\n- No outstanding tax liabilities (or approved payment plan)\n- Active KRA PIN\n\n### How to Apply\n1. Log in at itax.kra.go.ke with your PIN and password\n2. Click **Certificates → Apply for Tax Compliance Certificate**\n3. System checks your compliance status automatically\n4. If compliant: certificate issued within 24 hours\n5. If not compliant: outstanding items are listed — resolve each before re-applying\n\n### Validity\n- TCC is valid for **12 months** from date of issue\n\n### Common Issues\n- **Pending returns**: File all outstanding returns via iTax. Employee (PAYE) returns are filed by employer\n- **Disputed assessment**: Request an amendment or file an objection at your KRA office before applying for TCC\n- **PIN forgotten**: Reset at any KRA office with your National ID\n\n### Downloading Your Certificate\nCertificates are in PDF format. Verify authenticity at itax.kra.go.ke → **Certificate Verification**.`,
    },
    {
      title: 'Filing Individual Income Tax Return (iTax)',
      slug: 'individual-income-tax-return',
      category: 'Tax Compliance',
      tags: ['KRA', 'tax', 'payments'],
      summary: 'Step-by-step guide to filing your annual individual income tax return on iTax.',
      content: `## Individual Income Tax Return\n\n### Who Must File?\n- All persons with a KRA PIN who earn income\n- Even if PAYE is deducted by employer — you must file a **Nil Return** or confirm P9 details\n\n### Filing Deadline\n- **30 June** of the following year (e.g., 2024 returns due 30 June 2025)\n- Late filing penalty: KES 2,000 per month\n\n### Steps\n1. Log in at itax.kra.go.ke\n2. Click **Returns → File Return → Income Tax → Resident Individual**\n3. Select year of income\n4. Fill in employment income from your **P9 form** (obtain from employer)\n5. Add any other income: rental, business, dividends\n6. Deductions: National Pension (NSSF), medical insurance (NHIF), mortgage interest\n7. System calculates tax liability\n8. If tax payable: pay via Paybill **222222** (Account: your PIN)\n9. Submit return and download **E-Return Acknowledgment**\n\n### Nil Return\nIf you had no income: file a Nil Return.\n1. iTax → File Return → Income Tax → Resident Individual\n2. Select year, answer all income questions as **No**\n3. Submit\n\n### Common Issues\n- **PIN locked**: Contact KRA on 020 4 999 999 or visit any KRA office\n- **Wrong PIN on P9**: Employer must issue a corrected P9\n- **System error at submission**: Try a different browser (Chrome recommended). Peak period (June) may be slow`,
    },
    // ── Payments & Fees (additional) ──────────────────────────────────────────
    {
      title: 'What to Do If Your Payment Goes Through But Service Not Activated',
      slug: 'payment-successful-service-not-activated',
      category: 'Payments & Fees',
      tags: ['payments', 'eCitizen', 'technical'],
      summary: 'Steps to take when you have paid a fee but the service status has not updated.',
      content: `## Payment Successful — Service Not Activated\n\n### Wait Period\nFirst, allow **30–60 minutes** for payment to reconcile. Payments made via M-Pesa during peak hours can take up to 2 hours.\n\n### Verify Payment\n1. Check your M-Pesa messages for the confirmation code\n2. Log in to eCitizen → **My Payments** — confirm the transaction appears with **"Completed"** status\n3. If status shows **"Pending"**: your bank/M-Pesa may still be processing\n\n### If Still Not Updated After 2 Hours\n1. Raise a ticket on eCitizen\n2. Select the relevant agency and category: **Payment Reconciliation**\n3. Attach:\n   - M-Pesa confirmation SMS (screenshot)\n   - eCitizen payment reference number\n   - Screenshot of the unpaid/pending service\n4. Response typically within 4–8 working hours\n\n### Do NOT\n- Pay again (you may be double-charged)\n- Clear your eCitizen session/cart before the issue is resolved\n\n### M-Pesa Reversal\nIf your payment was charged but not received by eCitizen, a reversal will be processed within 3–5 business days once the support ticket is resolved.`,
    },
    {
      title: 'How to Get a Receipt for Government Service Payments',
      slug: 'government-service-payment-receipt',
      category: 'Payments & Fees',
      tags: ['payments', 'eCitizen', 'portal'],
      summary: 'How to download or print official payment receipts for services paid via eCitizen.',
      content: `## Downloading Your Payment Receipt\n\n### On eCitizen Portal\n1. Log in at ecitizen.go.ke\n2. Click your profile → **Payment History** (or **My Transactions**)\n3. Locate the payment and click **View Receipt**\n4. Download the PDF receipt\n\n### Receipt Not Appearing\n- Allow up to 2 hours for the payment to reflect\n- Ensure you are logged in with the same account used for payment\n- If receipt is missing after 24 hours: raise a ticket under the relevant agency → **Payment Receipt**\n\n### Official vs. M-Pesa Receipt\n- The **eCitizen PDF receipt** is the official government receipt\n- M-Pesa confirmation messages are proof of payment but may not be accepted for official documentation\n\n### Lost Receipt\nIf you cannot find the receipt:\n1. Go to **Payment History**\n2. Use the transaction date and amount to locate the payment\n3. Re-download from the portal\n\n### Receipt Required For\n- Passport collection\n- Certificate collection\n- Tender applications\n- Court filing confirmation`,
    },
    // ── Account & Registration (additional) ──────────────────────────────────
    {
      title: 'How to Update Your Profile and Contact Details',
      slug: 'update-ecitizen-profile',
      category: 'Account & Registration',
      tags: ['account', 'eCitizen', 'portal'],
      summary: 'How to update your name, phone number, email, and ID details on eCitizen.',
      content: `## Updating Your eCitizen Profile\n\n### What You Can Update Online\n- Email address\n- Phone number\n- Postal address\n- Password\n\n### Updating Email\n1. Log in → click your name (top right) → **Profile Settings**\n2. Click **Edit** next to Email\n3. Enter new email and click **Send Verification Code**\n4. Enter OTP from your new email\n5. Email updated immediately\n\n### Updating Phone Number\n1. Profile Settings → **Edit** next to Phone\n2. Enter new number → OTP sent via SMS\n3. Enter OTP to confirm\n\n### Name or ID Number Changes\nName and national ID changes require:\n- Visit a Huduma Centre or eCitizen registration point\n- Bring your new ID (with the corrected details)\n- ID changes take 3–5 business days to reflect\n\n### Two-Factor Authentication (2FA)\nFor added security, enable 2FA under **Security Settings**. OTP sent to your registered phone on each login.\n\n### Linked Services\nAll government services (KRA, NHIF, NTSA, Immigration) linked to your PIN and ID — name changes affect all linked services.`,
    },
  ];

  for (const def of kbArticles) {
    const exArticle = await prisma.kbArticle.findFirst({ where: { slug: def.slug, agencyId: null } });
    if (exArticle) continue;
    const article = await prisma.kbArticle.create({
      data: { slug: def.slug, title: def.title, categoryId: kbCatIds[def.category] ?? null, visibility: KbVisibility.PUBLIC, isPublished: true, publishedAt: new Date(Date.now() - Math.random() * 30 * 86400000), createdBy: kbAdmin?.id ?? null },
    });
    const version = await prisma.kbArticleVersion.create({
      data: { articleId: article.id, versionNumber: 1, content: def.content, summary: def.summary, isPublished: true, createdBy: kbAdmin?.id ?? null },
    });
    await prisma.kbArticle.update({ where: { id: article.id }, data: { currentVersionId: version.id } });
    for (const tagName of def.tags) {
      if (kbTagIds[tagName]) {
        await prisma.kbArticleTagMapping.upsert({ where: { articleId_tagId: { articleId: article.id, tagId: kbTagIds[tagName] } }, update: {}, create: { articleId: article.id, tagId: kbTagIds[tagName] } });
      }
    }
    const viewCount = 8 + Math.floor(Math.random() * 40);
    for (let v = 0; v < viewCount; v++) {
      await prisma.kbArticleView.create({ data: { articleId: article.id, viewedAt: new Date(Date.now() - v * 3600000 * 6) } });
    }
    await prisma.kbFeedback.create({ data: { articleId: article.id, wasHelpful: true, rating: 4 + (Math.random() > 0.5 ? 1 : 0), feedbackComment: 'Very helpful guide, resolved my issue.', createdAt: new Date(Date.now() - 86400000) } });
  }
  console.log('✅ Knowledge base articles, categories, and tags seeded');

  // ==========================================
  // 17. Ticket Tags + Mappings
  // ==========================================
  const ticketTagNames = ['urgent','billing','technical','documents','follow-up','awaiting-docs','escalated-ministry','legal','accessibility','duplicate'];
  const ticketTagMap: Record<string, string> = {};
  for (const name of ticketTagNames) {
    const ex = await prisma.ticketTag.findFirst({ where: { agencyId: null, name } });
    const rec = ex ?? await prisma.ticketTag.create({ data: { name } });
    ticketTagMap[name] = rec.id;
  }
  const tagsForTickets = await prisma.ticket.findMany({ take: 20, orderBy: { createdAt: 'asc' } });
  const tagMatrix = [
    ['urgent','technical'],['billing'],['documents','follow-up'],['technical'],['awaiting-docs'],
    ['billing','follow-up'],['urgent','escalated-ministry'],['documents'],['legal'],['technical','follow-up'],
    ['billing','urgent'],['documents','awaiting-docs'],['follow-up'],['urgent'],['technical','duplicate'],
    ['escalated-ministry','legal'],['billing'],['documents'],['follow-up','urgent'],['technical'],
  ];
  for (let i = 0; i < Math.min(tagsForTickets.length, tagMatrix.length); i++) {
    for (const t of tagMatrix[i]) {
      if (ticketTagMap[t]) {
        await prisma.ticketTagMapping.upsert({ where: { ticketId_tagId: { ticketId: tagsForTickets[i].id, tagId: ticketTagMap[t] } }, update: {}, create: { ticketId: tagsForTickets[i].id, tagId: ticketTagMap[t] } });
      }
    }
  }
  console.log('✅ Ticket tags seeded and applied');

  // ==========================================
  // 18. SLA Tracking for All Tickets
  // ==========================================
  const slaRespMin: Record<string, number> = { LOW: 480, MEDIUM: 240, HIGH: 60, CRITICAL: 15 };
  const slaResolMin: Record<string, number> = { LOW: 2880, MEDIUM: 1440, HIGH: 480, CRITICAL: 120 };
  const allTicketsForSla = await prisma.ticket.findMany({ include: { priority: true, status: true } });

  for (const t of allTicketsForSla) {
    const ex = await prisma.slaTracking.findUnique({ where: { ticketId: t.id } });
    if (ex) continue;
    const pName = t.priority?.name ?? 'MEDIUM';
    const respMin = slaRespMin[pName] ?? 240;
    const resolMin = slaResolMin[pName] ?? 1440;
    const responseDueAt = new Date(t.createdAt.getTime() + respMin * 60000);
    const resolutionDueAt = new Date(t.createdAt.getTime() + resolMin * 60000);
    const isClosed = ['RESOLVED', 'CLOSED'].includes(t.status.name);
    const responseBreached = !t.firstResponseAt && new Date() > responseDueAt;
    const resolutionBreached = !isClosed && new Date() > resolutionDueAt;
    await prisma.slaTracking.create({
      data: {
        ticketId: t.id,
        responseDueAt,
        resolutionDueAt,
        responseMet: t.firstResponseAt ? t.firstResponseAt <= responseDueAt : null,
        resolutionMet: isClosed ? (t.resolvedAt ? t.resolvedAt <= resolutionDueAt : false) : null,
        responseBreached,
        resolutionBreached,
        escalationLevel: t.escalationLevel,
      },
    });
  }
  console.log('✅ SLA tracking created for all tickets');

  // ==========================================
  // 19. Ticket Assignments + History Records
  // ==========================================
  const openStatusRec = await prisma.ticketStatus.findUnique({ where: { name: TicketStatusName.OPEN } });
  const assignedTickets = await prisma.ticket.findMany({ where: { currentAssigneeId: { not: null } }, include: { status: true } });
  for (const t of assignedTickets) {
    const assignEx = await prisma.ticketAssignment.findFirst({ where: { ticketId: t.id } });
    if (!assignEx) {
      await prisma.ticketAssignment.create({ data: { ticketId: t.id, assignedTo: t.currentAssigneeId, assignmentReason: 'Assigned by system on ticket intake', assignedAt: new Date(t.createdAt.getTime() + 30 * 60000) } });
    }
    const histEx = await prisma.ticketHistory.findFirst({ where: { ticketId: t.id } });
    if (!histEx && openStatusRec && t.statusId !== openStatusRec.id) {
      await prisma.ticketHistory.create({ data: { ticketId: t.id, oldStatusId: openStatusRec.id, newStatusId: t.statusId, changedBy: t.currentAssigneeId, changeReason: 'Status updated on assignment', changedAt: new Date(t.createdAt.getTime() + 35 * 60000) } });
    }
  }
  console.log('✅ Ticket assignments and history seeded');

  // ==========================================
  // 20. Escalation Events + Breach Logs
  // ==========================================
  const escalatedTicketsList = await prisma.ticket.findMany({ where: { isEscalated: true }, include: { slaTracking: true } });
  for (const t of escalatedTicketsList) {
    const escEx = await prisma.escalationEvent.findFirst({ where: { ticketId: t.id } });
    if (!escEx) {
      await prisma.escalationEvent.create({ data: { ticketId: t.id, slaTrackingId: t.slaTracking?.id ?? null, previousLevel: 0, newLevel: 1, escalatedToRole: 'L1_SUPERVISOR', escalationReason: 'SLA breach threshold exceeded — auto-escalated', triggeredBy: EscalationTrigger.SYSTEM, createdAt: new Date(t.createdAt.getTime() + 90 * 60000) } });
    }
    if (t.slaTracking) {
      const breachEx = await prisma.breachLog.findFirst({ where: { ticketId: t.id } });
      if (!breachEx) {
        await prisma.breachLog.create({ data: { ticketId: t.id, slaTrackingId: t.slaTracking.id, breachType: BreachType.RESPONSE, breachTimestamp: t.slaTracking.responseDueAt, breachDurationMinutes: 30 + Math.floor(Math.random() * 60) } });
      }
    }
  }
  console.log('✅ Escalation events and breach logs seeded');

  // ==========================================
  // 21. AI Classification Logs
  // ==========================================
  const aiModelRec = await prisma.aiModel.findFirst({ where: { modelName: 'escc-classifier' } });
  const ticketsForAi = await prisma.ticket.findMany({ take: 35, include: { category: true, priority: true } });
  if (aiModelRec) {
    for (const t of ticketsForAi) {
      const aiEx = await prisma.aiClassificationLog.findFirst({ where: { ticketId: t.id } });
      if (!aiEx) {
        const conf = parseFloat((0.62 + Math.random() * 0.33).toFixed(2));
        await prisma.aiClassificationLog.create({ data: { ticketId: t.id, aiModelId: aiModelRec.id, predictedCategoryId: t.categoryId, predictedPriorityId: t.priorityId, confidenceScore: conf, sentimentScore: parseFloat((0.15 + Math.random() * 0.55).toFixed(2)), autoApplied: conf > 0.80, manualOverride: false } });
      }
    }
  }
  console.log('✅ AI classification logs seeded');

  // ==========================================
  // 22. Automation Rules + Actions
  // ==========================================
  const automationAdmin = await prisma.user.findUnique({ where: { email: 'admin@ecitizen.go.ke' } });
  const automationAgencies = await prisma.agency.findMany({ take: 6 });
  const ruleDefs = [
    { ruleName: 'Auto-escalate CRITICAL tickets after 15 minutes', triggerEvent: 'ticket.sla.response_breach', condition: { priority: 'CRITICAL', responseBreached: true }, actions: [{ actionType: 'escalate_ticket', payload: { toRole: 'L1_SUPERVISOR', reason: 'SLA breach auto-escalation' }, order: 1 }, { actionType: 'send_notification', payload: { channel: 'EMAIL', template: 'ticket_escalated' }, order: 2 }] },
    { ruleName: 'Send SMS on ticket creation', triggerEvent: 'ticket.created', condition: { channel: ['WEB', 'MOBILE'] }, actions: [{ actionType: 'send_notification', payload: { channel: 'SMS', template: 'ticket_created' }, order: 1 }] },
    { ruleName: 'Auto-close resolved tickets after 7 days', triggerEvent: 'ticket.resolved', condition: { resolvedDaysAgo: 7, citizenConfirmed: false }, actions: [{ actionType: 'close_ticket', payload: { reason: 'Auto-closed: no citizen response within 7 days' }, order: 1 }] },
  ];
  for (const ag of automationAgencies) {
    for (const def of ruleDefs) {
      const ex = await prisma.automationRule.findFirst({ where: { agencyId: ag.id, ruleName: def.ruleName } });
      if (ex) continue;
      const rule = await prisma.automationRule.create({ data: { agencyId: ag.id, ruleName: def.ruleName, triggerEvent: def.triggerEvent, conditionExpression: JSON.stringify(def.condition), isActive: true, createdBy: automationAdmin?.id ?? null } });
      for (const a of def.actions) {
        await prisma.automationAction.create({ data: { automationRuleId: rule.id, actionType: a.actionType, actionPayload: a.payload, executionOrder: a.order } });
      }
    }
  }
  console.log('✅ Automation rules and actions seeded');

  // ==========================================
  // 23. Daily + Hourly Metrics Backfill (30 days)
  // ==========================================
  const metricsAgencies = await prisma.agency.findMany({ select: { id: true } });
  for (const ag of metricsAgencies) {
    for (let d = 29; d >= 0; d--) {
      const dateBucket = new Date();
      dateBucket.setDate(dateBucket.getDate() - d);
      dateBucket.setHours(0, 0, 0, 0);
      const isWeekend = [0, 6].includes(dateBucket.getDay());
      const base = isWeekend ? 2 : 7;
      const created = base + Math.floor(Math.random() * 6);
      const resolved = Math.floor(created * 0.72);
      const closed = Math.floor(resolved * 0.80);

      await prisma.ticketMetricDaily.upsert({
        where: { uq_ticket_daily: { agencyId: ag.id, dateBucket } },
        update: {},
        create: { agencyId: ag.id, dateBucket, ticketsCreated: created, ticketsResolved: resolved, ticketsClosed: closed, openTickets: Math.max(0, created - resolved), escalatedTickets: Math.floor(created * 0.10), breachedResponse: Math.floor(created * 0.05), breachedResolution: Math.floor(created * 0.03), avgFirstResponseMinutes: parseFloat((30 + Math.random() * 50).toFixed(2)), avgResolutionMinutes: parseFloat((280 + Math.random() * 380).toFixed(2)) },
      });

      if (!isWeekend) {
        for (let h = 8; h <= 17; h++) {
          const hourBucket = new Date(dateBucket);
          hourBucket.setHours(h, 0, 0, 0);
          const hc = Math.floor(Math.random() * 3);
          await prisma.ticketMetricHourly.upsert({
            where: { uq_ticket_hourly: { agencyId: ag.id, hourBucket } },
            update: {},
            create: { agencyId: ag.id, hourBucket, ticketsCreated: hc, ticketsResolved: Math.floor(hc * 0.6), ticketsClosed: Math.floor(hc * 0.4), ticketsEscalated: hc > 1 ? 1 : 0, ticketsReopened: 0, avgFirstResponseMinutes: parseFloat((20 + Math.random() * 35).toFixed(2)), avgResolutionMinutes: parseFloat((180 + Math.random() * 280).toFixed(2)) },
          });
        }
      }
    }

    for (let m = 0; m < 3; m++) {
      const start = new Date();
      start.setMonth(start.getMonth() - m - 1, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1, 0);

      await prisma.agencyPerformanceMetric.upsert({
        where: { uq_agency_performance: { agencyId: ag.id, reportingPeriodStart: start, reportingPeriodEnd: end } },
        update: {},
        create: { agencyId: ag.id, reportingPeriodStart: start, reportingPeriodEnd: end, totalTickets: 140 + Math.floor(Math.random() * 110), avgResponseTime: parseFloat((40 + Math.random() * 55).toFixed(2)), avgResolutionTime: parseFloat((300 + Math.random() * 220).toFixed(2)), slaCompliancePercentage: parseFloat((72 + Math.random() * 22).toFixed(2)), escalationRatePercentage: parseFloat((4 + Math.random() * 11).toFixed(2)), citizenSatisfactionScore: parseFloat((3.4 + Math.random() * 1.5).toFixed(2)) },
      });

      await prisma.slaPerformanceMetric.upsert({
        where: { uq_sla_daily: { agencyId: ag.id, dateBucket: start } },
        update: {},
        create: { agencyId: ag.id, dateBucket: start, totalSlaTracked: 140 + Math.floor(Math.random() * 60), responseMet: 120 + Math.floor(Math.random() * 25), responseBreached: 8 + Math.floor(Math.random() * 12), resolutionMet: 110 + Math.floor(Math.random() * 25), resolutionBreached: 12 + Math.floor(Math.random() * 14), avgBreachDurationMinutes: parseFloat((25 + Math.random() * 55).toFixed(2)) },
      });
    }
  }
  console.log('✅ Daily/hourly metrics backfilled for 30 days across all agencies');

  // ==========================================
  // 24. Kenya National Holidays 2026
  // ==========================================
  const allAgenciesForHols = await prisma.agency.findMany({ select: { id: true } });
  const holidays2026 = [
    { date: new Date('2026-01-01'), description: "New Year's Day" },
    { date: new Date('2026-04-03'), description: 'Good Friday' },
    { date: new Date('2026-04-06'), description: 'Easter Monday' },
    { date: new Date('2026-05-01'), description: 'Labour Day' },
    { date: new Date('2026-06-01'), description: 'Madaraka Day' },
    { date: new Date('2026-10-10'), description: 'Huduma Day' },
    { date: new Date('2026-10-20'), description: 'Mashujaa Day' },
    { date: new Date('2026-12-12'), description: 'Jamhuri Day' },
    { date: new Date('2026-12-25'), description: 'Christmas Day' },
    { date: new Date('2026-12-26'), description: 'Boxing Day' },
  ];
  for (const ag of allAgenciesForHols) {
    for (const h of holidays2026) {
      await prisma.businessCalendarOverride.upsert({ where: { uq_calendar_override: { agencyId: ag.id, overrideDate: h.date } }, update: {}, create: { agencyId: ag.id, overrideDate: h.date, isWorkingDay: false, description: h.description } });
    }
  }
  console.log('✅ Kenya 2026 national holidays seeded for all agencies');

  // ==========================================
  // 25. Consent Versions
  // ==========================================
  const consentDefs = [
    { consentType: 'privacy_policy', versionNumber: 1, effectiveDate: new Date('2025-01-01'), consentText: 'By using the eCitizen portal, you consent to the collection and processing of your personal data to facilitate government service delivery, protected under the Kenya Data Protection Act 2019.' },
    { consentType: 'terms_of_service', versionNumber: 1, effectiveDate: new Date('2025-01-01'), consentText: 'These Terms govern your use of the eCitizen Service Command Centre portal. By accessing this portal you agree to use it only for lawful purposes in compliance with applicable Kenyan laws.' },
    { consentType: 'data_sharing', versionNumber: 1, effectiveDate: new Date('2025-01-01'), consentText: 'Your complaint data may be shared with relevant government agencies solely to resolve your complaint. Data is not shared with third parties outside the government.' },
  ];
  for (const cv of consentDefs) {
    await prisma.consentVersion.upsert({ where: { uq_consent_version: { consentType: cv.consentType, versionNumber: cv.versionNumber } }, update: {}, create: cv });
  }
  console.log('✅ Consent versions seeded');

  // ==========================================
  // 26. Demo Chat Rooms (for live demo)
  // ==========================================

  const superAdmin    = await prisma.user.findUnique({ where: { email: 'admin@ecitizen.go.ke' } });
  const bKakai        = await prisma.user.findUnique({ where: { email: 'b.kakai@wasaachat.com' } });
  const ccAdmin       = await prisma.user.findUnique({ where: { email: 'cc.admin@ecitizen.go.ke' } });
  const auditorUser   = await prisma.user.findUnique({ where: { email: 'auditor@ecitizen.go.ke' } });
  const analystUser   = await prisma.user.findUnique({ where: { email: 'analyst@ecitizen.go.ke' } });

  if (superAdmin && bKakai) {
    // ── 1:1 DM between Super Admin & Benjamin ──────────────────────────
    let dmRoom = await prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: superAdmin.id } } },
          { participants: { some: { userId: bKakai.id } } },
        ],
      },
    });

    if (!dmRoom) {
      dmRoom = await prisma.chatRoom.create({
        data: {
          type: 'DIRECT',
          title: 'Super Admin & B. Kakai',
          participants: {
            create: [
              { userId: superAdmin.id },
              { userId: bKakai.id },
            ],
          },
        },
      });
    }

    // Seed DM messages (idempotent — only if room has no messages yet)
    const dmMsgCount = await prisma.chatMessage.count({ where: { roomId: dmRoom.id } });
    if (dmMsgCount === 0) {
      const dmMessages = [
        { senderId: superAdmin.id, senderName: 'Super Admin', body: 'Benjamin, the new command centre is looking great!', minutesAgo: 45 },
        { senderId: bKakai.id,     senderName: 'Benjamin Kakai', body: 'Thanks! Just finished the chat module. Ready for the demo 🔥', minutesAgo: 42 },
        { senderId: superAdmin.id, senderName: 'Super Admin', body: 'The real-time messaging works perfectly. Ticket escalations are also live.', minutesAgo: 40 },
        { senderId: bKakai.id,     senderName: 'Benjamin Kakai', body: 'Voice notes and file uploads are wired too. Want a quick walkthrough before the meeting?', minutesAgo: 38 },
        { senderId: superAdmin.id, senderName: 'Super Admin', body: 'Yes! Let\'s sync at 2pm. Can you also confirm the ML pipeline is connected?', minutesAgo: 35 },
        { senderId: bKakai.id,     senderName: 'Benjamin Kakai', body: '✅ All good on ML — ticket classification + SLA breach prediction are live. SLA is at 94% 💪', minutesAgo: 32 },
        { senderId: superAdmin.id, senderName: 'Super Admin', body: 'Excellent. See you at the demo.', minutesAgo: 30 },
      ];

      for (const m of dmMessages) {
        const createdAt = new Date(Date.now() - m.minutesAgo * 60_000);
        await prisma.chatMessage.create({
          data: { roomId: dmRoom.id, senderId: m.senderId, senderName: m.senderName, body: m.body, messageType: 'TEXT', createdAt },
        });
      }
    }

    // ── Leadership Group Chat ──────────────────────────────────────────
    let groupRoom = await prisma.chatRoom.findFirst({
      where: { type: 'GROUP', title: 'eCitizen Leadership' },
    });

    if (!groupRoom) {
      const groupMembers = [superAdmin.id, bKakai.id, ccAdmin?.id, auditorUser?.id, analystUser?.id].filter(Boolean) as string[];
      groupRoom = await prisma.chatRoom.create({
        data: {
          type: 'GROUP',
          title: 'eCitizen Leadership',
          participants: { create: groupMembers.map((uid) => ({ userId: uid, addedBy: superAdmin.id })) },
        },
      });
    } else {
      // Ensure all users are participants
      const existingParticipants = await prisma.chatParticipant.findMany({ where: { roomId: groupRoom.id } });
      const existingIds = new Set(existingParticipants.map((p) => p.userId));
      const needed = [superAdmin.id, bKakai.id, ccAdmin?.id, auditorUser?.id, analystUser?.id].filter(Boolean) as string[];
      for (const uid of needed) {
        if (!existingIds.has(uid)) {
          await prisma.chatParticipant.create({ data: { roomId: groupRoom.id, userId: uid, addedBy: superAdmin.id } });
        }
      }
    }

    const grpMsgCount = await prisma.chatMessage.count({ where: { roomId: groupRoom.id } });
    if (grpMsgCount === 0) {
      const grpMessages = [
        { senderId: superAdmin.id,  senderName: 'Super Admin',       body: 'Good morning team 🇰🇪 Welcome to the eCitizen Command Centre.', minutesAgo: 120 },
        { senderId: ccAdmin?.id,    senderName: 'Command Admin',     body: 'Morning! Ticket volume is normal — 142 open, 23 escalated. SLA compliance at 94%.', minutesAgo: 117 },
        { senderId: auditorUser?.id, senderName: 'Compliance Auditor', body: 'Audit logs are running clean. No anomalies flagged overnight.', minutesAgo: 115 },
        { senderId: bKakai.id,      senderName: 'Benjamin Kakai',    body: 'Chat and calling modules are live ✅ Everyone test this group right now 😄', minutesAgo: 110 },
        { senderId: analystUser?.id, senderName: 'Data Analyst',     body: 'ML models classified 98% of overnight tickets automatically. Routing accuracy is up.', minutesAgo: 105 },
        { senderId: superAdmin.id,  senderName: 'Super Admin',       body: 'Great work everyone. Let\'s aim for 96% SLA by end of month. Anything blocking anyone?', minutesAgo: 100 },
        { senderId: ccAdmin?.id,    senderName: 'Command Admin',     body: 'Immigration tickets are spiking — passport processing delays. I\'ll escalate to the agency.', minutesAgo: 95 },
        { senderId: bKakai.id,      senderName: 'Benjamin Kakai',    body: 'I can pull a forecast from the ML module. Give me 2 minutes 🔍', minutesAgo: 93 },
        { senderId: bKakai.id,      senderName: 'Benjamin Kakai',    body: 'ML forecast shows a 34% spike expected Thursday–Friday. Recommend pre-allocating 3 extra agents to immigration.', minutesAgo: 90 },
        { senderId: superAdmin.id,  senderName: 'Super Admin',       body: 'Approved. CC Admin — action that please. Benjamin, excellent work on this platform 🏆', minutesAgo: 85 },
      ];

      for (const m of grpMessages) {
        if (!m.senderId) continue;
        const createdAt = new Date(Date.now() - m.minutesAgo * 60_000);
        await prisma.chatMessage.create({
          data: { roomId: groupRoom.id, senderId: m.senderId, senderName: m.senderName, body: m.body, messageType: 'TEXT', createdAt },
        });
      }
    }

    console.log('✅ Demo chat rooms seeded (1:1 DM + eCitizen Leadership group)');
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Test credentials:');
  console.log('   Super Admin:          admin@ecitizen.go.ke / Admin@123456');
  console.log('   Command Center Admin: cc.admin@ecitizen.go.ke / Staff@123');
  console.log('   Auditor:              auditor@ecitizen.go.ke / Staff@123');
  console.log('   Analyst:              analyst@ecitizen.go.ke / Staff@123');
  console.log('   Citizen:              citizen@example.com / Citizen@123');
  console.log('   L1 Agent:             agent@icta.go.ke / Agent@123');
  console.log('   Per-agency admins:    admin@kra.go.ke, admin@ntsa.go.ke, etc. / Staff@123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
