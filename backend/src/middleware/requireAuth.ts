import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';

interface AccessTokenPayload {
  sub: string;
  role: string;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Missing or malformed Authorization header', 'AUTH_TOKEN_INVALID', 401);
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
    throw new AppError(
      isExpired ? 'Access token expired' : 'Invalid access token',
      isExpired ? 'AUTH_TOKEN_EXPIRED' : 'AUTH_TOKEN_INVALID',
      401,
    );
  }
};
