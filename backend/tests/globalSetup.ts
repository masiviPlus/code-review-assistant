import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Downloads the MongoDB binary once before any test suite starts.
 * Without this, parallel suites race to download the same binary
 * and CI runners frequently time out on the duplicate download.
 */
export default async function globalSetup() {
  const server = await MongoMemoryServer.create();
  await server.stop();
}
