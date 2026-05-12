import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'error-handler' });

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues,
      },
    });
    return;
  }

  const appErr = err as AppError;
  const statusCode = appErr.statusCode ?? 500;
  const code = appErr.code ?? 'INTERNAL_ERROR';
  const message =
    statusCode === 500 ? 'Internal server error' : appErr.message;

  if (statusCode === 500) {
    logger.error({ err }, 'Unhandled error');
  }

  res.status(statusCode).json({
    ok: false,
    error: { code, message },
  });
};
