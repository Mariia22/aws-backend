import { handler } from "./catalogBatchProcess";
import { SQSEvent, SQSRecord, Context } from "aws-lambda";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import * as helpers from "./helpers";

jest.mock("./helpers");

const mockSend = jest.fn();

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  ...jest.requireActual("@aws-sdk/lib-dynamodb"),
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({
      send: mockSend,
    })),
  },
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-product-id"),
}));

const mockContext: Partial<Context> = {
  functionName: "catalogBatchProcess",
  functionVersion: "$LATEST",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789:function:catalogBatchProcess",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/catalogBatchProcess",
  logStreamName: "2024/01/01/[$LATEST]abc123",
  getRemainingTimeInMillis: () => 60000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

describe("catalogBatchProcess Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (helpers.initializeDocClient as jest.Mock).mockReturnValue({
      send: mockSend,
    });
    (helpers.getTableNames as jest.Mock).mockReturnValue({
      PRODUCTS_TABLE: "products",
      STOCKS_TABLE: "stocks",
    });
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should process a single message successfully", async () => {
    const mockRecord: SQSRecord = {
      messageId: "msg-1",
      receiptHandle: "handle-1",
      body: JSON.stringify({
        title: "Test Product",
        description: "Test Description",
        price: 100,
        count: 5,
      }),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "1234567890",
        SenderId: "123456789",
        ApproximateFirstReceiveTimestamp: "1234567890",
      },
      messageAttributes: {},
      md5OfBody: "test",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:123456789:queue",
      awsRegion: "us-east-1",
    };

    const event: SQSEvent = {
      Records: [mockRecord],
    };

    mockSend.mockResolvedValue({});

    await handler(event, mockContext as Context, jest.fn());

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("should process multiple messages in a batch", async () => {
    const mockRecords: SQSRecord[] = [
      {
        messageId: "msg-1",
        receiptHandle: "handle-1",
        body: JSON.stringify({
          title: "Product 1",
          price: 100,
          count: 5,
        }),
        attributes: {
          ApproximateReceiveCount: "1",
          SentTimestamp: "1234567890",
          SenderId: "123456789",
          ApproximateFirstReceiveTimestamp: "1234567890",
        },
        messageAttributes: {},
        md5OfBody: "test",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:123456789:queue",
        awsRegion: "us-east-1",
      },
      {
        messageId: "msg-2",
        receiptHandle: "handle-2",
        body: JSON.stringify({
          title: "Product 2",
          price: 200,
          count: 10,
        }),
        attributes: {
          ApproximateReceiveCount: "1",
          SentTimestamp: "1234567890",
          SenderId: "123456789",
          ApproximateFirstReceiveTimestamp: "1234567890",
        },
        messageAttributes: {},
        md5OfBody: "test",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:123456789:queue",
        awsRegion: "us-east-1",
      },
    ];

    const event: SQSEvent = {
      Records: mockRecords,
    };

    mockSend.mockResolvedValue({});

    await handler(event, mockContext as Context, jest.fn());

    expect(mockSend).toHaveBeenCalledTimes(4); // 2 messages * 2 operations (product + stock)
  });

  it("should handle missing required fields", async () => {
    const mockRecord: SQSRecord = {
      messageId: "msg-1",
      receiptHandle: "handle-1",
      body: JSON.stringify({
        description: "Missing title and price",
      }),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "1234567890",
        SenderId: "123456789",
        ApproximateFirstReceiveTimestamp: "1234567890",
      },
      messageAttributes: {},
      md5OfBody: "test",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:123456789:queue",
      awsRegion: "us-east-1",
    };

    const event: SQSEvent = {
      Records: [mockRecord],
    };

    await handler(event, mockContext as Context, jest.fn());

    expect(console.error).toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should handle DynamoDB errors gracefully", async () => {
    const mockRecord: SQSRecord = {
      messageId: "msg-1",
      receiptHandle: "handle-1",
      body: JSON.stringify({
        title: "Test Product",
        price: 100,
        count: 5,
      }),
      attributes: {
        ApproximateReceiveCount: "1",
        SentTimestamp: "1234567890",
        SenderId: "123456789",
        ApproximateFirstReceiveTimestamp: "1234567890",
      },
      messageAttributes: {},
      md5OfBody: "test",
      eventSource: "aws:sqs",
      eventSourceARN: "arn:aws:sqs:us-east-1:123456789:queue",
      awsRegion: "us-east-1",
    };

    const event: SQSEvent = {
      Records: [mockRecord],
    };

    mockSend.mockRejectedValueOnce(new Error("DynamoDB Error"));

    await handler(event, mockContext as Context, jest.fn());

    expect(console.error).toHaveBeenCalled();
  });
});
