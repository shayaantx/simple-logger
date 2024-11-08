// index.d.ts

export type LogLevel =
  "INFO" | "ERROR";

export class BatchLogEntry {
  message: string;
  logLevel: LogLevel;
  context: object;
  constructor(message: string, logLevel: LogLevel, context: {});
}

export class AWSPayload {
  Entries: {
    DetailType: string,
    Detail: string,
    EventBusName: string,
    Source: string
  }[]
}

export class BatchLogger {
  logs: BatchLogEntry[];
  constructor(options?: BatchLoggerOptions);
  destroy(): void;
  info(message: string, context?: {}): void;
  error(message: string, context?: {}): void;
  write(): Promise<void>;
  _createAWSPayload(entries: Array<BatchLogEntry>): AWSPayload;
  _createBatches(entries: Array<BatchLogEntry>): Array<Array<BatchLogEntry>>;
}

export interface BatchLoggerOptions {
  // the aws region your credentials are configured for
  awsRegion: string;
  // the event bus to send log events to
  awsEventBusName: string;
  logToConsole?: boolean;
  // extra contextual data to log
  commonContext?: {};
  // whether to append a unique request id to every request
  enableRequestId?: boolean;
}

export class SimpleLogger {
  constructor(options?: SimpleLoggerOptions);
  destroy(): void;
  aws(message: string, logLevel: LogLevel, context?: {}): Promise<void>;
  info(message: string, context?: {}): Promise<void>;
  error(message: string, context?: {}): Promise<void>;
  slack(message: string, logLevel: LogLevel, context?: {}, color: string, emoji: string): Promise<void>;
}

export interface SimpleLoggerOptions {
  // http url for your slack channel integration
  slackWebhookUrl?: string;
  // the aws region your credentials are configured for
  awsRegion?: string;
  // the event bus to send log events to
  awsEventBusName?: string;
  logToConsole?: boolean;
  // extra contextual data to log
  commonContext?: {};
  // whether to append a unique request id to every request
  enableRequestId?: boolean;
}
