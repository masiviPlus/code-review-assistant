import { env } from './config/env';
import { createApp } from './app';
import { connectDB, registerShutdownHooks } from './db/connection';
import pino from 'pino';

const logger = pino({ name: 'server', level: env.LOG_LEVEL });

async function main() {
  await connectDB(env.MONGODB_URI);
  logger.info('Connected to MongoDB');
  registerShutdownHooks();

  const app = createApp();

  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
