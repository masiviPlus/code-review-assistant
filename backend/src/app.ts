import 'express-async-errors';
import express from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import healthRouter from './routes/health';
import { errorHandler } from './middleware/errorHandler';

export function createApp(options?: { silent?: boolean }) {
  const app = express();

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
