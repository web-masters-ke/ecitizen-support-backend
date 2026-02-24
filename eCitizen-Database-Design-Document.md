**eCitizen Service Command Center (eSCC)**

**Database Design Document (DDD)**

**Section 1: Introduction**

**1.1 Purpose of the Document**

This Database Design Document (DDD) defines the logical and physical
data architecture for the **eCitizen Service Command Center (eSCC)**.

The document provides:

- A complete data model aligned with the approved SRS and TDD

- Detailed entity definitions and relationships

- Field-level specifications

- Data integrity rules and constraints

- Security and compliance design at database level

- Performance, scalability, and availability strategy

- Governance, audit, and retention framework

This DDD serves as the authoritative reference for:

- Backend engineers

- Database administrators

- DevOps engineers

- Security teams

- Integration architects

- Government ICT oversight teams

It ensures that the eSCC database layer supports a national,
multi-agency, AI-powered service management platform.

**1.2 Scope of Database Design**

This document covers the complete database layer for eSCC, including:

**Core Functional Domains**

- User & Identity Management

- Government Agency & Service Provider Management

- Ticket Lifecycle Management

- SLA & Escalation Monitoring

- AI Classification & Automation

- Knowledge Base

- Notifications

- Audit & Compliance

- Analytics & Reporting

**Architectural Scope**

- Primary relational database schema

- NoSQL components for logs and AI metadata

- Search indexing strategy

- Caching layer integration

- Multi-tenancy isolation

- Data warehouse integration

- High availability and disaster recovery

**Out of Scope**

- Application-layer business logic

- API contract definitions

- UI design

- Infrastructure provisioning scripts

Those areas are defined in the TDD and DevOps documentation.

**1.3 Alignment with SRS & TDD**

The database design directly supports the functional and non-functional
requirements defined in the eSCC SRS and TDD.

**Alignment with SRS**

The database structure supports:

- Multi-agency ticket routing

- Level 1 and Level 2 support workflows

- AI-based ticket categorization

- SLA tracking and breach detection

- Escalation rules and matrices

- Citizen and business account management

- Knowledge base self-service

- Real-time command center dashboards

- Regulatory compliance and audit traceability

All required business entities and state transitions are reflected in
the schema design.

**Alignment with TDD**

The database design aligns with:

- Microservices-based architecture

- Event-driven messaging (Kafka integration)

- REST and WebSocket APIs

- AI classification services

- External system integrations (SMS, Email, Identity APIs)

- Horizontal scaling requirements

Database decisions are made to:

- Support high throughput

- Enable asynchronous processing

- Maintain transactional consistency

- Ensure fault tolerance

**1.4 Design Principles**

The eSCC database is designed based on enterprise government system
standards.

**1.4.1 Scalability**

The database must support:

- 10+ million tickets annually

- Millions of users (citizens and businesses)

- Hundreds of government agencies

- Thousands of concurrent support agents

Scalability strategy includes:

- Horizontal read scaling

- Table partitioning

- Index optimization

- Caching via Redis

- Search offloading to Elasticsearch

**1.4.2 High Availability**

The database architecture must support:

- 99.9%+ uptime

- Multi-node replication

- Automated failover

- Backup and point-in-time recovery

No single point of failure is allowed in production deployment.

**1.4.3 Security by Design**

Security is embedded at schema level.

Controls include:

- Role-based access control (RBAC)

- Row-level security for agency isolation

- Column-level encryption for PII

- Immutable audit logs

- Data access tracking

- TLS encryption in transit

- AES-256 encryption at rest

The database must comply with:

- Kenya Data Protection Act

- Government ICT Authority standards

- Public Service ICT security policies

**1.4.4 Multi-Tenancy Isolation**

eSCC operates across multiple government agencies.

The design ensures:

- Logical tenant isolation

- Row-level separation per agency

- No cross-agency data leakage

- Strict referential integrity

Multi-tenancy strategy is defined in Section 2.

**1.4.5 Data Integrity & Consistency**

The database enforces:

- Strong foreign key constraints

- Unique constraints

- Controlled enumerations

- Status lifecycle enforcement

- Transaction-safe updates

Critical operations use ACID-compliant transactions.

**1.4.6 Observability & Auditability**

Every critical action must be traceable.

The design includes:

- Immutable audit logs

- Historical ticket state tracking

- User activity logs

- SLA breach logs

- AI decision logs

All sensitive data access is recorded.

**1.4.7 Performance Optimization**

Performance design includes:

- Proper indexing strategy

- Query optimization guidelines

- Read replicas

- Materialized views for dashboards

- Aggregated reporting tables

- Connection pooling

**1.4.8 Regulatory Compliance**

The database must support:

- Data retention policies

- Archival rules

- Consent records

- Data deletion workflows

- Data export capability for legal compliance

Retention and archival design is defined in Section 9.

**1.5 Assumptions**

- PostgreSQL will be used as the primary relational database.

- Redis will be used for caching and sessions.

- MongoDB will store large logs and AI metadata.

- Elasticsearch will power search and reporting queries.

- Kafka will support event streaming between services.

- Deployment will be cloud-hosted or government data center-based.

**1.6 Target Deployment Scale**

The database must support:

- National rollout

- Cross-agency support coordination

- Real-time dashboards

- AI-driven automation

- Continuous integration and schema versioning

Design must accommodate future expansion to:

- County governments

- Cross-border integrations

- Additional government service modules

**Section 2: Database Architecture Overview**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**2.1 Database Technology Stack**

The eSCC database architecture follows a polyglot persistence model.
Each data store is selected based on workload characteristics,
performance requirements, and compliance needs.

**2.1.1 Primary Relational Database --- PostgreSQL (Clustered)**

**Purpose**

- Core transactional data

- Ticket lifecycle management

- User and agency management

- SLA tracking

- Escalation rules

- RBAC enforcement

**Rationale**

- ACID compliance

- Strong referential integrity

- Native Row-Level Security (RLS)

- Advanced indexing

- Partitioning support

- Logical replication

- Government-grade stability

**Deployment Model**

- Primary node (write)

- 2+ read replicas

- Automatic failover (Patroni or managed HA service)

- WAL archiving enabled

**2.1.2 NoSQL Database --- MongoDB**

**Purpose**

- AI classification logs

- Large ticket conversation logs (optional hybrid model)

- Automation execution logs

- System event logs

**Rationale**

- Flexible schema

- High write throughput

- Efficient storage of JSON-based AI metadata

- Horizontal scaling

**2.1.3 Redis (In-Memory Cache)**

**Purpose**

- Session storage

- JWT blacklist

- Frequently accessed ticket metadata

- SLA timers

- Rate limiting

- Real-time dashboard counters

**Rationale**

- Sub-millisecond access

- TTL-based expiry

- Atomic operations

**2.1.4 Elasticsearch**

**Purpose**

- Full-text search on tickets

- Knowledge base search

- Cross-agency analytics

- Command center dashboards

**Rationale**

- High-performance search indexing

- Aggregation queries

- Log analytics support

**2.1.5 Data Warehouse (Optional but Recommended)**

Example: BigQuery / Redshift / Snowflake

**Purpose**

- Historical analytics

- SLA performance trends

- Cross-agency performance comparison

- BI dashboards

- AI model training datasets

Data sync method:

- CDC (Change Data Capture)

- Kafka streaming

- Scheduled ETL pipelines

**2.2 High-Level Architecture (Textual Diagram)**

Users (Citizens, Agencies, Admins)\
↓\
API Gateway\
↓\
Application Services (Microservices)\
↓\
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
\| PostgreSQL (Core Data) \|\
\| Redis (Cache & Sessions) \|\
\| MongoDB (AI Logs & Automation) \|\
\| Elasticsearch (Search & Analytics) \|\
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--\
↓\
Kafka Event Bus\
↓\
Data Warehouse / BI Layer

Each service interacts with its designated data store while maintaining
referential integrity within PostgreSQL for transactional consistency.

**2.3 Multi-Tenancy Strategy**

eSCC operates in a multi-agency government environment. Strict tenant
isolation is mandatory.

**2.3.1 Tenant Model**

Tenant = Government Agency

Each ticket, user, and SLA record is associated with:

agency_id UUID NOT NULL

**2.3.2 Tenant Isolation Strategy**

**Selected Approach: Shared Schema + Row-Level Security (RLS)**

Rationale:

- Simplifies cross-agency reporting

- Reduces schema duplication

- Easier maintenance

- Strong isolation via PostgreSQL RLS

**2.3.3 Row-Level Security Policy Example**

Example for tickets table:

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;\
\
CREATE POLICY agency_isolation_policy\
ON tickets\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

Application layer sets:

SET app.current_agency = \'agency-uuid\';

This ensures:

- No cross-agency data visibility

- Enforcement at DB level

- Protection even if application layer fails

**2.3.4 Cross-Agency Admin Access**

Special roles:

- super_admin

- command_center_admin

These roles bypass RLS using:

ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

With controlled bypass privilege.

**2.4 Data Sharding Strategy**

Sharding becomes necessary beyond:

- 50M+ tickets

- 200M+ ticket messages

**2.4.1 Initial Strategy --- Logical Partitioning**

Use PostgreSQL table partitioning:

- Partition by created_at (monthly)

- Sub-partition by agency_id (hash)

Example:

CREATE TABLE tickets (\
id UUID PRIMARY KEY,\
agency_id UUID NOT NULL,\
created_at TIMESTAMP NOT NULL\
) PARTITION BY RANGE (created_at);

**2.4.2 Future Horizontal Sharding**

When scaling beyond single cluster:

- Agency-based sharding

- Each shard serves a group of agencies

- Global analytics via data warehouse

**2.5 Replication & High Availability**

**2.5.1 PostgreSQL HA**

- Streaming replication

- 1 Primary

- Minimum 2 Replicas

- Automatic failover

- Health checks

- Load-balanced read queries

**2.5.2 Backup Strategy**

- Daily full backup

- Hourly incremental backup

- WAL continuous archiving

- 30--90 day retention (configurable)

- Encrypted backups

**2.5.3 Disaster Recovery Targets**

- RPO: ≤ 5 minutes

- RTO: ≤ 30 minutes

Cold standby in secondary region recommended.

**2.6 Backup & Disaster Recovery**

**2.6.1 Backup Components**

- PostgreSQL cluster

- MongoDB cluster

- Redis snapshots

- Elasticsearch indices

- Configuration secrets

**2.6.2 Backup Security**

- AES-256 encryption

- Access-controlled backup storage

- Audit log for backup access

**2.6.3 Disaster Recovery Procedure**

1.  Promote replica

2.  Restore from WAL logs

3.  Rebuild search indices

4.  Validate integrity

5.  Re-enable application traffic

Automated recovery scripts required.

**2.7 Environment Strategy**

Separate environments:

- Development

- QA

- Staging

- Production

Each with:

- Isolated databases

- Separate encryption keys

- Independent backup policies

Production environment enforces:

- Strict RLS

- Audit logging enabled

- Read replicas active

**2.8 Compliance & Data Residency**

If hosted within Kenya:

- Data residency must comply with Kenya Data Protection Act

- Sensitive PII must not leave jurisdiction without approval

- Audit logs retained per regulatory standards

Cross-border integration must use:

- Encrypted APIs

- Controlled replication

- Data minimization principles

**2.9 Scalability Targets**

System designed for:

- 10M+ tickets annually

- 100K+ daily active users

- 5K+ concurrent support agents

- 1M+ daily search queries

- Sub-2 second average ticket query time

**Section 3: Data Domain Modeling**

**3.1 User & Identity Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.1 Overview**

The User & Identity Domain manages authentication, authorization,
session control, and user-to-agency relationships.

This domain supports:

- Citizens

- Business users

- Government agency support agents (Level 1)

- Service provider agents (Level 2)

- Command Center administrators

- System administrators

- API clients

The design enforces:

- Strong identity management

- Role-based access control (RBAC)

- Multi-agency isolation

- Session traceability

- Immutable authentication logs

**3.1.1 Core Design Principles**

- Single source of truth for user identity

- Strict RBAC enforcement

- Separation of identity and agency membership

- Support for external identity providers (eCitizen SSO)

- Audit logging for all authentication events

**3.1.2 Entity List**

The following tables define the User & Identity domain:

1.  users

2.  roles

3.  permissions

4.  role_permissions

5.  user_roles

6.  agencies (FK reference only; defined in Section 3.2)

7.  agency_users

8.  sessions

9.  api_keys

10. authentication_logs

11. password_reset_tokens

12. mfa_devices

**3.1.3 Entity Specifications**

**Table: users**

Stores all system users across roles and agencies.

CREATE TABLE users (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ecitizen_user_id VARCHAR(100),\
user_type VARCHAR(30) NOT NULL,\
first_name VARCHAR(100),\
last_name VARCHAR(100),\
email VARCHAR(255) NOT NULL,\
phone_number VARCHAR(20),\
national_id VARCHAR(50),\
business_registration_no VARCHAR(100),\
password_hash TEXT,\
is_active BOOLEAN DEFAULT TRUE,\
is_verified BOOLEAN DEFAULT FALSE,\
mfa_enabled BOOLEAN DEFAULT FALSE,\
last_login_at TIMESTAMP,\
created_at TIMESTAMP NOT NULL DEFAULT NOW(),\
updated_at TIMESTAMP NOT NULL DEFAULT NOW(),\
deleted_at TIMESTAMP,\
CONSTRAINT uq_users_email UNIQUE (email)\
);

**Field Notes**

  -------------------------------------------------------------------------------
  **Column**      **Description**         **Indexed**   **Encrypted**   **PII**
  --------------- ----------------------- ------------- --------------- ---------
  email           Unique login identifier Yes           Optional        Yes

  national_id     Citizen identifier      Yes           Yes             Yes

  password_hash   Hashed password         No            Yes             Yes

  user_type       citizen, business,      Yes           No              No
                  agent, admin                                          
  -------------------------------------------------------------------------------

**user_type ENUM values**

- citizen

- business

- agency_agent

- service_provider_agent

- command_center_admin

- super_admin

- api_client

**Table: roles**

Defines system roles.

CREATE TABLE roles (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
name VARCHAR(100) NOT NULL,\
description TEXT,\
is_system_role BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_roles_name UNIQUE (name)\
);

Example roles:

- citizen_user

- agency_l1_agent

- service_provider_l2_agent

- agency_supervisor

- command_center_admin

- system_admin

**Table: permissions**

Defines granular access rights.

CREATE TABLE permissions (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
name VARCHAR(150) NOT NULL,\
resource VARCHAR(100) NOT NULL,\
action VARCHAR(50) NOT NULL,\
description TEXT,\
CONSTRAINT uq_permissions UNIQUE (resource, action)\
);

Example:

  ---------------------------
  **resource**   **action**
  -------------- ------------
  ticket         create

  ticket         update

  ticket         assign

  sla            configure

  agency         manage
  ---------------------------

**Table: role_permissions**

Many-to-many relationship.

CREATE TABLE role_permissions (\
role_id UUID REFERENCES roles(id) ON DELETE CASCADE,\
permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,\
PRIMARY KEY (role_id, permission_id)\
);

Indexed automatically via PK.

**Table: user_roles**

Maps users to roles.

CREATE TABLE user_roles (\
user_id UUID REFERENCES users(id) ON DELETE CASCADE,\
role_id UUID REFERENCES roles(id) ON DELETE CASCADE,\
agency_id UUID,\
assigned_at TIMESTAMP DEFAULT NOW(),\
assigned_by UUID REFERENCES users(id),\
PRIMARY KEY (user_id, role_id, agency_id)\
);

Supports:

- Global roles (agency_id NULL)

- Agency-specific roles

**Table: agency_users**

Defines membership of users within agencies.

