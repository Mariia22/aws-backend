import { handler } from "./getProductById";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

const ddbMock = mockClient(DynamoDBDocumentClient);

const mockProduct = {
  id: "1",
  title: "Laptop",
  description: "Gaming laptop",
  price: 1500,
};

const mockStock = {
  product_id: "1",
  count: 50,
};

describe("getProductById handler", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("should return status code 200 when product exists", async () => {
    ddbMock
      .on(GetCommand, { TableName: "products", Key: { id: "1" } })
      .resolves({ Item: mockProduct });
    ddbMock
      .on(GetCommand, { TableName: "stocks", Key: { product_id: "1" } })
      .resolves({ Item: mockStock });

    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it("should return status code 404 when product not found", async () => {
    ddbMock
      .on(GetCommand, { TableName: "products", Key: { id: "999" } })
      .resolves({ Item: undefined });

    const event = {
      pathParameters: { productId: "999" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it("should return correct product with stock count joined", async () => {
    ddbMock
      .on(GetCommand, { TableName: "products", Key: { id: "1" } })
      .resolves({ Item: mockProduct });
    ddbMock
      .on(GetCommand, { TableName: "stocks", Key: { product_id: "1" } })
      .resolves({ Item: mockStock });

    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(body).toEqual({
      id: "1",
      title: "Laptop",
      description: "Gaming laptop",
      price: 1500,
      count: 50,
    });
  });

  it("should return error when productId is missing", async () => {
    const event = {
      pathParameters: {},
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toBe("Product ID is required");
  });

  it("should return error when pathParameters is missing", async () => {
    const event = {};
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });

  it("should return 0 count when stock not found for product", async () => {
    ddbMock
      .on(GetCommand, { TableName: "products", Key: { id: "1" } })
      .resolves({ Item: mockProduct });
    ddbMock
      .on(GetCommand, { TableName: "stocks", Key: { product_id: "1" } })
      .resolves({ Item: undefined });

    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    const body = JSON.parse(result.body);

    expect(body.count).toBe(0);
    expect(body.title).toBe("Laptop");
  });

  it("should return 500 error on database exception", async () => {
    ddbMock
      .on(GetCommand, { TableName: "products", Key: { id: "1" } })
      .rejects(new Error("Database error"));

    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body).error).toBe("Internal server error");
  });
});
