**eCitizen Service Command Center (eSCC) Flutter Engineering Document**

**Section 1: Introduction**

**1.1 Purpose of the Flutter Frontend**

The eCitizen Service Command Center (eSCC) Flutter Frontend is the
unified operational interface for managing government service support
workflows across:

- Citizens (Service Request Originators)

- Level 1 Support (Government Agencies)

- Level 2 Support (Service Providers / Technical Teams)

- Command Center Supervisors

- System Administrators

The frontend provides:

- Centralized ticket visibility

- AI-assisted triage and routing

- SLA tracking and escalation monitoring

- Real-time operational dashboards

- Knowledge base access

- Audit and compliance views

- Multi-agency coordination tools

It acts as the presentation and interaction layer for the backend
microservices defined in the BED, and must strictly conform to:

- Functional requirements defined in the SRS

- Service contracts defined in the TDD

- Data models defined in the DDD

- API specifications defined in the BED

This document defines the engineering standards, architecture,
structure, and implementation approach for building the Flutter frontend
at enterprise scale.

**1.2 Scope of the Application**

The Flutter frontend will support:

**1.2.1 Platforms**

- Web (Primary operational interface)

- Android (Field support use cases)

- iOS (Supervisory and monitoring use cases)

Primary target: **Flutter Web for Command Center operations**

**1.2.2 Functional Scope**

The frontend must support:

- Secure multi-role authentication

- Role-based dashboards

- Ticket lifecycle management

- AI triage visualization

- Multi-agency routing

- SLA monitoring and alerts

- Escalation workflows

- Knowledge base integration

- Advanced search and filtering

- Real-time updates via WebSockets

- Analytics and reporting

- Audit logs and compliance reporting

- User and role management

**1.2.3 Non-Functional Scope**

The frontend must meet enterprise-level requirements:

- High availability

- Scalability across agencies

- Accessibility compliance (WCAG 2.1)

- Performance under heavy concurrent load

- Secure data handling

- Observability and monitoring

- Government-grade UI consistency

**1.3 Alignment with SRS, TDD, DDD, BED**

The frontend architecture is tightly aligned with backend and data
definitions.

**1.3.1 Alignment with SRS**

The frontend implements:

- All defined user roles and permission models

- All ticket states and workflow transitions

- SLA definitions and breach conditions

- Escalation chains

- AI recommendation flows

- Audit logging requirements

- Reporting requirements

Every screen maps to a functional requirement in the SRS.

**1.3.2 Alignment with TDD**

The frontend:

- Consumes APIs as defined in the TDD

- Respects defined service boundaries

- Integrates with microservices:

  - Auth Service

  - Ticket Service

  - SLA Service

  - AI Triage Service

  - Agency Routing Service

  - Knowledge Base Service

  - Analytics Service

  - Audit Service

It follows:

- Defined request/response contracts

- Error response standards

- Pagination standards

- Filtering conventions

- WebSocket event schemas

**1.3.3 Alignment with DDD**

Frontend domain models mirror DDD entities:

- Ticket

- User

- Agency

- SLA

- Escalation

- AuditLog

- KnowledgeArticle

- AIRecommendation

Mapping strategy:

- API DTO → Data Layer Model

- Data Model → Domain Model

- Domain Model → UI ViewModel

This ensures:

- Loose coupling

- Testability

- Clear separation of concerns

**1.3.4 Alignment with BED**

The frontend:

- Uses standardized REST endpoints

- Implements token-based authentication

- Supports WebSocket streams

- Applies retry and error mapping strategy

- Integrates logging correlation IDs

All network interactions comply with backend API contracts.

**1.4 Target Users and Operational Context**

The system serves multiple operational personas:

**1.4.1 Citizen**

- Submit tickets

- Track ticket status

- View responses

- Access knowledge base

- Provide feedback

**1.4.2 Level 1 Support (Government Agency)**

- Receive assigned tickets

- Respond to tickets

- Escalate to Level 2

- Monitor SLA timers

- View AI triage recommendations

**1.4.3 Level 2 Support (Service Provider)**

- Handle escalated technical issues

- Update resolution notes

- Communicate with L1

- Close tickets

**1.4.4 Command Center Supervisor**

- View cross-agency dashboards

- Monitor SLA compliance

- Override routing decisions

- Analyze performance metrics

- Trigger manual escalations

**1.4.5 System Administrator**

- Manage users and roles

- Configure agencies

- Define SLA policies

- Manage escalation chains

- View audit logs

**1.5 Enterprise Constraints**

The eSCC frontend must comply with:

**1.5.1 Security Constraints**

- Strict RBAC enforcement

- Token validation

- Secure storage of credentials

- Protection against XSS and CSRF

- Input validation

- Encrypted communications (HTTPS only)

**1.5.2 Performance Constraints**

- Must support thousands of concurrent sessions

- Dashboard updates under 2 seconds latency

- Efficient rendering of large ticket tables

- Minimal memory footprint on web

**1.5.3 Compliance Constraints**

- Government data handling standards

- Auditability of user actions

- Retention of operational logs

- Accessibility compliance

**1.5.4 Availability Constraints**

- Zero-downtime deployment strategy

- Resilient frontend architecture

- Graceful error handling

- Fallback UI states

**1.6 Design Principles**

The frontend will be built using the following principles:

- Clean Architecture

- Feature-first modular design

- Strict separation of concerns

- API contract-first development

- Test-driven development

- Security-by-design

- Accessibility-first UI

- Performance optimization by default

**1.7 High-Level Architecture Context**

The frontend sits between users and backend microservices.

Users\
↓\
Flutter Web / Mobile App\
↓\
API Gateway\
↓\
Microservices (Auth, Ticket, SLA, AI, Audit, Analytics)\
↓\
Databases (As defined in DDD)

The frontend must remain:

- Stateless (except UI state)

- Scalable horizontally (for web deployment)

- Decoupled from backend internals

**1.8 Summary**

The eCitizen Service Command Center Flutter frontend is a
mission-critical enterprise interface that:

- Orchestrates multi-agency support workflows

- Visualizes AI-powered decision support

- Enforces SLA accountability

- Enables national-scale service monitoring

- Ensures compliance and auditability

It must be:

- Secure

- Scalable

- Modular

- Maintainable

- Observable

- Testable

- Future-ready

**Section 2: Frontend Architecture Overview**

**2.1 Architectural Pattern**

**2.1.1 Selected Architecture: Clean Architecture (Feature-First Modular
Design)**

The eSCC frontend will use:

- Clean Architecture

- Feature-first modular structure

- Strict separation of concerns

- Dependency rule enforcement (inner layers do not depend on outer
  layers)

This is mandatory for:

- Large government systems

- Multi-team development

- Long-term maintainability

- Audit compliance

- Independent feature evolution

**2.1.2 Layered Structure**

Each feature follows this structure:

features/\
└── tickets/\
├── presentation/\
├── domain/\
├── data/\
└── tickets_module.dart

Each layer has a strict responsibility.

**2.1.3 Layer Responsibilities**

**1️⃣ Presentation Layer**

Contains:

- Screens

- Widgets

- State management logic

- ViewModels / Controllers

- Routing

Responsibilities:

- Render UI

- Handle user interaction

- Dispatch events

- Listen to state updates

- Display loading and error states

It does NOT:

- Call APIs directly

- Contain business logic

- Know about database structure

**2️⃣ Domain Layer**

Contains:

- Entities (Ticket, SLA, Agency, etc.)

- Use cases

- Repository interfaces

- Business rules

- Workflow logic

Responsibilities:

- Define business logic

- Define contract for data access

- Contain SLA evaluation logic

- Contain escalation logic

- Define AI override rules

It does NOT:

- Import Flutter

- Depend on API models

- Know about HTTP

This ensures maximum testability.

**3️⃣ Data Layer**

Contains:

- API DTOs

- Mappers (DTO → Domain)

- Repository implementations

- Data sources (REST, WebSocket)

- Caching logic

Responsibilities:

- Call backend APIs

- Transform responses

- Handle network errors

- Retry logic

- Pagination handling

It does NOT:

- Contain UI logic

- Contain workflow logic

**4️⃣ Core Layer**

Global utilities shared across features:

core/\
├── network/\
├── errors/\
├── auth/\
├── theme/\
├── routing/\
├── storage/\
└── utils/

Contains:

- API client

- Interceptors

- Token manager

- App theme

- App router

- Global error handler

- Logger

- Dependency injection container

**2.1.4 Why Clean Architecture is Suitable for Government Systems**

Clean Architecture is selected because:

- It isolates business logic from UI changes

- It enables parallel team development

- It supports long-term maintainability

- It enforces strict domain modeling

- It enables high test coverage

- It prevents tight coupling with backend changes

- It supports multi-platform Flutter targets

This is critical for:

- National-scale deployments

- Evolving service requirements

- Regulatory compliance

- Auditability

**2.2 State Management Strategy**

**2.2.1 Options Evaluated**

  ---------------------------------------------------------------------------
  **Option**   **Pros**                         **Cons**
  ------------ -------------------------------- -----------------------------
  Provider     Simple                           Not scalable for complex
                                                enterprise flows

  Bloc         Strong separation, predictable   Boilerplate heavy
               state                            

  Riverpod     Modern, scalable, testable,      Requires disciplined
               compile-time safety              structure
  ---------------------------------------------------------------------------

**2.2.2 Selected Approach: Riverpod (with StateNotifier /
AsyncNotifier)**

Reason:

- Better testability

- Compile-time safety

- Scoped providers

- Easy dependency injection

- Clean integration with Clean Architecture

- Reduced boilerplate compared to Bloc

- Better async state handling for API-heavy systems

**2.2.3 State Management Strategy by Module**

Each feature will contain:

presentation/\
├── providers/\
├── controllers/\
├── screens/\
└── widgets/

Example for tickets:

tickets_provider.dart\
tickets_controller.dart\
ticket_state.dart

**2.2.4 State Model Example**

class TicketState {\
final bool isLoading;\
final List\<Ticket\> tickets;\
final String? error;\
final int page;\
final bool hasMore;\
\
TicketState({\
required this.isLoading,\
required this.tickets,\
this.error,\
required this.page,\
required this.hasMore,\
});\
\
TicketState copyWith({\
bool? isLoading,\
List\<Ticket\>? tickets,\
String? error,\
int? page,\
bool? hasMore,\
}) {\
return TicketState(\
isLoading: isLoading ?? this.isLoading,\
tickets: tickets ?? this.tickets,\
error: error,\
page: page ?? this.page,\
hasMore: hasMore ?? this.hasMore,\
);\
}\
}

**2.2.5 Controller Example**

class TicketController extends StateNotifier\<TicketState\> {\
final GetTicketsUseCase getTickets;\
\
TicketController(this.getTickets)\
: super(TicketState(\
isLoading: false,\
tickets: \[\],\
page: 1,\
hasMore: true,\
));\
\
Future\<void\> fetchTickets() async {\
state = state.copyWith(isLoading: true);\
\
final result = await getTickets(state.page);\
\
result.fold(\
(failure) =\> state = state.copyWith(\
isLoading: false,\
error: failure.message,\
),\
(data) =\> state = state.copyWith(\
isLoading: false,\
tickets: \[\...state.tickets, \...data.items\],\
hasMore: data.hasMore,\
page: state.page + 1,\
),\
);\
}\
}

**2.3 Dependency Injection Strategy**

**2.3.1 Selected Approach: Riverpod + Service Locator Pattern**

We will use:

- Riverpod for dependency scoping

- A centralized dependency registration file

- Lazy initialization

- Feature-based provider registration

**2.3.2 Core Dependency Container**

Example:

final apiClientProvider = Provider\<ApiClient\>((ref) {\
return ApiClient(ref.read(tokenManagerProvider));\
});\
\
final ticketRepositoryProvider = Provider\<TicketRepository\>((ref) {\
return TicketRepositoryImpl(\
ref.read(apiClientProvider),\
);\
});\
\
final getTicketsUseCaseProvider = Provider\<GetTicketsUseCase\>((ref) {\
return GetTicketsUseCase(\
ref.read(ticketRepositoryProvider),\
);\
});

This ensures:

- Loose coupling

- Testability (easy overrides)

- Feature isolation

**2.3.3 Environment Configuration**

We will support:

- dev

- staging

- production

Config structure:

core/\
└── config/\
├── app_config.dart\
├── dev_config.dart\
├── staging_config.dart\
└── prod_config.dart

AppConfig example:

class AppConfig {\
final String baseUrl;\
final bool enableLogging;\
\
AppConfig({\
required this.baseUrl,\
required this.enableLogging,\
});\
}

Injected at app start.

**2.4 Routing Strategy**

**2.4.1 Selected Router: GoRouter**

Reason:

- Declarative routing

- Role-based route guards

- Nested routing

- Web URL support

- Deep linking

- Scalable structure

Example:

