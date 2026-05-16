import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Product } from "../types/Product";
import {
  initializeDocClient,
  getTableNames,
  errorResponse,
  successResponse,
  handleCorsPreFlight,
  corsHeaders,
} from "./helpers";

const docClient = initializeDocClient();
const { PRODUCTS_TABLE, STOCKS_TABLE } = getTableNames();

export const handler = async (event?: any) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreFlight(event);
  if (corsResponse) return corsResponse;

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