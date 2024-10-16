// index.d.ts

export class SimpleLogger {
  constructor(options?: SimpleLoggerOptions);
  destroy(): void;
  info(message: string, context: {}): Promise<void>;
  error(message: string, context: {}): Promise<void>;
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