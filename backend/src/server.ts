import { env } from './config/env';
import { createApp } from './app';
import mongoose from 'mongoose';
import pino from 'pino';

const logger = pino({ name: 'server', level: env.LOG_LEVEL });

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info('Connected to MongoDB');

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
