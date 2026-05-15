import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';

interface AccessTokenPayload {
  sub: string;
  role: string;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    const err = new Error('Missing or malformed Authorization header') as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 401;
    err.code = 'AUTH_TOKEN_INVALID';
    throw err;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    req.user = {
      userId: new Types.ObjectId(payload.sub),
      role: payload.role,
    };
    next();
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    const appErr = new Error(isExpired ? 'Access token expired' : 'Invalid access token') as Error & {
      statusCode: number;
      code: string;
    };
    appErr.statusCode = 401;
    appErr.code = isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID';
    throw appErr;
  }
};
