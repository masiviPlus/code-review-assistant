import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import pino from 'pino';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import submissionsRouter from './routes/submissions';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

export function createApp(options?: { silent?: boolean }) {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(cookieParser());

  if (!options?.silent) {
    app.use(
      pinoHttp({
        logger: pino({ level: process.env.LOG_LEVEL ?? 'info' }),
      }),
    );
  }

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/submissions', submissionsRouter);

  app.use(errorHandler);

  return app;
}
