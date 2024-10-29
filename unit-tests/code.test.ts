import {BatchLogger} from "..";
import * as crypto from "node:crypto";

describe("BatchLogger Unit Tests", () => {
  beforeEach(() => {});
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
});
