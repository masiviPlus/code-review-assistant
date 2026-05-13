import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import pino from 'pino';
import healthRouter from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

export function createApp(options?: { silent?: boolean }) {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );

  app.use(express.json());

  if (!options?.silent) {
    app.use(
      pinoHttp({
        logger: pino({ level: process.env.LOG_LEVEL ?? 'info' }),
      }),
    );
  }

  app.use('/api', healthRouter);

  app.use(errorHandler);

  return app;
}
