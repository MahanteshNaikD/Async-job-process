export enum JobStatus {
  Queued = 'queued',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Retrying = 'retrying',
  Delayed = 'delayed',
  Cancelled = 'cancelled',
  DeadLetter = 'dead_letter',
}
