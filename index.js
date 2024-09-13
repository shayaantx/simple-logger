const SlackNotify = require("slack-notify");
const {
  EventBridgeClient,
  PutEventsCommand,
} = require("@aws-sdk/client-eventbridge");

class SimpleLogger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'info',
      format: config.format || 'text',
      slackWebhookUrl: config.slackWebhookUrl || '',
      awsRegion: config.awsRegion || '',
      awsEventBusName: config.awsEventBusName || '',
      awsMaxRetries: config.awsMaxRetries || 5,
    };

    if (this.config.slackWebhookUrl) {
      this.slackClient = SlackNotify(this.config.slackWebhookUrl);
    }
    if (this.config.awsRegion) {
      this.eventBridgeClient = new EventBridgeClient({
        region: this.config.awsRegion,
        maxAttempts: this.awsMaxRetries,
        retryDelayOptions: {base: 500}
      });
    }
  }

  destroy() {
    if (this.eventBridgeClient) {
      this.eventBridgeClient.destroy();
    }
  }

  async aws(message, detailType) {
    // All four of the Entries properties are required.
    // The source must match the EventBusName.
    const logPayload = {
      Entries: [
        {
          DetailType: `${detailType}`,
          Detail: JSON.stringify(message),
          EventBusName: `${this.awsEventBusName}`,
          Source: `${this.awsEventBusName}`,
        },
      ],
    };
  
    await this.eventBridgeClient.send(new PutEventsCommand(logPayload));
  }

  async slack(message, type, context = {}) {
    console.log(message, context);
  
    await this.slackClient.send({
      text: `${type}\n`,
      icon_emoji: ":alert:",
      attachments: [
        {
          color: "#FF5733",
          fields: [
            { title: "Message", value: message, short: true },
            {
              title: "Context",
              value: JSON.stringify(context, null, 4),
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