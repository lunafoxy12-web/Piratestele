import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, verifyPassword, User } from './db.ts';

// Persistent & In-memory active session token store (token -> { token, userId, role, expiresAt })
export interface Session {
  token: string;
  userId: string;
  role: 'admin' | 'manager' | 'agent' | 'customer';
  managerId?: string;
  agentId?: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days persistent cache

// Hydrate sessions from persistent database on startup
function hydrateSessions() {
  try {
    const data = db.get();
    if (Array.isArray(data.sessions)) {
      const now = Date.now();
      for (const s of data.sessions) {
        if (s.expiresAt > now && s.token) {
          sessions.set(s.token, s);
        }
      }
      if (sessions.size > 0) {
        console.log(`[AUTH] Hydrated ${sessions.size} active sessions from database`);
      }
    }
  } catch (err) {
    console.warn('[AUTH] Session hydration note:', err);
  }
}
hydrateSessions();

export function createSession(user: User): { token: string; session: Session } {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  let managerId: string | undefined;
  let agentId: string | undefined;

  const data = db.get();
  if (user.role === 'manager') {
    const mgr = data.managers.find((m) => m.userId === user.id || m.id === user.id);
    managerId = mgr ? mgr.id : 'mgr_alpha';
  } else if (user.role === 'admin') {
    managerId = 'mgr_alpha';
  } else if (user.role === 'agent') {
    const agt = data.agents.find(
      (a) =>
        a.userId === user.id ||
        a.id === user.id ||
        (a.username && a.username.toLowerCase() === user.username.toLowerCase()) ||
        (a.name && a.name.toLowerCase() === user.username.toLowerCase())
    );
    if (agt) {
      agentId = agt.id;
      managerId = agt.managerId || (user as any).managerId || 'mgr_alpha';
    } else {
      agentId = (user as any).agentId || user.id;
      managerId = (user as any).managerId || 'mgr_alpha';
    }
  }

  const session: Session = {
    token,
    userId: user.id,
    role: user.role,
    managerId,
    agentId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessions.set(token, session);

  // Persist session into database so server restarts or recompiles never kick user out
  db.update((d) => {
    d.sessions = [...(d.sessions || []).filter((s) => s.expiresAt > now), session];
  }).catch(() => {});

  return { token, session };
}

export function getSession(token: string): Session | undefined {
  if (sessions.has(token)) return sessions.get(token);
  // Check persistent DB in case server recently restarted
  const dbSession = (db.get().sessions || []).find((s) => s.token === token && s.expiresAt > Date.now());
  if (dbSession) {
    sessions.set(token, dbSession);
    return dbSession;
  }
  return undefined;
}

export function revokeSession(token: string): void {
  sessions.delete(token);
  db.update((d) => {
    d.sessions = (d.sessions || []).filter((s) => s.token !== token);
  }).catch(() => {});
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionInfo?: Session;
  managerId?: string;
  agentId?: string;
}

// Authentication Middleware
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token.' });
  }

  const token = authHeader.substring(7).trim();
  const session = getSession(token);

  if (!session || Date.now() > session.expiresAt) {
    if (session) revokeSession(token);
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  const data = db.get();
  const user = data.users.find((u) => u.id === session.userId);

  if (!user || !user.enabled) {
    revokeSession(token);
    return res.status(403).json({ error: 'User account is disabled or does not exist.' });
  }

  req.user = user;
  req.sessionInfo = session;
  req.managerId = session.managerId;
  req.agentId = session.agentId;

  next();
}

// RBAC Middleware
export function requireRole(allowedRoles: Array<'admin' | 'manager' | 'agent' | 'customer'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access this resource.',
      });
    }
    next();
  };
}

// Audit logger helper
export async function logAudit(
  actor: string,
  actorRole: string,
  action: string,
  resource: string,
  metadata?: Record<string, any>,
  ipAddress?: string
) {
  await db.update((d) => {
    d.audit_logs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      actor,
      actorRole,
      action,
      resource,
      timestamp: new Date().toISOString(),
      ipAddress,
      metadata,
    });
    // Keep last 1000 audit records
    if (d.audit_logs.length > 1000) {
      d.audit_logs = d.audit_logs.slice(0, 1000);
    }
  });
}
