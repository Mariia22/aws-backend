import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Product } from "../types/Product";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || "products";
const STOCKS_TABLE = process.env.STOCKS_TABLE || "stocks";

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

    // Fetch product from DynamoDB
    const productResult = await docClient.send(
      new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { id: productId },
      })
    );

    const product = productResult.Item;

    if (!product) {
      return errorResponse(404, `Product with ID "${productId}" not found`);
    }

    const stockResult = await docClient.send(
      new GetCommand({
        TableName: STOCKS_TABLE,
        Key: { product_id: productId },
      })
    );

    const stock = stockResult.Item;

    const joinedProduct: Product = {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      count: stock?.count || 0,
    };

    return successResponse(joinedProduct);
  } catch (error) {
    console.error("Error fetching product:", error);
    return errorResponse(500, "Internal server error");
  }
};