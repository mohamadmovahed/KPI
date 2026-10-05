import type { FastifyReply, FastifyRequest } from 'fastify';
import { KnowledgeBase, type ProjectPermission, type Role } from '@kpi/shared';
import type { Config } from '../config';
import { verifyAccessToken, type AccessClaims } from './crypto';
import type { AuditRecord, Store } from '../store/store';
import type { AiOrchestrator } from '../ai/orchestrator';

export interface AppContext {
  config: Config;
  store: Store;
  kb: KnowledgeBase;
  ai: AiOrchestrator;
  audit: (entry: Omit<AuditRecord, 'id' | 'at'>) => void;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessClaims;
  }
}

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export function makeAuthHooks(ctx: AppContext) {
  const authenticate = async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Missing bearer token');
    try {
      req.user = await verifyAccessToken(header.slice(7), ctx.config.jwtSecret);
    } catch {
      throw new HttpError(401, 'Invalid or expired token');
    }
  };

  const requireRole =
    (...roles: Role[]) =>
    async (req: FastifyRequest, _reply: FastifyReply) => {
      await authenticate(req);
      if (!roles.includes(req.user!.role)) throw new HttpError(403, 'Insufficient role');
    };

  return { authenticate, requireRole };
}

const rank: Record<ProjectPermission, number> = { viewer: 1, editor: 2, owner: 3 };

/** Project-level permission check, scoped to the caller's organisation. */
export function assertProjectAccess(ctx: AppContext, userId: string, orgId: string, projectId: string, needed: ProjectPermission) {
  const project = ctx.store.data.projects.find((p) => p.id === projectId);
  // 404 (not 403) for other orgs' projects to avoid leaking existence.
  if (!project || project.orgId !== orgId) throw new HttpError(404, 'Project not found');
  const member = ctx.store.data.members.find((m) => m.projectId === projectId && m.userId === userId);
  if (!member || rank[member.permission] < rank[needed]) throw new HttpError(project && member ? 403 : 404, member ? 'Insufficient project permission' : 'Project not found');
  return project;
}
