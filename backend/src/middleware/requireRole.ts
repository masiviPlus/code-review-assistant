import { RequestHandler } from 'express';

export function requireRole(...roles: string[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const err = new Error('Insufficient permissions') as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 403;
      err.code = 'AUTH_FORBIDDEN';
      throw err;
    }
    next();
  };
}
