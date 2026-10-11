import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db, verifyPassword, User } from './db.ts';

// In-memory active session token store (token -> { userId, role, expiresAt })
interface Session {
  userId: string;
  role: 'admin' | 'manager' | 'agent' | 'customer';
  managerId?: string;
  agentId?: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
      managerId = agt.managerId || 'mgr_alpha';
    }
  }

  const session: Session = {
    userId: user.id,
    role: user.role,
    managerId,
    agentId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };

  sessions.set(token, session);
  return { token, session };
}

export function getSession(token: string): Session | undefined {
  return sessions.get(token);
}

export function revokeSession(token: string): void {
  sessions.delete(token);
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
  const session = sessions.get(token);

  if (!session || Date.now() > session.expiresAt) {
    if (session) sessions.delete(token);
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  const data = db.get();
  const user = data.users.find((u) => u.id === session.userId);

  if (!user || !user.enabled) {
    sessions.delete(token);
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
