import { handler } from "./getProductById";
import { products } from "../data/products";

describe("getProductById handler", () => {
  it("should return status code 200 when product exists", async () => {
    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  it("should return status code 404 when product not found", async () => {
    const event = {
      pathParameters: { productId: "999" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it("should return correct product when id exists", async () => {
    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    const body = JSON.parse(result.body);
    expect(body.id).toBe("1");
    expect(body.name).toBe(products[0].name);
    expect(body.price).toBe(products[0].price);
  });

  it("should return error message when product not found", async () => {
    const event = {
      pathParameters: { productId: "999" },
    };
    const result = await handler(event);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Product not found");
  });

  it("should return valid JSON in body for successful response", async () => {
    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    expect(() => JSON.parse(result.body)).not.toThrow();
  });

  it("should return valid JSON in body for error response", async () => {
    const event = {
      pathParameters: { productId: "999" },
    };
    const result = await handler(event);
    expect(() => JSON.parse(result.body)).not.toThrow();
  });

  it("should return product with correct structure", async () => {
    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    const body = JSON.parse(result.body);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("price");
  });

  it("should handle all valid product IDs", async () => {
    for (const product of products) {
      const event = {
        pathParameters: { productId: product.id },
      };
      const result = await handler(event);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.id).toBe(product.id);
    }
  });

  it("should return status code 404 when pathParameters is undefined", async () => {
    const event = {};
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it("should return status code 404 when productId is undefined", async () => {
    const event = {
      pathParameters: { productId: undefined },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it("should return status code 404 when productId is empty string", async () => {
    const event = {
      pathParameters: { productId: "" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it("should return status code 404 when productId is null", async () => {
    const event = {
      pathParameters: { productId: null },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it("should return correct response structure for successful retrieval", async () => {
    const event = {
      pathParameters: { productId: "1" },
    };
    const result = await handler(event);
    expect(result).toHaveProperty("statusCode");
    expect(result).toHaveProperty("body");
    expect(typeof result.statusCode).toBe("number");
    expect(typeof result.body).toBe("string");
  });

  it("should be case-sensitive when matching product ids", async () => {
    const event = {
      pathParameters: { productId: "A" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(404);
  });

  it("should handle multiple sequential calls consistently", async () => {
    const event = {
      pathParameters: { productId: "2" },
    };
    const result1 = await handler(event);
    const result2 = await handler(event);
    expect(result1).toEqual(result2);
  });
});
