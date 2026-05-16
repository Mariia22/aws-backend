/**
 * API Configuration for AWS Backend Services
 * This file is shared with the frontend for API integration
 */

export const API_PATHS = {
  // Product Service endpoints
  PRODUCTS: {
    LIST: "/products",
    GET_BY_ID: "/products/{productId}",
  },
  // Import Service endpoints
  IMPORT: {
    FILE: "/import",
  },
} as const;

/**
 * Helper to get the import signed URL
 * @param apiBaseUrl - The base URL of the API (e.g., https://api.example.com)
 * @param fileName - The name of the CSV file to upload
 * @returns Promise with the signed URL
 */
export async function getImportSignedUrl(
  apiBaseUrl: string,
  fileName: string
): Promise<string> {
  const url = new URL(API_PATHS.IMPORT.FILE, apiBaseUrl);
  url.searchParams.append("name", fileName);

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Failed to get signed URL: ${response.statusText}`);
  }

  return response.text();
}
