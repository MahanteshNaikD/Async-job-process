export interface JobHandlerContext {
  jobId: string;
  type: string;
  attempt: number;
  maxAttempts: number;
}

export interface JobHandler {
  /** Job type this handler owns (e.g. email.send). */
  readonly type: string;
  handle(
    payload: Record<string, unknown>,
    ctx: JobHandlerContext,
  ): Promise<Record<string, unknown> | void>;
}

export const JOB_HANDLERS = Symbol('JOB_HANDLERS');
