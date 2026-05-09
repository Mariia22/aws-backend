import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: "us-east-1" });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = "products";
const STOCKS_TABLE = "stocks";

type Product = {
  id: string;
  title: string;
  description?: string;
  price: number;
};

type Stock = {
  product_id: string;
  count: number;
};

const products: Product[] = [
  {
    id: uuidv4(),
    title: "Laptop",
    description: "Gaming laptop",
    price: 1500,
  },
  {
    id: uuidv4(),
    title: "Phone",
    description: "Smartphone",
    price: 800,
  },
  {
    id: uuidv4(),
    title: "Headphones",
    description: "Wireless headphones",
    price: 200,
  },
];

const MAX_STOCK = 100;

async function insertProduct(product: Product) {
  await docClient.send(
    new PutCommand({
      TableName: PRODUCTS_TABLE,
      Item: product,
    })
  );
}

async function insertStock(stock: Stock) {
  await docClient.send(
    new PutCommand({
      TableName: STOCKS_TABLE,
      Item: stock,
    })
  );
}

async function seed() {
  try {
    for (const product of products) {
      await insertProduct(product);

      const stock: Stock = {
        product_id: product.id,
        count: Math.floor(Math.random() * MAX_STOCK),
      };

      await insertStock(stock);

    }
  } catch (error) {
    console.error("Seeding failed:", error);
  }
}

seed();