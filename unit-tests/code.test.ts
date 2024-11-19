import {BatchLogger, SimpleLogger} from "..";
import * as crypto from "node:crypto";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
const SlackNotify = require("slack-notify");

jest.mock("@aws-sdk/client-eventbridge");
jest.mock("slack-notify");

describe("BatchLogger Unit Tests", () => {
  beforeEach(() => {});
  it("fail to create batch logger due to missing config", async () => {
    expect(() => { new BatchLogger() }).toThrow();
  });
  it("logs with console logging and request id", async () => {
    const logger = new BatchLogger({
      awsRegion: "us-east-1",
      awsEventBusName: "my-event-bus",
      logToConsole: true,
      enableRequestId: true,
    });
    logger.info("foo-info");
    logger.error("foo-error");
    await logger.write();
    expect(EventBridgeClient.prototype.send).toHaveBeenCalled();
    expect(logger.logger.config.commonContext.requestId).toBeDefined();
  });
  it("create single batch if less than 256KB total", async () => {
    const logger = new BatchLogger({awsRegion: "us-east-2", awsEventBusName: "batch-logger-event-bus"})
    logger.info("foo");
    const batches = logger._createBatches(logger.logs);
    expect(batches.length).toBe(1);
    expect(batches[0].length).toBe(1);
    expect(batches[0][0].message).toBe("foo");
  });
  it("create AWS payload containing a single log", async () => {
    const logger = new BatchLogger({awsRegion: "us-east-2", awsEventBusName: "batch-logger-event-bus"})
    logger.info("foo");
    const batches = logger._createBatches(logger.logs);
    expect(batches.length).toBe(1);
    expect(batches[0].length).toBe(1);
    const payload = logger._createAWSPayload(batches[0]);
    expect(payload.Entries.length).toBe(1);
    expect(payload.Entries[0].Detail).toContain("foo");
  });
  it("create two batches if payload is between 256KB and 512KB", async () => {
    const log_1 = crypto.randomBytes(100000).toString('hex');
    const log_2 = crypto.randomBytes(100000).toString('hex');

    const logger = new BatchLogger({awsRegion: "us-east-2", awsEventBusName: "batch-logger-event-bus"})
    logger.info(log_1);
    logger.info(log_2);
    const batches = logger._createBatches(logger.logs);
    expect(batches.length).toBe(2);
    expect(batches[0].length).toBe(1);
    expect(batches[0][0].message.length).toBe(log_1.length);
    expect(batches[1][0].message.length).toBe(log_1.length);
  });
  it("create two batches if payload is more than ten events", async () => {
    const logger = new BatchLogger({awsRegion: "us-east-2", awsEventBusName: "batch-logger-event-bus"})
    for (let i = 0; i < 12; i++) {
      logger.error(`${i}`);
    }
    const batches = logger._createBatches(logger.logs);
    expect(batches.length).toBe(2);
    expect(batches[0].length).toBe(10);
    expect(batches[1].length).toBe(2);
  });
  it("destroy eventbridge client", async () => {
    const logger = new BatchLogger({awsRegion: "us-east-2", awsEventBusName: "batch-logger-event-bus"})
    logger.destroy();
  });
});

describe("SimpleLogger Integration Test", () => {
  beforeEach(() => {
    const slack = {
      send: jest.fn((message, callback) => {
        if (callback && typeof callback === "function") {
          callback(null);
        }
      }),
    };

    SlackNotify.mockReturnValue(slack);
  });
  it("SimpleLogger integration test", async () => {
    const slackSpy = jest
      .spyOn(SimpleLogger.prototype, "slack")
      .mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          resolve();
        });
      });
    const awsSpy = jest
      .spyOn(SimpleLogger.prototype, "aws")
      .mockImplementationOnce(() => {
      return new Promise(resolve => {
        resolve();
      })
    });
    const logger = new SimpleLogger({
      slackWebhookUrl: "http://example.com",
      enableRequestId: true,
      logToConsole: true,
      awsRegion: "us-east-1",
      awsEventBusName: "my-event-bus",
    });
    await logger.info("foo-info");
    await logger.error("foo-error");
    logger.destroy();
    expect(slackSpy).toHaveBeenCalled();
    expect(awsSpy).toHaveBeenCalled();
    expect(EventBridgeClient.prototype.send).toHaveBeenCalled();
  });
});
