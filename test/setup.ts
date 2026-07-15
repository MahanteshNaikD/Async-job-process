import { Logger } from '@nestjs/common';

/**
 * Silence Nest Logger during unit/integration tests so intentional
 * failure-path logs (e.g. enqueue_failed) do not look like real failures.
 */
beforeAll(() => {
  Logger.overrideLogger(false);
});
