import { handler } from "./getProductsList";
import { products } from "../data/products";

describe("getProductsList handler", () => {
  it("should return status code 200", async () => {
    const result = await handler();
    expect(result.statusCode).toBe(200);
  });

  it("should return correct Content-Type header", async () => {
    const result = await handler();
    expect(result.headers["Content-Type"]).toBe("application/json");
  });

  it("should return all products in the body", async () => {
    const result = await handler();
    const body = JSON.parse(result.body);
    expect(body).toEqual(products);
  });

  it("should return valid JSON in body", async () => {
    const result = await handler();
    expect(() => JSON.parse(result.body)).not.toThrow();
  });

  it("should return correct number of products", async () => {
    const result = await handler();
    const body = JSON.parse(result.body);
    expect(body).toHaveLength(3);
  });

  it("should return products with correct structure", async () => {
    const result = await handler();
    const body = JSON.parse(result.body);
    body.forEach((product: any) => {
      expect(product).toHaveProperty("id");
      expect(product).toHaveProperty("name");
      expect(product).toHaveProperty("price");
    });
  });

  it("should return complete response object with all required properties", async () => {
    const result = await handler();
    expect(result).toHaveProperty("statusCode");
    expect(result).toHaveProperty("headers");
    expect(result).toHaveProperty("body");
  });

  it("should return products in correct order", async () => {
    const result = await handler();
    const body = JSON.parse(result.body);
    expect(body[0].id).toBe("1");
    expect(body[1].id).toBe("2");
    expect(body[2].id).toBe("3");
  });

  it("should handle multiple calls consistently", async () => {
    const result1 = await handler();
    const result2 = await handler();
    expect(result1).toEqual(result2);
  });
});

