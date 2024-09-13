# Simple Logger

This is a super simpler logger that lets you log to either AWS or slack

## Configuration

### Slack

If you want to use slack pass a slack web hook url

```js
const logger = new SimpleLogger({
  slackWebhookUrl: "https://slackthis.com",
});
await logger.info("omg", "Failure");
```

### AWS

If you want to use aws, you should already have your aws profile or credentials configured on machine running the logger (as atm there is nothing to take an access key/secret in config)


```js
const logger = new SimplerLogger({
  awsRegion: "us-east-2",
  awsEventBusName: "SomeEventBus",
});
await logger.info("Job Ran", "Success");
```