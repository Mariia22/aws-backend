import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  try {
    const fileName = event.queryStringParameters?.name;

    if (!fileName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing 'name' query parameter" }),
      };
    }

    const s3Key = `uploaded/${fileName}`;
    const bucketName = process.env.BUCKET_NAME;

    if (!bucketName) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Bucket name not configured" }),
      };
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    return {
      statusCode: 200,
      body: signedUrl,
      headers: {
        "Content-Type": "text/plain",
      },
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate signed URL" }),
    };
  }
};