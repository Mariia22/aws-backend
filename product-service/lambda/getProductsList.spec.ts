import { handler } from "./getProductsList";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

const mockProducts = [
  {
    id: "1",
    title: "Laptop",
    description: "Gaming laptop",
    price: 1500,
  },
  {
    id: "2",
    title: "Phone",
    description: "Smartphone",
    price: 800,
  },
  {
    id: "3",
    title: "Headphones",
    description: "Wireless headphones",
    price: 200,
  },
];

const mockStocks = [
  { product_id: "1", count: 50 },
  { product_id: "2", count: 30 },
  { product_id: "3", count: 100 },
];

describe("getProductsList handler", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("should return status code 200", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "products" })
      .resolves({ Items: mockProducts });
    ddbMock
      .on(ScanCommand, { TableName: "stocks" })
      .resolves({ Items: mockStocks });

    const result = await handler();
    expect(result.statusCode).toBe(200);
  });

  it("should return correct Content-Type header", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "products" })
      .resolves({ Items: mockProducts });
    ddbMock
      .on(ScanCommand, { TableName: "stocks" })
      .resolves({ Items: mockStocks });

    const result = await handler();
    expect((result.headers as any)["Content-Type"]).toBe("application/json");
    expect((result.headers as any)["Cache-Control"]).toBe("no-cache, no-store, must-revalidate");
    expect((result.headers as any)["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("should return all products with stock count joined", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "products" })
      .resolves({ Items: mockProducts });
    ddbMock
      .on(ScanCommand, { TableName: "stocks" })
      .resolves({ Items: mockStocks });

    const result = await handler();
    const body = JSON.parse(result.body);

    expect(body).toHaveLength(3);
    expect(body[0]).toEqual({
      id: "1",
      title: "Laptop",
      description: "Gaming laptop",
      price: 1500,
      count: 50,
    });
    expect(body[1]).toEqual({
      id: "2",
      title: "Phone",
      description: "Smartphone",
      price: 800,
      count: 30,
    });
    expect(body[2]).toEqual({
      id: "3",
      title: "Headphones",
      description: "Wireless headphones",
      price: 200,
      count: 100,
    });
  });

  it("should return valid JSON in body", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "products" })
      .resolves({ Items: mockProducts });
    ddbMock
      .on(ScanCommand, { TableName: "stocks" })
      .resolves({ Items: mockStocks });

    const result = await handler();
    expect(() => JSON.parse(result.body)).not.toThrow();
  });

  it("should return empty array when no products exist", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "products" })
      .resolves({ Items: [] });
    ddbMock
      .on(ScanCommand, { TableName: "stocks" })
      .resolves({ Items: [] });

    const result = await handler();
    const body = JSON.parse(result.body);
    expect(body).toEqual([]);
  });

  it("should handle missing stock data for a product", async () => {
    const productsWithExtra = [...mockProducts];
    const productsWithExtra2 = [
      ...productsWithExtra,
      { id: "4", title: "Tablet", description: "Tablet device", price: 500 },
    ];

    ddbMock
      .on(ScanCommand, { TableName: "products" })
      .resolves({ Items: productsWithExtra2 });
    ddbMock
      .on(ScanCommand, { TableName: "stocks" })
      .resolves({ Items: mockStocks });

    const result = await handler();
    const body = JSON.parse(result.body);

    const tabletProduct = body.find((p: any) => p.id === "4");
    expect(tabletProduct.count).toBe(0);
  });

  it("should return 500 error on database exception", async () => {
    ddbMock
      .on(ScanCommand, { TableName: "products" })
      .rejects(new Error("Database error"));

    const result = await handler();
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe("Internal server error");
  });
});

