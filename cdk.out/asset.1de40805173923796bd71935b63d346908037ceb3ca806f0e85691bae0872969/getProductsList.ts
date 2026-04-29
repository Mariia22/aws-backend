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

export const handler = async (event?: any) => {
  try {
    if (!products || products.length === 0) {
      return successResponse([]);
    }

    return successResponse(products);
  } catch (error) {
    return errorResponse(500, "Internal server error");
  }
};