import { handler } from "./importProductsFile";

// Mock the getSignedUrl function to generate URLs based on the command input
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockImplementation((client, command) => {
    // Extract the Key from the command
    const key = (command as any).input?.Key || "test-key";
    const encodedKey = encodeURIComponent(key);
    return Promise.resolve(
      `https://import-products-bucket.s3.amazonaws.com/${encodedKey}?X-Amz-Signature=test`
    );
  }),
}));

// Mock the S3Client
jest.mock("@aws-sdk/client-s3", () => {
  const actual = jest.requireActual("@aws-sdk/client-s3");
  return {
    ...actual,
    S3Client: jest.fn(),
  };
});

describe("importProductsFile Lambda", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = "test-bucket";
  });

  it("should return a signed URL for a valid request", async () => {
    const event = {
      queryStringParameters: {
        name: "products.csv",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect((result as any).headers?.["Content-Type"]).toBe("text/plain");
    expect(typeof result.body).toBe("string");
    expect(result.body).toContain("s3.amazonaws.com");
  });

  it("should return 400 error when name parameter is missing", async () => {
    const event = {
      queryStringParameters: {},
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: "Missing 'name' query parameter",
    });
  });

  it("should return 400 error when queryStringParameters is null", async () => {
    const event = {
      queryStringParameters: null,
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({
      error: "Missing 'name' query parameter",
    });
  });

  it("should return 500 error when BUCKET_NAME environment variable is not set", async () => {
    delete process.env.BUCKET_NAME;

    const event = {
      queryStringParameters: {
        name: "products.csv",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: "Bucket name not configured",
    });
  });

  it("should create correct S3 key with uploaded prefix", async () => {
    const event = {
      queryStringParameters: {
        name: "myfile.csv",
      },
    };

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    // The signed URL should contain the uploaded/ prefix in the path
    expect(result.body).toContain("uploaded%2Fmyfile.csv");
  });
});
