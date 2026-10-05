import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { KpiCollection, Project, ProjectPermission, Role } from '@kpi/shared';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  orgId: string;
  passwordHash: string;
  createdAt: string;
}

export interface OrgRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface RefreshTokenRecord {
  hash: string;
  userId: string;
  expiresAt: number;
  /** Token family for rotation; reuse of a rotated token revokes the family. */
  family: string;
  revoked: boolean;
}

export interface MemberRecord {
  projectId: string;
  userId: string;
  permission: ProjectPermission;
}

export interface AuditRecord {
  id: string;
  at: string;
  userId?: string;
  orgId?: string;
  action: string;
  target?: string;
  /** Never contains confidential project content — identifiers and action names only. */
  meta?: Record<string, string | number | boolean>;
}

export interface PushTokenRecord {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  updatedAt: string;
}

export interface DataShape {
  orgs: OrgRecord[];
  users: UserRecord[];
  refreshTokens: RefreshTokenRecord[];
  projects: Project[];
  members: MemberRecord[];
  collections: (KpiCollection & { ownerId: string })[];
  audit: AuditRecord[];
  pushTokens: PushTokenRecord[];
}

const empty = (): DataShape => ({ orgs: [], users: [], refreshTokens: [], projects: [], members: [], collections: [], audit: [], pushTokens: [] });

/**
 * Minimal persistence layer: in-memory with atomic JSON snapshots.
 * Repositories access data only through this class, so swapping to Postgres
 * (recommended for production; schema in docs/ARCHITECTURE.md) is a contained change.
 */
export class Store {
  data: DataShape;
  private file?: string;
  private timer?: NodeJS.Timeout;

  constructor(dataDir?: string) {
    if (dataDir) {
      mkdirSync(dataDir, { recursive: true });
      this.file = join(dataDir, 'db.json');
      this.data = existsSync(this.file) ? { ...empty(), ...JSON.parse(readFileSync(this.file, 'utf8')) } : empty();
    } else {
      this.data = empty();
    }
  }

  /** Debounced atomic write (write temp file then rename). */
  save() {
    if (!this.file) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 50);
  }

  flush() {
    if (!this.file) return;
    clearTimeout(this.timer);
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
}
