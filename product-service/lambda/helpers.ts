import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const initializeDocClient = (): DynamoDBDocumentClient => {
  const client = new DynamoDBClient({ region: "us-east-1" });
  return DynamoDBDocumentClient.from(client);
};

export const getTableNames = () => ({
  PRODUCTS_TABLE: process.env.PRODUCTS_TABLE || "products",
  STOCKS_TABLE: process.env.STOCKS_TABLE || "stocks",
});

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const errorResponse = (statusCode: number, message: string) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    ...corsHeaders,
  },
  body: JSON.stringify({ error: message }),
});

/**
 * Create success response with proper headers
 */
export const successResponse = (data: any) => ({
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    ...corsHeaders,
  },
  body: JSON.stringify(data),
});

/**
 * Handle CORS preflight requests
 */
export const handleCorsPreFlight = (event: any): any | null => {
  if (event?.requestContext?.http?.method === "OPTIONS" || event?.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }
  return null;
};
