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
