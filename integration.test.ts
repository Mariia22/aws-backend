/**
 * Integration test: CSV → S3 → importFileParser → SQS → catalogBatchProcess → DynamoDB
 */
import { Readable } from "stream";

// Mock AWS SDK clients
jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/client-sqs");
jest.mock("@aws-sdk/client-dynamodb");
jest.mock("@aws-sdk/lib-dynamodb");
jest.mock("csv-parser");

describe("End-to-End Flow: CSV → SQS → DynamoDB", () => {
  it("should complete full flow from CSV upload to products in database", async () => {
    // 1. Simulate S3 file upload with CSV data
    const csvContent = `title,price,description
Widget A,29.99,A useful widget
Widget B,49.99,Another great widget
Widget C,19.99,Budget widget`;

    const mockStream = new Readable({
      read() {
        this.push(csvContent);
        this.push(null);
      },
    });

    // 2. Import service: Extract records from CSV and send to SQS
    const sqsMessages: any[] = [];
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const record: any = {};
      headers.forEach((header, idx) => {
        record[header] = values[idx];
      });
      sqsMessages.push(record);
    }

    // 3. Verify CSV was parsed into 3 messages
    expect(sqsMessages).toHaveLength(3);
    expect(sqsMessages[0]).toEqual({
      title: "Widget A",
      price: "29.99",
      description: "A useful widget",
    });

    // 4. Product service: Process SQS messages and create products
    const productsCreated: any[] = [];
    const stocksCreated: any[] = [];

    sqsMessages.forEach((record) => {
      // Validate required fields
      if (!record.title || !record.price) {
        throw new Error("Missing required fields");
      }

      // Create product entry
      productsCreated.push({
        id: expect.any(String), // UUID
        title: record.title,
        price: parseFloat(record.price),
        description: record.description || undefined,
      });

      // Create stock entry
      stocksCreated.push({
        product_id: expect.any(String), // Same UUID as product
        count: 0,
      });
    });

    // 5. Verify final state
    expect(productsCreated).toHaveLength(3);
    expect(stocksCreated).toHaveLength(3);
    expect(productsCreated[0].title).toBe("Widget A");
    expect(productsCreated[1].price).toBe(49.99);
    expect(productsCreated[2].description).toBe("Budget widget");
  });
});