final router = GoRouter(\
routes: \[\
GoRoute(\
path: \'/login\',\
builder: (context, state) =\> LoginScreen(),\
),\
GoRoute(\
path: \'/dashboard\',\
builder: (context, state) =\> DashboardScreen(),\
),\
\],\
);

Route guards enforce RBAC.

**2.5 Cross-Cutting Architectural Concerns**

**2.5.1 Error Handling**

Global error wrapper:

- Network errors mapped to domain failures

- UI shows standardized error component

- Logging to observability service

**2.5.2 Logging**

Centralized logger:

core/logger/app_logger.dart

Supports:

- Info logs

- Warning logs

- Error logs

- Correlation ID tracking

**2.5.3 Feature Isolation**

Each feature:

- Has independent folder

- Owns its providers

- Owns its state

- Can be developed independently

This supports:

- Large team collaboration

- Agency-specific modules

- Plugin-based expansion

**2.6 High-Level Frontend Architecture Diagram**

┌───────────────────────────┐\
│ Presentation │\
│ Screens / Widgets / UI │\
└───────────────▲──────────┘\
│\
┌───────────────┴──────────┐\
│ Domain │\
│ Entities / UseCases │\
└───────────────▲──────────┘\
│\
┌───────────────┴──────────┐\
│ Data │\
│ API / Repositories │\
└───────────────▲──────────┘\
│\
┌───────────────┴──────────┐\
│ Core │\
│ Network / Auth / Config │\
└──────────────────────────┘

Dependency direction: **Upward only**

**2.7 Summary**

The eSCC frontend architecture is:

- Clean and modular

- Feature-first

- Strictly layered

- Riverpod-driven

- Testable

- Scalable

- Secure by design

- Aligned with backend contracts

- Ready for enterprise deployment

**Section 3: Folder & Project Structure**

**3.1 Project Structure Philosophy**

The eSCC frontend follows:

- Feature-first organization

- Clean Architecture layering

- Clear separation of shared vs feature code

- Scalable modular boundaries

- Government-grade maintainability

Key goals:

- Independent feature evolution

- Reduced merge conflicts across teams

- Predictable structure

- Easy onboarding for new engineers

- Support for plugin-based expansion

**3.2 Root-Level Structure**

lib/\
├── core/\
├── features/\
├── shared/\
├── app/\
├── main.dart\
└── bootstrap.dart

**3.3 Root Directory Responsibilities**

**3.3.1 main.dart**

Entry point.

Responsibilities:

- Initialize environment config

- Initialize dependency injection

- Initialize logging

- Setup router

- RunApp

Example:

void main() async {\
WidgetsFlutterBinding.ensureInitialized();\
\
final config = await AppBootstrap.initialize();\
\
runApp(\
ProviderScope(\
overrides: \[\
appConfigProvider.overrideWithValue(config),\
\],\
child: const ESCCApp(),\
),\
);\
}

**3.3.2 bootstrap.dart**

Handles:

- Environment selection (dev/staging/prod)

- Dependency registration

- Logging configuration

- Secure storage initialization

**3.3.3 app/**

Contains:

app/\
├── app.dart\
├── router.dart\
├── theme.dart\
├── app_providers.dart\
└── route_guards.dart

Responsibilities:

- Global app configuration

- Routing setup (GoRouter)

- Role-based route guards

- Theme injection

- App-level providers

**3.4 Core Layer**

Shared low-level infrastructure used across features.

core/\
├── network/\
├── auth/\
├── storage/\
├── config/\
├── errors/\
├── logging/\
├── constants/\
├── utils/\
└── theme/

**3.4.1 core/network/**

Contains:

- ApiClient

- Interceptors

- Request wrapper

- WebSocket client

- Retry policy

- Error mapping

Example:

network/\
├── api_client.dart\
├── api_interceptor.dart\
├── websocket_client.dart\
├── network_exceptions.dart\
└── pagination.dart

**3.4.2 core/auth/**

Handles:

- JWT parsing

- Token refresh

- Role extraction

- Session expiration logic

Files:

auth/\
├── token_manager.dart\
├── auth_guard.dart\
├── jwt_decoder.dart\
└── session_manager.dart

**3.4.3 core/storage/**

Secure storage abstraction.

Supports:

- Flutter Secure Storage

- Web local storage

- Token encryption

**3.4.4 core/errors/**

Standardized error handling.

errors/\
├── failure.dart\
├── api_failure.dart\
├── validation_failure.dart\
└── error_mapper.dart

All features must use domain-level Failure objects.

**3.4.5 core/logging/**

Centralized logging.

logging/\
├── app_logger.dart\
├── log_levels.dart\
└── correlation_id.dart

Supports:

- Correlation IDs

- Structured logs

- Error reporting integration

**3.4.6 core/config/**

Environment configuration:

config/\
├── app_config.dart\
├── dev_config.dart\
├── staging_config.dart\
└── prod_config.dart

**3.5 Shared Layer**

Reusable UI and shared widgets.

shared/\
├── widgets/\
├── components/\
├── dialogs/\
├── extensions/\
├── mixins/\
└── formatters/

Examples:

- LoadingIndicator

- ErrorView

- ConfirmDialog

- PaginatedTableWidget

- SearchBar

- FilterPanel

Shared components must not contain feature logic.

**3.6 Features Layer**

Main application modules.

features/\
├── auth/\
├── dashboard/\
├── tickets/\
├── sla/\
├── escalation/\
├── agencies/\
├── knowledge_base/\
├── ai_triage/\
├── analytics/\
├── audit/\
└── users/

Each feature is isolated and self-contained.

**3.7 Feature Module Structure**

Every feature follows the same pattern.

Example: tickets/

tickets/\
├── presentation/\
├── domain/\
├── data/\
└── tickets_module.dart

**3.7.1 Presentation Layer (Inside Feature)**

presentation/\
├── screens/\
├── widgets/\
├── providers/\
├── controllers/\
└── ticket_state.dart

Responsibilities:

- UI screens

- Feature widgets

- Riverpod providers

- State management

- Navigation events

Example:

screens/\
├── ticket_list_screen.dart\
├── ticket_detail_screen.dart\
└── ticket_create_screen.dart

**3.7.2 Domain Layer (Inside Feature)**

domain/\
├── entities/\
├── usecases/\
├── repositories/\
└── value_objects/

Example:

entities/\
└── ticket.dart\
\
usecases/\
├── get_tickets_usecase.dart\
├── create_ticket_usecase.dart\
└── escalate_ticket_usecase.dart\
\
repositories/\
└── ticket_repository.dart

Contains business logic only.

No Flutter imports allowed.

**3.7.3 Data Layer (Inside Feature)**

data/\
├── models/\
├── datasources/\
├── repositories/\
└── mappers/

Example:

models/\
└── ticket_dto.dart\
\
datasources/\
└── ticket_remote_datasource.dart\
\
repositories/\
└── ticket_repository_impl.dart\
\
mappers/\
└── ticket_mapper.dart

Handles:

- REST calls

- WebSocket updates

- DTO conversion

- Error translation

**3.8 tickets_module.dart**

Each feature exposes a module registration file.

Example:

final ticketRepositoryProvider = Provider\<TicketRepository\>((ref) {\
return TicketRepositoryImpl(\
ref.read(ticketRemoteDataSourceProvider),\
);\
});

This keeps dependency registration inside the feature.

**3.9 Example Full Feature Layout**

features/tickets/\
├── data/\
│ ├── models/\
│ ├── datasources/\
│ ├── repositories/\
│ └── mappers/\
├── domain/\
│ ├── entities/\
│ ├── repositories/\
│ └── usecases/\
├── presentation/\
│ ├── screens/\
│ ├── widgets/\
│ ├── providers/\
│ ├── controllers/\
│ └── ticket_state.dart\
└── tickets_module.dart

This pattern repeats for:

- sla/

- escalation/

- analytics/

- audit/

- knowledge_base/

- ai_triage/

**3.10 Scalability Considerations**

This structure supports:

- Adding new agencies as plugin modules

- Independent team ownership per feature

- Lazy-loaded features for web optimization

- Multi-tenant future expansion

- Microfrontend-style federation

**3.11 Naming Conventions**

- Entities: PascalCase

- DTOs: SuffixDto

- UseCases: VerbNounUseCase

- Repositories: Interface in domain, Impl in data

- Providers: camelCaseProvider

- Controllers: FeatureController

Example:

- GetTicketsUseCase

- TicketRepository

- TicketRepositoryImpl

- ticketControllerProvider

**3.12 Enforcement Rules**

Mandatory engineering rules:

- No cross-feature imports of presentation layer

- Domain cannot import Flutter

- Data cannot import presentation

- Core cannot depend on features

- All API calls go through ApiClient

- No direct HTTP calls inside widgets

**3.13 Benefits of This Structure**

- Predictable development flow

- Enterprise maintainability

- Strict domain modeling

- Easy refactoring

- Clean code reviews

- Improved test coverage

- Reduced technical debt

- Government-scale readiness

**3.14 Summary**

The eSCC project structure is:

- Modular

- Layered

- Feature-first

- Clean Architecture compliant

- Testable

- Scalable

- Enterprise-ready

It ensures long-term sustainability for a national service platform.

**Section 4: Authentication & Security Architecture**

**4.1 Security Architecture Principles**

The eSCC frontend must enforce **security-by-design**.

Core principles:

- Zero trust between layers

- Strict RBAC enforcement

- Token-based authentication

- Short-lived access tokens

- Secure storage mechanisms

- Encrypted communication only (HTTPS/WSS)

- Centralized session management

- Audit logging hooks for sensitive actions

This is mandatory for:

- Government-grade systems

- Multi-agency access

- Sensitive citizen data handling

- Regulatory compliance

**4.2 Authentication Flow Overview**

The system uses:

- JWT-based authentication

- Refresh token mechanism

- API Gateway validation

- Role-based authorization

**4.2.1 Login Flow**

User → Login Screen\
→ Auth API (/auth/login)\
→ Access Token (JWT)\
→ Refresh Token\
→ Store Securely\
→ Redirect Based on Role

**4.2.2 Token Lifecycle**

- Access Token (short-lived, e.g., 15 minutes)

- Refresh Token (long-lived, e.g., 7--30 days)

- Automatic refresh before expiry

- Forced logout on refresh failure

**4.3 Multi-Role Authentication Model**

The system supports:

- Citizen

- Level 1 Support (Agency Officer)

- Level 2 Support (Service Provider)

- Command Center Supervisor

- System Administrator

Each user has:

- role

- permissions\[\]

- agencyId (if applicable)

Example JWT payload:

{\
\"sub\": \"user-123\",\
\"role\": \"L1_SUPPORT\",\
\"agencyId\": \"AGENCY-45\",\
\"permissions\": \[\
\"VIEW_TICKET\",\
\"ESCALATE_TICKET\",\
\"VIEW_SLA\"\
\],\
\"exp\": 1735689600\
}

**4.4 Token Storage Strategy**

**4.4.1 Mobile (Android / iOS)**

Use:

- flutter_secure_storage

- Encrypted Keystore / Keychain

Never store:

- Tokens in plain SharedPreferences

**4.4.2 Web**

Use:

- Secure HTTP-only cookies (preferred)\
  OR

- Encrypted local storage abstraction

Avoid:

- Exposing raw JWT to JavaScript if possible

**4.5 Token Manager Architecture**

Location:

core/auth/token_manager.dart

Responsibilities:

- Store tokens

- Retrieve tokens

- Decode JWT

- Check expiry

- Trigger refresh

- Clear session

Example:

class TokenManager {\
final SecureStorage storage;\
\
Future\<void\> saveTokens(String access, String refresh) async {\
await storage.write(key: \'access_token\', value: access);\
await storage.write(key: \'refresh_token\', value: refresh);\
}\
\
Future\<String?\> getAccessToken() async {\
return storage.read(key: \'access_token\');\
}\
\
Future\<void\> clearSession() async {\
await storage.deleteAll();\
}\
}

**4.6 API Interceptor Architecture**

All network requests pass through:

core/network/api_interceptor.dart

Responsibilities:

- Attach Authorization header

- Attach Correlation ID

- Detect 401 Unauthorized

- Trigger refresh token

- Retry failed request

- Log security failures

**4.6.1 Authorization Header Injection**

options.headers\[\'Authorization\'\] = \'Bearer \$token\';

**4.6.2 Automatic Refresh Flow**

API Call → 401\
→ Refresh Token API\
→ New Access Token\
→ Retry Original Request

If refresh fails:

- Clear session

- Redirect to login

- Log event

**4.7 Role-Based Access Control (RBAC)**

**4.7.1 Enforcement Layers**

RBAC enforced at:

1.  Route level

2.  Screen level

3.  Component level

4.  Action level

**4.7.2 Route Guard Example**

GoRoute(\
path: \'/admin\',\
builder: (context, state) =\> AdminScreen(),\
redirect: (context, state) {\
final role = context.read(authProvider).role;\
if (role != UserRole.admin) {\
return \'/unauthorized\';\
}\
return null;\
},\
);

**4.7.3 UI-Level Permission Check**

Example:

if (user.hasPermission(\'ESCALATE_TICKET\')) {\
return EscalateButton();\
}

**4.8 Session Management**

**4.8.1 Idle Timeout**

- Auto logout after inactivity threshold

- Warning dialog before expiry

- Token expiry countdown timer

**4.8.2 Forced Logout Conditions**

- Token invalid

- Account disabled

- Role revoked

- Agency access revoked

- Concurrent login restrictions (if required)

**4.9 Audit Logging Hooks**

Frontend must trigger audit events for:

- Login

- Logout

- Ticket escalation

- SLA override

- Manual routing

- AI override

- Role change

- Agency configuration change

Audit event payload example:

{\
\"action\": \"ESCALATE_TICKET\",\
\"userId\": \"user-123\",\
\"ticketId\": \"TCK-456\",\
\"timestamp\": \"2026-02-24T10:00:00Z\"\
}

Frontend sends audit events to Audit Service.

**4.10 Secure Communication**

**4.10.1 Enforced Protocols**

- HTTPS only

- WSS for WebSockets

- No HTTP fallback

**4.10.2 Certificate Pinning (Mobile)**

Implemented for:

- Android

- iOS

Prevents MITM attacks.

**4.11 Input Validation Strategy**

Validation layers:

1.  UI-level validation

2.  Domain-level validation

3.  Backend validation

Example:

- Required fields

- Email format

- Ticket description length

- File attachment size limits

All validation errors mapped to:

core/errors/validation_failure.dart

**4.12 Secure Error Handling**

Rules:

- No stack traces in UI

- No internal server messages exposed

- Friendly, standardized error messages

- Security incidents logged

Example UI message:

\"Session expired. Please log in again.\"

Not:

\"JWTExpiredException: Signature invalid at line 342\"

**4.13 Anti-Tampering Measures**

For Flutter Web:

- Disable debug builds in production

- Obfuscate Dart code

- Enable tree shaking

- Minify builds

For Mobile:

- Enable code obfuscation

- Prevent rooted/jailbroken device access (if required)

- Block screen capture for sensitive views (optional)

**4.14 Security Threat Mitigation**

  --------------------------------------
  **Threat**      **Mitigation**
  --------------- ----------------------
  Token Theft     Secure storage + short
                  TTL

  CSRF            SameSite cookies

  XSS             Strict CSP headers

  Replay Attacks  Token expiry + refresh
                  logic

  MITM            HTTPS + certificate
                  pinning

  Privilege       Strict RBAC
  Escalation      enforcement

  Session         Idle timeout + token
  Hijacking       rotation
  --------------------------------------

**4.15 Security Compliance Checklist**

- JWT validation implemented

- Refresh logic implemented

- Secure storage used

- Route guards enabled

- Permission checks enforced

- Audit events triggered

- HTTPS enforced

- Certificate pinning enabled

- Error messages sanitized

- Logs do not expose sensitive data

**4.16 High-Level Security Flow Diagram**

User\
↓\
Login Screen\
↓\
Auth Service\
↓\
JWT + Refresh Token\
↓\
Secure Storage\
↓\
API Interceptor\
↓\
Protected Endpoints\
↓\
RBAC Enforcement

**4.17 Summary**

The eSCC Authentication & Security Architecture ensures:

- Strong identity verification

- Multi-role enforcement

- Secure token lifecycle

- Protection against common attack vectors

- Compliance with government security standards

- Full alignment with backend authentication contracts

The frontend acts as a secure, RBAC-enforcing gateway to all system
capabilities.

**Section 5: UI/UX System Architecture**

**5.1 UI/UX Design Principles**

The eSCC frontend must reflect:

- Authority

- Clarity

- Operational efficiency

- Accessibility

- Data density without clutter

Design principles:

- Functional over decorative

- High information visibility

- Clear hierarchy

- Consistent component behavior

- Minimal cognitive load

- Fast interaction cycles

This is an operational command system, not a marketing website.

**5.2 Design System Architecture**

The system uses a centralized design system located in:

core/theme/

**5.2.1 Theme Configuration**

theme/\
├── app_theme.dart\
├── color_palette.dart\
├── typography.dart\
├── spacing.dart\
└── component_theme.dart

**5.2.2 Color System**

Color categories:

- Primary (Government identity)

- Secondary

- Success (SLA met)

- Warning (Approaching breach)

- Error (SLA breached / failure)

- Info

- Background

- Surface

- Border

Example:

class AppColors {\
static const primary = Color(0xFF003366);\
static const success = Color(0xFF2E7D32);\
static const warning = Color(0xFFF9A825);\
static const error = Color(0xFFC62828);\
}

**5.2.3 Typography System**

Defined for clarity and hierarchy:

- HeadlineLarge (Dashboard titles)

- HeadlineMedium

- BodyLarge

- BodyMedium

- LabelSmall

- DataMonospace (for ticket IDs)

Consistency enforced across modules.

**5.2.4 Spacing System**

Standard spacing scale:

- 4px

- 8px

- 16px

- 24px

- 32px

- 48px

No arbitrary spacing allowed.

**5.3 Accessibility Compliance (WCAG 2.1)**

Mandatory requirements:

- Minimum contrast ratio 4.5:1

- Keyboard navigability (Flutter Web)

- Screen reader labels

- Semantic widgets

- Proper focus order

- Scalable text support

- No color-only indicators

Example:

Semantics(\
label: \"SLA Status: Breached\",\
child: SLAStatusBadge(status: SLAStatus.breached),\
);

**5.4 Dark and Light Mode**

The app supports:

- Light mode (default for government offices)

- Dark mode (optional for long operational sessions)

Theme toggling:

- Controlled via settings

- Persisted locally

- Applied globally

**5.5 Layout Architecture**

**5.5.1 Web Layout Structure**

┌─────────────────────────────────────┐\
│ Top App Bar │\
├───────────────┬────────────────────┤\
│ Side Navigation│ Main Content Area │\
│ │ │\
│ │ │\
└───────────────┴────────────────────┘

**5.5.2 Mobile Layout Structure**

┌────────────────────┐\
│ App Bar │\
├────────────────────┤\
│ Main Content │\
│ │\
├────────────────────┤\
│ Bottom Navigation │\
└────────────────────┘

**5.6 Component Architecture**

Reusable UI components live in:

shared/components/

Each component:

- Stateless when possible

- Accepts domain models

- Does not perform API calls

- Supports theming

- Supports accessibility

**5.7 Core Enterprise Components**

**5.7.1 TicketCard**

Used in:

- Ticket list

- Escalation view

- Dashboard

Displays:

- Ticket ID

- Title

- Agency

- Status

- SLA countdown

- Priority

- Assigned officer

Example structure:

class TicketCard extends StatelessWidget {\
final Ticket ticket;\
\
const TicketCard({required this.ticket});\
\
\@override\
Widget build(BuildContext context) {\
return Card(\
child: Column(\
children: \[\
Text(ticket.id),\
Text(ticket.title),\
SLAStatusBadge(status: ticket.slaStatus),\
\],\
),\
);\
}\
}

**5.7.2 SLAStatusBadge**

Visual representation of SLA state:

- On Track → Green

- At Risk → Amber

- Breached → Red

Must support:

- Icon + label

- Tooltip with SLA time remaining

**5.7.3 AgencySelector**

Dropdown with:

- Search capability

- Agency grouping

- Multi-select option (Supervisor view)

**5.7.4 EscalationTimeline**

Visual timeline showing:

- Ticket creation

- L1 handling

- Escalation to L2

- SLA breach

- Resolution

Uses vertical timeline layout.

**5.7.5 AIRecommendationPanel**

Displays:

- Suggested agency

- Confidence score

- Suggested category

- Risk level

- Override button

Must show:

- Confidence as percentage

- Visual risk indicator

**5.7.6 AuditLogViewer**

Displays:

- Action

- User

- Timestamp

- Old value

- New value

Supports:

- Filtering

- Search

- Pagination

**5.7.7 AnalyticsCharts**

Built using:

- charts_flutter or equivalent

- Lazy rendering

- Data grouping support

Charts include:

- Ticket volume over time

- SLA breach rate

- Agency performance comparison

- Escalation frequency

**5.8 Data-Dense UI Handling**

For large datasets:

- Paginated tables

- Virtual scrolling

- Lazy loading

- Column visibility toggles

- Export to CSV (if permitted)

Example:

PaginatedDataTable(\
header: Text(\'Tickets\'),\
rowsPerPage: 20,\
columns: \[\...\],\
source: TicketDataSource(),\
);

**5.9 Error & Loading States**

Every screen must support:

- Loading state

- Empty state

- Error state

- Partial data state

Example:

if (state.isLoading) {\
return const LoadingIndicator();\
}\
\
if (state.error != null) {\
return ErrorView(message: state.error!);\
}

**5.10 Feedback & Alerts**

System-wide feedback:

- Snackbar for minor actions

- Modal for critical actions

- Confirmation dialogs for destructive operations

- Toast for success messages

Examples:

- \"Ticket escalated successfully.\"

- \"SLA breached.\"

- \"Session expiring in 1 minute.\"

**5.11 Role-Based UI Rendering**

UI elements must adapt to role:

- Citizen → Simplified UI

- L1 → Operational ticket panel

- Supervisor → Analytics-heavy dashboard

- Admin → Configuration tools

Example:

if (user.role == UserRole.supervisor) {\
return SupervisorDashboard();\
}

**5.12 Responsiveness Strategy**

Breakpoints:

- \< 600px → Mobile

- 600--1024px → Tablet

- 1024px → Desktop

Use:

- LayoutBuilder

- MediaQuery

- Responsive grid systems

**5.13 Micro-Interaction Guidelines**

- Hover effects (Web)

- Focus indicators

- Smooth transitions

- SLA countdown animation

- Expand/collapse panels

Avoid:

- Heavy animations

- Non-functional effects

**5.14 Internationalization (Future-Ready)**

Prepared for:

- Multi-language support

- RTL layout

- Locale-based formatting

Structure:

l10n/\
├── app_en.arb\
├── app_sw.arb

**5.15 UI Consistency Enforcement**

Rules:

- No inline colors

- No inline text styles

- Use shared components only

- All buttons must use AppButton

- All forms must use standardized FormField widgets

**5.16 High-Level UI Architecture Diagram**

Screens\
↓\
Feature Widgets\
↓\
Shared Components\
↓\
Theme System

No direct styling inside screens beyond layout structure.

**5.17 Summary**

The eSCC UI/UX System Architecture ensures:

- Government-grade visual consistency

- Operational efficiency

- Accessibility compliance

- Modular component reuse

- Data-dense but readable interfaces

- Role-adaptive layouts

- Future scalability

The UI is built for performance, clarity, and control --- not
decoration.

**Section 6: Feature Modules (Detailed Engineering Design)**

This section defines the internal engineering design for each functional
module.

Each module includes:

- Screens

- State management structure

- Domain use cases

- API interactions

- Real-time handling (if applicable)

- Error handling strategy

- Loading strategy

- Role-based behavior

All modules strictly follow:

- Clean Architecture

- Riverpod state management

- Repository pattern

- Centralized API client usage

**6.1 Authentication Module**

**6.1.1 Folder Structure**

features/auth/\
├── presentation/\
├── domain/\
├── data/\
└── auth_module.dart

**6.1.2 Screens**

- LoginScreen

- ForgotPasswordScreen

- ResetPasswordScreen

- SessionExpiredScreen

- UnauthorizedScreen

**6.1.3 Domain Layer**

Entities:

- AuthUser

- AuthSession

UseCases:

- LoginUseCase

- RefreshTokenUseCase

- LogoutUseCase

- GetCurrentUserUseCase

**6.1.4 State Model**

class AuthState {\
final bool isLoading;\
final AuthUser? user;\
final String? error;\
\
AuthState({\
required this.isLoading,\
this.user,\
this.error,\
});\
}

**6.1.5 API Integration**

Endpoints:

- POST /auth/login

- POST /auth/refresh

- POST /auth/logout

- GET /auth/me

Token refresh handled globally in interceptor.

**6.1.6 Role-Based Redirect**

After login:

- Citizen → Citizen Dashboard

- L1 → Agency Ticket Panel

- L2 → Technical Queue

- Supervisor → Command Center Dashboard

- Admin → Admin Console

**6.2 Dashboard Module (Command Center View)**

**6.2.1 Purpose**

Provides high-level operational visibility.

**6.2.2 Screens**

- SupervisorDashboardScreen

- AgencyDashboardScreen

- CitizenDashboardScreen

**6.2.3 Widgets**

- TicketVolumeChart

- SLABreachChart

- AgencyPerformanceTable

- EscalationRateGraph

- RealTimeActivityFeed

**6.2.4 Domain UseCases**

- GetDashboardMetricsUseCase

- GetAgencyPerformanceUseCase

- GetRealtimeStatsUseCase

**6.2.5 Real-Time Strategy**

WebSocket subscription:

- ticket_created

- ticket_escalated

- sla_breached

- ticket_closed

Updates state incrementally without full refresh.

**6.2.6 Performance Strategy**

- Lazy load charts

- Cache last dashboard snapshot

- Throttle real-time updates

**6.3 Ticket Management Module**

**6.3.1 Core Responsibility**

Manages full ticket lifecycle.

**6.3.2 Screens**

- TicketListScreen

- TicketDetailScreen

- CreateTicketScreen

- UpdateTicketScreen

**6.3.3 Ticket States (from SRS)**

- OPEN

- IN_PROGRESS

- ESCALATED

- RESOLVED

- CLOSED

- REJECTED

UI must reflect state visually.

**6.3.4 Domain UseCases**

- GetTicketsUseCase

- GetTicketDetailUseCase

- CreateTicketUseCase

- UpdateTicketUseCase

- EscalateTicketUseCase

- CloseTicketUseCase

**6.3.5 Filtering & Search**

Supports:

- Status filter

- Agency filter

- SLA status filter

- Date range filter

- Full-text search

Pagination via backend.

**6.3.6 Error Handling**

Standardized failures:

- NetworkFailure

- ValidationFailure

- PermissionFailure

- ConflictFailure

**6.4 SLA Monitoring Module**

**6.4.1 Purpose**

Tracks SLA deadlines and breach risks.

**6.4.2 Screens**

- SLADashboardScreen

- SLADetailScreen

**6.4.3 Key UI Elements**

- Countdown timer

- Risk indicator

- Breach alert panel

**6.4.4 Domain Logic**

UseCase:

- EvaluateSLARiskUseCase

Frontend logic may calculate visual countdown but SLA breach validation
remains backend-driven.

**6.4.5 Real-Time SLA Updates**

WebSocket event:

- sla_warning

- sla_breached

Triggers:

- UI alert

- Badge color update

- Optional sound notification

**6.5 AI Triage & Recommendation Module**

**6.5.1 Purpose**

Displays AI routing suggestions and risk scores.

**6.5.2 Screens**

- AITriagePanel (within TicketDetailScreen)

**6.5.3 Displays**

- Suggested Agency

- Suggested Category

- Confidence Score

- Risk Level

- Override Button

**6.5.4 Domain UseCases**

- GetAITriageRecommendationUseCase

- OverrideAIRecommendationUseCase

**6.5.5 Override Workflow**

Supervisor can:

- Accept AI suggestion

- Override with manual routing

- Add override justification

Audit log required.

**6.6 Escalation Workflow Module**

**6.6.1 Screens**

- EscalationQueueScreen

- EscalationDetailView

**6.6.2 UseCases**

- EscalateTicketUseCase

- GetEscalationHistoryUseCase

- ReassignEscalationUseCase

**6.6.3 Timeline Component**

Visual timeline showing escalation path.

**6.7 Multi-Agency Routing Module**

**6.7.1 Responsibility**

Routes tickets between agencies.

**6.7.2 Features**

- Manual routing

- AI-assisted routing

- Agency load balancing

- Cross-agency transfer

**6.7.3 Domain UseCases**

- RouteTicketUseCase

- GetAgencyLoadUseCase

**6.8 Knowledge Base Module**

**6.8.1 Screens**

- KnowledgeSearchScreen

- ArticleDetailScreen

- SuggestedArticlesPanel

**6.8.2 Integration Points**

- Linked from ticket view

- Linked from citizen portal

- AI suggests articles

**6.8.3 Search Strategy**

- Backend-driven search

- Debounced input

- Pagination

- Highlight matched keywords

**6.9 Analytics & Reporting Module**

**6.9.1 Screens**

- AnalyticsDashboardScreen

- ExportReportScreen

**6.9.2 Charts**

- Ticket trends

- SLA compliance rate

- Agency performance ranking

- Escalation rate

**6.9.3 Export Formats**

- CSV

- PDF (if allowed)

- Excel (if supported)

**6.10 Audit & Logs Module**

**6.10.1 Screens**

- AuditLogScreen

- AuditDetailView

**6.10.2 Features**

- Filter by user

- Filter by action

- Filter by date range

- Export audit records

**6.10.3 Domain UseCases**

- GetAuditLogsUseCase

- ExportAuditLogsUseCase

**6.11 User & Role Management Module**

**6.11.1 Screens**

- UserListScreen

- CreateUserScreen

- EditUserScreen

- RoleAssignmentScreen

**6.11.2 Role Types**

- Citizen

- L1

- L2

- Supervisor

- Admin

**6.11.3 Domain UseCases**

- CreateUserUseCase

- UpdateUserUseCase

- AssignRoleUseCase

- DisableUserUseCase

**6.11.4 Permission Matrix UI**

Admin can:

- Assign granular permissions

- View effective permissions

- Revoke access

**6.12 Cross-Module Standards**

All modules must:

- Use centralized error handling

- Use shared loading components

- Respect RBAC

- Log audit actions

- Use domain models only in presentation

- Avoid direct API calls in UI

**6.13 Module Interaction Diagram**

Ticket Module\
↕\
AI Module\
↕\
Escalation Module\
↕\
SLA Module\
↕\
Audit Module\
↕\
Analytics Module

All interactions go through domain layer, not direct feature-to-feature
UI calls.

**6.14 Summary**

The feature modules are:

- Strictly isolated

- Domain-driven

- API-aligned

- Real-time capable

- Role-aware

- Audit-compliant

- Scalable for national deployment

Each module follows consistent architectural discipline to maintain
long-term sustainability and enterprise maintainability.

**Section 7: Real-Time Communication Architecture**

The eSCC frontend requires real-time capabilities to support:

- Live ticket updates

- SLA countdown monitoring

- Escalation alerts

- Supervisor dashboards

- Cross-agency coordination

- AI triage results streaming (if asynchronous)

This section defines the architecture, protocols, integration strategy,
and state synchronization model.

**7.1 Real-Time Communication Principles**

The system must:

- Avoid polling where possible

- Use persistent WebSocket connections

- Support automatic reconnection

- Gracefully degrade if connection drops

- Maintain secure communication (WSS only)

- Ensure message ordering

- Prevent duplicate event processing

**7.2 Communication Protocol**

**7.2.1 Selected Protocol: WebSocket (WSS)**

Reasons:

- Bi-directional communication

- Low latency

- Reduced server overhead vs polling

- Suitable for dashboards

- Scalable via backend message broker (Kafka / Redis PubSub)

**7.3 High-Level Architecture**

Flutter App\
↓\
WebSocket Client\
↓\
API Gateway (WSS)\
↓\
Event Stream (Kafka / PubSub)\
↓\
Microservices (Ticket, SLA, AI, Audit)

Frontend subscribes only to relevant channels based on:

- Role

- Agency

- Assigned tickets

**7.4 WebSocket Client Implementation**

Located in:

core/network/websocket_client.dart

Responsibilities:

- Establish connection

- Authenticate connection (JWT)

- Subscribe to topics

- Parse incoming events

- Dispatch events to feature providers

- Handle reconnection

- Log connection status

**7.4.1 Connection Initialization**

class WebSocketClient {\
WebSocketChannel? \_channel;\
\
void connect(String token) {\
\_channel = WebSocketChannel.connect(\
Uri.parse(\'wss://api.escc.gov/ws?token=\$token\'),\
);\
}\
}

Token must be validated by backend.

**7.5 Subscription Model**

After connection:

Frontend subscribes to topics:

- tickets.global (Supervisor)

- tickets.agency.{agencyId}

- tickets.user.{userId}

- sla.updates

- escalation.events

- ai.results

**7.6 Event Schema**

All events follow standardized structure:

{\
\"eventId\": \"evt-12345\",\
\"eventType\": \"TICKET_UPDATED\",\
\"entityId\": \"TCK-456\",\
\"timestamp\": \"2026-02-24T12:00:00Z\",\
\"payload\": {\
\"status\": \"ESCALATED\",\
\"assignedTo\": \"user-987\"\
}\
}

Frontend must:

- Validate eventType

- Map payload to domain model

- Ignore unknown events safely

**7.7 Event Types**

Core event types:

- TICKET_CREATED

- TICKET_UPDATED

- TICKET_ESCALATED

- TICKET_CLOSED

- SLA_WARNING

- SLA_BREACHED

- AI_RECOMMENDATION_READY

- USER_ROLE_UPDATED

- AGENCY_CONFIGURATION_CHANGED

**7.8 State Synchronization Strategy**

When event received:

1.  Identify affected feature

2.  Locate corresponding provider

3.  Update state immutably

4.  Trigger UI refresh

Example (Riverpod):

ref.read(ticketControllerProvider.notifier)\
.handleRealtimeUpdate(event);

**7.9 Duplicate Event Protection**

Each event has:

- eventId

Frontend maintains:

Set\<String\> processedEventIds;

Before processing:

- Check if already handled

- Ignore duplicates

Prevents double updates during reconnection.

**7.10 Reconnection Strategy**

Triggers reconnection when:

- Connection drops

- Token refresh occurs

- Network connectivity restored

Reconnection flow:

Connection Lost\
↓\
Retry with exponential backoff\
↓\
Re-authenticate\
↓\
Re-subscribe to topics

Backoff strategy:

- 1s

- 2s

- 5s

- 10s

- 30s (max)

**7.11 SLA Countdown Strategy**

Two-layer approach:

1.  Backend sends SLA deadline timestamp

2.  Frontend renders local countdown timer

Example:

Duration remaining = ticket.slaDeadline.difference(DateTime.now());

When zero:

- Show breach state

- Await backend confirmation event

Backend remains source of truth.

**7.12 Real-Time Dashboard Updates**

Supervisor dashboard listens to:

- ticket_created

- sla_breached

- escalation.events

Instead of reloading entire dashboard:

- Increment counters

- Update chart data

- Append to activity feed

Avoid full refetch for performance.

**7.13 AI Asynchronous Results Handling**

Some AI triage operations may be async.

Flow:

1.  Ticket created

2.  AI processing in backend

3.  Event AI_RECOMMENDATION_READY

4.  Frontend updates AIRecommendationPanel

UI must show:

- "Analyzing..." state

- Spinner until event received

**7.14 Security Considerations**

WebSocket must:

- Use WSS only

- Include token validation

- Disconnect on token expiry

- Reject unauthorized subscriptions

- Prevent cross-agency data leakage

Frontend must:

- Not subscribe to unauthorized channels

- Clear subscriptions on logout

**7.15 Offline & Fallback Strategy**

If WebSocket unavailable:

- Show connection warning banner

- Fallback to manual refresh

- Retry silently in background

UI indicator example:

- Green dot → Connected

- Yellow → Reconnecting

- Red → Disconnected

**7.16 Performance Considerations**

- Batch rapid events

- Throttle UI updates

- Avoid rebuilding full screen

- Use selective provider updates

- Limit event payload size

**7.17 Observability**

Log:

- Connection established

- Connection lost

- Subscription success

- Reconnection attempts

- Unexpected event types

Logs include correlation ID.

**7.18 Failure Handling**

Failure scenarios:

- Token expired

- Invalid subscription

- Malformed event

- Backend disconnect

Frontend must:

- Attempt recovery

- Fallback gracefully

- Notify user only if persistent failure

**7.19 Real-Time Architecture Diagram**

Flutter App\
↓\
WebSocket Client\
↓\
Event Dispatcher\
↓\
Feature Providers\
↓\
UI Update

No direct UI handling of raw WebSocket messages.

All events go through structured dispatcher.

**7.20 Summary**

The eSCC Real-Time Communication Architecture ensures:

- Low-latency operational visibility

- Live SLA tracking

- Real-time escalation awareness

- AI asynchronous result handling

- Secure event delivery

- Resilient reconnection

- Scalable multi-agency subscription model

This architecture supports national-scale concurrent usage while
maintaining performance and reliability.

**Section 8: API Integration Layer**

The API Integration Layer is responsible for all communication between
the Flutter frontend and backend microservices defined in the BED.

It ensures:

- Strict adherence to API contracts

- Centralized network logic

- Secure request handling

- Standardized error mapping

- Pagination and filtering consistency

- Retry and timeout management

- Alignment with DDD data models

All API interactions must pass through the Core Network Layer.

**8.1 Design Principles**

The API layer must:

- Be centralized (no direct HTTP in features)

- Be environment-aware (dev/staging/prod)

- Enforce JWT authentication

- Support REST and WebSocket

- Map DTOs to Domain Models

- Normalize backend errors

- Be testable via mocks

**8.2 API Client Architecture**

Located in:

core/network/api_client.dart

Responsibilities:

- Configure HTTP client (Dio recommended)

- Attach interceptors

- Manage base URL

- Handle timeouts

- Map network errors

- Log requests and responses

**8.2.1 HTTP Client Configuration**

class ApiClient {\
final Dio dio;\
\
ApiClient(TokenManager tokenManager)\
: dio = Dio(\
BaseOptions(\
baseUrl: AppConfig.current.baseUrl,\
connectTimeout: const Duration(seconds: 10),\
receiveTimeout: const Duration(seconds: 20),\
headers: {\
\'Content-Type\': \'application/json\',\
},\
),\
) {\
dio.interceptors.add(ApiInterceptor(tokenManager));\
}\
}

**8.3 API Interceptors**

Located in:

core/network/api_interceptor.dart

Interceptor responsibilities:

- Add Authorization header

- Attach Correlation ID

- Handle 401 responses

- Trigger token refresh

- Retry failed request

- Log request metadata

**8.4 REST API Structure Alignment with BED**

All API calls must align with:

- Defined endpoints

- Request/response schemas

- Standard response wrapper

Standard response format:

{\
\"success\": true,\
\"data\": {\...},\
\"meta\": {\...},\
\"error\": null\
}

Frontend must validate:

- success flag

- error presence

- meta pagination

**8.5 Data Source Layer Pattern**

Each feature has:

data/datasources/

Example: ticket_remote_datasource.dart

abstract class TicketRemoteDataSource {\
Future\<TicketDto\> getTicket(String id);\
Future\<PaginatedTicketDto\> getTickets(int page);\
}

Implementation:

class TicketRemoteDataSourceImpl\
implements TicketRemoteDataSource {\
\
final ApiClient apiClient;\
\
TicketRemoteDataSourceImpl(this.apiClient);\
\
\@override\
Future\<TicketDto\> getTicket(String id) async {\
final response = await apiClient.dio.get(\'/tickets/\$id\');\
return TicketDto.fromJson(response.data\[\'data\'\]);\
}\
}

**8.6 DTO → Domain Mapping**

Never expose DTOs to UI.

Mapping layer:

data/mappers/

Example:

class TicketMapper {\
static Ticket toDomain(TicketDto dto) {\
return Ticket(\
id: dto.id,\
title: dto.title,\
status: TicketStatus.fromString(dto.status),\
createdAt: DateTime.parse(dto.createdAt),\
);\
}\
}

Flow:

API → DTO → Mapper → Domain Model → UI

**8.7 Pagination Strategy**

Backend defines:

- page

- pageSize

- total

- hasNext

Frontend must:

- Support infinite scroll

- Support manual page controls

- Prevent duplicate page loads

Example:

if (state.hasMore && !state.isLoading) {\
controller.fetchNextPage();\
}

**8.8 Filtering & Query Parameters**

Filtering handled via query parameters:

Example:

GET /tickets?status=OPEN&agencyId=AG-45&page=2

Frontend must:

- Build query parameters safely

- Avoid manual string concatenation

- Use queryParameters field in Dio

Example:

dio.get(\
\'/tickets\',\
queryParameters: {\
\'status\': \'OPEN\',\
\'page\': 2,\
},\
);

**8.9 Error Mapping Strategy**

All API errors are mapped into:

core/errors/failure.dart

Types:

- NetworkFailure

- ServerFailure

- ValidationFailure

- UnauthorizedFailure

- ForbiddenFailure

- ConflictFailure

- UnknownFailure

Example mapping:

Failure mapDioError(DioException e) {\
if (e.response?.statusCode == 401) {\
return UnauthorizedFailure();\
}\
return NetworkFailure();\
}

UI must not depend on HTTP status codes.

**8.10 Retry Strategy**

Retry only for:

- Network timeouts

- Temporary server errors (5xx)

Do not retry:

- 400 validation errors

- 403 forbidden

- 409 conflict

Retry approach:

- Max 3 retries

- Exponential backoff

**8.11 Request Timeout Strategy**

Timeout rules:

- Auth: 10s

- Ticket fetch: 20s

- Analytics: 30s

Timeout error mapped to:

- NetworkFailure(\"Request timed out\")

**8.12 File Upload Handling**

For attachments:

- Use multipart/form-data

- Enforce file size limit

- Validate file type

- Show upload progress

Example:

FormData formData = FormData.fromMap({\
\"file\": await MultipartFile.fromFile(file.path),\
});

**8.13 Caching Strategy**

Frontend caching levels:

1.  In-memory (Riverpod state)

2.  Optional local storage for read-only data

3.  No persistent caching for sensitive data

Safe to cache:

- Agency list

- Knowledge categories

Not safe to cache:

- Sensitive tickets

- Audit logs

**8.14 Offline Handling Strategy**

If network unavailable:

- Show offline banner

- Prevent write operations

- Allow viewing cached read-only data (optional)

- Auto-retry when connection restored

**8.15 API Versioning Strategy**

Base URL must support versioning:

https://api.escc.gov/v1/

Frontend must:

- Avoid hardcoding version in multiple places

- Store version in AppConfig

**8.16 Correlation ID Strategy**

Each request includes:

- X-Correlation-ID header

Generated per session or per request.

Used for:

- Backend tracing

- Debugging production issues

**8.17 Rate Limiting Handling**

If backend returns 429:

- Show user-friendly message

- Delay retry

- Log incident

Example message:

\"Too many requests. Please wait a moment.\"

**8.18 API Integration Testing**

Test types:

- Mock API responses

- Test error mapping

- Test pagination logic

- Test retry logic

Use:

- Dio mock adapter

- Riverpod overrides

**8.19 High-Level API Flow Diagram**

UI\
↓\
Controller (Riverpod)\
↓\
UseCase\
↓\
Repository (Domain Interface)\
↓\
RepositoryImpl (Data)\
↓\
RemoteDataSource\
↓\
ApiClient (Dio)\
↓\
Backend API

Strict directional flow.

**8.20 Summary**

The API Integration Layer ensures:

- Clean separation from UI

- Full alignment with BED

- DTO to Domain transformation

- Robust error handling

- Secure token integration

- Controlled retry and timeout logic

- Scalable pagination and filtering

- Enterprise-grade reliability

This design ensures the frontend remains stable, predictable, and
maintainable even as backend services evolve.

**Section 9: Data Models Alignment with DDD**

This section defines how the Flutter frontend aligns with the Database
Design Document (DDD) and backend domain models.

The goal is:

- Strict domain consistency

- Clear DTO → Domain separation

- Strong typing

- Predictable mapping

- Future-proof schema evolution

- Audit-safe data handling

The frontend must reflect the canonical domain entities defined in the
DDD while remaining decoupled from raw database structure.

**9.1 Data Modeling Principles**

The frontend follows these modeling rules:

1.  UI never consumes raw JSON.

2.  DTOs are confined to the data layer.

3.  Domain models are pure and framework-agnostic.

4.  Domain models mirror DDD entities.

5.  Value objects enforce invariants where necessary.

6.  Enum mapping must be explicit.

7.  Null safety must be strictly enforced.

**9.2 Layered Model Separation**

Backend JSON\
↓\
DTO (Data Layer)\
↓\
Mapper\
↓\
Domain Entity\
↓\
ViewModel (Optional)\
↓\
UI

No shortcuts allowed.

**9.3 Core Domain Entities (Aligned with DDD)**

The frontend mirrors the following DDD entities:

- Ticket

- User

- Agency

- SLA

- Escalation

- AuditLog

- KnowledgeArticle

- AIRecommendation

**9.4 Ticket Entity**

**9.4.1 Domain Entity**

Located in:

features/tickets/domain/entities/ticket.dart

class Ticket {\
final String id;\
final String title;\
final String description;\
final TicketStatus status;\
final String agencyId;\
final String createdBy;\
final DateTime createdAt;\
final DateTime? updatedAt;\
final SLA? sla;\
final List\<Escalation\> escalations;\
\
Ticket({\
required this.id,\
required this.title,\
required this.description,\
required this.status,\
required this.agencyId,\
required this.createdBy,\
required this.createdAt,\
this.updatedAt,\
this.sla,\
required this.escalations,\
});\
}

**9.4.2 DTO Representation**

class TicketDto {\
final String id;\
final String title;\
final String description;\
final String status;\
final String agencyId;\
final String createdBy;\
final String createdAt;\
final String? updatedAt;\
\
TicketDto({\
required this.id,\
required this.title,\
required this.description,\
required this.status,\
required this.agencyId,\
required this.createdBy,\
required this.createdAt,\
this.updatedAt,\
});\
\
factory TicketDto.fromJson(Map\<String, dynamic\> json) {\
return TicketDto(\
id: json\[\'id\'\],\
title: json\[\'title\'\],\
description: json\[\'description\'\],\
status: json\[\'status\'\],\
agencyId: json\[\'agencyId\'\],\
createdBy: json\[\'createdBy\'\],\
createdAt: json\[\'createdAt\'\],\
updatedAt: json\[\'updatedAt\'\],\
);\
}\
}

**9.4.3 Enum Mapping**

enum TicketStatus {\
open,\
inProgress,\
escalated,\
resolved,\
closed,\
rejected;\
\
static TicketStatus fromString(String value) {\
switch (value) {\
case \'OPEN\':\
return TicketStatus.open;\
case \'IN_PROGRESS\':\
return TicketStatus.inProgress;\
case \'ESCALATED\':\
return TicketStatus.escalated;\
case \'RESOLVED\':\
return TicketStatus.resolved;\
case \'CLOSED\':\
return TicketStatus.closed;\
case \'REJECTED\':\
return TicketStatus.rejected;\
default:\
throw Exception(\'Invalid ticket status\');\
}\
}\
}

**9.5 User Entity**

Aligned with DDD User table.

class User {\
final String id;\
final String email;\
final String fullName;\
final UserRole role;\
final String? agencyId;\
final bool isActive;\
\
User({\
required this.id,\
required this.email,\
required this.fullName,\
required this.role,\
this.agencyId,\
required this.isActive,\
});\
}

**9.5.1 Role Enum**

enum UserRole {\
citizen,\
l1Support,\
l2Support,\
supervisor,\
admin;\
}

Role determines UI behavior and route access.

**9.6 Agency Entity**

class Agency {\
final String id;\
final String name;\
final String code;\
final bool isActive;\
\
Agency({\
required this.id,\
required this.name,\
required this.code,\
required this.isActive,\
});\
}

Used for:

- Ticket routing

- Load balancing

- Agency dashboard filtering

**9.7 SLA Entity**

class SLA {\
final String id;\
final DateTime deadline;\
final SLAStatus status;\
final Duration remaining;\
\
SLA({\
required this.id,\
required this.deadline,\
required this.status,\
required this.remaining,\
});\
}

**9.7.1 SLA Status Enum**

enum SLAStatus {\
onTrack,\
atRisk,\
breached;\
}

UI maps:

- onTrack → Green

- atRisk → Amber

- breached → Red

**9.8 Escalation Entity**

class Escalation {\
final String id;\
final String fromAgencyId;\
final String toAgencyId;\
final DateTime escalatedAt;\
final String reason;\
\
Escalation({\
required this.id,\
required this.fromAgencyId,\
required this.toAgencyId,\
required this.escalatedAt,\
required this.reason,\
});\
}

Displayed in EscalationTimeline.

**9.9 AuditLog Entity**

class AuditLog {\
final String id;\
final String action;\
final String userId;\
final DateTime timestamp;\
final Map\<String, dynamic\>? metadata;\
\
AuditLog({\
required this.id,\
required this.action,\
required this.userId,\
required this.timestamp,\
this.metadata,\
});\
}

Used in AuditLogViewer.

**9.10 KnowledgeArticle Entity**

class KnowledgeArticle {\
final String id;\
final String title;\
final String content;\
final String category;\
final DateTime publishedAt;\
\
KnowledgeArticle({\
required this.id,\
required this.title,\
required this.content,\
required this.category,\
required this.publishedAt,\
});\
}

**9.11 AIRecommendation Entity**

class AIRecommendation {\
final String suggestedAgencyId;\
final String suggestedCategory;\
final double confidenceScore;\
final String riskLevel;\
\
AIRecommendation({\
required this.suggestedAgencyId,\
required this.suggestedCategory,\
required this.confidenceScore,\
required this.riskLevel,\
});\
}

Confidence displayed as percentage.

**9.12 Domain Validation Rules**

Frontend domain layer enforces:

- Non-empty ticket title

- Description length constraints

- Valid email format

- Escalation reason required

- SLA deadline must be future timestamp

These validations are defensive. Backend remains source of truth.

**9.13 Handling Schema Evolution**

If backend adds new fields:

- DTO updated

- Mapper updated

- Domain model updated only if required

Never expose unknown JSON fields directly to UI.

**9.14 Optional ViewModel Layer**

For complex screens:

presentation/viewmodels/

ViewModel aggregates multiple domain entities for UI consumption.

Example:

class TicketDetailViewModel {\
final Ticket ticket;\
final User assignedUser;\
final AIRecommendation? aiRecommendation;\
}

Prevents UI from performing cross-entity lookups.

**9.15 Data Integrity Strategy**

Frontend ensures:

- Enum validation

- Null checks

- Date parsing safety

- Type safety

- No silent fallback for invalid data

Invalid mapping triggers:

- Logged error

- Fallback UI state

**9.16 Model Testing Strategy**

Unit tests must verify:

- DTO parsing

- Enum conversion

- Mapper correctness

- Null safety

- Date conversions

- Invalid data handling

**9.17 DDD Alignment Checklist**

- All DDD entities mirrored

- Enum values aligned

- Field names consistent

- No database-specific logic in UI

- No direct DB schema assumptions

- No snake_case exposure to UI

- Domain naming consistency maintained

**9.18 Summary**

The eSCC Data Model Alignment ensures:

- Strong consistency with DDD

- Clean separation between DTO and Domain

- Predictable enum mapping

- Defensive data validation

- Scalable schema evolution

- High testability

- Enterprise reliability

The frontend remains aligned with backend domain logic while maintaining
strict architectural boundaries.

**Section 10: AI Integration Layer**

The AI Integration Layer enables the frontend to:

- Display AI-powered ticket triage recommendations

- Visualize confidence scores and risk indicators

- Support asynchronous AI processing

- Allow manual override with audit logging

- Provide transparency in AI-assisted decisions

The AI layer does **not** perform AI computation in the frontend.\
All AI logic resides in backend AI services defined in the BED.

The frontend is responsible for:

- Rendering AI results

- Managing AI loading states

- Handling override workflows

- Displaying explainability metadata (if provided)

**10.1 AI Integration Principles**

The AI module must:

- Treat backend as source of truth

- Never make autonomous routing decisions

- Always allow human override

- Clearly display confidence levels

- Log all overrides

- Be transparent about AI suggestions

The system must never appear fully automated without oversight.

**10.2 AI Architecture Overview**

Ticket Created\
↓\
Backend AI Service\
↓\
AI Recommendation Generated\
↓\
WebSocket Event (AI_RECOMMENDATION_READY)\
↓\
Frontend Updates Ticket View

AI responses may be:

- Immediate (synchronous API response)

- Delayed (async event-based update)

The frontend must support both.

**10.3 AI Recommendation Data Model**

Aligned with DDD.

class AIRecommendation {\
final String suggestedAgencyId;\
final String suggestedCategory;\
final double confidenceScore; // 0.0 - 1.0\
final String riskLevel; // LOW, MEDIUM, HIGH\
final String? explanation; // Optional explainability text\
\
AIRecommendation({\
required this.suggestedAgencyId,\
required this.suggestedCategory,\
required this.confidenceScore,\
required this.riskLevel,\
this.explanation,\
});\
}

**10.4 AI Recommendation Panel Component**

Located in:

features/ai_triage/presentation/widgets/ai_recommendation_panel.dart

Displays:

- Suggested Agency

- Suggested Category

- Confidence Percentage

- Risk Level Indicator

- Explanation (if available)

- Accept Button

- Override Button

**10.4.1 Example Structure**

class AIRecommendationPanel extends StatelessWidget {\
final AIRecommendation recommendation;\
final VoidCallback onAccept;\
final VoidCallback onOverride;\
\
const AIRecommendationPanel({\
required this.recommendation,\
required this.onAccept,\
required this.onOverride,\
});\
\
\@override\
Widget build(BuildContext context) {\
return Card(\
child: Column(\
crossAxisAlignment: CrossAxisAlignment.start,\
children: \[\
Text(\"AI Suggested Agency: \${recommendation.suggestedAgencyId}\"),\
Text(\"Confidence: \${(recommendation.confidenceScore \*
100).toStringAsFixed(1)}%\"),\
Text(\"Risk Level: \${recommendation.riskLevel}\"),\
if (recommendation.explanation != null)\
Text(\"Explanation: \${recommendation.explanation}\"),\
Row(\
children: \[\
ElevatedButton(\
onPressed: onAccept,\
child: const Text(\"Accept\"),\
),\
OutlinedButton(\
onPressed: onOverride,\
child: const Text(\"Override\"),\
),\
\],\
)\
\],\
),\
);\
}\
}

**10.5 Confidence Score Visualization**

Confidence must be:

- Displayed as percentage

- Visually reinforced with color coding

Mapping:

- 80--100% → Green

- 50--79% → Amber

- \< 50% → Red

Optional visualization:

- LinearProgressIndicator

- Circular indicator

Example:

LinearProgressIndicator(\
value: recommendation.confidenceScore,\
)

**10.6 Risk Level Indicator**

RiskLevel mapping:

  -------------------------------
  **Risk**   **Meaning**
  ---------- --------------------
  LOW        Stable
             classification

  MEDIUM     Possible
             misclassification

  HIGH       Likely ambiguous
  -------------------------------

UI should use:

- Badge

- Tooltip explaining risk meaning

**10.7 AI Loading State Handling**

When AI is processing:

- Show spinner in panel

- Show message: "Analyzing ticket content..."

State example:

class AIState {\
final bool isLoading;\
final AIRecommendation? recommendation;\
final String? error;\
}

Flow:

1.  Ticket created

2.  AI processing started

3.  Show loading state

4.  WebSocket event arrives

5.  Update recommendation

**10.8 AI Override Workflow**

If supervisor overrides AI:

Flow:

User clicks Override\
↓\
Override Dialog\
↓\
Select Agency + Justification\
↓\
Call OverrideAIRecommendationUseCase\
↓\
Backend Records Override\
↓\
Audit Log Created

**10.8.1 Override Dialog Requirements**

Must include:

- Dropdown of agencies

- Required justification field

- Confirmation step

Validation:

- Justification cannot be empty

- Agency must be selected

**10.9 AI Acceptance Workflow**

If user accepts AI recommendation:

- Trigger RouteTicketUseCase

- Update ticket assignment

- Record audit event

- Update UI immediately

**10.10 Explainability Support**

If backend provides explanation metadata:

Example:

{\
\"explanation\": \"Matched keywords: passport, renewal, immigration\"\
}

Frontend must:

- Display in collapsible section

- Avoid exposing sensitive internal AI logic

- Keep explanation user-readable

**10.11 AI Event Handling (Real-Time)**

Event:

{\
\"eventType\": \"AI_RECOMMENDATION_READY\",\
\"entityId\": \"TCK-456\",\
\"payload\": {\
\"suggestedAgencyId\": \"AG-45\",\
\"confidenceScore\": 0.87\
}\
}

Handler:

- Locate ticket in state

- Inject AIRecommendation

- Trigger UI refresh

**10.12 Error Handling Strategy**

Possible failures:

- AI service timeout

- Recommendation unavailable

- Invalid response

- Override rejected

UI response:

- Show fallback message

- Allow manual routing

- Log error silently

Example message:

"AI recommendation unavailable. Please assign manually."

**10.13 AI Observability**

Frontend logs:

- AI request initiated

- AI response received

- AI override performed

- Confidence below threshold cases

These logs include:

- Correlation ID

- Ticket ID

- User ID

**10.14 AI Ethical Safeguards**

Frontend must:

- Never auto-assign without review (unless explicitly allowed in future)

- Clearly label AI suggestions as "Recommendation"

- Allow full human override

- Display confidence clearly

- Avoid misleading users about certainty

**10.15 Performance Considerations**

- AI panel updates only when recommendation changes

- Avoid rebuilding entire ticket screen

- Cache AI result within ticket state

- Do not repeatedly request AI if already processed

**10.16 AI Integration Diagram**

Ticket Screen\
↓\
AI Panel (Loading)\
↓\
WebSocket Event\
↓\
AI Recommendation Rendered\
↓\
Accept or Override\
↓\
Audit Logged

**10.17 Alignment with SRS & TDD**

This AI layer satisfies:

- AI-powered triage requirement

- Manual override requirement

- Supervisor control requirement

- Audit compliance requirement

- Real-time event integration requirement

**10.18 Summary**

The eSCC AI Integration Layer:

- Provides transparent AI suggestions

- Maintains human oversight

- Supports asynchronous updates

- Ensures auditability

- Visualizes confidence and risk clearly

- Prevents blind automation

- Aligns fully with backend AI service contracts

It enhances efficiency without compromising governance or
accountability.

**Section 11: Performance & Scalability Strategy**

The eSCC frontend must operate reliably under:

- High concurrent user load

- Large ticket volumes

- Multi-agency dashboards

- Real-time updates

- Data-dense operational views

This section defines how the Flutter frontend achieves performance
efficiency and horizontal scalability, particularly for Flutter Web,
which is the primary deployment target.

**11.1 Performance Objectives**

The frontend must meet the following targets:

- Initial page load \< 3 seconds (web, broadband)

- Dashboard update latency \< 2 seconds

- Ticket list scroll performance: 60 FPS target

- No UI freeze under large dataset loads

- Memory footprint optimized for long-running sessions

**11.2 Rendering Optimization Strategy**

**11.2.1 Avoid Full Widget Tree Rebuilds**

Use:

- Riverpod selective listening

- Consumer with specific providers

- Separate widgets for isolated updates

Example:

Consumer(\
builder: (context, ref, child) {\
final slaStatus = ref.watch(slaStatusProvider(ticketId));\
return SLAStatusBadge(status: slaStatus);\
},\
);

Only SLA badge rebuilds, not entire screen.

**11.2.2 Immutable State Updates**

State updates must:

- Use copyWith

- Avoid deep object mutation

- Replace only changed fields

This ensures predictable diff rendering.

**11.3 Large Data Handling**

**11.3.1 Pagination Mandatory**

Never load all tickets at once.

Use:

- Backend-driven pagination

- Infinite scroll or paginated table

- 20--50 items per page

**11.3.2 Virtual Scrolling**

For long lists:

- Use ListView.builder

- Use PaginatedDataTable

- Avoid Column with many children

Example:

ListView.builder(\
itemCount: state.tickets.length,\
itemBuilder: (context, index) {\
return TicketCard(ticket: state.tickets\[index\]);\
},\
);

**11.4 Dashboard Optimization**

Dashboards are data-heavy.

Strategies:

- Load metrics in parallel

- Render charts lazily

- Avoid unnecessary animations

- Throttle real-time updates

**11.4.1 Parallel Data Fetching**

Use Future.wait:

await Future.wait(\[\
getTicketMetrics(),\
getSLAMetrics(),\
getEscalationMetrics(),\
\]);

Reduces load time.

**11.5 Web Performance Optimization**

**11.5.1 Build Configuration**

For production:

- Enable tree shaking

- Enable minification

- Disable debug flags

- Use release mode only

Command:

flutter build web \--release

**11.5.2 Code Splitting Strategy**

Organize routes to support deferred loading (if applicable).

Heavy modules:

- Analytics

- Audit logs

- Reports

Load only when accessed.

**11.6 State Management Optimization**

**11.6.1 Scoped Providers**

Avoid global providers when unnecessary.

Use:

- Family providers

- AutoDispose where appropriate

Example:

final ticketDetailProvider =\
StateNotifierProvider.family\<TicketController, TicketState, String\>(\
(ref, ticketId) {\
return TicketController(ticketId);\
});

Prevents memory leaks.

**11.7 Memory Management**

**11.7.1 Dispose Controllers**

AutoDispose for:

- Detail screens

- Search controllers

- Temporary providers

**11.7.2 Avoid Large In-Memory Caches**

Safe to cache:

- Small agency lists

Avoid caching:

- Entire ticket history

- Full audit logs

**11.8 Real-Time Performance Control**

WebSocket updates can overwhelm UI.

Mitigation:

- Batch updates

- Debounce state refresh

- Update only affected entities

- Avoid full refetch

Example:

if (event.type == \"TICKET_UPDATED\") {\
updateSingleTicket(event.entityId);\
}

**11.9 Network Optimization**

**11.9.1 Reduce Payload Size**

Backend should:

- Avoid unnecessary fields

- Use pagination

- Provide summary endpoints for dashboards

Frontend must:

- Avoid requesting full ticket detail in list view

- Use summary DTO for list endpoints

**11.9.2 Request Deduplication**

Prevent duplicate calls:

- Use loading flags

- Cancel stale requests

- Debounce search input

Example:

Timer? \_debounce;

**11.10 SLA Countdown Efficiency**

Countdown timers must:

- Use periodic timer

- Avoid triggering full rebuild

- Update only countdown widget

Example:

Timer.periodic(const Duration(seconds: 1), (\_) {\
updateRemainingTime();\
});

Avoid multiple timers per screen.

**11.11 Scalability Strategy**

**11.11.1 Horizontal Scalability (Web)**

Frontend must:

- Be stateless (except UI state)

- Rely on backend scaling

- Support CDN deployment

- Avoid session stickiness

**11.11.2 Multi-Agency Load Handling**

Subscription filtering ensures:

- L1 sees only own agency tickets

- Supervisor sees aggregated stream

- Reduced data volume per user

**11.12 Long-Running Session Stability**

Command center operators may stay logged in for hours.

Mitigation:

- Periodic memory cleanup

- Auto refresh tokens

- Controlled WebSocket reconnection

- Avoid excessive logs in production

**11.13 Performance Monitoring**

Integrate:

- Performance logging

- Frame rate monitoring

- API response time tracking

Log slow requests \> 3 seconds.

**11.14 Stress Handling Strategy**

If backend under load:

- Show degraded state

- Reduce polling

- Disable heavy analytics temporarily

- Display system health banner

**11.15 Accessibility Performance**

Accessibility features must not:

- Block rendering

- Add heavy overlays

- Introduce reflow delays

Use semantic labels efficiently.

**11.16 Anti-Pattern Prevention**

Forbidden patterns:

- Large setState rebuilds

- Deep nested Consumer usage

- Massive synchronous loops in UI

- Heavy computation in build()

- Parsing JSON in presentation layer

**11.17 Performance Testing Strategy**

Test with:

- 10,000+ tickets dataset

- Simulated 100+ concurrent updates

- Web performance profiling

- Lighthouse audit (for web)

- Memory profiling

**11.18 Performance Architecture Diagram**

User Interaction\
↓\
Selective Provider Update\
↓\
Minimal Widget Rebuild\
↓\
Efficient Render

**11.19 Alignment with Enterprise Requirements**

This strategy ensures:

- Smooth dashboard experience

- Stable long-running sessions

- Large dataset handling

- Real-time responsiveness

- Scalable deployment

**11.20 Summary**

The eSCC Performance & Scalability Strategy ensures:

- Efficient rendering

- Controlled memory usage

- Smart real-time updates

- Web optimization

- Enterprise-scale reliability

- Stable multi-agency operations

The frontend is engineered to handle national-scale usage without
degradation.

**Section 12: Observability & Monitoring**

The eSCC frontend must provide enterprise-grade observability to
support:

- Operational monitoring

- Incident response

- Performance tracking

- Security auditing

- Production debugging

- Compliance reporting

Observability is not optional. It is a core requirement for a national
command center system.

**12.1 Observability Principles**

The frontend must:

- Log meaningful events

- Avoid logging sensitive data

- Correlate frontend and backend traces

- Capture performance metrics

- Capture error telemetry

- Provide structured logging

- Support production diagnostics

**12.2 Observability Architecture Overview**

User Action\
↓\
UI Event\
↓\
Logger\
↓\
Telemetry Service\
↓\
Monitoring Dashboard

Integrated with backend observability stack.

**12.3 Logging Architecture**

Located in:

core/logging/

Files:

logging/\
├── app_logger.dart\
├── log_event.dart\
├── correlation_id.dart\
└── log_levels.dart

**12.3.1 Log Levels**

Supported levels:

- DEBUG (development only)

- INFO

- WARNING

- ERROR

- CRITICAL

Production builds must:

- Disable DEBUG logs

- Avoid console spam

**12.3.2 Structured Log Format**

Logs must follow structured format:

{\
\"timestamp\": \"2026-02-24T14:20:00Z\",\
\"level\": \"INFO\",\
\"userId\": \"user-123\",\
\"action\": \"TICKET_ESCALATED\",\
\"ticketId\": \"TCK-456\",\
\"correlationId\": \"corr-789\"\
}

**12.4 Correlation ID Strategy**

Each session generates:

- Correlation ID

Included in:

- All API requests

- All logs

- WebSocket subscriptions

Location:

core/logging/correlation_id.dart

Used for:

- Backend trace linking

- Incident investigation

- SLA debugging

**12.5 Error Monitoring**

The frontend must capture:

- Unhandled exceptions

- API failures

- UI rendering errors

- WebSocket failures

- Token refresh failures

Error reporting integration options:

- Sentry

- Firebase Crashlytics

- Enterprise monitoring tool

**12.5.1 Global Error Handler**

Implemented at app root:

FlutterError.onError = (FlutterErrorDetails details) {\
AppLogger.error(details.exceptionAsString());\
};

**12.6 Performance Monitoring**

Metrics to track:

- Page load time

- API response time

- WebSocket connection time

- SLA countdown update performance

- Chart rendering time

Log slow API responses (\>3s).

Example:

if (responseTime \> 3000) {\
AppLogger.warning(\"Slow API response: \${responseTime}ms\");\
}

**12.7 User Activity Tracking**

Track key operational actions:

- Login

- Logout

- Ticket created

- Ticket escalated

- SLA override

- AI override

- Role change

- Agency reconfiguration

These logs:

- Feed audit system

- Enable compliance reporting

**12.8 Real-Time Monitoring**

Track:

- WebSocket connected/disconnected

- Reconnection attempts

- Subscription failures

- Event parsing errors

Show UI indicator:

- Green → Connected

- Yellow → Reconnecting

- Red → Disconnected

**12.9 Security Monitoring**

Log security events:

- Unauthorized route access

- Permission denial

- Token refresh failure

- Suspicious rapid requests

- Repeated failed login attempts

Never log:

- Passwords

- Full JWT tokens

- Sensitive citizen data

**12.10 SLA Monitoring Integration**

When SLA breaches occur:

- Log breach event

- Log time difference

- Log responsible agency

Supports backend SLA analytics.

**12.11 Analytics Telemetry (Non-Marketing)**

This is operational telemetry, not marketing analytics.

Track:

- Dashboard usage frequency

- Most accessed reports

- Filter usage patterns

- Feature adoption

Used for:

- System optimization

- Feature prioritization

- Capacity planning

**12.12 Production Logging Rules**

Production environment must:

- Suppress debug logs

- Avoid verbose network logging

- Log only critical operational events

- Obfuscate sensitive values

- Respect data protection policies

**12.13 Observability for Long Sessions**

Command center users may remain logged in for 8+ hours.

Monitor:

- Memory growth

- WebSocket stability

- Token refresh cycles

- Performance degradation over time

Log anomalies.

**12.14 Health Monitoring UI**

Optional Supervisor feature:

- Show system health panel

- Display API latency

- Display event stream health

- Show SLA risk trends

**12.15 Audit Trail Integration**

Frontend must:

- Send audit events

- Display audit logs

- Ensure timestamps consistent (UTC)

- Preserve integrity of event metadata

All timestamps standardized to ISO 8601.

**12.16 Compliance Logging Requirements**

Must support:

- Government data retention policies

- Non-repudiation

- Traceable user actions

- Exportable audit records

Frontend must ensure:

- No silent failure of audit submission

- Retry on temporary audit API failure

**12.17 Observability Testing**

Test cases:

- Simulate API timeout

- Simulate WebSocket drop

- Simulate token expiry

- Simulate SLA breach event

- Verify log output format

- Verify correlation ID inclusion

**12.18 Observability Architecture Diagram**

User Action\
↓\
Feature Controller\
↓\
AppLogger\
↓\
Telemetry API\
↓\
Monitoring System

All logging centralized through AppLogger.

**12.19 Observability Maturity Goals**

Level 1: Basic logging\
Level 2: Structured logs + correlation ID\
Level 3: Performance metrics + error reporting\
Level 4: Full trace integration across frontend and backend

Target: Level 4 maturity.

**12.20 Summary**

The eSCC Observability & Monitoring Strategy ensures:

- Full operational transparency

- Production-grade debugging capability

- SLA compliance monitoring

- Security event tracking

- Performance insight

- Audit-ready event logs

This enables reliable, accountable, and scalable national service
operations.

**Section 13: Testing Strategy**

The eSCC frontend must maintain high reliability, predictability, and
security.\
Testing is mandatory at every layer.

This strategy aligns with:

- SRS functional requirements

- TDD architectural design

- DDD domain modeling

- BED API contracts

Target test coverage:

- Minimum 80% domain layer coverage

- Critical flows at 100% coverage

**13.1 Testing Philosophy**

The frontend testing strategy follows:

- Test business logic first

- Keep UI tests focused on behavior

- Mock external dependencies

- Avoid brittle UI tests

- Validate error handling paths

- Test role-based access thoroughly

Testing layers:

1.  Unit Tests

2.  Widget Tests

3.  Integration Tests

4.  End-to-End (E2E) Tests

5.  Performance Tests

**13.2 Testing Pyramid**

E2E\
Integration\
Widget Tests\
Unit Tests

Most tests should be unit tests.

**13.3 Unit Testing**

**13.3.1 Domain Layer Testing (Highest Priority)**

Test:

- UseCases

- Entities

- Value objects

- Enum conversions

- Validation rules

- SLA calculations

- AI override logic

Example:

void main() {\
test(\'should escalate ticket successfully\', () async {\
final repository = MockTicketRepository();\
final useCase = EscalateTicketUseCase(repository);\
\
when(repository.escalate(any))\
.thenAnswer((\_) async =\> true);\
\
final result = await useCase(\"TCK-1\");\
\
expect(result, true);\
});\
}

**13.3.2 Mapper Testing**

Test:

- DTO → Domain mapping

- Null safety

- Enum conversion

- Invalid field handling

Example:

test(\'should map TicketDto to Ticket domain\', () {\
final dto = TicketDto(\
id: \'1\',\
title: \'Test\',\
description: \'Desc\',\
status: \'OPEN\',\
agencyId: \'A1\',\
createdBy: \'U1\',\
createdAt: \'2026-02-24T10:00:00Z\',\
);\
\
final ticket = TicketMapper.toDomain(dto);\
\
expect(ticket.status, TicketStatus.open);\
});

**13.4 Widget Testing**

Widget tests verify:

- UI behavior

- State rendering

- Error states

- Loading states

- Role-based UI rendering

Example:

testWidgets(\'shows loading indicator\', (tester) async {\
await tester.pumpWidget(\
ProviderScope(\
overrides: \[\
ticketControllerProvider.overrideWithValue(\
MockLoadingState(),\
),\
\],\
child: TicketListScreen(),\
),\
);\
\
expect(find.byType(LoadingIndicator), findsOneWidget);\
});

**13.5 Integration Testing**

Integration tests verify:

- Feature flow across layers

- Controller → UseCase → Repository

- API interaction with mock backend

- Pagination logic

- Real-time update handling

Example scenario:

- Login → Fetch Tickets → Escalate → Verify state update

**13.6 End-to-End (E2E) Testing**

For Flutter Web:

Use:

- integration_test package

- CI automation

Test scenarios:

- User login

- Ticket creation

- SLA breach display

- AI recommendation acceptance

- Role restriction enforcement

- Logout flow

**13.7 API Mocking Strategy**

Use:

- Mock Dio adapter

- Fake repositories

- Riverpod provider overrides

Never depend on live backend in CI.

Example:

final mockApiClient = MockApiClient();\
\
when(mockApiClient.get(\'/tickets\'))\
.thenAnswer((\_) async =\> fakeResponse);

**13.8 WebSocket Testing**

Test:

- Event handling

- Duplicate event filtering

- Reconnection logic

- Subscription management

Simulate events:

fakeWebSocket.emit({\
\"eventType\": \"TICKET_UPDATED\",\
\"entityId\": \"TCK-1\"\
});

Verify provider state updated correctly.

**13.9 Security Testing**

Test:

- Unauthorized route access blocked

- Permission-based UI rendering

- Token refresh handling

- Session timeout behavior

- Error sanitization

Example:

- Attempt to access /admin as L1 user → redirected

**13.10 Role-Based Testing Matrix**

Test for each role:

  ---------------------------------------------------------------------
  **Role**     **Dashboard**   **Ticket    **Escalation**   **Admin
                               Access**                     Panel**
  ------------ --------------- ----------- ---------------- -----------
  Citizen      Limited         Own only    No               No

  L1           Agency          Yes         Yes              No

  L2           Assigned        Yes         Limited          No

  Supervisor   Global          Yes         Yes              No

  Admin        All             Yes         Yes              Yes
  ---------------------------------------------------------------------

All combinations must be tested.

**13.11 Performance Testing**

Simulate:

- 10,000 ticket list

- Rapid WebSocket events

- Large audit log page

- Parallel API calls

Measure:

- Frame drops

- Memory usage

- Response times

**13.12 Accessibility Testing**

Verify:

- Screen reader compatibility

- Focus navigation

- Keyboard navigation (Web)

- Contrast ratio compliance

- Text scaling support

**13.13 CI/CD Test Pipeline**

Every pull request must:

- Run unit tests

- Run widget tests

- Check code coverage

- Enforce lint rules

- Fail on test failure

Pipeline stages:

Install Dependencies\
↓\
Static Analysis\
↓\
Unit Tests\
↓\
Widget Tests\
↓\
Integration Tests\
↓\
Build Check

**13.14 Code Coverage Requirements**

Minimum coverage:

- Domain Layer → 80%

- Critical workflows → 100%

- Overall project → 70%+

Coverage tool:

flutter test \--coverage

**13.15 Regression Testing**

Maintain test cases for:

- Ticket lifecycle

- SLA breach handling

- Escalation flows

- AI override flow

- Role enforcement

Prevents accidental feature breakage.

**13.16 Test Data Strategy**

Use:

- Factories

- Mock data builders

- JSON fixtures

Example:

TicketFactory.createOpenTicket();

Prevents repetitive test setup code.

**13.17 Failure Case Testing**

Mandatory tests for:

- Network timeout

- 401 Unauthorized

- 403 Forbidden

- 500 Server error

- Malformed JSON

- WebSocket disconnect

Ensure UI degrades gracefully.

**13.18 Anti-Patterns to Avoid**

- Testing implementation details instead of behavior

- Mocking too many internal classes

- UI pixel-perfect tests

- Relying on live APIs

- Skipping error path tests

**13.19 Test Maintenance Strategy**

- Refactor tests with feature changes

- Remove obsolete tests

- Keep tests readable

- Document complex test scenarios

- Review tests in code review process

**13.20 Summary**

The eSCC Testing Strategy ensures:

- High reliability

- Strong domain correctness

- Secure role enforcement

- Stable real-time handling

- Performance validation

- CI-enforced quality control

This approach guarantees production-grade confidence for a national
operational system.

**Section 14: CI/CD & Deployment Strategy**

The eSCC frontend must support:

- Secure and automated deployments

- Multi-environment configuration

- Zero-downtime updates (Web)

- Controlled mobile releases

- Government-grade change management

- Reproducible builds

This section defines how the Flutter application is built, tested,
versioned, and deployed across environments.

**14.1 Deployment Targets**

Primary target:

- Flutter Web (Command Center operations)

Secondary targets:

- Android (Field support)

- iOS (Supervisory and executive access)

Deployment must support:

- Dev

- Staging

- Production

**14.2 Environment Configuration Strategy**

Environment config stored in:

core/config/

Each environment defines:

- baseUrl

- WebSocket URL

- feature flags

- logging level

- analytics toggle

Example:

class AppConfig {\
final String apiBaseUrl;\
final String wsUrl;\
final bool enableLogging;\
final bool enableAnalytics;\
\
AppConfig({\
required this.apiBaseUrl,\
required this.wsUrl,\
required this.enableLogging,\
required this.enableAnalytics,\
});\
}

Injected at bootstrap.

**14.3 Environment Separation**

  -------------------------------------
  **Environment**   **Purpose**
  ----------------- -------------------
  Dev               Local development

  Staging           Pre-production
                    validation

  Production        Live government
                    system
  -------------------------------------

No cross-environment API usage allowed.

**14.4 CI/CD Pipeline Overview**

Automated pipeline stages:

Code Push\
↓\
Static Analysis\
↓\
Unit Tests\
↓\
Widget Tests\
↓\
Integration Tests\
↓\
Build (Web / Mobile)\
↓\
Artifact Storage\
↓\
Deployment

CI tools may include:

- GitHub Actions

- GitLab CI

- Azure DevOps

- Jenkins

**14.5 Static Analysis & Quality Gates**

Pipeline must enforce:

- flutter analyze

- Dart lint rules

- Code formatting

- Test coverage threshold

- No debug logs in production build

Fail build if:

- Tests fail

- Coverage drops below threshold

- Lint errors present

**14.6 Build Strategy**

**14.6.1 Web Build**

Command:

flutter build web \--release

Optimizations:

- Tree shaking

- Minification

- Obfuscation (optional)

- Disable debug flags

Artifacts:

build/web/

Deploy to:

- Government cloud

- Secure CDN

- Reverse-proxy backend gateway

**14.6.2 Android Build**

flutter build appbundle \--release

Security:

- Code obfuscation

- Secure signing key

- Play Store internal track (if used)

**14.6.3 iOS Build**

flutter build ios \--release

Security:

- Certificate signing

- App Store Connect distribution

- Enterprise distribution (if applicable)

**14.7 Versioning Strategy**

Use Semantic Versioning:

MAJOR.MINOR.PATCH

Example:

- 1.0.0 → Initial release

- 1.1.0 → New feature

- 1.1.1 → Bug fix

Version defined in:

pubspec.yaml

**14.8 Feature Flag Strategy**

Use environment-based feature toggles for:

- Experimental AI features

- New analytics dashboards

- Agency-specific modules

Feature flags stored in AppConfig.

Prevents risky deployments.

**14.9 Web Deployment Architecture**

User\
↓\
CDN\
↓\
Flutter Web Static Files\
↓\
API Gateway\
↓\
Microservices

Frontend remains stateless.

Supports horizontal scaling.

**14.10 Zero-Downtime Deployment (Web)**

Strategy:

- Deploy new build to parallel folder

- Switch CDN pointer

- Invalidate cache

- Monitor logs

Rollback plan:

- Restore previous build

- Re-point CDN

- Clear cache

**14.11 Secure Deployment Requirements**

- HTTPS only

- WSS only

- CSP headers enforced

- No debug builds in production

- Environment variables not exposed in code

Sensitive configuration must not be hardcoded.

**14.12 Mobile Release Strategy**

Mobile releases follow:

1.  Internal testing

2.  Staging validation

3.  Security review

4.  Production rollout

Rollout strategy:

- Phased rollout

- Monitor crash rate

- Rollback if anomaly detected

**14.13 Rollback Strategy**

Rollback triggers:

- Severe production bug

- Security vulnerability

- Performance degradation

- API incompatibility

Rollback plan:

- Revert to previous artifact

- Clear CDN cache

- Notify operations team

**14.14 Dependency Management**

Dependencies locked in:

pubspec.lock

Rules:

- No unreviewed package upgrades

- Security audit of third-party packages

- Use only maintained libraries

**14.15 Build Security Controls**

Prevent:

- Debug flags in release

- Exposed API keys

- Hardcoded credentials

- Dev URLs in production build

Add CI step to scan for:

- Secrets

- Console logs

- Insecure patterns

**14.16 Infrastructure as Code Alignment**

Frontend deployment must align with:

- Backend infrastructure

- Government cloud policies

- API Gateway configuration

- Load balancer setup

Frontend should not assume fixed IPs.

**14.17 Monitoring After Deployment**

After each deployment:

- Monitor error rate

- Monitor API latency

- Monitor WebSocket stability

- Monitor SLA dashboards

- Monitor user login rates

Deployments must include post-deployment validation checklist.

**14.18 Disaster Recovery Plan**

If system outage occurs:

- Show maintenance banner

- Display fallback status page

- Prevent data corruption

- Resume gracefully once backend restored

Frontend must handle backend downtime cleanly.

**14.19 CI/CD Governance**

All deployments must:

- Be traceable

- Be logged

- Have release notes

- Include ticket references

- Be approved for production

No direct production pushes.

**14.20 Summary**

The eSCC CI/CD & Deployment Strategy ensures:

- Secure and automated builds

- Controlled multi-environment deployment

- Zero-downtime web updates

- Safe mobile release cycles

- Rollback readiness

- Governance compliance

- Enterprise reliability

The deployment pipeline is engineered for stability, traceability, and
national-scale operational resilience.

**Section 15: Security Hardening Checklist**

The eSCC frontend operates in a national government context and must
meet strict security standards.

This section defines mandatory security hardening controls before
production deployment.

Security must be enforced at:

- Code level

- Build level

- Runtime level

- Deployment level

- Operational level

This checklist complements Section 4 (Authentication & Security
Architecture).

**15.1 Transport Security**

**15.1.1 HTTPS Enforcement**

- All API calls must use HTTPS

- All WebSocket connections must use WSS

- No HTTP fallback permitted

- Redirect HTTP to HTTPS at gateway level

**15.1.2 HSTS**

Enable HTTP Strict Transport Security at CDN / gateway:

- Prevent downgrade attacks

- Enforce HTTPS-only communication

**15.2 Authentication Hardening**

**15.2.1 JWT Handling**

- Access tokens short-lived

- Refresh tokens stored securely

- No tokens logged

- No tokens embedded in URLs (except secure WebSocket handshake)

**15.2.2 Token Storage**

Mobile:

- Use encrypted secure storage

Web:

- Prefer HTTP-only secure cookies

- Avoid storing raw JWT in localStorage if possible

**15.2.3 Token Refresh Controls**

- Automatic refresh before expiry

- Logout on refresh failure

- Clear session on unauthorized response

- Block parallel refresh race conditions

**15.3 Role-Based Access Control (RBAC)**

- Enforce route guards

- Enforce UI-level permission checks

- Hide unauthorized actions

- Block API calls for unauthorized roles

- Never rely solely on frontend validation

**15.4 Input Validation & Sanitization**

**15.4.1 Client-Side Validation**

Validate:

- Required fields

- String length limits

- File upload size

- Allowed file types

- Email format

- Escalation justification required

**15.4.2 XSS Protection**

- Never render raw HTML without sanitization

- Escape user-generated content

- Avoid dangerouslySetInnerHTML patterns (if using HTML rendering)

**15.4.3 Injection Protection**

- Do not build query strings manually

- Use queryParameters object in API calls

- Avoid string interpolation for URLs

**15.5 Content Security Policy (Web)**

Configure CSP headers:

- Restrict script sources

- Restrict frame embedding

- Prevent inline script execution

- Restrict WebSocket origins

Example policy:

default-src \'self\';\
connect-src https://api.escc.gov wss://api.escc.gov;

**15.6 File Upload Security**

- Validate file type before upload

- Restrict file size (e.g., max 10MB)

- Block executable formats

- Show clear error messages

- Never trust client-side validation alone

**15.7 Secure Error Handling**

Production builds must:

- Suppress stack traces

- Avoid exposing backend error details

- Show standardized error messages

- Log detailed errors internally only

Example allowed message:

\"Unable to process request. Please try again.\"

**15.8 Sensitive Data Protection**

Never log:

- Passwords

- Access tokens

- Refresh tokens

- National ID numbers

- Full ticket descriptions containing sensitive data

Mask sensitive identifiers where possible.

**15.9 Anti-Tampering Measures**

**15.9.1 Flutter Web**

- Use release build only

- Enable tree shaking

- Enable minification

- Disable debug mode

- Remove debug banners

**15.9.2 Mobile**

- Enable code obfuscation

- Secure signing certificates

- Detect rooted/jailbroken devices (optional)

- Disable screenshots on sensitive screens (optional)

**15.10 Session Management Hardening**

- Idle timeout enforced

- Warn user before auto logout

- Invalidate session on logout

- Clear storage completely

- Block concurrent session abuse if required

**15.11 WebSocket Security**

- Use WSS only

- Validate token during handshake

- Re-authenticate on token refresh

- Close connection on logout

- Do not subscribe to unauthorized channels

**15.12 Rate Limiting Awareness**

Frontend must:

- Handle 429 responses gracefully

- Avoid rapid repeat calls

- Debounce search input

- Prevent accidental spamming

**15.13 Dependency Security**

- Review third-party packages

- Remove unused packages

- Monitor CVE vulnerabilities

- Lock dependency versions

- Avoid abandoned libraries

Run periodic security audits.

**15.14 Secure Build Controls**

CI must check:

- No debug flags in release

- No dev URLs in production

- No console logs in release build

- No embedded secrets

- No test credentials

**15.15 Environment Isolation**

- Dev and staging URLs must never be accessible from production build

- Environment-specific configs injected at build time

- Feature flags controlled by environment

**15.16 Audit & Compliance Enforcement**

- All override actions logged

- All role changes logged

- All escalation actions logged

- All configuration changes logged

- Logs timestamped in UTC

**15.17 Anti-CSRF (Web)**

If using cookies:

- Enable SameSite=strict

- Use CSRF tokens if required by backend

- Validate origin headers

**15.18 Secure Routing**

- Prevent deep-linking into unauthorized routes

- Always validate role before rendering

- Redirect unauthorized users

- Log unauthorized access attempts

**15.19 Secure Logout**

Logout must:

- Invalidate backend session

- Clear tokens

- Clear WebSocket connection

- Clear cached state

- Redirect to login

**15.20 Security Hardening Checklist Summary**

Before production deployment, verify:

Transport:

- HTTPS enforced

- WSS enforced

- HSTS enabled

Authentication:

- Secure token storage

- Refresh logic validated

- Session timeout tested

RBAC:

- Route guards implemented

- UI permissions validated

- Unauthorized access blocked

Data Protection:

- Sensitive data not logged

- Error messages sanitized

- CSP headers configured

Code Security:

- Release build only

- Debug disabled

- Dependencies audited

- No secrets exposed

Operational:

- Audit logging enabled

- Monitoring configured

- Rollback plan ready

**15.21 Security Maturity Target**

Level 1 → Basic token auth\
Level 2 → RBAC enforced\
Level 3 → Secure storage + CSP + logging\
Level 4 → Full hardening + monitoring + compliance validation

Target: Level 4 before national deployment.

**15.22 Summary**

The eSCC Security Hardening Checklist ensures:

- Protection of citizen data

- Strong access control

- Secure communication

- Controlled deployment

- Audit readiness

- Regulatory compliance

Security is enforced across the full frontend lifecycle --- from code to
deployment to runtime operations.

**Section 16: Future Scalability Roadmap**

The eSCC frontend must be designed not only for current national
operations, but for long-term expansion.

This roadmap outlines how the Flutter frontend can evolve to support:

- Increased service complexity

- More government agencies

- Multi-tenant deployments

- Cross-border integrations

- Advanced AI automation

- Modular ecosystem growth

The roadmap aligns with long-term SRS evolution and backend microservice
expansion.

**16.1 Scalability Vision**

The frontend must evolve toward:

- Modular extensibility

- Microfrontend-style feature isolation

- Plugin-based agency onboarding

- Multi-tenant capability

- Configurable dashboards

- Internationalization readiness

- AI augmentation expansion

The architecture already supports this through:

- Feature-first modular design

- Clean Architecture

- Riverpod-based dependency injection

- Config-driven routing

**16.2 Microfrontend Readiness**

Although Flutter Web does not natively support microfrontends in the
traditional web sense, architectural preparation includes:

- Strict feature isolation

- No cross-feature direct imports

- Independent module registration

- Route-level separation

Future capability:

- Lazy-load heavy modules

- Split analytics or audit modules into separately deployable artifacts
  (if framework allows)

- Modular build configurations per agency cluster

**16.3 Multi-Tenant Architecture Support**

Future scenario:

- eSCC deployed for multiple counties or ministries

- Each tenant with custom SLA policies

- Agency-specific UI branding

Preparation steps:

- Tenant ID in AppConfig

- Tenant-scoped API base URL

- Feature flags per tenant

- Theming per tenant

- Agency-level permission matrix

Frontend must avoid hardcoded national assumptions.

**16.4 Plugin-Based Agency Modules**

Future agencies may require:

- Custom dashboards

- Custom SLA metrics

- Custom workflows

- Custom knowledge categories

Scalable approach:

features/\
├── core_modules/\
├── agency_plugins/\
│ ├── immigration_plugin/\
│ ├── health_plugin/\
│ └── transport_plugin/

Each plugin:

- Registers routes

- Registers providers

- Extends dashboards

- Injects configuration

This supports incremental onboarding of new government entities.

**16.5 Advanced AI Expansion**

Future AI enhancements may include:

- Predictive SLA breach forecasting

- Sentiment analysis of citizen complaints

- Auto-prioritization scoring

- Automated response suggestion

- Chatbot-based ticket submission

- Risk clustering across agencies

Frontend preparation:

- Keep AIRecommendation extensible

- Support expandable explanation panels

- Prepare dashboard for predictive indicators

- Allow AI model version display (optional)

**16.6 Real-Time Intelligence Expansion**

Future upgrades:

- Real-time performance heat maps

- Cross-agency risk alerts

- Incident clustering visualization

- Command center alert console

Frontend must support:

- Dynamic dashboard widgets

- Configurable alert thresholds

- Expandable analytics components

**16.7 Configurable Dashboards**

Future requirement:

- Supervisor can configure dashboard layout

- Drag-and-drop widgets

- Save custom views

- Agency-specific dashboard templates

Preparation:

- Modular widget system

- Widget registry

- Dynamic layout engine

**16.8 Internationalization & Localization**

Preparation already includes:

l10n/

Future needs:

- Multi-language support (English, Swahili, others)

- RTL support (if required)

- Local date/time formatting

- Locale-specific SLA rules

Frontend must avoid hardcoded strings.

**16.9 Mobile-First Expansion**

Future enhancements for mobile:

- Offline ticket drafting

- Push notifications for SLA breach

- Field inspection integration

- Camera-based evidence upload

- Location tagging for service issues

Preparation:

- Modular notification service

- Attachment handling abstraction

- Location permission handling module

**16.10 API Evolution Readiness**

Backend may introduce:

- GraphQL endpoints

- Streaming APIs

- New microservices

- Enhanced analytics APIs

Frontend must:

- Keep API client abstracted

- Avoid tight coupling to endpoint structure

- Maintain DTO mapping flexibility

- Support versioned API endpoints

**16.11 Multi-Region Deployment**

Future national scale:

- Deploy per region

- Regional dashboards

- Data residency compliance

Frontend preparation:

- Configurable region parameter

- Region-based filtering

- No assumption of single national dataset

**16.12 Accessibility Enhancement Roadmap**

Future enhancements:

- Voice navigation

- High-contrast theme mode

- AI-based accessibility assistant

- Screen-reader optimized workflows

Maintain compliance with evolving accessibility standards.

**16.13 Performance Scaling Roadmap**

As usage grows:

- Improve code splitting

- Optimize bundle size

- Advanced caching strategies

- Intelligent data prefetching

- Background data sync

Frontend must remain lean and modular.

**16.14 Security Evolution**

Future security upgrades:

- Multi-factor authentication (MFA)

- Biometric login (mobile)

- Hardware-backed token storage

- Device binding

- Behavioral anomaly detection

Frontend must maintain extensible authentication architecture.

**16.15 Observability Maturity Expansion**

Future observability features:

- Full distributed tracing

- Real-time performance dashboards

- Automated anomaly detection

- SLA breach prediction dashboards

Frontend must maintain structured logging discipline.

**16.16 Governance & Workflow Automation**

Future automation:

- Automated escalation routing

- Policy-based ticket reassignment

- SLA auto-adjustment based on workload

- Configurable workflow engine

Frontend must:

- Support dynamic workflow state transitions

- Render state machine-driven UI

- Avoid hardcoded workflow assumptions

**16.17 Integration with National Digital Platforms**

Future integration possibilities:

- eCitizen core services

- National identity system

- Digital payment gateway

- SMS notification service

- Email service

- Government document management systems

Frontend must remain integration-ready.

**16.18 Long-Term Maintainability Strategy**

Ensure:

- Strict adherence to Clean Architecture

- Periodic dependency upgrades

- Continuous refactoring

- Automated testing coverage maintained

- Documentation updated

- Engineering governance enforced

**16.19 Architectural Evolution Path**

Current → Modular Monolith Frontend\
Next → Modular Feature Plugins\
Future → Distributed Microfrontend Federation (if supported by
ecosystem)

The system is designed to evolve without architectural rewrite.

**16.20 Roadmap Summary**

The eSCC frontend is designed to support:

- National scale

- Multi-agency growth

- Multi-tenant deployment

- AI expansion

- Advanced analytics

- Configurable dashboards

- Security evolution

- International expansion

- Long-term maintainability

The architecture choices made in Sections 1--15 ensure that the platform
can scale functionally, operationally, and structurally without
fundamental redesign.
