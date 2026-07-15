import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ConsoleLogger, LogLevel, LoggerService } from '@nestjs/common';

export type LogAppName = 'api' | 'worker';

export interface FileLoggerOptions {
  app: LogAppName;
  /** Directory for log files (default: LOG_DIR env or `logs`). */
  dir?: string;
  /** Also write to stdout (default true). */
  console?: boolean;
  logLevels?: LogLevel[];
}

/**
 * Nest logger that mirrors every log line to `logs/<app>.log` (JSONL).
 */
export class FileLogger extends ConsoleLogger implements LoggerService {
  private readonly filePath: string;
  private readonly writeConsole: boolean;

  constructor(options: FileLoggerOptions) {
    super(options.app.toUpperCase(), {
      logLevels: options.logLevels ?? ['log', 'error', 'warn', 'debug', 'verbose'],
    });
    this.writeConsole = options.console !== false;
    const dir = options.dir ?? process.env.LOG_DIR ?? join(process.cwd(), 'logs');
    mkdirSync(dir, { recursive: true });
    this.filePath = join(dir, `${options.app}.log`);
  }

  get path(): string {
    return this.filePath;
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFile('log', message, optionalParams);
    if (this.writeConsole) super.log(message as string, ...optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFile('error', message, optionalParams);
    if (this.writeConsole) super.error(message as string, ...optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFile('warn', message, optionalParams);
    if (this.writeConsole) super.warn(message as string, ...optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFile('debug', message, optionalParams);
    if (this.writeConsole) super.debug?.(message as string, ...optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.writeFile('verbose', message, optionalParams);
    if (this.writeConsole) super.verbose?.(message as string, ...optionalParams);
  }

  private writeFile(
    level: string,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    const context =
      typeof optionalParams[optionalParams.length - 1] === 'string'
        ? (optionalParams[optionalParams.length - 1] as string)
        : this.context;

    const line = {
      ts: new Date().toISOString(),
      level,
      app: this.context,
      context,
      message: this.normalizeMessage(message),
    };

    try {
      appendFileSync(this.filePath, `${JSON.stringify(line)}\n`, 'utf8');
    } catch {
      // Never throw from logging
    }
  }

  private normalizeMessage(message: unknown): unknown {
    if (message instanceof Error) {
      return { name: message.name, message: message.message, stack: message.stack };
    }
    return message;
  }
}

export function createFileLogger(options: FileLoggerOptions): FileLogger {
  return new FileLogger(options);
}
