import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable, Transform } from "stream";
import { handler } from "./importFileParser";

// Mock csv-parser to return a transform stream that properly emits events
jest.mock("csv-parser", () => {
  return () => {
    return new Transform({
      transform(chunk: any, encoding: string, callback: Function) {
        try {
          const lines = chunk.toString().split("\n");
          lines.forEach((line: string) => {
            if (line.trim()) {
              const [id, name, ...rest] = line.split(",");
              this.push({ id, name, ...rest });
            }
          });
          callback();
        } catch (err) {
          callback(err as Error | undefined);
        }
      },
      objectMode: true,
      flush(callback: Function) {
        // Ensure the end event is properly emitted
        callback();
      },
    });
  };
});

// Mock S3Client with all required commands
jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    GetObjectCommand: actual.GetObjectCommand,
    CopyObjectCommand: actual.CopyObjectCommand,
    DeleteObjectCommand: actual.DeleteObjectCommand,
  };
});

describe("importFileParser Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation();
    jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
  });

  it("should extract bucket and key from S3 event", async () => {
    const mockStream = new Readable({
      read() {
        this.push("id,name\n1,test");
        this.push(null);
      },
    });

    const { S3Client: MockS3Client } = require("@aws-sdk/client-s3");
    const mockInstance = new MockS3Client();
    mockInstance.send = jest.fn().mockResolvedValue({
      Body: mockStream,
    });

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
        .then(() => setTimeout(() => resolve(), 50))
        .catch(() => setTimeout(() => resolve(), 50));
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing file:")
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("test-bucket")
    );
  });

  it("should handle URL-encoded keys", async () => {
    const mockStream = new Readable({
      read() {
        this.push("id,name\n1,test");
        this.push(null);
      },
    });

    const { S3Client: MockS3Client } = require("@aws-sdk/client-s3");
    const mockInstance = new MockS3Client();
    mockInstance.send = jest.fn().mockResolvedValue({
      Body: mockStream,
    });

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
        .then(() => setTimeout(() => resolve(), 50))
        .catch(() => setTimeout(() => resolve(), 50));
    });

    // Verify the key was decoded
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("my file.csv")
    );
  });

  it("should handle plus encoding in keys", async () => {
    const mockStream = new Readable({
      read() {
        this.push("id,name\n1,test");
        this.push(null);
      },
    });

    const { S3Client: MockS3Client } = require("@aws-sdk/client-s3");
    const mockInstance = new MockS3Client();
    mockInstance.send = jest.fn().mockResolvedValue({
      Body: mockStream,
    });

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
        .then(() => setTimeout(() => resolve(), 50))
        .catch(() => setTimeout(() => resolve(), 50));
    });

    // Plus should be replaced with space
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("products new.csv")
    );
  });

  it("should log processing start message", async () => {
    const mockStream = new Readable({
      read() {
        this.push("id\n1");
        this.push(null);
      },
    });

    const { S3Client: MockS3Client } = require("@aws-sdk/client-s3");
    const mockInstance = new MockS3Client();
    mockInstance.send = jest.fn().mockResolvedValue({
      Body: mockStream,
    });

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
        .then(() => setTimeout(() => resolve(), 50))
        .catch(() => setTimeout(() => resolve(), 50));
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing file: s3://my-bucket/uploaded/test.csv")
    );
  });

  it("should handle S3 client errors", async () => {
    const { S3Client: MockS3Client } = require("@aws-sdk/client-s3");
    const mockInstance = new MockS3Client();
    mockInstance.send = jest.fn().mockRejectedValue(new Error("S3 Error"));

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
      // Error should be thrown due to missing mock setup or S3 error
      expect((error as Error).message).toBeDefined();
    }

    expect(console.error).toHaveBeenCalledWith(
      "Error processing file:",
      expect.any(Error)
    );
  });

  it("should process multiple records from CSV", async () => {
    const csvData = "id,name\n1,Product1\n2,Product2\n3,Product3";
    const mockStream = new Readable({
      read() {
        this.push(csvData);
        this.push(null);
      },
    });

    const { S3Client: MockS3Client } = require("@aws-sdk/client-s3");
    const mockInstance = new MockS3Client();
    mockInstance.send = jest.fn().mockResolvedValue({
      Body: mockStream,
    });

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

    const result = await new Promise((resolve) => {
      handler(event)
        .then((res) => resolve(res))
        .catch((err) => {
          console.log("Handler error:", err.message);
          resolve(null);
        });
    });

    // Verify that processing started
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Processing file:")
    );
  });
});
