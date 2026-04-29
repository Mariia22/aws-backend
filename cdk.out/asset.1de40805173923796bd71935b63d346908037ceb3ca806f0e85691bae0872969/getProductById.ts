import { products } from "../data/products";

const errorResponse = (statusCode: number, message: string) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ error: message }),
});

const successResponse = (data: any) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
});

export const handler = async (event: any) => {
  try {
    if (!event.pathParameters) {
      return errorResponse(400, "Missing path parameters");
    }

    const { productId } = event.pathParameters;
    if (!productId || productId.trim() === "") {
      return errorResponse(400, "Product ID is required");
    }

    const product = products.find((p) => p.id === productId);

    if (!product) {
      return errorResponse(404, `Product with ID "${productId}" not found`);
    }

    return successResponse(product);
  } catch (error) {
    return errorResponse(500, "Internal server error");
  }
};