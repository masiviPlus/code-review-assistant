import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export async function connectDB(uri: string): Promise<typeof mongoose> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(uri);
      return conn;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

export function registerShutdownHooks(): void {
  const graceful = async () => {
    await mongoose.connection.close();
    process.exit(0);
  };

  process.on('SIGTERM', graceful);
  process.on('SIGINT', graceful);
}
