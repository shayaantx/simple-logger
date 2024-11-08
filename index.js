const SlackNotify = require("slack-notify");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");

const createRequestId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const LogLevelInfo = "INFO";
const LogLevelError = "ERROR";

/**
 * BatchLogEntry represents a single log event.
 */
class BatchLogEntry {
  message;
  logLevel;
  context;
  time;

  constructor(message, logLevel, context = {}) {
    this.message = message;
    this.logLevel = logLevel;
    this.context = context;
    this.time = new Date();
  }
}

/**
 * BatchLogger stores log events until instructed to send them to AWS EventBridge.
 * Batches are grouped into bundles of less than 256KB to comply with EventBridge API payload constraints.
 * Slack configuration is ignored.
 */
class BatchLogger {
  logger;
  logs;

  /**
   * @param config
   * @throws Error
   */
  constructor(config = {}) {
    if (!config.awsRegion || !config.awsEventBusName) {
      throw new Error("missing AWS configuration for batch logger")
    }

    this.logger = new SimpleLogger(config);
    this.logs = [];
  }

  destroy() {
    this.logger.eventBridgeClient.destroy();
  }

  /**
   * Creates a log entry at log level INFO.
   *
   * @param message {string}
   * @param context {Object}
   */
  info(message, context = {}) {
    if (this.logger.config.logToConsole) {
      console.log(LogLevelInfo, message, context);
    }

    this.logs.push(new BatchLogEntry(message, LogLevelInfo, context));
  }

  /**
   * Creates a log entry at log level ERROR.
   *
   * @param message {string}
   * @param context {Object}
   */
  error(message, context = {}) {
    if (this.logger.config.logToConsole) {
      console.log(LogLevelError, message, context);
    }

    this.logs.push(new BatchLogEntry(message, LogLevelError, context));
  }

  /**
   * Sends the stored log entries to AWS EventBridge.
   *
   * @return {Promise<void>}
   */
  async write() {
    const batches = this._createBatches(this.logs);
    for (const batch of batches) {
      await this.aws(batch);
    }
  }

  /**
   *
   * @param entries {Array<BatchLogEntry>}
   * @return {Promise<void>}
   */
  async aws(entries) {
    const logPayload = this._createAWSPayload(entries);
    await this.logger.eventBridgeClient.send(new PutEventsCommand(logPayload));
  }

  /**
   * Format the provided log entries for AWS EventBridge.
   *
   * @param entries {Array<BatchLogEntry>}
   * @private
   * @return {{Entries: Array<{DetailType: string, Detail: string, EventBusName: string, Source: string}>}}
   */
  _createAWSPayload(entries) {
    const commonContext = this.logger.commonContext;
    const eventBusName = this.logger.config.awsEventBusName;

    const awsInnerPayload = entries.map(entry => {
      return {
        DetailType: `${entry.logLevel}`,
        Detail: JSON.stringify({
          message: entry.message,
          context: { ...entry.context, commonContext }
        }),
        Time: entry.time,
        EventBusName: `${eventBusName}`,
        Source: `${eventBusName}`,
      }
    });

    return {
      Entries: awsInnerPayload,
    }
  }

  /**
   * Create batches of log entries smaller than the AWS EventBridge payload limit of 256KB.
   *
   * @param entries {Array<BatchLogEntry>}
   * @return {Array<Array<BatchLogEntry>>}
   */
  _createBatches(entries) {
    const batches = [];
    let currentBatch = [];
    let currentSize = 0;

    for (const event of entries) {
      const eventSize = JSON.stringify(event).length;
      const tooManyEntries = currentBatch.length > 9;
      const payloadTooLarge = (currentSize + eventSize) > (256 * 1024) // 256KB

      if (tooManyEntries || payloadTooLarge) {
        batches.push(currentBatch);
        currentBatch = [];
        currentSize = 0;
      }

      currentBatch.push(event);
      currentSize += eventSize;
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }
}

class SimpleLogger {
  constructor(config = {}) {
    let commonContext = config.commonContext || {};
    if (config.enableRequestId) {
      commonContext = { ...config.commonContext, requestId: createRequestId() }
    }
    this.config = {
      slackWebhookUrl: config.slackWebhookUrl || '',
      awsRegion: config.awsRegion || '',
      awsEventBusName: config.awsEventBusName || '',
      awsMaxRetries: config.awsMaxRetries || 5,
      logToConsole: config.logToConsole || false,
      commonContext
    };

    if (this.config.slackWebhookUrl) {
      this.slackClient = SlackNotify(this.config.slackWebhookUrl);
    }
    if (this.config.awsRegion) {
      this.eventBridgeClient = new EventBridgeClient({
        region: this.config.awsRegion,
        maxAttempts: this.config.awsMaxRetries,
        retryDelayOptions: { base: 500 }
      });
    }
  }

  destroy() {
    if (this.eventBridgeClient) {
      this.eventBridgeClient.destroy();
    }
  }

  async info(message, context = {}) {
    if (this.config.logToConsole) {
      console.log(message, context);
    }
    if (this.eventBridgeClient) {
      this.aws(message, LogLevelInfo, context);
    }
    if (this.slackClient) {
      this.slack(message, LogLevelInfo, context, "#D3D3D3", ":info:");
    }
  }

  async error(message, context = {}) {
    if (this.config.logToConsole) {
      console.log(message, context);
    }
    if (this.eventBridgeClient) {
      this.aws(message, LogLevelError, context);
    }
    if (this.slackClient) {
      this.slack(message, LogLevelError, context, "#FF5733", ":alert:");
    }
  }

  async aws(message, logLevel, context = {}) {
    // All four of the Entries properties are required.
    // The source must match the EventBusName.
    const commonContext = this.config.commonContext;
    const logPayload = {
      Entries: [
        {
          DetailType: `${logLevel}`,
          Detail: JSON.stringify({
            message, context: { ...context, commonContext }
          }),
          EventBusName: `${this.config.awsEventBusName}`,
          Source: `${this.config.awsEventBusName}`,
        },
      ],
    };

    await this.eventBridgeClient.send(new PutEventsCommand(logPayload));
  }

  async slack(message, logLevel, context = {}, color, emoji) {
    const commonContext = this.config.commonContext;
    await this.slackClient.send({
      text: `${logLevel}\n`,
      icon_emoji: emoji,
      attachments: [
        {
          color,
          fields: [
            { title: "Message", value: message, short: true },
            {
              title: "Context",
              value: JSON.stringify({ ...context, commonContext }, null, 4),
              short: false,
            },
          ],
          footer: `${logLevel}`,
          ts: Date.now(),
        },
      ],
    });
  }
}

module.exports = {
  BatchLogEntry,
  BatchLogger,
  LogLevelError,
  LogLevelInfo,
  SimpleLogger
};
