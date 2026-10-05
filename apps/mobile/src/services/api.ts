import Constants from 'expo-constants';
import type { AiContext, AiResponse, AuthTokens, Diagnosis, ExecutiveSummary, Kpi, KpiCollection, Project, PublicUser, Source } from '@kpi/shared';
import { secureStorage } from '@/lib/storage';
import { useSettings } from '@/state/settings';

const TOKENS_KEY = 'kpi.auth.tokens';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const apiBaseUrl = () =>
  (useSettings.getState().apiUrl || (Constants.expoConfig?.extra?.apiUrl as string | undefined) || 'http://localhost:4000').replace(/\/$/, '');

let tokens: AuthTokens | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | undefined;

export const tokenStore = {
  async load() {
    const raw = await secureStorage.get(TOKENS_KEY);
    tokens = raw ? (JSON.parse(raw) as AuthTokens) : null;
    return tokens;
  },
  async save(t: AuthTokens) {
    tokens = t;
    await secureStorage.set(TOKENS_KEY, JSON.stringify(t));
  },
  async clear() {
    tokens = null;
    await secureStorage.remove(TOKENS_KEY);
  },
  has: () => Boolean(tokens),
  onExpired(cb: () => void) {
    onSessionExpired = cb;
  },
};

async function refreshTokens(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetchWithTimeout(`${apiBaseUrl()}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
      });
      if (!res.ok) {
        await tokenStore.clear();
        onSessionExpired?.();
        return false;
      }
      const body = (await res.json()) as { tokens: AuthTokens };
      await tokenStore.save(body.tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  formData?: FormData;
}

export async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth && tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${apiBaseUrl()}${path}`,
      { method: opts.method ?? 'GET', headers, body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) },
      opts.timeoutMs,
    );
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection.');
  }
  if (res.status === 401 && opts.auth && !retried && (await refreshTokens())) return request<T>(path, opts, true);
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

// ---------- Typed endpoints ----------
type AuthResult = { user: PublicUser; tokens: AuthTokens };

export const api = {
  login: (email: string, password: string) => request<AuthResult>('/v1/auth/login', { method: 'POST', body: { email, password } }),
  register: (name: string, email: string, password: string, orgName?: string) =>
    request<AuthResult>('/v1/auth/register', { method: 'POST', body: { name, email, password, orgName } }),
  logout: (refreshToken: string) => request<{ ok: boolean }>('/v1/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => request<{ user: PublicUser }>('/v1/me', { auth: true }),
  currentRefreshToken: () => tokens?.refreshToken,

  syncKpis: (version?: string) =>
    request<{ version: string; kpis: Kpi[]; sources: Source[] } | undefined>(`/v1/kpis/sync${version ? `?version=${encodeURIComponent(version)}` : ''}`, { timeoutMs: 30_000 }),

  chat: (message: string, context: AiContext, history: { role: 'user' | 'assistant'; text: string }[]) =>
    request<AiResponse>('/v1/ai/chat', { method: 'POST', body: { message, context, history }, auth: true, timeoutMs: 75_000 }),

  analyzeDocument: (file: { uri: string; name: string; mimeType: string }) => {
    const form = new FormData();
    // React Native FormData accepts { uri, name, type } file descriptors.
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    return request<{ found: number; summary: string; items: { name: string; kpiId?: string; indicator?: string }[] }>('/v1/ai/documents', {
      method: 'POST',
      formData: form,
      auth: true,
      timeoutMs: 90_000,
    });
  },

  diagnose: (kpiId: string, from?: number, to?: number) => request<Diagnosis>('/v1/diagnostics', { method: 'POST', body: { kpiId, from, to } }),

  listProjects: () => request<{ projects: Project[] }>('/v1/projects', { auth: true }),
  putProject: (p: Project) => request<{ project: Project; conflict: boolean }>(`/v1/projects/${encodeURIComponent(p.id)}`, { method: 'PUT', body: p, auth: true }),
  deleteProject: (id: string) => request<{ ok: boolean }>(`/v1/projects/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
  summary: (id: string) => request<ExecutiveSummary>(`/v1/projects/${encodeURIComponent(id)}/summary`, { auth: true }),

  listCollections: () => request<{ collections: KpiCollection[] }>('/v1/collections', { auth: true }),
  putCollection: (c: KpiCollection) => request<{ collection: KpiCollection }>(`/v1/collections/${encodeURIComponent(c.id)}`, { method: 'PUT', body: c, auth: true }),
  deleteCollection: (id: string) => request<{ ok: boolean }>(`/v1/collections/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),

  registerPushToken: (token: string, platform: 'ios' | 'android' | 'web') =>
    request<{ ok: boolean }>('/v1/notifications/push-token', { method: 'POST', body: { token, platform }, auth: true }),
};
