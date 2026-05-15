import { RequestHandler } from 'express';
import { AppError } from '../errors/AppError';

export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 'AUTH_FORBIDDEN', 403);
    }
    next();
  };
}
