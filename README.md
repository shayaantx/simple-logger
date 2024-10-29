# Simple Logger

This is a super simpler logger that lets you log to either AWS or slack that I primarily use for Auth0 actions (or short lived requests).

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

### AWS (Batch Logging)

Batch logging to AWS is possible by instantiating a `BatchLogger`.

```js
const logger = new BatchLogger({
  awsRegion: "us-east-2",
  awsEventBusName: "SomeEventBus",
});
try {
  logger.info("starting foo", {job_id: "bar"})
  // ... stuff happens
} catch(e) {
  logger.error("foo failed", {job_id: "bar", error: e.message})
} finally {
  await logger.write();
}
```
