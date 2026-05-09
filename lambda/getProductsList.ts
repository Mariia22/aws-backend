import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Product } from "../types/Product";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || "products";
const STOCKS_TABLE = process.env.STOCKS_TABLE || "stocks";

const errorResponse = (statusCode: number, message: string) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  },
  body: JSON.stringify({ error: message }),
});

const successResponse = (data: any) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  },
  body: JSON.stringify(data),
});

export const handler = async (event?: any) => {
  try {
    const productsResult = await docClient.send(
      new ScanCommand({ TableName: PRODUCTS_TABLE })
    );
    const products = productsResult.Items || [];

    const stocksResult = await docClient.send(
      new ScanCommand({ TableName: STOCKS_TABLE })
    );
    const stocks = stocksResult.Items || [];

    const stockMap = new Map(stocks.map((s: any) => [s.product_id, s.count]));

    const joinedProducts: Product[] = products.map((product: any) => ({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      count: stockMap.get(product.id) || 0,
    }));

    return successResponse(joinedProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    return errorResponse(500, "Internal server error");
  }
};