CREATE TABLE agency_users (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
department_id UUID,\
employment_status VARCHAR(30) DEFAULT \'active\',\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_agency_user UNIQUE (user_id, agency_id)\
);

**Table: sessions**

Tracks login sessions.

CREATE TABLE sessions (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
user_id UUID REFERENCES users(id) ON DELETE CASCADE,\
refresh_token_hash TEXT NOT NULL,\
ip_address INET,\
user_agent TEXT,\
expires_at TIMESTAMP NOT NULL,\
revoked BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW()\
);

Indexes:

- user_id

- expires_at

**Table: api_keys**

Used for system integrations.

CREATE TABLE api_keys (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
client_name VARCHAR(150),\
api_key_hash TEXT NOT NULL,\
agency_id UUID REFERENCES agencies(id),\
is_active BOOLEAN DEFAULT TRUE,\
rate_limit INTEGER DEFAULT 1000,\
expires_at TIMESTAMP,\
created_at TIMESTAMP DEFAULT NOW()\
);

**Table: authentication_logs**

Immutable record of login attempts.

CREATE TABLE authentication_logs (\
id BIGSERIAL PRIMARY KEY,\
user_id UUID,\
email_attempted VARCHAR(255),\
success BOOLEAN,\
failure_reason VARCHAR(255),\
ip_address INET,\
user_agent TEXT,\
created_at TIMESTAMP DEFAULT NOW()\
);

Partitioned monthly.

**Table: password_reset_tokens**

CREATE TABLE password_reset_tokens (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
user_id UUID REFERENCES users(id) ON DELETE CASCADE,\
token_hash TEXT NOT NULL,\
expires_at TIMESTAMP NOT NULL,\
used BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW()\
);

**Table: mfa_devices**

CREATE TABLE mfa_devices (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
user_id UUID REFERENCES users(id) ON DELETE CASCADE,\
device_type VARCHAR(50),\
secret_key TEXT NOT NULL,\
is_verified BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW()\
);

**3.1.4 Indexing Strategy (Identity Domain)**

Indexes created on:

- users(email)

- users(national_id)

- user_roles(user_id)

- agency_users(agency_id)

- sessions(user_id)

- authentication_logs(created_at)

Composite indexes:

CREATE INDEX idx_user_roles_agency\
ON user_roles(user_id, agency_id);

**3.1.5 Row-Level Security (RLS)**

Applied to:

- agency_users

- user_roles

- api_keys

Policy example:

CREATE POLICY agency_user_isolation\
ON agency_users\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

**3.1.6 Data Integrity Rules**

- Email must be unique

- Role assignment must reference existing agency if agency_id provided

- API keys must be hashed before storage

- Sessions auto-expire via TTL cleanup job

- MFA secrets encrypted at column level

**3.1.7 PII & Encryption Controls**

Encrypted fields:

- national_id

- password_hash

- secret_key (MFA)

- api_key_hash

- refresh_token_hash

Encryption:

- AES-256 at rest

- TLS in transit

**3.1.8 Scalability Considerations**

- authentication_logs partitioned monthly

- sessions cleaned via background job

- heavy login traffic handled via Redis session cache

- rate limiting at API gateway

**3.1.9 Audit & Traceability**

Every identity event must generate:

- authentication_log entry

- user_activity_log (defined in Section 3.8)

No login attempt is discarded.

**Section 3: Data Domain Modeling**

**3.2 Agency & Organization Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.2 Overview**

The Agency & Organization Domain defines the structural hierarchy of
government entities and service providers participating in the eSCC
ecosystem.

This domain supports:

- National ministries

- State departments

- Parastatals

- County governments

- Service providers (Level 2 support)

- Inter-agency routing

- Escalation matrices

- Agency-level configuration

This domain is foundational to:

- Multi-tenancy isolation

- Ticket routing

- SLA ownership

- Escalation workflows

- Command Center reporting

**3.2.1 Core Design Principles**

- Every ticket must belong to exactly one agency

- Agencies may have multiple departments

- Agencies may map to one or more service providers

- Escalation chains must be configurable per agency

- Agency settings must be extensible

- Cross-agency routing must be traceable

**3.2.2 Entity List**

1.  agencies

2.  departments

3.  service_providers

4.  agency_service_mappings

5.  escalation_matrix

6.  escalation_levels

7.  agency_settings

8.  agency_business_hours

9.  agency_contacts

**3.2.3 Entity Specifications**

**Table: agencies**

Defines all government entities onboarded to eSCC.

CREATE TABLE agencies (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_code VARCHAR(50) NOT NULL,\
agency_name VARCHAR(255) NOT NULL,\
agency_type VARCHAR(50) NOT NULL,\
parent_agency_id UUID REFERENCES agencies(id),\
registration_number VARCHAR(100),\
official_email VARCHAR(255),\
official_phone VARCHAR(50),\
physical_address TEXT,\
county VARCHAR(100),\
is_active BOOLEAN DEFAULT TRUE,\
onboarding_status VARCHAR(50) DEFAULT \'pending\',\
created_at TIMESTAMP DEFAULT NOW(),\
updated_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_agency_code UNIQUE (agency_code)\
);

**agency_type ENUM**

- ministry

- department

- parastatal

- county_government

- regulatory_body

- service_provider

**Table: departments**

Sub-units within agencies.

CREATE TABLE departments (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
department_name VARCHAR(255) NOT NULL,\
department_code VARCHAR(50),\
description TEXT,\
is_active BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_department UNIQUE (agency_id, department_name)\
);

**Table: service_providers**

Defines external vendors handling Level 2 support.

CREATE TABLE service_providers (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
provider_name VARCHAR(255) NOT NULL,\
provider_type VARCHAR(100),\
contact_email VARCHAR(255),\
contact_phone VARCHAR(50),\
contract_reference VARCHAR(100),\
contract_start_date DATE,\
contract_end_date DATE,\
is_active BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_provider_name UNIQUE (provider_name)\
);

**Table: agency_service_mappings**

Maps agencies to service providers.

CREATE TABLE agency_service_mappings (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
service_provider_id UUID NOT NULL REFERENCES service_providers(id) ON
DELETE CASCADE,\
support_scope TEXT,\
is_primary BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_agency_provider UNIQUE (agency_id, service_provider_id)\
);

Supports:

- One-to-many mapping

- Shared providers across agencies

- Primary provider designation

**Table: escalation_matrix**

Defines escalation configuration per agency.

CREATE TABLE escalation_matrix (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
priority_level VARCHAR(50) NOT NULL,\
max_response_time_minutes INTEGER NOT NULL,\
max_resolution_time_minutes INTEGER NOT NULL,\
auto_escalation_enabled BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW()\
);

**Table: escalation_levels**

Defines escalation chain hierarchy.

CREATE TABLE escalation_levels (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
escalation_matrix_id UUID NOT NULL REFERENCES escalation_matrix(id) ON
DELETE CASCADE,\
level_number INTEGER NOT NULL,\
escalation_role VARCHAR(100),\
escalation_department_id UUID REFERENCES departments(id),\
notify_via_email BOOLEAN DEFAULT TRUE,\
notify_via_sms BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_escalation_level UNIQUE (escalation_matrix_id,
level_number)\
);

Example:

- Level 1 → Department Supervisor

- Level 2 → Agency Director

- Level 3 → Command Center

**Table: agency_settings**

Stores agency-specific configuration.

CREATE TABLE agency_settings (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
setting_key VARCHAR(100) NOT NULL,\
setting_value TEXT NOT NULL,\
created_at TIMESTAMP DEFAULT NOW(),\
updated_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_agency_setting UNIQUE (agency_id, setting_key)\
);

Examples:

- ticket_auto_assignment_enabled

- default_priority

- business_hours_enabled

- ai_classification_enabled

**Table: agency_business_hours**

Defines SLA calculation windows.

CREATE TABLE agency_business_hours (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
day_of_week INTEGER NOT NULL,\
start_time TIME NOT NULL,\
end_time TIME NOT NULL,\
is_active BOOLEAN DEFAULT TRUE,\
CONSTRAINT uq_business_hours UNIQUE (agency_id, day_of_week)\
);

Supports:

- Working day SLA calculations

- Holiday overrides (optional extension table)

**Table: agency_contacts**

Stores key escalation contacts.

CREATE TABLE agency_contacts (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
contact_name VARCHAR(255),\
role_title VARCHAR(255),\
email VARCHAR(255),\
phone VARCHAR(50),\
escalation_level INTEGER,\
created_at TIMESTAMP DEFAULT NOW()\
);

**3.2.4 Relationships Overview**

- agencies → self-referencing parent_agency_id

- agencies → departments (1:N)

- agencies → escalation_matrix (1:N)

- escalation_matrix → escalation_levels (1:N)

- agencies ↔ service_providers (M:N via mapping table)

- agencies → agency_settings (1:N)

**3.2.5 Indexing Strategy**

Indexes created on:

CREATE INDEX idx_departments_agency ON departments(agency_id);\
CREATE INDEX idx_escalation_matrix_agency ON
escalation_matrix(agency_id);\
CREATE INDEX idx_agency_settings_agency ON agency_settings(agency_id);\
CREATE INDEX idx_agency_service_mapping ON
agency_service_mappings(agency_id);

**3.2.6 Multi-Tenancy Enforcement**

Row-Level Security applied to:

- departments

- escalation_matrix

- agency_settings

- agency_contacts

Policy example:

CREATE POLICY agency_isolation_policy\
ON departments\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

**3.2.7 Data Integrity Rules**

- agency_code must be globally unique

- Department name must be unique per agency

- Escalation levels must be sequential

- A service provider cannot be mapped twice to same agency

- Agency cannot be deleted if tickets exist

**3.2.8 Scalability Considerations**

- Agencies expected: 500+

- Departments expected: 5,000+

- Service providers: 50+

- Escalation rules dynamic per agency

Low write volume, moderate read volume.

**3.2.9 Audit Requirements**

All changes to:

- Escalation matrix

- Agency settings

- Service provider mappings

Must trigger:

- audit_logs entry (Section 3.8)

- configuration change event via Kafka

**Section 3: Data Domain Modeling**

**3.3 Ticket Management Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.3 Overview**

The Ticket Management Domain is the core transactional domain of the
eSCC system.

It supports:

- Citizen and business ticket submission

- Multi-agency ticket routing

- Level 1 and Level 2 assignment

- SLA tracking

- Escalation triggers

- AI-based classification

- Full ticket lifecycle tracking

- Attachments and threaded conversations

- Reopen and audit traceability

This domain must support:

- 10M+ tickets annually

- 200M+ ticket messages over time

- Real-time dashboards

- Cross-agency analytics

- Strict multi-tenancy isolation

**3.3.1 Core Design Principles**

- Each ticket belongs to one agency

- Tickets are immutable in history (state changes tracked separately)

- Messages are append-only

- Attachments stored externally (object storage) with DB reference

- SLA fields stored for fast query

- AI metadata stored in structured columns

- Partitioning required for scalability

**3.3.2 Entity List**

1.  tickets

2.  ticket_categories

3.  ticket_statuses

4.  ticket_priority_levels

5.  ticket_messages

6.  ticket_attachments

7.  ticket_assignments

8.  ticket_history

9.  ticket_tags

10. ticket_tag_mappings

**3.3.3 Entity Specifications**

**Table: ticket_categories**

CREATE TABLE ticket_categories (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
name VARCHAR(150) NOT NULL,\
description TEXT,\
is_active BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_ticket_category UNIQUE (agency_id, name)\
);

**Table: ticket_priority_levels**

CREATE TABLE ticket_priority_levels (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
name VARCHAR(50) NOT NULL,\
severity_score INTEGER NOT NULL,\
description TEXT,\
CONSTRAINT uq_priority_name UNIQUE (name)\
);

Examples:

- Low

- Medium

- High

- Critical

**Table: ticket_statuses**

CREATE TABLE ticket_statuses (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
name VARCHAR(50) NOT NULL,\
is_closed_status BOOLEAN DEFAULT FALSE,\
is_system_status BOOLEAN DEFAULT FALSE,\
CONSTRAINT uq_status_name UNIQUE (name)\
);

Examples:

- Open

- Assigned

- In Progress

- Escalated

- Pending Citizen

- Resolved

- Closed

- Reopened

**Table: tickets (CORE TABLE)**

Partitioned by created_at (monthly).

CREATE TABLE tickets (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_number VARCHAR(30) NOT NULL,\
agency_id UUID NOT NULL REFERENCES agencies(id),\
department_id UUID REFERENCES departments(id),\
category_id UUID REFERENCES ticket_categories(id),\
created_by UUID NOT NULL REFERENCES users(id),\
current_assignee_id UUID REFERENCES users(id),\
priority_id UUID REFERENCES ticket_priority_levels(id),\
status_id UUID NOT NULL REFERENCES ticket_statuses(id),\
channel VARCHAR(50) NOT NULL,\
subject VARCHAR(255) NOT NULL,\
description TEXT NOT NULL,\
ai_predicted_category_id UUID,\
ai_confidence_score NUMERIC(5,2),\
ai_auto_assigned BOOLEAN DEFAULT FALSE,\
sla_response_due_at TIMESTAMP,\
sla_resolution_due_at TIMESTAMP,\
first_response_at TIMESTAMP,\
resolved_at TIMESTAMP,\
closed_at TIMESTAMP,\
reopen_count INTEGER DEFAULT 0,\
escalation_level INTEGER DEFAULT 0,\
is_escalated BOOLEAN DEFAULT FALSE,\
is_deleted BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP NOT NULL DEFAULT NOW(),\
updated_at TIMESTAMP NOT NULL DEFAULT NOW(),\
CONSTRAINT uq_ticket_number UNIQUE (ticket_number)\
) PARTITION BY RANGE (created_at);

**Channel ENUM Values**

- web

- mobile

- ussd

- sms

- api

- call_center

**Partition Strategy**

Example:

CREATE TABLE tickets_2026_01 PARTITION OF tickets\
FOR VALUES FROM (\'2026-01-01\') TO (\'2026-02-01\');

**Table: ticket_messages**

Append-only message thread.

CREATE TABLE ticket_messages (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
sender_id UUID REFERENCES users(id),\
message_type VARCHAR(50) DEFAULT \'comment\',\
message_text TEXT,\
is_internal BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW()\
);

message_type:

- comment

- status_change

- escalation_note

- system_update

Partitioned by created_at if volume exceeds threshold.

**Table: ticket_attachments**

CREATE TABLE ticket_attachments (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
message_id UUID REFERENCES ticket_messages(id),\
file_name VARCHAR(255),\
file_type VARCHAR(100),\
file_size BIGINT,\
storage_url TEXT NOT NULL,\
uploaded_by UUID REFERENCES users(id),\
created_at TIMESTAMP DEFAULT NOW()\
);

Files stored in:

- S3-compatible object storage

- Government secure storage

**Table: ticket_assignments**

Tracks assignment history.

CREATE TABLE ticket_assignments (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
assigned_to UUID REFERENCES users(id),\
assigned_by UUID REFERENCES users(id),\
assignment_reason TEXT,\
assigned_at TIMESTAMP DEFAULT NOW()\
);

**Table: ticket_history**

Immutable lifecycle tracking.

CREATE TABLE ticket_history (\
id BIGSERIAL PRIMARY KEY,\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
old_status_id UUID,\
new_status_id UUID,\
changed_by UUID REFERENCES users(id),\
change_reason TEXT,\
changed_at TIMESTAMP DEFAULT NOW()\
);

Partitioned monthly.

**Table: ticket_tags**

CREATE TABLE ticket_tags (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
name VARCHAR(100) NOT NULL,\
agency_id UUID REFERENCES agencies(id),\
CONSTRAINT uq_ticket_tag UNIQUE (agency_id, name)\
);

**Table: ticket_tag_mappings**

CREATE TABLE ticket_tag_mappings (\
ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,\
tag_id UUID REFERENCES ticket_tags(id) ON DELETE CASCADE,\
PRIMARY KEY (ticket_id, tag_id)\
);

**3.3.4 Indexing Strategy**

Critical indexes:

CREATE INDEX idx_tickets_agency ON tickets(agency_id);\
CREATE INDEX idx_tickets_status ON tickets(status_id);\
CREATE INDEX idx_tickets_assignee ON tickets(current_assignee_id);\
CREATE INDEX idx_tickets_created_at ON tickets(created_at);\
CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id);\
CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);

Composite index:

CREATE INDEX idx_ticket_dashboard\
ON tickets(agency_id, status_id, priority_id, created_at DESC);

**3.3.5 SLA Optimization**

Fields stored directly in tickets:

- sla_response_due_at

- sla_resolution_due_at

- first_response_at

- resolved_at

Allows:

- Fast breach detection

- Dashboard queries

- Escalation triggers

**3.3.6 Multi-Tenancy Enforcement**

RLS applied to:

- tickets

- ticket_messages

- ticket_assignments

- ticket_history

Policy:

CREATE POLICY ticket_agency_isolation\
ON tickets\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

**3.3.7 Data Integrity Rules**

- ticket_number globally unique

- Cannot close ticket without resolved_at

- Cannot resolve without assignment

- Reopen increments reopen_count

- Escalation_level auto-increments only via escalation engine

Enforced via:

- Constraints

- Triggers

- Application validation

**3.3.8 Scalability Considerations**

Expected scale:

- 10M+ tickets/year

- 20--30 messages per ticket average

- 200M+ history rows over lifecycle

Mitigation:

- Table partitioning

- Read replicas

- Archival of closed tickets after retention window

- Search offloaded to Elasticsearch

**3.3.9 Audit & Compliance**

Every change must generate:

- ticket_history entry

- audit_logs entry (Section 3.8)

- Kafka event for downstream systems

No ticket deletion allowed without soft-delete trace.

**Section 3: Data Domain Modeling**

**3.4 SLA & Escalation Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.4 Overview**

The SLA & Escalation Domain enforces service performance governance
across all participating government agencies and service providers.

This domain is responsible for:

- Defining SLA policies

- Tracking response and resolution deadlines

- Monitoring breaches

- Triggering automated escalations

- Supporting business hours logic

- Producing SLA performance analytics

This domain must support:

- Agency-specific SLAs

- Category-specific SLAs

- Priority-based SLA rules

- Real-time breach detection

- Escalation chain automation

The SLA engine must operate at national scale with near real-time
updates.

**3.4.1 Core Design Principles**

- SLA policies configurable per agency

- SLA rules can vary by priority and category

- SLA tracking must be precomputed and stored for performance

- Escalation logic must be deterministic and auditable

- Breach records must be immutable

- Business hours must influence SLA timers

**3.4.2 Entity List**

1.  sla_policies

2.  sla_rules

3.  sla_tracking

4.  escalation_events

5.  breach_logs

6.  business_calendar_overrides

**3.4.3 Entity Specifications**

**Table: sla_policies**

Defines high-level SLA configuration per agency.

CREATE TABLE sla_policies (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
policy_name VARCHAR(150) NOT NULL,\
description TEXT,\
is_active BOOLEAN DEFAULT TRUE,\
applies_business_hours BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
updated_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_sla_policy UNIQUE (agency_id, policy_name)\
);

**Table: sla_rules**

Defines granular SLA timing rules.

CREATE TABLE sla_rules (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
sla_policy_id UUID NOT NULL REFERENCES sla_policies(id) ON DELETE
CASCADE,\
priority_id UUID REFERENCES ticket_priority_levels(id),\
category_id UUID REFERENCES ticket_categories(id),\
response_time_minutes INTEGER NOT NULL,\
resolution_time_minutes INTEGER NOT NULL,\
escalation_after_minutes INTEGER,\
created_at TIMESTAMP DEFAULT NOW()\
);

Rule behavior:

- Rules may apply by priority

- Rules may apply by category

- If both provided → most specific rule applies

- Fallback to agency default rule

**Table: sla_tracking**

Tracks SLA timers per ticket.

This table supports real-time monitoring and reporting.

CREATE TABLE sla_tracking (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
sla_policy_id UUID REFERENCES sla_policies(id),\
response_due_at TIMESTAMP NOT NULL,\
resolution_due_at TIMESTAMP NOT NULL,\
response_met BOOLEAN,\
resolution_met BOOLEAN,\
response_breached BOOLEAN DEFAULT FALSE,\
resolution_breached BOOLEAN DEFAULT FALSE,\
response_breach_at TIMESTAMP,\
resolution_breach_at TIMESTAMP,\
escalation_level INTEGER DEFAULT 0,\
last_escalated_at TIMESTAMP,\
created_at TIMESTAMP DEFAULT NOW(),\
updated_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_sla_ticket UNIQUE (ticket_id)\
);

Indexes:

CREATE INDEX idx_sla_tracking_ticket ON sla_tracking(ticket_id);\
CREATE INDEX idx_sla_resolution_due ON sla_tracking(resolution_due_at);\
CREATE INDEX idx_sla_response_due ON sla_tracking(response_due_at);

**Table: escalation_events**

Tracks every escalation action.

CREATE TABLE escalation_events (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
sla_tracking_id UUID REFERENCES sla_tracking(id),\
previous_level INTEGER,\
new_level INTEGER,\
escalated_to_user_id UUID REFERENCES users(id),\
escalated_to_role VARCHAR(100),\
escalation_reason VARCHAR(255),\
triggered_by VARCHAR(50) DEFAULT \'system\',\
created_at TIMESTAMP DEFAULT NOW()\
);

triggered_by values:

- system

- supervisor

- command_center

- manual_override

**Table: breach_logs**

Immutable log of SLA breaches.

CREATE TABLE breach_logs (\
id BIGSERIAL PRIMARY KEY,\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
sla_tracking_id UUID REFERENCES sla_tracking(id),\
breach_type VARCHAR(50) NOT NULL,\
breach_timestamp TIMESTAMP NOT NULL,\
breach_duration_minutes INTEGER,\
recorded_at TIMESTAMP DEFAULT NOW()\
);

breach_type:

- response

- resolution

Partitioned monthly for performance.

**Table: business_calendar_overrides**

Defines holidays or special working days.

CREATE TABLE business_calendar_overrides (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
override_date DATE NOT NULL,\
is_working_day BOOLEAN DEFAULT FALSE,\
start_time TIME,\
end_time TIME,\
description TEXT,\
CONSTRAINT uq_calendar_override UNIQUE (agency_id, override_date)\
);

**3.4.4 SLA Computation Logic**

When ticket is created:

1.  Determine agency

2.  Identify SLA policy

3.  Select matching SLA rule

4.  Compute deadlines:

    - response_due_at

    - resolution_due_at

5.  Insert into sla_tracking

If business hours enabled:

- Exclude non-working hours

- Exclude holidays

- Resume clock during working window

Computation handled by SLA Engine microservice.

**3.4.5 Escalation Workflow**

Escalation triggered when:

- response_due_at exceeded

- resolution_due_at exceeded

- Manual supervisor escalation

Steps:

1.  Update sla_tracking.escalation_level

2.  Insert escalation_event

3.  Notify escalation target

4.  Update tickets.escalation_level

5.  Emit Kafka event

**3.4.6 Multi-Tenancy Enforcement**

RLS applied to:

- sla_policies

- sla_rules

- sla_tracking

- breach_logs

- escalation_events

Policy example:

CREATE POLICY sla_agency_isolation\
ON sla_policies\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

**3.4.7 Performance Strategy**

Expected scale:

- 10M SLA records per year

- Continuous deadline scanning

Optimizations:

- Index on resolution_due_at

- Background worker polling upcoming deadlines

- Redis for near-term deadline queue

- Partition breach_logs

**3.4.8 Data Integrity Rules**

- One SLA record per ticket

- Breach logs immutable

- Escalation level cannot decrease automatically

- Resolution cannot be marked met if breach already recorded

Enforced via:

- Constraints

- Triggers

- SLA engine validation

**3.4.9 Audit & Compliance**

All SLA rule changes must:

- Create audit_logs entry

- Emit configuration change event

- Require elevated role

Breach records must never be deleted.

**Section 3: Data Domain Modeling**

**3.5 AI & Automation Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.5 Overview**

The AI & Automation Domain enables intelligent ticket processing,
automated routing, predictive classification, and workflow execution.

This domain supports:

- AI-based ticket categorization

- AI priority prediction

- AI confidence scoring

- Auto-assignment recommendations

- Automation rule execution

- Workflow triggers

- Model version traceability

- Training dataset tracking

The system must ensure:

- Explainability of AI decisions

- Auditability of automated actions

- No silent automation

- Versioned AI model tracking

- Compliance with public sector transparency standards

AI must assist operations without compromising accountability.

**3.5.1 Core Design Principles**

- Every AI decision must be logged

- AI metadata must not overwrite original user data

- Automation rules must be configurable per agency

- Manual override must always be possible

- AI decisions must store model version

- Automation actions must be traceable

**3.5.2 Data Storage Strategy**

Hybrid storage approach:

- PostgreSQL → Structured AI metadata and automation rules

- MongoDB → Large AI inference payloads and logs

- Elasticsearch → AI analytics and trend analysis

**3.5.3 Entity List (PostgreSQL)**

1.  ai_models

2.  ai_classification_logs

3.  ai_recommendations

4.  automation_rules

5.  automation_actions

6.  workflow_triggers

7.  automation_execution_logs

**3.5.4 Entity Specifications**

**Table: ai_models**

Tracks AI model versions deployed in production.

CREATE TABLE ai_models (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
model_name VARCHAR(150) NOT NULL,\
model_version VARCHAR(50) NOT NULL,\
model_type VARCHAR(100),\
deployment_environment VARCHAR(50),\
is_active BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_ai_model UNIQUE (model_name, model_version)\
);

model_type examples:

- classification

- priority_prediction

- sentiment_analysis

- routing_recommendation

**Table: ai_classification_logs**

Stores AI decision metadata per ticket.

CREATE TABLE ai_classification_logs (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
ai_model_id UUID REFERENCES ai_models(id),\
predicted_category_id UUID REFERENCES ticket_categories(id),\
predicted_priority_id UUID REFERENCES ticket_priority_levels(id),\
confidence_score NUMERIC(5,2),\
sentiment_score NUMERIC(5,2),\
auto_applied BOOLEAN DEFAULT FALSE,\
manual_override BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW()\
);

Indexes:

CREATE INDEX idx_ai_logs_ticket ON ai_classification_logs(ticket_id);\
CREATE INDEX idx_ai_logs_model ON ai_classification_logs(ai_model_id);

**Table: ai_recommendations**

Stores suggested actions by AI.

CREATE TABLE ai_recommendations (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,\
recommendation_type VARCHAR(100),\
recommended_value TEXT,\
confidence_score NUMERIC(5,2),\
applied BOOLEAN DEFAULT FALSE,\
applied_by UUID REFERENCES users(id),\
created_at TIMESTAMP DEFAULT NOW()\
);

recommendation_type examples:

- assign_agent

- escalate

- suggest_kb_article

- change_priority

**Table: automation_rules**

Defines configurable automation logic.

CREATE TABLE automation_rules (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,\
rule_name VARCHAR(150) NOT NULL,\
trigger_event VARCHAR(100) NOT NULL,\
condition_expression TEXT NOT NULL,\
is_active BOOLEAN DEFAULT TRUE,\
created_by UUID REFERENCES users(id),\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_automation_rule UNIQUE (agency_id, rule_name)\
);

trigger_event examples:

- ticket_created

- ticket_updated

- sla_breach

- status_changed

condition_expression example (JSON logic):

{\
\"priority\": \"High\",\
\"category\": \"Payments\",\
\"sentiment_score\": \"\< -0.5\"\
}

**Table: automation_actions**

Defines actions tied to rules.

CREATE TABLE automation_actions (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
automation_rule_id UUID NOT NULL REFERENCES automation_rules(id) ON
DELETE CASCADE,\
action_type VARCHAR(100) NOT NULL,\
action_payload JSONB,\
execution_order INTEGER DEFAULT 1,\
created_at TIMESTAMP DEFAULT NOW()\
);

action_type examples:

- assign_to_user

- escalate_ticket

- notify_supervisor

- auto_reply

- tag_ticket

**Table: workflow_triggers**

Tracks system workflow events.

CREATE TABLE workflow_triggers (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,\
trigger_type VARCHAR(100),\
triggered_by UUID REFERENCES users(id),\
trigger_source VARCHAR(100),\
created_at TIMESTAMP DEFAULT NOW()\
);

**Table: automation_execution_logs**

Immutable log of automation execution.

CREATE TABLE automation_execution_logs (\
id BIGSERIAL PRIMARY KEY,\
ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,\
automation_rule_id UUID REFERENCES automation_rules(id),\
action_type VARCHAR(100),\
execution_status VARCHAR(50),\
error_message TEXT,\
executed_at TIMESTAMP DEFAULT NOW()\
);

execution_status:

- success

- failed

- skipped

Partitioned monthly.

**3.5.5 MongoDB Collections**

Used for:

- Full AI inference request payload

- Raw model output

- Training metadata

- Feature extraction logs

Collection examples:

- ai_inference_logs

- ai_training_datasets

- ai_model_metrics

Reference stored in PostgreSQL via:

- ticket_id

- ai_model_id

- inference_id

**3.5.6 Multi-Tenancy Enforcement**

RLS applied to:

- automation_rules

- ai_classification_logs

- ai_recommendations

Policy example:

CREATE POLICY ai_agency_isolation\
ON automation_rules\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

**3.5.7 Data Integrity Rules**

- AI logs cannot modify original ticket record

- Automation rules must belong to one agency

- Execution logs are immutable

- AI model must exist before logging inference

- Manual override must set manual_override = TRUE

**3.5.8 Performance Strategy**

Expected scale:

- 10M+ AI classifications annually

- High write throughput

Optimizations:

- Index ticket_id

- Partition automation_execution_logs

- Offload large JSON payloads to MongoDB

- Cache frequent automation rules in Redis

**3.5.9 Audit & Transparency**

All AI and automation actions must:

- Be traceable

- Be reproducible

- Store model version

- Store timestamp

- Record whether applied automatically

This ensures:

- Legal defensibility

- Public accountability

- Compliance with AI governance frameworks

**3.5.10 Compliance Considerations**

- No automated decision without logging

- Sensitive AI training data anonymized

- PII masked in AI training datasets

- Model version retained for audit lifecycle

**Section 3: Data Domain Modeling**

**3.6 Knowledge Base Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.6 Overview**

The Knowledge Base (KB) Domain supports self-service resolution and
agent-assisted responses within eSCC.

It enables:

- Citizen self-help articles

- Agency-specific documentation

- Internal-only operational guides

- AI-powered article suggestions

- Version control of content

- Article feedback and rating

- Search indexing

The Knowledge Base reduces ticket volume and improves resolution time.

**3.6.1 Core Design Principles**

- Articles may be global or agency-specific

- Articles support versioning

- Published content must be immutable

- Drafts must be editable

- Search performance must be optimized

- Feedback must be measurable

- AI suggestions must reference KB IDs

**3.6.2 Entity List**

1.  kb_categories

2.  kb_articles

3.  kb_article_versions

4.  kb_tags

5.  kb_article_tag_mappings

6.  kb_feedback

7.  kb_article_views

**3.6.3 Entity Specifications**

**Table: kb_categories**

CREATE TABLE kb_categories (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID REFERENCES agencies(id),\
name VARCHAR(150) NOT NULL,\
description TEXT,\
parent_category_id UUID REFERENCES kb_categories(id),\
is_active BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_kb_category UNIQUE (agency_id, name)\
);

Notes:

- agency_id NULL → global category

- Self-referencing hierarchy supported

**Table: kb_articles**

Stores the published article reference.

CREATE TABLE kb_articles (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID REFERENCES agencies(id),\
category_id UUID REFERENCES kb_categories(id),\
title VARCHAR(255) NOT NULL,\
slug VARCHAR(255) NOT NULL,\
current_version_id UUID,\
visibility VARCHAR(50) DEFAULT \'public\',\
is_published BOOLEAN DEFAULT FALSE,\
published_at TIMESTAMP,\
created_by UUID REFERENCES users(id),\
created_at TIMESTAMP DEFAULT NOW(),\
updated_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_kb_slug UNIQUE (agency_id, slug)\
);

visibility values:

- public

- agency_internal

- agent_only

**Table: kb_article_versions**

Maintains version history.

CREATE TABLE kb_article_versions (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,\
version_number INTEGER NOT NULL,\
content TEXT NOT NULL,\
summary TEXT,\
change_notes TEXT,\
is_published BOOLEAN DEFAULT FALSE,\
created_by UUID REFERENCES users(id),\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_article_version UNIQUE (article_id, version_number)\
);

Design behavior:

- Only one version marked published at a time

- kb_articles.current_version_id references active version

**Table: kb_tags**

CREATE TABLE kb_tags (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID REFERENCES agencies(id),\
name VARCHAR(100) NOT NULL,\
CONSTRAINT uq_kb_tag UNIQUE (agency_id, name)\
);

**Table: kb_article_tag_mappings**

CREATE TABLE kb_article_tag_mappings (\
article_id UUID REFERENCES kb_articles(id) ON DELETE CASCADE,\
tag_id UUID REFERENCES kb_tags(id) ON DELETE CASCADE,\
PRIMARY KEY (article_id, tag_id)\
);

**Table: kb_feedback**

Stores user feedback on articles.

CREATE TABLE kb_feedback (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
article_id UUID NOT NULL REFERENCES kb_articles(id) ON DELETE CASCADE,\
user_id UUID REFERENCES users(id),\
rating INTEGER CHECK (rating BETWEEN 1 AND 5),\
was_helpful BOOLEAN,\
feedback_comment TEXT,\
created_at TIMESTAMP DEFAULT NOW()\
);

**Table: kb_article_views**

Tracks usage metrics.

CREATE TABLE kb_article_views (\
id BIGSERIAL PRIMARY KEY,\
article_id UUID REFERENCES kb_articles(id) ON DELETE CASCADE,\
viewed_by UUID REFERENCES users(id),\
ip_address INET,\
viewed_at TIMESTAMP DEFAULT NOW()\
);

Partitioned monthly for scale.

**3.6.4 Relationships Overview**

- kb_categories → self-referencing hierarchy

- kb_articles → kb_categories (N:1)

- kb_articles → kb_article_versions (1:N)

- kb_articles ↔ kb_tags (M:N)

- kb_articles → kb_feedback (1:N)

**3.6.5 Search & Indexing Strategy**

Indexes:

CREATE INDEX idx_kb_articles_agency ON kb_articles(agency_id);\
CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);\
CREATE INDEX idx_kb_feedback_article ON kb_feedback(article_id);

Full-text search:

- Content indexed in Elasticsearch

- Synonym dictionaries per agency

- AI search ranking

Search fields:

- title

- content

- tags

- summary

**3.6.6 AI Integration**

AI uses KB for:

- Suggesting articles during ticket creation

- Auto-reply generation

- Resolution recommendation

Link stored in:

- ai_recommendations table

- Ticket messages referencing article ID

**3.6.7 Multi-Tenancy Enforcement**

RLS applied to:

- kb_articles

- kb_categories

- kb_tags

Policy example:

CREATE POLICY kb_agency_isolation\
ON kb_articles\
USING (\
agency_id IS NULL\
OR agency_id = current_setting(\'app.current_agency\')::uuid\
);

Supports:

- Global articles

- Agency-specific articles

**3.6.8 Data Integrity Rules**

- Slug unique per agency

- Version numbers sequential

- Only one published version per article

- Cannot delete article with active ticket references

Enforced via:

- Unique constraints

- Triggers

- Soft delete strategy

**3.6.9 Performance Considerations**

Expected scale:

- 50,000+ articles

- 10M+ views annually

- High read, low write

Optimizations:

- Elasticsearch for search

- Caching top articles in Redis

- Partition views table

**3.6.10 Audit & Governance**

All changes to:

- Articles

- Categories

- Visibility

Must generate:

- audit_logs entry

- Version increment

- Change tracking metadata

**Section 3: Data Domain Modeling**

**3.7 Notifications Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.7 Overview**

The Notifications Domain manages all outbound and internal system
notifications triggered by ticket events, SLA breaches, escalations, and
administrative actions.

It supports:

- Email notifications

- SMS notifications

- Push notifications

- In-app notifications

- Webhook callbacks

- Delivery tracking

- Retry mechanisms

- Template management

This domain must support:

- High-volume messaging

- Multi-channel delivery

- Audit traceability

- Failure handling

- Rate limiting

Notifications must be asynchronous and event-driven.

**3.7.1 Core Design Principles**

- All notifications are event-triggered

- Templates must be reusable and agency-configurable

- Delivery attempts must be logged

- Failures must be retryable

- Sensitive content must be masked

- Notification logs must be immutable

**3.7.2 Entity List**

1.  notification_templates

2.  notifications

3.  notification_recipients

4.  notification_delivery_logs

5.  sms_logs

6.  email_logs

7.  push_logs

8.  webhook_logs

**3.7.3 Entity Specifications**

**Table: notification_templates**

CREATE TABLE notification_templates (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID REFERENCES agencies(id),\
template_name VARCHAR(150) NOT NULL,\
channel VARCHAR(50) NOT NULL,\
subject_template VARCHAR(255),\
body_template TEXT NOT NULL,\
is_active BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
updated_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_notification_template UNIQUE (agency_id, template_name,
channel)\
);

channel values:

- email

- sms

- push

- in_app

- webhook

Templates support variable placeholders:

- {{ticket_number}}

- {{agency_name}}

- {{sla_due_at}}

**Table: notifications**

Core notification queue.

CREATE TABLE notifications (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID REFERENCES agencies(id),\
ticket_id UUID REFERENCES tickets(id),\
template_id UUID REFERENCES notification_templates(id),\
trigger_event VARCHAR(100),\
channel VARCHAR(50) NOT NULL,\
status VARCHAR(50) DEFAULT \'pending\',\
scheduled_at TIMESTAMP DEFAULT NOW(),\
sent_at TIMESTAMP,\
retry_count INTEGER DEFAULT 0,\
max_retries INTEGER DEFAULT 3,\
created_at TIMESTAMP DEFAULT NOW()\
);

status values:

- pending

- sent

- failed

- cancelled

- retrying

Indexes:

CREATE INDEX idx_notifications_status ON notifications(status);\
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_at);

**Table: notification_recipients**

Supports multiple recipients per notification.

CREATE TABLE notification_recipients (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE
CASCADE,\
recipient_user_id UUID REFERENCES users(id),\
recipient_email VARCHAR(255),\
recipient_phone VARCHAR(50),\
delivery_status VARCHAR(50) DEFAULT \'pending\',\
delivered_at TIMESTAMP\
);

delivery_status values:

- pending

- delivered

- failed

- bounced

**Table: notification_delivery_logs**

Immutable delivery attempts log.

CREATE TABLE notification_delivery_logs (\
id BIGSERIAL PRIMARY KEY,\
notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,\
recipient_id UUID REFERENCES notification_recipients(id),\
attempt_number INTEGER,\
delivery_status VARCHAR(50),\
provider_response TEXT,\
attempted_at TIMESTAMP DEFAULT NOW()\
);

Partitioned monthly.

**Table: sms_logs**

CREATE TABLE sms_logs (\
id BIGSERIAL PRIMARY KEY,\
notification_id UUID REFERENCES notifications(id),\
phone_number VARCHAR(50),\
message_body TEXT,\
provider_name VARCHAR(100),\
provider_message_id VARCHAR(150),\
delivery_status VARCHAR(50),\
cost NUMERIC(10,4),\
sent_at TIMESTAMP DEFAULT NOW()\
);

**Table: email_logs**

CREATE TABLE email_logs (\
id BIGSERIAL PRIMARY KEY,\
notification_id UUID REFERENCES notifications(id),\
recipient_email VARCHAR(255),\
subject TEXT,\
message_body TEXT,\
provider_name VARCHAR(100),\
provider_message_id VARCHAR(150),\
delivery_status VARCHAR(50),\
opened BOOLEAN DEFAULT FALSE,\
clicked BOOLEAN DEFAULT FALSE,\
sent_at TIMESTAMP DEFAULT NOW()\
);

**Table: push_logs**

CREATE TABLE push_logs (\
id BIGSERIAL PRIMARY KEY,\
notification_id UUID REFERENCES notifications(id),\
device_token TEXT,\
message_title TEXT,\
message_body TEXT,\
delivery_status VARCHAR(50),\
sent_at TIMESTAMP DEFAULT NOW()\
);

**Table: webhook_logs**

CREATE TABLE webhook_logs (\
id BIGSERIAL PRIMARY KEY,\
notification_id UUID REFERENCES notifications(id),\
target_url TEXT,\
payload JSONB,\
response_status INTEGER,\
response_body TEXT,\
sent_at TIMESTAMP DEFAULT NOW()\
);

**3.7.4 Notification Processing Flow**

1.  Event triggered (ticket update, SLA breach, escalation)

2.  Insert into notifications table

3.  Worker service processes queue

4.  Resolve template variables

5.  Insert notification_recipients

6.  Send via provider

7.  Log delivery in respective channel log

8.  Update notification status

All operations emit Kafka events for monitoring.

**3.7.5 Retry Logic**

Retry conditions:

- delivery_status = failed

- retry_count \< max_retries

Backoff strategy:

- Exponential backoff

- Configurable per agency

retry_count incremented per attempt.

**3.7.6 Multi-Tenancy Enforcement**

RLS applied to:

- notification_templates

- notifications

Policy example:

CREATE POLICY notification_agency_isolation\
ON notifications\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

**3.7.7 Performance Strategy**

Expected scale:

- Millions of notifications annually

- High write volume

Optimizations:

- Index on status + scheduled_at

- Partition delivery logs

- Asynchronous processing via Kafka

- Redis queue caching

**3.7.8 Data Integrity Rules**

- Cannot mark notification as sent without sent_at

- Delivery logs immutable

- Template must exist before notification creation

- Retry_count cannot exceed max_retries

**3.7.9 Security & Compliance**

- Mask sensitive content in logs

- Encrypt phone numbers and emails where required

- Restrict webhook endpoints

- Store provider responses for audit

**3.7.10 Audit Requirements**

All template changes must:

- Generate audit_logs entry

- Require elevated role

- Emit configuration change event

Delivery logs retained per regulatory retention policy.

**Section 3: Data Domain Modeling**

**3.8 Audit & Compliance Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.8 Overview**

The Audit & Compliance Domain ensures full traceability, regulatory
compliance, and legal defensibility of all actions performed within the
eSCC platform.

This domain supports:

- Immutable audit trails

- User activity tracking

- Sensitive data access logging

- Consent management

- Data retention enforcement

- Regulatory reporting

- Forensic investigation support

This domain must comply with:

- Kenya Data Protection Act

- Government ICT Authority standards

- Public service digital governance policies

All critical actions must be recorded and preserved according to
retention policies.

**3.8.1 Core Design Principles**

- Audit logs are append-only and immutable

- No audit record may be modified or deleted

- Sensitive data access must be logged

- Consent records must be versioned

- Retention policies must be enforceable

- Logs must support partitioning at scale

**3.8.2 Entity List**

1.  audit_logs

2.  user_activity_logs

3.  data_access_logs

4.  consent_records

5.  consent_versions

6.  retention_policies

7.  archival_records

**3.8.3 Entity Specifications**

**Table: audit_logs**

Captures all configuration and system-level changes.

CREATE TABLE audit_logs (\
id BIGSERIAL PRIMARY KEY,\
entity_type VARCHAR(100) NOT NULL,\
entity_id UUID,\
action_type VARCHAR(100) NOT NULL,\
old_value JSONB,\
new_value JSONB,\
performed_by UUID REFERENCES users(id),\
performed_by_role VARCHAR(100),\
ip_address INET,\
created_at TIMESTAMP DEFAULT NOW()\
);

Examples:

- SLA rule updated

- Agency settings changed

- Role permissions modified

- Escalation matrix edited

Partitioned monthly.

**Table: user_activity_logs**

Tracks user interactions within system.

CREATE TABLE user_activity_logs (\
id BIGSERIAL PRIMARY KEY,\
user_id UUID REFERENCES users(id),\
agency_id UUID REFERENCES agencies(id),\
activity_type VARCHAR(100),\
ticket_id UUID,\
description TEXT,\
ip_address INET,\
user_agent TEXT,\
created_at TIMESTAMP DEFAULT NOW()\
);

activity_type examples:

- ticket_created

- ticket_updated

- login_success

- login_failed

- article_published

- automation_rule_created

**Table: data_access_logs**

Logs access to sensitive data fields.

CREATE TABLE data_access_logs (\
id BIGSERIAL PRIMARY KEY,\
user_id UUID REFERENCES users(id),\
agency_id UUID REFERENCES agencies(id),\
entity_type VARCHAR(100),\
entity_id UUID,\
field_accessed VARCHAR(100),\
access_type VARCHAR(50),\
accessed_at TIMESTAMP DEFAULT NOW()\
);

access_type values:

- read

- export

- print

- download

Triggers required on:

- Sensitive columns (national_id, phone_number, etc.)

- Ticket export operations

**Table: consent_records**

Stores high-level consent agreement.

CREATE TABLE consent_records (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
user_id UUID REFERENCES users(id) ON DELETE CASCADE,\
consent_type VARCHAR(100) NOT NULL,\
current_version_id UUID,\
consent_given BOOLEAN NOT NULL,\
consent_timestamp TIMESTAMP NOT NULL,\
revoked_at TIMESTAMP,\
created_at TIMESTAMP DEFAULT NOW()\
);

consent_type examples:

- data_processing

- marketing_communication

- cross_agency_data_sharing

**Table: consent_versions**

Tracks consent text versions.

CREATE TABLE consent_versions (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
consent_type VARCHAR(100) NOT NULL,\
version_number INTEGER NOT NULL,\
consent_text TEXT NOT NULL,\
effective_date DATE NOT NULL,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_consent_version UNIQUE (consent_type, version_number)\
);

**Table: retention_policies**

Defines retention configuration.

CREATE TABLE retention_policies (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
entity_type VARCHAR(100) NOT NULL,\
retention_period_days INTEGER NOT NULL,\
archive_after_days INTEGER,\
is_active BOOLEAN DEFAULT TRUE,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_retention_policy UNIQUE (entity_type)\
);

entity_type examples:

- tickets

- ticket_messages

- audit_logs

- authentication_logs

- notifications

**Table: archival_records**

Tracks archived records.

CREATE TABLE archival_records (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
entity_type VARCHAR(100),\
entity_id UUID,\
archived_at TIMESTAMP DEFAULT NOW(),\
archived_by_process VARCHAR(100),\
storage_location TEXT\
);

**3.8.4 Immutability Enforcement**

The following tables are strictly append-only:

- audit_logs

- breach_logs

- escalation_events

- notification_delivery_logs

- automation_execution_logs

Enforced via:

- No UPDATE permissions

- No DELETE permissions

- DB-level role restriction

- Write-only access via service account

**3.8.5 Multi-Tenancy Enforcement**

RLS applied to:

- user_activity_logs

- data_access_logs

Policy example:

CREATE POLICY audit_agency_isolation\
ON user_activity_logs\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

Note:

audit_logs may allow Command Center global visibility.

**3.8.6 Data Integrity Rules**

- Audit records cannot be modified

- Consent revocation must timestamp revoked_at

- Retention policy must exist for each major entity

- Data access log required for sensitive export

Enforced via:

- DB triggers

- Application service validation

- Scheduled compliance jobs

**3.8.7 Retention & Archival Workflow**

1.  Scheduled job scans retention_policies

2.  Identify records beyond archive threshold

3.  Move to archival storage (cold DB or object storage)

4.  Insert archival_record entry

5.  Mark original record archived

No permanent deletion without policy approval.

**3.8.8 Performance Strategy**

Expected scale:

- 50M+ audit records annually

- High write, low read

Optimizations:

- Monthly partitioning

- Index on created_at

- Index on entity_type

- Data warehouse replication for analytics

**3.8.9 Compliance Reporting Support**

The database must support generation of:

- Data access reports per user

- SLA breach audit report

- Ticket lifecycle trace report

- Consent compliance report

- Data export audit logs

Materialized views may be used for reporting.

**3.8.10 Security Controls**

- Strict DB role separation

- Audit table write-only

- No direct admin modification

- Encrypted backups

- Integrity validation checksums

**Section 3: Data Domain Modeling**

**3.9 Analytics & Reporting Domain**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**3.9 Overview**

The Analytics & Reporting Domain supports operational dashboards,
executive reporting, SLA monitoring, and cross-agency performance
benchmarking.

This domain is optimized for:

- Fast read queries

- Aggregated metrics

- Time-series reporting

- Command Center dashboards

- Data warehouse synchronization

This layer does not replace transactional data. It provides
pre-aggregated, query-optimized structures to avoid heavy load on core
ticket tables.

**3.9.1 Core Design Principles**

- No heavy aggregation on transactional tables

- Metrics computed via background jobs

- Time-based partitioning

- Separate operational metrics from BI warehouse

- Support real-time dashboard needs (\< 2 sec query time)

- Ensure consistency with source-of-truth tables

**3.9.2 Data Strategy**

Two-tier approach:

1.  Operational Analytics (PostgreSQL)

    - Near real-time summaries

    - Materialized views

    - Aggregated tables

2.  Strategic Analytics (Data Warehouse)

    - Historical trends

    - Cross-agency comparisons

    - AI training datasets

    - BI tools integration

**3.9.3 Entity List**

1.  ticket_metrics_hourly

2.  ticket_metrics_daily

3.  agency_performance_metrics

4.  sla_performance_metrics

5.  user_activity_metrics

6.  dashboard_snapshots

**3.9.4 Entity Specifications**

**Table: ticket_metrics_hourly**

Aggregated ticket statistics per hour.

CREATE TABLE ticket_metrics_hourly (\
id BIGSERIAL PRIMARY KEY,\
agency_id UUID REFERENCES agencies(id),\
hour_bucket TIMESTAMP NOT NULL,\
tickets_created INTEGER DEFAULT 0,\
tickets_resolved INTEGER DEFAULT 0,\
tickets_closed INTEGER DEFAULT 0,\
tickets_escalated INTEGER DEFAULT 0,\
tickets_reopened INTEGER DEFAULT 0,\
avg_first_response_minutes NUMERIC(10,2),\
avg_resolution_minutes NUMERIC(10,2),\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_ticket_hourly UNIQUE (agency_id, hour_bucket)\
);

Index:

CREATE INDEX idx_ticket_hourly_agency_time\
ON ticket_metrics_hourly(agency_id, hour_bucket DESC);

**Table: ticket_metrics_daily**

Daily aggregation per agency.

CREATE TABLE ticket_metrics_daily (\
id BIGSERIAL PRIMARY KEY,\
agency_id UUID REFERENCES agencies(id),\
date_bucket DATE NOT NULL,\
tickets_created INTEGER DEFAULT 0,\
tickets_resolved INTEGER DEFAULT 0,\
tickets_closed INTEGER DEFAULT 0,\
open_tickets INTEGER DEFAULT 0,\
escalated_tickets INTEGER DEFAULT 0,\
breached_response INTEGER DEFAULT 0,\
breached_resolution INTEGER DEFAULT 0,\
avg_first_response_minutes NUMERIC(10,2),\
avg_resolution_minutes NUMERIC(10,2),\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_ticket_daily UNIQUE (agency_id, date_bucket)\
);

**Table: agency_performance_metrics**

Used for Command Center cross-agency comparison.

CREATE TABLE agency_performance_metrics (\
id BIGSERIAL PRIMARY KEY,\
agency_id UUID REFERENCES agencies(id),\
reporting_period_start DATE NOT NULL,\
reporting_period_end DATE NOT NULL,\
total_tickets INTEGER,\
avg_response_time NUMERIC(10,2),\
avg_resolution_time NUMERIC(10,2),\
sla_compliance_percentage NUMERIC(5,2),\
escalation_rate_percentage NUMERIC(5,2),\
citizen_satisfaction_score NUMERIC(5,2),\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_agency_performance UNIQUE (agency_id,
reporting_period_start, reporting_period_end)\
);

**Table: sla_performance_metrics**

SLA-specific analytics.

CREATE TABLE sla_performance_metrics (\
id BIGSERIAL PRIMARY KEY,\
agency_id UUID REFERENCES agencies(id),\
date_bucket DATE NOT NULL,\
total_sla_tracked INTEGER,\
response_met INTEGER,\
response_breached INTEGER,\
resolution_met INTEGER,\
resolution_breached INTEGER,\
avg_breach_duration_minutes NUMERIC(10,2),\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_sla_daily UNIQUE (agency_id, date_bucket)\
);

**Table: user_activity_metrics**

Tracks agent productivity.

CREATE TABLE user_activity_metrics (\
id BIGSERIAL PRIMARY KEY,\
user_id UUID REFERENCES users(id),\
agency_id UUID REFERENCES agencies(id),\
date_bucket DATE NOT NULL,\
tickets_assigned INTEGER DEFAULT 0,\
tickets_resolved INTEGER DEFAULT 0,\
avg_resolution_time_minutes NUMERIC(10,2),\
escalations_handled INTEGER DEFAULT 0,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_user_daily UNIQUE (user_id, date_bucket)\
);

**Table: dashboard_snapshots**

Stores precomputed dashboard snapshots.

CREATE TABLE dashboard_snapshots (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
agency_id UUID REFERENCES agencies(id),\
snapshot_type VARCHAR(100),\
snapshot_payload JSONB NOT NULL,\
generated_at TIMESTAMP DEFAULT NOW()\
);

snapshot_type examples:

- command_center_overview

- agency_dashboard

- sla_dashboard

**3.9.5 Materialized Views**

Example:

CREATE MATERIALIZED VIEW mv_open_tickets_by_agency AS\
SELECT agency_id, COUNT(\*) AS open_ticket_count\
FROM tickets\
WHERE status_id IN (\
SELECT id FROM ticket_statuses WHERE is_closed_status = FALSE\
)\
GROUP BY agency_id;

Refresh strategy:

- Scheduled refresh every 5 minutes

- Concurrent refresh enabled

**3.9.6 Aggregation Workflow**

1.  Kafka event triggered on ticket changes

2.  Metrics worker consumes event

3.  Update hourly metrics table

4.  End-of-day job aggregates into daily metrics

5.  Sync to data warehouse

No heavy queries run directly on tickets table for dashboards.

**3.9.7 Data Warehouse Synchronization**

CDC (Change Data Capture) strategy:

- Logical replication from PostgreSQL

- Kafka streaming pipeline

- ETL into data warehouse

Warehouse stores:

- Historical ticket records

- Full SLA history

- Cross-year analytics

- AI training features

Warehouse retention: 7+ years configurable.

**3.9.8 Multi-Tenancy Enforcement**

RLS applied to:

- ticket_metrics_hourly

- ticket_metrics_daily

- sla_performance_metrics

- user_activity_metrics

Command Center Admin role may bypass RLS for national view.

**3.9.9 Performance Strategy**

Expected scale:

- 500+ agencies

- Hourly metrics: \~12,000 rows/day

- Daily metrics: \~500 rows/day

Optimizations:

- Composite indexes on (agency_id, date_bucket)

- JSONB indexing for dashboard_snapshots

- Partition daily metrics yearly

**3.9.10 Data Integrity Rules**

- Metrics derived only from source-of-truth tables

- No manual modification allowed

- Aggregation jobs idempotent

- Validation checks between daily totals and transactional counts

**3.9.11 Compliance & Reporting Support**

System must generate:

- National performance report

- Agency SLA compliance report

- Citizen satisfaction trends

- Escalation frequency analysis

- AI classification accuracy report

Materialized views and warehouse queries support regulatory reporting.

**3.9.12 Scalability Targets**

Designed for:

- 10M+ tickets annually

- Sub-2 second dashboard response

- Real-time escalation monitoring

- Multi-year historical analysis

**End of Section 3.9 -- Analytics & Reporting Domain**

**Section 4: Entity-Relationship Diagrams (ERD)**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**4.1 Overview**

This section defines the logical relationships between all entities in
the eSCC database.

The ERD design ensures:

- Referential integrity

- Strict multi-tenancy isolation

- Clear domain boundaries

- Scalable relational structure

- Audit traceability

All relationships are enforced using foreign key constraints unless
otherwise specified for performance optimization.

**4.2 High-Level ERD (Conceptual Overview)**

At a national level, the system can be represented as:

Agencies\
│\
├── Departments\
│\
├── Users\
│ ├── User Roles\
│ └── Sessions\
│\
├── SLA Policies\
│ └── SLA Rules\
│\
├── Tickets\
│ ├── Ticket Messages\
│ ├── Ticket Attachments\
│ ├── Ticket Assignments\
│ ├── Ticket History\
│ ├── SLA Tracking\
│ │ ├── Breach Logs\
│ │ └── Escalation Events\
│ ├── AI Classification Logs\
│ └── Notifications\
│\
├── Automation Rules\
│ └── Automation Actions\
│\
├── Knowledge Base\
│ ├── Articles\
│ ├── Versions\
│ └── Feedback\
│\
└── Analytics Tables

Cross-cutting domains:

- Audit Logs

- Data Access Logs

- Retention Policies

**4.3 Domain-Level ERDs**

**4.3.1 User & Identity Domain ERD**

**Relationships**

1.  users (1) → (M) user_roles

2.  roles (1) → (M) user_roles

3.  roles (1) → (M) role_permissions

4.  permissions (1) → (M) role_permissions

5.  users (1) → (M) sessions

6.  users (1) → (M) authentication_logs

7.  agencies (1) → (M) agency_users

8.  users (1) → (M) agency_users

**Cardinality Summary**

  ---------------------------------------------
  **Parent**   **Child**      **Cardinality**
  ------------ -------------- -----------------
  users        sessions       1:N

  users        user_roles     1:N

  roles        permissions    M:N

  agencies     agency_users   1:N
  ---------------------------------------------

**4.3.2 Agency & Organization Domain ERD**

**Relationships**

1.  agencies (1) → (M) departments

2.  agencies (1) → (M) escalation_matrix

3.  escalation_matrix (1) → (M) escalation_levels

4.  agencies (M) ↔ (M) service_providers via agency_service_mappings

5.  agencies (1) → (M) agency_settings

6.  agencies (1) → (M) agency_business_hours

**Special Relationship**

Self-referencing:

agencies.parent_agency_id → agencies.id

Supports ministry → department hierarchy.

**4.3.3 Ticket Management Domain ERD**

**Core Relationship**

agencies (1)\
↓\
tickets (M)

**Detailed Relationships**

1.  tickets (1) → (M) ticket_messages

2.  tickets (1) → (M) ticket_assignments

3.  tickets (1) → (M) ticket_history

4.  tickets (1) → (M) ticket_attachments

5.  tickets (1) → (1) sla_tracking

6.  tickets (M) ↔ (M) ticket_tags via ticket_tag_mappings

7.  ticket_categories (1) → (M) tickets

8.  ticket_priority_levels (1) → (M) tickets

9.  ticket_statuses (1) → (M) tickets

**Cardinality Summary**

  ------------------------------------------------
  **Parent**   **Child**         **Cardinality**
  ------------ ----------------- -----------------
  agencies     tickets           1:N

  tickets      ticket_messages   1:N

  tickets      sla_tracking      1:1

  tickets      ticket_history    1:N
  ------------------------------------------------

**4.3.4 SLA & Escalation Domain ERD**

**Relationships**

1.  agencies (1) → (M) sla_policies

2.  sla_policies (1) → (M) sla_rules

3.  tickets (1) → (1) sla_tracking

4.  sla_tracking (1) → (M) breach_logs

5.  sla_tracking (1) → (M) escalation_events

**Important Constraint**

One SLA record per ticket:

sla_tracking.ticket_id UNIQUE

**4.3.5 AI & Automation Domain ERD**

**Relationships**

1.  ai_models (1) → (M) ai_classification_logs

2.  tickets (1) → (M) ai_classification_logs

3.  agencies (1) → (M) automation_rules

4.  automation_rules (1) → (M) automation_actions

5.  tickets (1) → (M) automation_execution_logs

**Design Rule**

AI decisions do NOT directly modify tickets without logging.

**4.3.6 Knowledge Base Domain ERD**

**Relationships**

1.  agencies (1) → (M) kb_categories

2.  kb_categories (1) → (M) kb_articles

3.  kb_articles (1) → (M) kb_article_versions

4.  kb_articles (M) ↔ (M) kb_tags

5.  kb_articles (1) → (M) kb_feedback

**4.3.7 Notifications Domain ERD**

**Relationships**

1.  agencies (1) → (M) notification_templates

2.  tickets (1) → (M) notifications

3.  notifications (1) → (M) notification_recipients

4.  notifications (1) → (M) notification_delivery_logs

5.  notifications (1) → (M) sms_logs

6.  notifications (1) → (M) email_logs

7.  notifications (1) → (M) push_logs

**4.3.8 Audit & Compliance Domain ERD**

**Relationships**

1.  users (1) → (M) user_activity_logs

2.  users (1) → (M) data_access_logs

3.  users (1) → (M) consent_records

4.  consent_records (1) → (M) consent_versions

5.  retention_policies independent but applied across entities

Audit tables are append-only and not parent-owned.

**4.3.9 Analytics Domain ERD**

**Relationships**

1.  agencies (1) → (M) ticket_metrics_daily

2.  agencies (1) → (M) sla_performance_metrics

3.  users (1) → (M) user_activity_metrics

Analytics tables reference source tables but do not enforce cascading
deletes.

**4.4 Referential Integrity Rules**

**4.4.1 Cascading Rules**

  ------------------------------------------
  **Relationship**                **On
                                  Delete**
  ------------------------------- ----------
  tickets → ticket_messages       CASCADE

  tickets → ticket_assignments    CASCADE

  tickets → ticket_history        CASCADE

  agencies → departments          CASCADE

  automation_rules →              CASCADE
  automation_actions              
  ------------------------------------------

**4.4.2 Restricted Deletes**

Deletion NOT allowed if dependent records exist:

- agencies with tickets

- users with audit logs

- SLA policies referenced by active tickets

Enforced using:

ON DELETE RESTRICT

**4.4.3 Soft Delete Strategy**

Applied to:

- tickets

- users

- agencies

Using:

deleted_at TIMESTAMP\
is_deleted BOOLEAN

Audit logs preserve history.

**4.5 Cardinality Matrix (Core Tables)**

  ------------------------------------------------------------
  **Entity A**    **Entity B**              **Relationship**
  --------------- ------------------------- ------------------
  agencies        tickets                   1:N

  tickets         sla_tracking              1:1

  tickets         ticket_messages           1:N

  users           user_roles                1:N

  roles           permissions               M:N

  kb_articles     kb_article_versions       1:N

  notifications   notification_recipients   1:N
  ------------------------------------------------------------

**4.6 Multi-Tenancy Isolation in ERD**

Every tenant-aware table includes:

agency_id UUID NOT NULL

Except:

- Global roles

- System audit logs

- Consent versions

- AI models

Row-Level Security policies enforce isolation.

**4.7 Logical vs Physical ERD**

Logical ERD:

- Domain separation

- Clean relationship modeling

Physical ERD:

- Partitioned tables

- Indexed columns

- Performance optimizations

- Archival boundaries

**4.8 Scalability Considerations in ERD**

High-growth entities:

- tickets

- ticket_messages

- audit_logs

- notification_delivery_logs

- breach_logs

Mitigation:

- Partitioning

- Indexing

- Archival policies

- Read replicas

**4.9 ERD Governance Rules**

- No circular foreign keys

- No nullable foreign key unless business-justified

- All FK indexed

- No orphan records allowed

- Strict naming conventions

**Section 5: Field-Level Specifications**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**5.1 Overview**

This section provides detailed field-level specifications for core
transactional tables across all major domains.

Each table definition includes:

- Column Name

- Data Type

- Nullable (Yes/No)

- Default Value

- Constraints

- Indexed (Yes/No)

- Encryption Required (Yes/No)

- PII Classification (Yes/No)

Sensitive fields are identified for:

- Column-level encryption

- Data masking

- Access logging

This section covers high-impact core tables. Extended analytics and log
tables follow similar patterns.

**5.2 users Table**

  --------------------------------------------------------------------------------------------------------------------------------------
  **Column**                 **Type**       **Nullable**   **Default**         **Constraints**   **Indexed**   **Encrypted**   **PII**
  -------------------------- -------------- -------------- ------------------- ----------------- ------------- --------------- ---------
  id                         UUID           No             gen_random_uuid()   PK                Yes           No              No

  ecitizen_user_id           VARCHAR(100)   Yes            \-                  Unique (optional) Yes           No              Yes

  user_type                  VARCHAR(30)    No             \-                  ENUM enforced     Yes           No              No

  first_name                 VARCHAR(100)   Yes            \-                  \-                No            Optional        Yes

  last_name                  VARCHAR(100)   Yes            \-                  \-                No            Optional        Yes

  email                      VARCHAR(255)   No             \-                  Unique            Yes           Optional        Yes

  phone_number               VARCHAR(20)    Yes            \-                  \-                Yes           Yes             Yes

  national_id                VARCHAR(50)    Yes            \-                  Unique (optional) Yes           Yes             Yes

  business_registration_no   VARCHAR(100)   Yes            \-                  \-                Yes           Yes             Yes

  password_hash              TEXT           Yes            \-                  \-                No            Yes             Yes

  is_active                  BOOLEAN        No             TRUE                \-                Yes           No              No

  is_verified                BOOLEAN        No             FALSE               \-                No            No              No

  mfa_enabled                BOOLEAN        No             FALSE               \-                No            No              No

  last_login_at              TIMESTAMP      Yes            \-                  \-                Yes           No              No

  created_at                 TIMESTAMP      No             NOW()               \-                Yes           No              No

  updated_at                 TIMESTAMP      No             NOW()               \-                No            No              No

  deleted_at                 TIMESTAMP      Yes            \-                  Soft delete       Yes           No              No
  --------------------------------------------------------------------------------------------------------------------------------------

**5.3 agencies Table**

  -------------------------------------------------------------------------------------------------------------------------------
  **Column**          **Type**       **Nullable**   **Default**         **Constraints**   **Indexed**   **Encrypted**   **PII**
  ------------------- -------------- -------------- ------------------- ----------------- ------------- --------------- ---------
  id                  UUID           No             gen_random_uuid()   PK                Yes           No              No

  agency_code         VARCHAR(50)    No             \-                  Unique            Yes           No              No

  agency_name         VARCHAR(255)   No             \-                  \-                Yes           No              No

  agency_type         VARCHAR(50)    No             \-                  ENUM              Yes           No              No

  parent_agency_id    UUID           Yes            \-                  FK → agencies     Yes           No              No

  official_email      VARCHAR(255)   Yes            \-                  \-                Yes           Optional        Yes

  official_phone      VARCHAR(50)    Yes            \-                  \-                Yes           Optional        Yes

  is_active           BOOLEAN        No             TRUE                \-                Yes           No              No

  onboarding_status   VARCHAR(50)    No             \'pending\'         \-                Yes           No              No

  created_at          TIMESTAMP      No             NOW()               \-                Yes           No              No
  -------------------------------------------------------------------------------------------------------------------------------

**5.4 tickets Table (Core Transaction Table)**

  --------------------------------------------------------------------------------------------------------------------------------------
  **Column**                 **Type**       **Nullable**   **Default**         **Constraints**   **Indexed**   **Encrypted**   **PII**
  -------------------------- -------------- -------------- ------------------- ----------------- ------------- --------------- ---------
  id                         UUID           No             gen_random_uuid()   PK                Yes           No              No

  ticket_number              VARCHAR(30)    No             \-                  Unique            Yes           No              No

  agency_id                  UUID           No             \-                  FK                Yes           No              No

  department_id              UUID           Yes            \-                  FK                Yes           No              No

  category_id                UUID           Yes            \-                  FK                Yes           No              No

  created_by                 UUID           No             \-                  FK                Yes           No              No

  current_assignee_id        UUID           Yes            \-                  FK                Yes           No              No

  priority_id                UUID           Yes            \-                  FK                Yes           No              No

  status_id                  UUID           No             \-                  FK                Yes           No              No

  channel                    VARCHAR(50)    No             \-                  ENUM              Yes           No              No

  subject                    VARCHAR(255)   No             \-                  \-                Yes           No              No

  description                TEXT           No             \-                  \-                Yes (FTS)     Optional        Yes

  ai_predicted_category_id   UUID           Yes            \-                  FK                Yes           No              No

  ai_confidence_score        NUMERIC(5,2)   Yes            \-                  0--100            Yes           No              No

  sla_response_due_at        TIMESTAMP      Yes            \-                  \-                Yes           No              No

  sla_resolution_due_at      TIMESTAMP      Yes            \-                  \-                Yes           No              No

  first_response_at          TIMESTAMP      Yes            \-                  \-                Yes           No              No

  resolved_at                TIMESTAMP      Yes            \-                  \-                Yes           No              No

  closed_at                  TIMESTAMP      Yes            \-                  \-                Yes           No              No

  reopen_count               INTEGER        No             0                   \-                Yes           No              No

  escalation_level           INTEGER        No             0                   \-                Yes           No              No

  is_escalated               BOOLEAN        No             FALSE               \-                Yes           No              No

  is_deleted                 BOOLEAN        No             FALSE               \-                Yes           No              No

  created_at                 TIMESTAMP      No             NOW()               Partition key     Yes           No              No

  updated_at                 TIMESTAMP      No             NOW()               \-                Yes           No              No
  --------------------------------------------------------------------------------------------------------------------------------------

**5.5 ticket_messages Table**

  -------------------------------------------------------------------------------------------------------------------------
  **Column**     **Type**      **Nullable**   **Default**         **Constraints**   **Indexed**   **Encrypted**   **PII**
  -------------- ------------- -------------- ------------------- ----------------- ------------- --------------- ---------
  id             UUID          No             gen_random_uuid()   PK                Yes           No              No

  ticket_id      UUID          No             \-                  FK                Yes           No              No

  sender_id      UUID          Yes            \-                  FK                Yes           No              No

  message_type   VARCHAR(50)   No             \'comment\'         ENUM              Yes           No              No

  message_text   TEXT          Yes            \-                  \-                Yes (FTS)     Optional        Yes

  is_internal    BOOLEAN       No             FALSE               \-                Yes           No              No

  created_at     TIMESTAMP     No             NOW()               Partition         Yes           No              No
                                                                  candidate                                       
  -------------------------------------------------------------------------------------------------------------------------

**5.6 sla_tracking Table**

  ------------------------------------------------------------------------------------------------------------------------------
  **Column**            **Type**    **Nullable**   **Default**         **Constraints**   **Indexed**   **Encrypted**   **PII**
  --------------------- ----------- -------------- ------------------- ----------------- ------------- --------------- ---------
  id                    UUID        No             gen_random_uuid()   PK                Yes           No              No

  ticket_id             UUID        No             \-                  Unique FK         Yes           No              No

  sla_policy_id         UUID        Yes            \-                  FK                Yes           No              No

  response_due_at       TIMESTAMP   No             \-                  \-                Yes           No              No

  resolution_due_at     TIMESTAMP   No             \-                  \-                Yes           No              No

  response_met          BOOLEAN     Yes            \-                  \-                Yes           No              No

  resolution_met        BOOLEAN     Yes            \-                  \-                Yes           No              No

  response_breached     BOOLEAN     No             FALSE               \-                Yes           No              No

  resolution_breached   BOOLEAN     No             FALSE               \-                Yes           No              No

  escalation_level      INTEGER     No             0                   \-                Yes           No              No

  last_escalated_at     TIMESTAMP   Yes            \-                  \-                Yes           No              No
  ------------------------------------------------------------------------------------------------------------------------------

**5.7 audit_logs Table**

  ---------------------------------------------------------------------------------------------------------------------
  **Column**     **Type**       **Nullable**   **Default**   **Constraints**   **Indexed**   **Encrypted**   **PII**
  -------------- -------------- -------------- ------------- ----------------- ------------- --------------- ----------
  id             BIGSERIAL      No             Auto          PK                Yes           No              No

  entity_type    VARCHAR(100)   No             \-            \-                Yes           No              No

  entity_id      UUID           Yes            \-            \-                Yes           No              No

  action_type    VARCHAR(100)   No             \-            \-                Yes           No              No

  old_value      JSONB          Yes            \-            \-                Yes           No              Possibly

  new_value      JSONB          Yes            \-            \-                Yes           No              Possibly

  performed_by   UUID           Yes            \-            FK                Yes           No              No

  ip_address     INET           Yes            \-            \-                Yes           No              Yes

  created_at     TIMESTAMP      No             NOW()         Partition key     Yes           No              No
  ---------------------------------------------------------------------------------------------------------------------

**5.8 notification_templates Table**

  -------------------------------------------------------------------------------------------------------------------------------
  **Column**         **Type**       **Nullable**   **Default**         **Constraints**   **Indexed**   **Encrypted**   **PII**
  ------------------ -------------- -------------- ------------------- ----------------- ------------- --------------- ----------
  id                 UUID           No             gen_random_uuid()   PK                Yes           No              No

  agency_id          UUID           Yes            \-                  FK                Yes           No              No

  template_name      VARCHAR(150)   No             \-                  Unique (per       Yes           No              No
                                                                       agency)                                         

  channel            VARCHAR(50)    No             \-                  ENUM              Yes           No              No

  subject_template   VARCHAR(255)   Yes            \-                  \-                No            No              No

  body_template      TEXT           No             \-                  \-                No            No              Possibly

  is_active          BOOLEAN        No             TRUE                \-                Yes           No              No
  -------------------------------------------------------------------------------------------------------------------------------

**5.9 Encryption & PII Classification Summary**

Sensitive Data Categories:

High Sensitivity (Encrypted + Access Logged):

- national_id

- business_registration_no

- password_hash

- mfa_secret

- api_key_hash

- phone_number

- personal email

Moderate Sensitivity:

- IP address

- user agent

- ticket description (if containing personal data)

Low Sensitivity:

- ticket number

- SLA timestamps

- priority

- status

Encryption Standard:

- AES-256 at rest

- TLS 1.2+ in transit

- Role-based decryption access

**5.10 Field Governance Rules**

- All FK columns indexed

- All timestamp columns indexed where used in filtering

- No nullable foreign key unless business justified

- ENUM values controlled at application layer

- All JSONB fields validated via schema

**5.11 Data Masking Rules**

Applied in:

- Admin dashboards

- Cross-agency reporting

- Export files

Masking examples:

- national_id → XXXX-XXXX-1234

- phone_number → 07XX-XXX-123

- email → j\*\*\*@domain.com

**End of Section 5 -- Field-Level Specifications**

**Section 6: Indexing Strategy**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**6.1 Overview**

The indexing strategy for eSCC is designed to support:

- 10M+ tickets annually

- High read concurrency

- Real-time dashboards

- SLA deadline monitoring

- Full-text search

- Multi-agency isolation

- Efficient partition pruning

Indexes must:

- Optimize high-frequency queries

- Avoid unnecessary write overhead

- Support partitioned tables

- Align with RLS policies

- Enable sub-2 second dashboard response time

**6.2 Primary Indexes**

All tables use:

- Primary Key (PK) index

- Foreign key (FK) supporting index

Example:

PRIMARY KEY (id);

Foreign keys must always have supporting indexes.

Example:

CREATE INDEX idx_tickets_agency_id ON tickets(agency_id);

**6.3 Core Transactional Indexes**

**6.3.1 Tickets Table**

High-frequency queries:

- Tickets by agency

- Tickets by status

- Tickets by assignee

- Tickets by SLA deadline

- Dashboard filtering

Indexes:

CREATE INDEX idx_tickets_agency_status\
ON tickets(agency_id, status_id);\
\
CREATE INDEX idx_tickets_assignee\
ON tickets(current_assignee_id);\
\
CREATE INDEX idx_tickets_priority\
ON tickets(priority_id);\
\
CREATE INDEX idx_tickets_sla_resolution_due\
ON tickets(sla_resolution_due_at);\
\
CREATE INDEX idx_tickets_created_at\
ON tickets(created_at DESC);

Composite Dashboard Index:

CREATE INDEX idx_tickets_dashboard\
ON tickets(agency_id, status_id, priority_id, created_at DESC);

**6.3.2 Ticket Messages**

Frequent query:

- Retrieve messages by ticket_id ordered by created_at

Index:

CREATE INDEX idx_ticket_messages_ticket_created\
ON ticket_messages(ticket_id, created_at ASC);

**6.3.3 SLA Tracking**

Deadline monitoring queries:

CREATE INDEX idx_sla_resolution_due\
ON sla_tracking(resolution_due_at)\
WHERE resolution_breached = FALSE;\
\
CREATE INDEX idx_sla_response_due\
ON sla_tracking(response_due_at)\
WHERE response_breached = FALSE;

Partial indexes reduce scan overhead.

**6.3.4 Audit Logs**

High write volume, filtered by date:

CREATE INDEX idx_audit_logs_created_at\
ON audit_logs(created_at DESC);\
\
CREATE INDEX idx_audit_logs_entity\
ON audit_logs(entity_type, entity_id);

**6.3.5 Notifications**

Queue processing:

CREATE INDEX idx_notifications_pending\
ON notifications(status, scheduled_at)\
WHERE status = \'pending\';

**6.4 Composite Index Strategy**

Composite indexes are used when:

- Multiple filters are frequently combined

- Order-by clause matches index order

Examples:

  -------------------------------------------
  **Query         **Index**
  Pattern**       
  --------------- ---------------------------
  Agency + Status (agency_id, status_id)

  Agency + SLA    (agency_id,
  Due             sla_resolution_due_at)

  Assignee +      (current_assignee_id,
  Status          status_id)

  Ticket +        (ticket_id, created_at)
  Created         
  -------------------------------------------

**6.5 Full-Text Search Indexes**

Full-text search required for:

- Ticket subject

- Ticket description

- Message text

- Knowledge base content

PostgreSQL example:

CREATE INDEX idx_tickets_fts\
ON tickets\
USING GIN (to_tsvector(\'english\', subject \|\| \' \' \|\|
description));

For large-scale search:

- Offload to Elasticsearch

- Index fields:

  - subject

  - description

  - tags

  - category

  - agency_id

Elasticsearch ensures:

- Faster fuzzy matching

- Multi-field boosting

- AI relevance ranking

**6.6 Partition Index Strategy**

Partitioned tables:

- tickets

- ticket_messages

- audit_logs

- breach_logs

- notification_delivery_logs

Indexes must be created on each partition automatically.

Example:

CREATE INDEX ON tickets_2026_01(agency_id, status_id);

Partition pruning ensures:

- Time-based queries scan only relevant partitions

- Reduced I/O load

**6.7 Partial Indexes**

Used to optimize filtered datasets.

Examples:

Open tickets only:

CREATE INDEX idx_open_tickets\
ON tickets(agency_id)\
WHERE is_deleted = FALSE\
AND status_id IN (\
SELECT id FROM ticket_statuses WHERE is_closed_status = FALSE\
);

Active users only:

CREATE INDEX idx_active_users\
ON users(email)\
WHERE is_active = TRUE;

**6.8 JSONB Indexing**

For automation rules and audit logs:

CREATE INDEX idx_automation_actions_payload\
ON automation_actions\
USING GIN (action_payload);

For audit logs:

CREATE INDEX idx_audit_logs_json\
ON audit_logs\
USING GIN (new_value);

Use selectively to avoid write overhead.

**6.9 RLS Performance Considerations**

Since Row-Level Security filters by agency_id:

All tenant-aware tables must have:

CREATE INDEX idx_table_agency\
ON table_name(agency_id);

This prevents full table scans under RLS conditions.

**6.10 Index Maintenance Strategy**

- Monitor index usage via pg_stat_user_indexes

- Remove unused indexes

- Rebuild fragmented indexes periodically

- Use REINDEX during maintenance windows

- Analyze query plans quarterly

**6.11 Write vs Read Trade-Off**

High-write tables:

- ticket_messages

- audit_logs

- notification_delivery_logs

Minimize index count to:

- PK

- Essential FK

- created_at

Avoid excessive composite indexes on heavy write tables.

**6.12 Performance Targets**

Target query response times:

  -----------------------------------
  **Query Type**         **Target**
  ---------------------- ------------
  Ticket lookup by ID    \< 50 ms

  Agency dashboard       \< 2 sec

  SLA breach scan        \< 500 ms

  Search query           \< 1 sec
  (Elasticsearch)        

  Notification queue     \< 100 ms
  polling                
  -----------------------------------

**6.13 Index Governance Rules**

- Every FK must have an index

- Avoid duplicate overlapping indexes

- Use partial indexes for filtered queries

- Prefer composite index over multiple single indexes for common
  patterns

- Review indexes during each release cycle

**6.14 Scalability Outlook**

As data grows beyond 50M+ tickets:

- Move historical partitions to archive cluster

- Use read-only replicas for analytics

- Consider Citus (distributed PostgreSQL) for horizontal scaling

- Offload heavy analytics to data warehouse

**Section 7: Security Design**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**7.1 Overview**

The Security Design defines how the eSCC database enforces:

- Confidentiality

- Integrity

- Availability

- Tenant isolation

- Regulatory compliance

- Auditability

Security controls are implemented at:

- Database layer

- Column level

- Row level

- Role level

- Infrastructure level

This section aligns with:

- Kenya Data Protection Act

- Government ICT Authority standards

- Public sector digital governance policies

**7.2 Data Encryption Strategy**

**7.2.1 Encryption in Transit**

All database connections must use:

- TLS 1.2 or higher

- Enforced SSL mode (sslmode=require)

- Certificate-based authentication for internal services

No plaintext database connections permitted.

**7.2.2 Encryption at Rest**

- AES-256 disk-level encryption

- Encrypted storage volumes

- Encrypted database backups

- Encrypted WAL archives

- Encrypted object storage for attachments

Backup encryption keys stored separately from database host.

**7.3 Column-Level Encryption**

Sensitive fields require application-level encryption before storage.

**7.3.1 High-Sensitivity Fields (Mandatory Encryption)**

  --------------------------------------
  **Table**   **Column**
  ----------- --------------------------
  users       national_id

  users       business_registration_no

  users       phone_number

  users       password_hash

  users       mfa_secret

  api_keys    api_key_hash

  sessions    refresh_token_hash
  --------------------------------------

Encryption method:

- AES-256

- Key managed via KMS or HSM

- Per-environment key separation

**7.3.2 Moderate Sensitivity Fields**

Encrypted where feasible:

- Ticket description (if containing personal data)

- Email content in logs

- IP addresses (optional tokenization)

**7.4 Row-Level Security (RLS)**

Multi-tenancy is enforced using PostgreSQL RLS.

**7.4.1 Tenant-Aware Tables**

RLS applied to:

- tickets

- ticket_messages

- sla_tracking

- agencies (limited)

- automation_rules

- notifications

- user_activity_logs

**7.4.2 Policy Example**

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;\
\
CREATE POLICY agency_isolation\
ON tickets\
USING (agency_id = current_setting(\'app.current_agency\')::uuid);

Application must execute:

SET app.current_agency = \'agency-uuid\';

**7.4.3 Admin Override**

Only:

- super_admin

- command_center_admin

Can bypass RLS using controlled DB roles.

No direct SQL access allowed without RBAC enforcement.

**7.5 Database Role Design**

**7.5.1 DB Role Segmentation**

  -------------------------------------------
  **Role**           **Purpose**
  ------------------ ------------------------
  app_user           Standard application
                     operations

  read_only_user     Reporting access

  audit_writer       Append-only audit
                     logging

  admin_user         Migration & maintenance

  replication_user   Logical replication
  -------------------------------------------

**7.5.2 Least Privilege Principle**

- No application role has superuser privilege

- No DELETE on audit tables

- No UPDATE on immutable log tables

- Limited schema modification rights

**7.6 Access Control Enforcement**

RBAC is enforced at:

1.  Application layer

2.  Database layer

Permissions validated before DB queries.

Sensitive tables require elevated roles.

**7.7 Data Masking Strategy**

Masking applied for:

- Cross-agency dashboards

- Exports

- Non-privileged views

Examples:

  -----------------------------------
  **Field**      **Masked Output**
  -------------- --------------------
  national_id    XXXX-XXXX-1234

  phone_number   07XX-XXX-456

  email          j\*\*\*@domain.com
  -----------------------------------

Masking implemented via:

- Database views

- Application-level formatting

**7.8 Audit Enforcement**

All sensitive actions must generate audit entries:

- SLA rule changes

- Role permission changes

- Agency configuration updates

- Manual ticket overrides

- Escalation overrides

- Data exports

Audit logs are:

- Append-only

- Non-deletable

- Partitioned monthly

**7.9 Data Access Logging**

Triggers required for:

- Reading national_id

- Exporting ticket data

- Bulk user export

- Downloading attachments

Example trigger logic:

INSERT INTO data_access_logs (\...)

Executed automatically during export workflows.

**7.10 Key Management**

Encryption keys managed via:

- Cloud KMS or Hardware Security Module

- Separate keys per environment

- Key rotation every 12 months

- Immediate revocation for compromised keys

Keys never stored in:

- Source code

- Application configs

- Backup files

**7.11 Backup Security**

- Encrypted backup files

- Restricted access to backup storage

- Backup integrity validation

- Logged restore operations

Restore operations must:

- Generate audit record

- Require admin approval

**7.12 Attachment Security**

Attachments stored in:

- Secure object storage

- Signed URL access

- Short-lived access tokens

- Virus scanning on upload

Metadata stored in DB, files stored externally.

**7.13 Protection Against Common Threats**

**7.13.1 SQL Injection**

Mitigation:

- Parameterized queries

- ORM enforcement

- No dynamic raw SQL

**7.13.2 Privilege Escalation**

Mitigation:

- Strict RBAC

- RLS enforcement

- DB role separation

- Regular privilege audit

**7.13.3 Data Exfiltration**

Mitigation:

- Data export audit logging

- Rate limiting

- Query monitoring

- Network-level firewall controls

**7.13.4 Insider Threat**

Mitigation:

- Immutable audit logs

- Access logging

- Dual approval for admin changes

- Periodic role review

**7.14 Compliance Controls**

The system must support:

- Right to access personal data

- Right to rectification

- Right to erasure (where applicable)

- Data portability

Deletion workflows must:

- Soft-delete first

- Log audit entry

- Respect retention policy

**7.15 Security Monitoring**

Continuous monitoring includes:

- Failed login attempts

- Unusual query patterns

- High-volume exports

- Escalation overrides

- Direct DB access attempts

Integration with:

- SIEM system

- Government SOC

**7.16 Security Governance Rules**

- Security review required before schema change

- RLS must be tested during QA

- Penetration testing annually

- Encryption validation quarterly

- Key rotation audit annually

**7.17 Security Scalability**

As system scales:

- Isolate audit logs into separate cluster if needed

- Use read-only replicas for reporting

- Separate analytics DB from transactional DB

- Consider zero-trust architecture

**Section 8: Performance & Scalability Design**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**8.1 Overview**

The eSCC database must support national-scale usage with high
concurrency and sustained growth.

Design targets:

- 10M+ tickets annually

- 100K+ daily active users

- 5K+ concurrent support agents

- Millions of notifications annually

- Sub-2 second dashboard response

- 99.9%+ availability

This section defines how performance and scalability are achieved at
database level.

**8.2 Workload Characteristics**

**8.2.1 Read-Heavy Workloads**

- Ticket dashboards

- SLA monitoring

- Command Center analytics

- Knowledge base search

- User session validation

**8.2.2 Write-Heavy Workloads**

- Ticket creation

- Ticket messages

- Audit logs

- Notification logs

- AI classification logs

**8.2.3 Mixed Workloads**

- Ticket updates

- SLA updates

- Escalation events

- Automation logs

System must balance transactional integrity with analytical
responsiveness.

**8.3 Read/Write Separation Strategy**

**8.3.1 Primary Node (Write)**

Handles:

- Inserts

- Updates

- Deletes

- Transactional integrity

**8.3.2 Read Replicas**

Handle:

- Dashboard queries

- Analytics reads

- Reporting queries

- Search indexing sync

Load balancer routes read queries automatically.

**8.3.3 Benefits**

- Reduced write contention

- Improved dashboard speed

- Increased system resilience

**8.4 Horizontal Scaling Strategy**

**8.4.1 Vertical Scaling (Initial Phase)**

- Increase CPU

- Increase RAM

- SSD-backed storage

- Dedicated IOPS

Suitable for:

- Early production stages

- \< 20M tickets

**8.4.2 Logical Partitioning (Mid-Scale)**

Partition high-volume tables:

- tickets (monthly)

- ticket_messages (monthly)

- audit_logs (monthly)

- notification_delivery_logs (monthly)

Partition pruning reduces scan time.

**8.4.3 Distributed PostgreSQL (Large Scale)**

If exceeding:

- 50M+ tickets

- 500M+ messages

Adopt:

- Citus (Distributed PostgreSQL)

- Agency-based sharding

- Horizontal scaling by tenant

Shard key:

agency_id

**8.4.4 Multi-Cluster Strategy (Future)**

Separate clusters for:

- Core transactional data

- Audit & log data

- Analytics

Improves fault isolation.

**8.5 Caching Strategy (Redis)**

Redis used for:

- Session storage

- JWT blacklist

- Frequently accessed ticket summaries

- SLA near-term deadlines

- Dashboard counters

- Rate limiting

**8.5.1 Cache Use Cases**

  -----------------------------
  **Use Case**     **TTL**
  ---------------- ------------
  Ticket summary   5--30
                   seconds

  Dashboard        10--60
  metrics          seconds

  User session     Session
                   lifetime

  SLA deadline     Real-time
  queue            
  -----------------------------

Cache invalidation triggered by Kafka events.

**8.6 Connection Pooling**

Use:

- PgBouncer

- Max connection threshold

- Transaction pooling mode

Benefits:

- Prevent connection exhaustion

- Improve concurrency

- Reduce memory overhead

Recommended limits:

- 200--500 pooled connections

- Separate pools per service

**8.7 Query Optimization Guidelines**

**8.7.1 Index Usage**

- All FK indexed

- Composite indexes for frequent filters

- Avoid over-indexing write-heavy tables

**8.7.2 Avoid Full Table Scans**

Ensure:

- WHERE clause uses indexed columns

- Partition keys included in time-based queries

- Use EXPLAIN ANALYZE during optimization

**8.7.3 Limit JSONB Scans**

- Use GIN indexes selectively

- Avoid filtering large JSON fields without index

**8.7.4 Pagination Strategy**

Use keyset pagination instead of OFFSET.

Example:

WHERE created_at \< last_seen_timestamp\
ORDER BY created_at DESC\
LIMIT 50;

Improves performance on large datasets.

**8.8 SLA Monitoring Performance**

Instead of scanning entire table:

- Maintain Redis sorted set for upcoming deadlines

- Background worker polls next expiring SLA

- Use indexed partial queries

Example:

SELECT \* FROM sla_tracking\
WHERE resolution_due_at \<= NOW()\
AND resolution_breached = FALSE;

Index supports fast lookup.

**8.9 Search Scalability**

Full-text search offloaded to:

- Elasticsearch cluster

Benefits:

- Faster fuzzy search

- Horizontal scaling

- Aggregations for reporting

DB stores authoritative data. Elasticsearch stores indexed projection.

**8.10 Analytics Scalability**

Operational analytics:

- Precomputed hourly/daily metrics

Strategic analytics:

- Offloaded to data warehouse

- CDC pipeline

- Historical partitions archived

Prevents heavy aggregation on transactional DB.

**8.11 Background Job Optimization**

Heavy tasks moved to async workers:

- SLA calculations

- Escalations

- Notification dispatch

- Metric aggregation

- Archive processes

Workers consume Kafka events.

Prevents DB blocking.

**8.12 Archival Strategy for Performance**

Closed tickets older than retention window:

- Moved to archive partition

- Removed from active dashboard queries

- Searchable via cold storage

Improves active dataset size.

**8.13 Performance Monitoring**

Continuous monitoring via:

- pg_stat_statements

- Slow query logs

- Index usage metrics

- CPU & memory usage

- Replication lag monitoring

Alert thresholds:

- Query \> 2 sec

- Replication lag \> 5 sec

- CPU \> 80% sustained

**8.14 Availability & Failover Performance**

- Streaming replication

- Automated failover

- Load-balanced read replicas

- Rolling maintenance updates

Failover must not exceed 30 minutes (RTO target).

**8.15 Capacity Planning**

Estimated yearly growth:

  -----------------------------------
  **Entity**        **Growth/Year**
  ----------------- -----------------
  tickets           10M

  ticket_messages   200M

  audit_logs        50M

  notifications     30M
  -----------------------------------

Storage planning:

- Hot storage (1--2 years)

- Warm storage (3--5 years)

- Cold storage (archival beyond policy)

**8.16 Performance Testing Requirements**

Before national rollout:

- Load test at 5x expected peak

- SLA breach simulation

- Escalation stress test

- Dashboard concurrent load test

- Failover drill

**8.17 Future Scalability Considerations**

- Cross-county expansion

- Cross-border integration

- AI workload increase

- Real-time streaming dashboards

Architecture must remain modular and horizontally scalable.

**Section 9: Data Retention & Archival Strategy**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**9.1 Overview**

The Data Retention & Archival Strategy ensures that eSCC:

- Complies with the Kenya Data Protection Act

- Meets public sector record-keeping obligations

- Preserves auditability

- Controls storage growth

- Protects sensitive personal data

- Supports legal and regulatory investigations

Retention rules apply to:

- Tickets

- Messages

- SLA records

- Audit logs

- Authentication logs

- Notifications

- AI logs

- Knowledge base history

Retention must balance:

- Legal compliance

- Operational efficiency

- Storage performance

**9.2 Retention Policy Framework**

Retention is governed by:

- retention_policies table (Section 3.8)

- Regulatory directives

- Government ICT record retention guidelines

- Agency-specific policies

Each entity_type must have:

- retention_period_days

- archive_after_days

- deletion_allowed flag (optional extension)

**9.3 Default Retention Periods (Recommended)**

  ---------------------------------------------------
  **Entity Type**              **Archive   **Retain
                               After**     For**
  ---------------------------- ----------- ----------
  tickets                      3 years     7 years

  ticket_messages              3 years     7 years

  sla_tracking                 3 years     7 years

  breach_logs                  5 years     10 years

  audit_logs                   5 years     10 years

  authentication_logs          1 year      3 years

  notification_delivery_logs   1 year      3 years

  user_activity_logs           2 years     5 years

  AI logs                      2 years     5 years
  ---------------------------------------------------

These values configurable via retention_policies table.

**9.4 Archival Strategy**

**9.4.1 Archival Objectives**

- Reduce active dataset size

- Maintain historical traceability

- Preserve legal evidence

- Improve dashboard performance

**9.4.2 Archival Methods**

**Method 1: Partition-Based Archival**

Old partitions moved to:

- Archive schema

- Read-only cluster

- Cold storage instance

Example:

ALTER TABLE tickets DETACH PARTITION tickets_2022_01;

Moved to archive database.

**Method 2: Logical Export to Cold Storage**

- Export to compressed format (Parquet/CSV)

- Store in secure object storage

- Maintain archival_records entry

Used for:

- Audit logs

- Notification logs

**9.5 Archival Workflow**

1.  Scheduled archival job runs daily

2.  Identify records older than archive_after_days

3.  Validate no active references

4.  Move to archive partition or export

5.  Insert archival_records entry

6.  Mark record archived

Archival records must include:

- entity_type

- entity_id

- archived_at

- storage_location

**9.6 Deletion Strategy**

Deletion only allowed when:

- retention_period_days exceeded

- Legal hold not active

- Compliance approval granted

Deletion workflow:

1.  Soft delete

2.  Log audit entry

3.  Confirm retention policy satisfied

4.  Hard delete (if legally allowed)

**9.7 Legal Hold Mechanism**

Add optional extension:

legal_hold BOOLEAN DEFAULT FALSE

Applied to:

- tickets

- audit_logs

- breach_logs

Records under legal hold:

- Cannot be archived

- Cannot be deleted

- Flag visible in compliance dashboard

**9.8 PII Minimization Strategy**

For long-term retention:

- Anonymize personal data after X years

- Remove phone_number

- Remove national_id

- Replace with tokenized identifier

Example anonymization:

UPDATE users\
SET national_id = NULL,\
phone_number = NULL\
WHERE created_at \< (NOW() - INTERVAL \'5 years\');

Must log anonymization in audit_logs.

**9.9 Cold Storage Strategy**

Cold storage must:

- Be encrypted

- Be access-controlled

- Be logged

- Support restore operations

Options:

- Secure object storage

- Government archival storage system

- Separate read-only database cluster

Restore requires:

- Compliance approval

- Audit entry

- Access time logging

**9.10 Retention Enforcement Jobs**

Background jobs required:

- Daily archive job

- Weekly deletion review job

- Monthly compliance report

- Quarterly integrity verification

Jobs must be:

- Idempotent

- Logged

- Monitored

**9.11 Archive Performance Considerations**

Archived data must not:

- Impact primary DB performance

- Be included in default dashboards

- Be indexed heavily

Archive cluster can:

- Use cheaper storage

- Use lower performance tier

**9.12 Data Restoration Procedure**

If archived data required:

1.  Retrieve from cold storage

2.  Load into temporary restore schema

3.  Grant read-only access

4.  Log access event

5.  Delete temporary restore after review

All restoration must be audited.

**9.13 Compliance Reporting Support**

Retention system must support:

- Retention status dashboard

- Records pending deletion report

- Legal hold report

- Data minimization report

- Archive volume statistics

Reports derived from:

- retention_policies

- archival_records

- audit_logs

**9.14 Risk Mitigation**

**Risk: Premature Deletion**

Mitigation:

- Multi-step deletion workflow

- Admin approval

- Grace period buffer

**Risk: Data Hoarding**

Mitigation:

- Automated retention enforcement

- Storage growth monitoring

- Quarterly compliance review

**Risk: Legal Non-Compliance**

Mitigation:

- Policy version tracking

- Legal hold capability

- Audit traceability

**9.15 Scalability of Retention**

As system grows:

- Increase partition granularity

- Separate archive cluster

- Automate retention via workflow engine

- Use data warehouse for long-term analytics

**9.16 Governance Rules**

- Every entity_type must have retention policy

- No manual deletion in production

- Archive operations require logging

- Retention rules reviewed annually

**Section 10: Migration & Versioning Strategy**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**10.1 Overview**

The Migration & Versioning Strategy defines how database schema changes
are:

- Designed

- Reviewed

- Versioned

- Deployed

- Rolled back

- Audited

The eSCC database will evolve over time due to:

- New features

- Regulatory updates

- Performance improvements

- Security enhancements

- AI capability expansion

Schema changes must:

- Be traceable

- Be reversible

- Avoid downtime

- Maintain data integrity

- Preserve backward compatibility

**10.2 Schema Versioning Approach**

**10.2.1 Versioning Model**

Use incremental migration versioning.

Format:

VYYYYMMDD\_\_description.sql

Example:

V20260224\_\_add_sla_escalation_index.sql

**10.2.2 Version Control**

All migrations must:

- Be stored in Git

- Be code-reviewed

- Be tested in staging

- Be tagged with release version

No manual schema changes allowed in production.

**10.3 Migration Tooling**

Recommended tools:

- Flyway\
  OR

- Liquibase

Features required:

- Ordered execution

- Checksum validation

- Migration history tracking

- Rollback support

- Environment targeting

Migration history table example:

flyway_schema_history

Tracks:

- Version

- Script name

- Execution timestamp

- Execution status

- Checksum

**10.4 Zero-Downtime Migration Strategy**

Zero-downtime principle:

Production system must remain operational during schema changes.

**10.4.1 Backward-Compatible Changes**

Allowed without downtime:

- Adding new nullable columns

- Adding new tables

- Adding new indexes (CONCURRENTLY)

- Adding new views

- Adding non-blocking constraints

Example:

CREATE INDEX CONCURRENTLY idx_new_index\
ON tickets(priority_id);

**10.4.2 Two-Step Column Migration Pattern**

For changing column structure:

Step 1:

- Add new column

- Populate via background job

Step 2:

- Update application to use new column

Step 3:

- Remove old column in later release

Prevents blocking and ensures compatibility.

**10.4.3 Avoiding Locking Operations**

Avoid:

- ALTER COLUMN TYPE on large tables

- Dropping columns immediately

- Adding NOT NULL constraints without backfill

Instead:

1.  Add column as nullable

2.  Backfill data

3.  Add NOT NULL constraint

**10.5 Data Migration Strategy**

**10.5.1 Large Table Migrations**

For tables like:

- tickets

- ticket_messages

- audit_logs

Use:

- Batch updates

- Background workers

- Rate-limited updates

Example:

UPDATE tickets\
SET new_column = value\
WHERE id \> last_processed_id\
LIMIT 1000;

Repeat until complete.

**10.5.2 Partitioned Tables**

Schema changes applied to:

- Parent table

- All partitions

Migration scripts must account for partition structure.

**10.6 Rollback Strategy**

Each migration must define:

- Forward script

- Rollback script (if feasible)

Rollback scenarios:

- Index addition → DROP INDEX

- New table → DROP TABLE

- New column → DROP COLUMN (if safe)

Irreversible migrations:

- Data deletions

- Column type narrowing

Require:

- Pre-migration backup

- Staged approval

**10.7 Backward Compatibility Rules**

Application must tolerate:

- Additional columns

- Missing optional columns

- Old schema for short overlap period

Deployment sequence:

1.  Deploy backward-compatible schema

2.  Deploy updated application

3.  Remove deprecated schema elements later

**10.8 Feature Flag Strategy**

For high-risk changes:

- Introduce feature flag

- Deploy schema

- Activate feature gradually

- Monitor performance

Ensures controlled rollout.

**10.9 Migration Governance**

**10.9.1 Approval Workflow**

All migrations must:

- Be reviewed by database architect

- Be reviewed by security team (if sensitive)

- Pass staging load test

- Pass integration tests

**10.9.2 Audit Logging**

Schema changes must:

- Be logged in audit_logs

- Include version number

- Include deployment user

- Include timestamp

Example audit entry:

{\
\"entity_type\": \"schema\",\
\"action_type\": \"migration_applied\",\
\"version\": \"V20260224\"\
}

**10.10 Environment Strategy**

Separate schema version tracking per environment:

- Development

- QA

- Staging

- Production

No direct production migration without staging validation.

**10.11 Data Integrity Validation**

After migration:

- Verify row counts

- Validate constraints

- Run automated health checks

- Compare pre/post metrics

Automated validation required before marking migration successful.

**10.12 Performance Validation**

For performance-impacting migrations:

- Compare query execution plans

- Run benchmark tests

- Monitor index usage

- Monitor CPU and I/O

Rollback if degradation detected.

**10.13 Major Version Upgrade Strategy**

For PostgreSQL version upgrade:

- Set up replica with new version

- Sync data

- Perform controlled switchover

- Validate replication

- Decommission old node

Zero data loss mandatory.

**10.14 Migration Risk Management**

**Risk: Long-Running Locks**

Mitigation:

- Use CONCURRENTLY for indexes

- Batch updates

- Off-peak migration windows

**Risk: Data Corruption**

Mitigation:

- Pre-migration backup

- Checksum validation

- Integrity checks

**Risk: Application Incompatibility**

Mitigation:

- Backward-compatible design

- Feature flags

- Staged deployment

**10.15 Future Schema Evolution**

System must support:

- New AI modules

- New government services

- Cross-border integrations

- Additional notification channels

- Expanded analytics tables

Schema must remain modular and extensible.

**Section 11: API & Integration Data Considerations**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**11.1 Overview**

The eSCC database must support seamless integration with:

- eCitizen core platform

- Government agency systems

- Service provider systems

- SMS and email gateways

- Identity verification systems

- Payment systems (where applicable)

- Analytics and BI platforms

- Kafka event streaming infrastructure

This section defines:

- API-to-database mapping

- External synchronization strategies

- Webhook logging

- Event persistence

- Idempotency controls

- Data consistency guarantees

**11.2 API Payload to Database Mapping**

All REST and WebSocket APIs must map cleanly to database entities.

**11.2.1 Ticket Creation API**

**API Payload Example**

{\
\"agency_id\": \"uuid\",\
\"category_id\": \"uuid\",\
\"priority_id\": \"uuid\",\
\"channel\": \"web\",\
\"subject\": \"Payment not reflected\",\
\"description\": \"I made payment but service not activated\",\
\"attachments\": \[\]\
}

**Database Writes**

1.  Insert into tickets

2.  Insert into ticket_messages (initial message)

3.  Insert into sla_tracking

4.  Insert into ticket_history

5.  Trigger Kafka event

6.  Insert audit_logs entry

All within single ACID transaction.

**11.2.2 Ticket Update API**

Maps to:

- tickets table (status_id, assignee, etc.)

- ticket_history

- user_activity_logs

- Possible escalation_events

- Possible notifications

**11.2.3 Authentication API**

Maps to:

- users

- sessions

- authentication_logs

Failed login attempts must always generate authentication_logs entry.

**11.3 External Agency System Synchronization**

eSCC integrates with external systems via:

- REST APIs

- Webhooks

- Kafka events

- Secure file exchange (if required)

**11.3.1 Agency Push Model**

Agency receives:

- Ticket created event

- Ticket escalated event

- SLA breach event

Database supports:

- notifications

- webhook_logs

- automation_execution_logs

Webhook persistence example:

webhook_logs

Stores:

- target_url

- payload

- response_status

- response_body

**11.3.2 Agency Pull Model**

Agency system queries:

- Ticket status

- SLA state

- Escalation history

RLS ensures only authorized agency access.

**11.4 Idempotency Strategy**

To prevent duplicate processing:

- API requests include idempotency_key

- Store in dedicated table:

CREATE TABLE api_idempotency_keys (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
idempotency_key VARCHAR(255) NOT NULL,\
endpoint VARCHAR(255),\
request_hash TEXT,\
response_snapshot JSONB,\
created_at TIMESTAMP DEFAULT NOW(),\
CONSTRAINT uq_idempotency UNIQUE (idempotency_key, endpoint)\
);

Prevents duplicate ticket creation or repeated payment processing.

**11.5 Webhook Logging Strategy**

All outbound webhooks must:

- Be logged before sending

- Capture response status

- Capture response payload

- Retry on failure

Tables involved:

- notifications

- webhook_logs

- notification_delivery_logs

Retries must increment retry_count and log each attempt.

**11.6 Event Sourcing & Kafka Integration**

eSCC uses event-driven architecture.

All major state changes emit Kafka events.

**11.6.1 Core Event Types**

- TicketCreated

- TicketUpdated

- TicketEscalated

- SLABreached

- TicketResolved

- UserLoggedIn

- AutomationRuleExecuted

**11.6.2 Event Persistence Alignment**

For reliability:

1.  Write to DB (source of truth)

2.  Insert into outbox table

3.  Background worker publishes to Kafka

4.  Mark outbox record processed

Outbox pattern table:

CREATE TABLE event_outbox (\
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\
aggregate_type VARCHAR(100),\
aggregate_id UUID,\
event_type VARCHAR(100),\
event_payload JSONB,\
published BOOLEAN DEFAULT FALSE,\
created_at TIMESTAMP DEFAULT NOW()\
);

Ensures no event lost if Kafka temporarily unavailable.

**11.7 Data Consistency Model**

**11.7.1 Transactional Consistency**

Core operations use:

- ACID transactions

- FK constraints

- RLS enforcement

**11.7.2 Eventual Consistency**

Used for:

- Search indexing

- Analytics

- Notifications

- External integrations

Consistency achieved via:

- Kafka events

- Retry mechanisms

- Idempotent consumers

**11.8 API Rate Limiting & Logging**

Rate limits stored in:

- Redis

- api_keys table

Every API request must log:

- user_id

- endpoint

- IP address

- timestamp

Logged in:

- user_activity_logs

**11.9 Data Export Considerations**

Export endpoints must:

- Log export action in data_access_logs

- Mask sensitive fields where required

- Enforce role-based access

Export formats:

- CSV

- Excel

- JSON

- PDF

All exports must generate audit entry.

**11.10 Integration with Identity Systems**

If integrated with eCitizen SSO:

- ecitizen_user_id mapped to users table

- JWT validated before DB access

- External identity changes synced via webhook or periodic sync

Mapping table:

users.ecitizen_user_id

**11.11 Integration with Payment Systems (Optional)**

If ticket involves payment dispute:

- payment_reference stored in tickets

- Payment verification API logs stored in audit_logs

- External response logged

**11.12 Data Warehouse Integration**

CDC pipeline pushes:

- tickets

- sla_tracking

- breach_logs

- user_activity_logs

To data warehouse for:

- Long-term analytics

- AI model training

- Performance dashboards

No heavy BI queries on transactional DB.

**11.13 Integration Risk Mitigation**

**Risk: Duplicate Events**

Mitigation:

- Outbox pattern

- Idempotent consumer design

**Risk: External API Failure**

Mitigation:

- Retry mechanism

- Dead-letter queue

- Alerting

**Risk: Data Drift**

Mitigation:

- Scheduled reconciliation jobs

- Hash validation

- Cross-system audit checks

**11.14 Governance Rules**

- All integrations must be authenticated

- All integration payloads must be logged

- No direct DB access by external systems

- No bypass of RLS via integration service

**Section 12: Risk Assessment**

**eCitizen Service Command Center (eSCC)**\
Database Design Document (DDD)

**12.1 Overview**

This section identifies database-level risks associated with the eSCC
system and defines mitigation strategies.

The assessment covers:

- Data corruption risks

- Multi-agency data leakage risks

- Performance bottlenecks

- Security threats

- Compliance failures

- Disaster recovery scenarios

- Operational risks

The objective is to ensure:

- High availability

- Data integrity

- Regulatory compliance

- Tenant isolation

- Long-term sustainability

**12.2 Data Corruption Risks**

**12.2.1 Risk: Transaction Failure Mid-Operation**

Scenario:

- Ticket created but SLA tracking not inserted

- Assignment created without history entry

Impact:

- Inconsistent state

- SLA miscalculations

- Audit gaps

Mitigation:

- Use ACID transactions for all multi-table writes

- Enforce NOT NULL + FK constraints

- Implement transactional service boundaries

- Run integrity validation jobs nightly

**12.2.2 Risk: Manual DB Modification**

Scenario:

- Direct SQL updates in production

Impact:

- Audit bypass

- Data inconsistency

- Legal exposure

Mitigation:

- No direct superuser access

- Audit all schema changes

- Read-only production access for DB admins

- Enforce migration tooling

**12.2.3 Risk: Partition Misconfiguration**

Scenario:

- New partition not created

- Inserts fail

Impact:

- Ticket creation outage

Mitigation:

- Automated partition creation job

- Monitoring for missing partition errors

- Alert on insert failure

**12.3 Multi-Agency Data Leakage Risks**

**12.3.1 Risk: RLS Misconfiguration**

Scenario:

- RLS disabled

- Policy misapplied

Impact:

- Cross-agency data exposure

Mitigation:

- RLS enforced on all tenant-aware tables

- FORCE ROW LEVEL SECURITY

- Automated RLS validation tests

- Security review before deployment

**12.3.2 Risk: Admin Role Misuse**

Scenario:

- Command Center admin accesses unauthorized agency data

Mitigation:

- Strict role-based permission controls

- Access logging via data_access_logs

- Quarterly role review

- Segregation of duties

**12.4 Performance Bottleneck Risks**

**12.4.1 Risk: Full Table Scans on Large Tables**

Affected tables:

- tickets

- ticket_messages

- audit_logs

Impact:

- Slow dashboards

- High CPU usage

Mitigation:

- Proper indexing

- Partition pruning

- Query performance monitoring

- EXPLAIN plan validation

**12.4.2 Risk: Write Amplification from Excess Indexes**

Impact:

- Slow inserts

- High I/O

Mitigation:

- Limit indexes on high-write tables

- Quarterly index usage review

- Remove unused indexes

**12.4.3 Risk: Replication Lag**

Impact:

- Stale dashboards

- Inconsistent analytics

Mitigation:

- Monitor replication delay

- Scale read replicas

- Alert if lag \> 5 seconds

**12.5 Security Threat Risks**

**12.5.1 Risk: SQL Injection**

Mitigation:

- Parameterized queries only

- ORM enforcement

- Application-layer validation

- Security testing

**12.5.2 Risk: Data Exfiltration**

Scenario:

- Mass export of ticket data

Mitigation:

- Export logging

- Rate limiting

- Masking sensitive fields

- Alert on high-volume exports

**12.5.3 Risk: Credential Compromise**

Mitigation:

- MFA enforcement

- Session expiration

- Refresh token hashing

- IP monitoring

- Login anomaly detection

**12.5.4 Risk: Backup Theft**

Mitigation:

- Encrypted backups

- Access-controlled storage

- Restore event logging

- Key separation

**12.6 Compliance Risks**

**12.6.1 Risk: Retention Violation**

Scenario:

- Data deleted before retention period

Mitigation:

- Automated retention enforcement

- Legal hold flag

- Deletion approval workflow

**12.6.2 Risk: Missing Audit Trail**

Scenario:

- Configuration change not logged

Mitigation:

- Mandatory audit triggers

- No update/delete on audit_logs

- Schema change logging

**12.7 Disaster Scenarios**

**12.7.1 Database Server Failure**

Mitigation:

- Streaming replication

- Automatic failover

- RTO ≤ 30 minutes

- RPO ≤ 5 minutes

**12.7.2 Region Outage**

Mitigation:

- Cross-region replica

- Offsite backup storage

- Disaster recovery drill annually

**12.7.3 Data Corruption**

Mitigation:

- Point-in-time recovery

- WAL archiving

- Backup validation tests

- Data integrity checks

**12.8 AI & Automation Risks**

**12.8.1 Risk: Incorrect AI Classification**

Impact:

- Misrouted tickets

- SLA breaches

Mitigation:

- Store AI confidence score

- Manual override capability

- AI performance monitoring

- Model version tracking

**12.8.2 Risk: Automation Rule Misfire**

Mitigation:

- Rule testing sandbox

- Execution logs

- Manual disable switch

- Version-controlled automation rules

**12.9 Integration Risks**

**12.9.1 Risk: Kafka Event Loss**

Mitigation:

- Outbox pattern

- Idempotent consumers

- Dead-letter queue

**12.9.2 Risk: Webhook Failure**

Mitigation:

- Retry logic

- Delivery logging

- Monitoring alerts

**12.10 Operational Risks**

**12.10.1 Risk: Schema Migration Failure**

Mitigation:

- Staging validation

- Zero-downtime strategy

- Rollback scripts

- Pre-migration backup

**12.10.2 Risk: Capacity Exhaustion**

Mitigation:

- Capacity monitoring

- Horizontal scaling readiness

- Storage threshold alerts

**12.11 Monitoring & Early Warning Indicators**

Critical alerts:

- Replication lag \> 5 seconds

- Query time \> 2 seconds sustained

- CPU \> 80% sustained

- Insert failure on partitioned tables

- Unusual export activity

- Repeated failed login attempts

Integrated with:

- SIEM

- Government SOC

- Infrastructure monitoring tools

**12.12 Risk Governance Framework**

- Quarterly database risk review

- Annual security audit

- Annual disaster recovery drill

- RLS validation audit

- Retention compliance review

All risk assessments must be documented and approved by ICT governance
body.

**12.13 Residual Risk Assessment**

After mitigation controls, residual risk remains:

- Insider misuse

- Advanced persistent threats

- Infrastructure-level failure

- AI misclassification at scale

These risks are reduced but not eliminated.

Continuous monitoring required.

**12.14 Conclusion**

The eSCC database architecture:

- Enforces strict multi-agency isolation

- Supports national-scale operations

- Ensures auditability and compliance

- Enables AI-driven automation

- Provides resilience and scalability

- Maintains data integrity under heavy load

This completes the Database Design Document (DDD) for:

**eCitizen Service Command Center (eSCC)**
