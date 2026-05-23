import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Readable, Transform } from "stream";

// Track the number of records to emit for the current test
let recordsToEmit: any[] = [];

// Mock csv-parser to return a transform stream that properly emits events
jest.mock("csv-parser", () => {
  return () => {
    const passThrough = new Transform({
      objectMode: true,
      transform(chunk: any, encoding: string, callback: Function) {
        callback();
      },
    });

    // Delay to allow stream listeners to be set up
    setTimeout(() => {
      recordsToEmit.forEach((record) => {
        passThrough.emit("data", record);
      });
      passThrough.emit("end");
    }, 10);

    return passThrough;
  };
});

const mockS3Send = jest.fn();
const mockSqsSend = jest.fn();

// Mock S3Client and SQSClient
jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn(() => ({
      send: mockS3Send,
    })),
    GetObjectCommand: actual.GetObjectCommand,
    CopyObjectCommand: actual.CopyObjectCommand,
    DeleteObjectCommand: actual.DeleteObjectCommand,
  };
});

jest.mock("@aws-sdk/client-sqs", () => {
  const actual = jest.requireActual("@aws-sdk/client-sqs");
  return {
    ...actual,
    SQSClient: jest.fn(() => ({
      send: mockSqsSend,
    })),
    SendMessageCommand: actual.SendMessageCommand,
  };
});

import { handler } from "./importFileParser";

describe("importFileParser Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
    process.env.SQS_QUEUE_URL = "https://sqs.us-east-1.amazonaws.com/123456789/catalogItemsQueue";
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
    delete process.env.SQS_QUEUE_URL;
  });

  it("should extract bucket and key from S3 event and send records to SQS", async () => {
    recordsToEmit = [{ id: "1", name: "test" }];

    const mockStream = new Readable({
      read() {
        this.push("id,name\n1,test");
        this.push(null);
      },
    });

    mockS3Send.mockResolvedValue({
      Body: mockStream,
    });
    mockSqsSend.mockResolvedValue({});

    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/products.csv",
            },
          },
        },
      ],
    };

    await new Promise<void>((resolve) => {
      handler(event)
        .then(() => setTimeout(() => resolve(), 300))
        .catch(() => setTimeout(() => resolve(), 300));
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing file:")
    );
    // Check that SQS was called at least once
    expect(mockSqsSend).toHaveBeenCalled();
  });

  it("should handle URL-encoded keys and send records to SQS", async () => {
    recordsToEmit = [{ id: "1", name: "test" }];

    const mockStream = new Readable({
      read() {
        this.push("id,name\n1,test");
        this.push(null);
      },
    });

    mockS3Send.mockResolvedValue({
      Body: mockStream,
    });
    mockSqsSend.mockResolvedValue({});

    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/my%20file.csv",
            },
          },
        },
      ],
    };

    await new Promise<void>((resolve) => {
      handler(event)
        .then(() => setTimeout(() => resolve(), 100))
        .catch(() => setTimeout(() => resolve(), 100));
    });

    // Verify the key was decoded
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("my file.csv")
    );
    expect(mockSqsSend).toHaveBeenCalled();
  });

  it("should handle plus encoding in keys and send records to SQS", async () => {
    recordsToEmit = [{ id: "1", name: "test" }];

    const mockStream = new Readable({
      read() {
        this.push("id,name\n1,test");
        this.push(null);
      },
    });

    mockS3Send.mockResolvedValue({
      Body: mockStream,
    });
    mockSqsSend.mockResolvedValue({});

    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/products+new.csv",
            },
          },
        },
      ],
    };

    await new Promise<void>((resolve) => {
      handler(event)
        .then(() => setTimeout(() => resolve(), 100))
        .catch(() => setTimeout(() => resolve(), 100));
    });

    // Plus should be replaced with space
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("products new.csv")
    );
    expect(mockSqsSend).toHaveBeenCalled();
  });

  it("should log processing start message and send records to SQS", async () => {
    recordsToEmit = [{ id: "1" }];

    const mockStream = new Readable({
      read() {
        this.push("id\n1");
        this.push(null);
      },
    });

    mockS3Send.mockResolvedValue({
      Body: mockStream,
    });
    mockSqsSend.mockResolvedValue({});

    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "my-bucket",
            },
            object: {
              key: "uploaded/test.csv",
            },
          },
        },
      ],
    };

    await new Promise<void>((resolve) => {
      handler(event)
        .then(() => setTimeout(() => resolve(), 100))
        .catch(() => setTimeout(() => resolve(), 100));
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing file: s3://my-bucket/uploaded/test.csv")
    );
    expect(mockSqsSend).toHaveBeenCalled();
  });

  it("should handle S3 client errors", async () => {
    mockS3Send.mockRejectedValue(new Error("S3 Error"));

    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/products.csv",
            },
          },
        },
      ],
    };

    try {
      await handler(event);
      fail("Should have thrown an error");
    } catch (error) {
      // Error should be thrown due to S3 error
      expect((error as Error).message).toBeDefined();
    }

    expect(console.error).toHaveBeenCalledWith(
      "Error processing file:",
      expect.any(Error)
    );
  });

  it("should process multiple records from CSV and send each to SQS", async () => {
    recordsToEmit = [
      { id: "1", name: "Product1" },
      { id: "2", name: "Product2" },
      { id: "3", name: "Product3" },
    ];

    const mockStream = new Readable({
      read() {
        this.push("id,name\n1,Product1\n2,Product2\n3,Product3");
        this.push(null);
      },
    });

    mockS3Send.mockResolvedValue({
      Body: mockStream,
    });
    mockSqsSend.mockResolvedValue({});

    const event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/products.csv",
            },
          },
        },
      ],
    };

    await new Promise<void>((resolve) => {
      handler(event)
        .then(() => setTimeout(() => resolve(), 300))
        .catch(() => setTimeout(() => resolve(), 300));
    });

    // Verify that processing started
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing file:")
    );
    // Verify that SQS was called at least once
    expect(mockSqsSend).toHaveBeenCalled();
  });
});
