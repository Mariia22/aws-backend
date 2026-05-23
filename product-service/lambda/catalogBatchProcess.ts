import { SQSEvent, SQSHandler } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { initializeDocClient, getTableNames } from "./helpers";

const { v4: uuidv4 } = require("uuid");

interface CatalogItem {
  title: string;
  description?: string;
  price: number;
  count: number;
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  const docClient = initializeDocClient();
  const snsClient = new SNSClient({ region: process.env.AWS_REGION });
  const { PRODUCTS_TABLE, STOCKS_TABLE } = getTableNames();
  const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

  console.log("Processing batch of messages:", event.Records.length);

  const results = [];

  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      console.log("Processing message:", messageBody);

      const catalogItem: CatalogItem = {
        title: messageBody.title,
        description: messageBody.description,
        price: messageBody.price,
        count: messageBody.count,
      };

      // Validate required fields
      if (!catalogItem.title || catalogItem.price === undefined || catalogItem.price === null) {
        throw new Error("Missing required fields: title and price are required");
      }

      const productId = uuidv4();

      // Insert product into products table
      await docClient.send(
        new PutCommand({
          TableName: PRODUCTS_TABLE,
          Item: {
            id: productId,
            title: catalogItem.title,
            description: catalogItem.description || "",
            price: catalogItem.price,
          },
        })
      );

      // Insert stock into stocks table
      await docClient.send(
        new PutCommand({
          TableName: STOCKS_TABLE,
          Item: {
            product_id: productId,
            count: catalogItem.count || 0,
          },
        })
      );

      // Publish notification to SNS with message attributes for filtering
      await snsClient.send(
        new PublishCommand({
          TopicArn: SNS_TOPIC_ARN,
          Subject: `New Product Created: ${catalogItem.title}`,
          Message: `A new product has been created:\n\nTitle: ${catalogItem.title}\nPrice: $${catalogItem.price}\nDescription: ${catalogItem.description || "N/A"}\nProduct ID: ${productId}`,
          MessageAttributes: {
            price: {
              DataType: "Number",
              StringValue: catalogItem.price.toString(),
            },
            title: {
              DataType: "String",
              StringValue: catalogItem.title,
            },
          },
        })
      );

      results.push({
        messageId: record.messageId,
        status: "success",
        productId,
      });

      console.log(`Successfully created product ${productId} from message ${record.messageId}`);
    } catch (error) {
      console.error(`Error processing message ${record.messageId}:`, error);
      results.push({
        messageId: record.messageId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  console.log("Batch processing completed:", results);
};
