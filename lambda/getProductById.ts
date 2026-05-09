import { GetCommand } from "@aws-sdk/lib-dynamodb";
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

export const handler = async (event: any) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPreFlight(event);
  if (corsResponse) return corsResponse;

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