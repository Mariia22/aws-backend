import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Readable } from "stream";
import csv from "csv-parser";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
  try {
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, " ")
    );

    console.log(`Processing file: s3://${bucket}/${key}`);

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    const sqsQueueUrl = process.env.SQS_QUEUE_URL;

    const stream = response.Body as Readable;

    return new Promise((resolve, reject) => {
      let recordCount = 0;

      stream
        .pipe(csv())
        .on("data", async (record) => {
          try {
            // Send each CSV record to SQS
            await sqsClient.send(
              new SendMessageCommand({
                QueueUrl: sqsQueueUrl,
                MessageBody: JSON.stringify(record),
              })
            );
            recordCount++;
          } catch (error) {
            console.error("Error sending message to SQS:", error);
            throw error;
          }
        })
        .on("end", async () => {
          console.log(`Successfully sent ${recordCount} records to SQS`);

          try {
            const fileName = key.split("/").pop();
            const newKey = `parsed/${fileName}`;

            await s3Client.send(
              new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${key}`,
                Key: newKey,
              })
            );

            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: bucket,
                Key: key,
              })
            );

            resolve({
              statusCode: 200,
              recordsProcessed: recordCount,
              fileMoved: true,
            });
          } catch (error) {
            console.error("Error moving file:", error);
            reject(error);
          }
        })
        .on("error", (error) => {
          console.error("Error parsing CSV:", error);
          reject(error);
        });
    });
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
};
