import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';
import { AccessTypeEnum } from '../../modules/audit/dto/audit.dto';

// Maps API path → entityType (and optionally extracts entityId from a regex group).
// Order matters: first match wins. List the more-specific patterns first.
const PATH_TO_ENTITY: Array<{
  pattern: RegExp;
  entityType: (m: RegExpMatchArray) => string;
  entityIdGroup?: number;
}> = [
  // /api/v1/users[/:id]
  { pattern: /^\/api\/v1\/users(?:\/([^/?]+))?/, entityType: (m) => (m[1] ? 'USER' : 'USER_LIST'), entityIdGroup: 1 },
  // /api/v1/agencies[/:id]
  { pattern: /^\/api\/v1\/agencies(?:\/([^/?]+))?/, entityType: (m) => (m[1] ? 'AGENCY' : 'AGENCY_LIST'), entityIdGroup: 1 },
  // /api/v1/tickets[/:id] — already logged inside the service, but the interceptor
  // is a safety net for any path the service doesn't cover.
  { pattern: /^\/api\/v1\/tickets(?:\/([^/?]+))?/, entityType: (m) => (m[1] ? 'TICKET' : 'TICKET_LIST'), entityIdGroup: 1 },
  // /api/v1/knowledge-base[/:id]
  { pattern: /^\/api\/v1\/knowledge-base(?:\/([^/?]+))?/, entityType: (m) => (m[1] ? 'KB_ARTICLE' : 'KB_LIST'), entityIdGroup: 1 },
  // /api/v1/sla[/:id]
  { pattern: /^\/api\/v1\/sla(?:\/([^/?]+))?/, entityType: (m) => (m[1] ? 'SLA_POLICY' : 'SLA_LIST'), entityIdGroup: 1 },
  // /api/v1/meetings[/:id]
  { pattern: /^\/api\/v1\/meetings(?:\/([^/?]+))?/, entityType: (m) => (m[1] ? 'MEETING' : 'MEETING_LIST'), entityIdGroup: 1 },
  // /api/v1/calls[/:id]
  { pattern: /^\/api\/v1\/calls(?:\/([^/?]+))?/, entityType: (m) => (m[1] ? 'CALL' : 'CALL_LIST'), entityIdGroup: 1 },
  // /api/v1/admin/<resource>[/...] — admin dashboard / metrics / policies / etc.
  { pattern: /^\/api\/v1\/admin\/([^/?]+)/, entityType: (m) => `ADMIN_${m[1].toUpperCase()}` },
  // /api/v1/reporting/...
  { pattern: /^\/api\/v1\/reporting/, entityType: () => 'REPORT' },
  // /api/v1/ai/...
  { pattern: /^\/api\/v1\/ai/, entityType: () => 'AI' },
  // /api/v1/ml/...
  { pattern: /^\/api\/v1\/ml/, entityType: () => 'ML' },
  // /api/v1/workflow/...
  { pattern: /^\/api\/v1\/workflow/, entityType: () => 'WORKFLOW' },
  // /api/v1/chat/...
  { pattern: /^\/api\/v1\/chat/, entityType: () => 'CHAT' },
];

// Endpoints we never want to log:
//   - audit endpoints (would create infinite recursion)
//   - health probes (k8s polls these)
//   - notifications (typically polled every few seconds by the client)
//   - auth/me / auth/refresh (every page load triggers these)
//   - media downloads (usually static/binary assets)
const SKIP_PREFIXES = [
  '/api/v1/audit',
  '/api/v1/health',
  '/api/v1/notifications',
  '/api/v1/auth/me',
  '/api/v1/auth/refresh',
  '/api/v1/auth/session',
  '/api/v1/media',
  '/api/v1/uploads',
];

interface AuthedRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
  user?: { sub?: string; agencyId?: string };
}

@Injectable()
export class DataAccessInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DataAccessInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const method = (req.method ?? '').toUpperCase();
    const rawPath = (req.originalUrl ?? req.url ?? '').split('?')[0];

    if (method !== 'GET') return next.handle();
    if (!req.user?.sub) return next.handle();
    if (SKIP_PREFIXES.some((p) => rawPath.startsWith(p))) return next.handle();

    let entityType: string | null = null;
    let entityId: string | undefined;

    for (const route of PATH_TO_ENTITY) {
      const m = rawPath.match(route.pattern);
      if (m) {
        entityType = route.entityType(m);
        if (route.entityIdGroup && m[route.entityIdGroup]) {
          entityId = m[route.entityIdGroup];
        }
        break;
      }
    }

    if (!entityType) return next.handle();

    // Distinguish exports from plain reads so the table is more useful.
    const accessType = rawPath.includes('/export')
      ? AccessTypeEnum.EXPORT
      : AccessTypeEnum.READ;

    const userId = req.user.sub;
    const agencyId = req.user.agencyId;

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .logDataAccess({
            userId,
            agencyId,
            entityType: entityType as string,
            entityId,
            accessType,
          })
          .catch((err: Error) => {
            this.logger.warn(`Data access log failed: ${err.message}`);
          });
      }),
    );
  }
}
