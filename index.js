const SlackNotify = require("slack-notify");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");

class SimpleLogger {
  constructor(config = {}) {
    this.config = {
      slackWebhookUrl: config.slackWebhookUrl || '',
      awsRegion: config.awsRegion || '',
      awsEventBusName: config.awsEventBusName || '',
      awsMaxRetries: config.awsMaxRetries || 5,
      logToConsole: config.logToConsole || false,
      commonContext: config.commonContext || {}
    };

    if (this.config.slackWebhookUrl) {
      this.slackClient = SlackNotify(this.config.slackWebhookUrl);
    }
    if (this.config.awsRegion) {
      this.eventBridgeClient = new EventBridgeClient({
        region: this.config.awsRegion,
        maxAttempts: this.config.awsMaxRetries,
        retryDelayOptions: {base: 500}
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
      this.aws(message, "INFO", context);
    }
    if (this.slackClient) {
      this.slack(message, "INFO", context, "#D3D3D3", ":info:");
    }
  }

  async error(message, context = {}) {
    if (this.config.logToConsole) {
      console.log(message, context);
    }
    if (this.eventBridgeClient) {
      this.aws(message, "ERROR", context);
    }
    if (this.slackClient) {
      this.slack(message, "ERROR", context, "#FF5733", ":alert:");
    }
  }

  async aws(message, type, context = {}) {
    // All four of the Entries properties are required.
    // The source must match the EventBusName.
    const commonContext = this.config.commonContext;
    const logPayload = {
      Entries: [
        {
          DetailType: `${type}`,
          Detail: JSON.stringify({
            message, context: {...context, commonContext}
          }),
          EventBusName: `${this.config.awsEventBusName}`,
          Source: `${this.config.awsEventBusName}`,
        },
      ],
    };
  
    await this.eventBridgeClient.send(new PutEventsCommand(logPayload));
  }

  async slack(message, type, context = {}, color, emoji) {
    const commonContext = this.config.commonContext;
    await this.slackClient.send({
      text: `${type}\n`,
      icon_emoji: emoji,
      attachments: [
        {
          color,
          fields: [
            { title: "Message", value: message, short: true },
            {
              title: "Context",
              value: JSON.stringify({...context, commonContext}, null, 4),
              short: false,
            },
          ],
          footer: `${type}`,
          ts: Date.now(),
        },
      ],
    });
  }
}

module.exports = SimpleLogger;