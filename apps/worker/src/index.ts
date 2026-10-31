import * as dotenv from 'dotenv';
import { NotificationWorker } from './daemon';

dotenv.config();

export * from './daemon';
export * from './polling/outbox-poller';
export * from './processors/event-processor';
export * from './processors/retry';
export * from './adapters';

// If executed directly (not in test runner or as an imported module)
const isDirectExecution =
  process.env.NODE_ENV !== 'test' &&
  !process.env.VITEST &&
  (process.argv[1]?.endsWith('index.ts') ||
    process.argv[1]?.endsWith('index.js') ||
    process.argv[1]?.includes('/apps/worker'));

if (isDirectExecution) {
  const worker = new NotificationWorker();
  worker.setupSignalHandlers();
  worker.start();
}
