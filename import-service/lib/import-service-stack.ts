import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const importBucket = new s3.Bucket(this, "ImportBucket", {
      bucketName: `import-products-bucket-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
    });

    // Lambda function to generate signed URLs
    const importProductsFileLambda = new lambda.Function(
      this,
      "ImportProductsFileFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "importProductsFile.handler",
        code: lambda.Code.fromAsset("dist/lambda"),
        environment: {
          BUCKET_NAME: importBucket.bucketName,
        },
      }
    );

    importBucket.grantWrite(importProductsFileLambda);

    // Reference the existing SQS queue
    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      "CatalogItemsQueue",
      `arn:aws:sqs:${this.region}:${this.account}:catalogItemsQueue`
    );

    // Lambda function to parse CSV files
    const importFileParserLambda = new lambda.Function(
      this,
      "ImportFileParserFn",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "importFileParser.handler",
        code: lambda.Code.fromAsset("dist/lambda"),
        timeout: cdk.Duration.minutes(5),
        memorySize: 512,
        environment: {
          SQS_QUEUE_URL: `https://sqs.${this.region}.amazonaws.com/${this.account}/catalogItemsQueue`,
        },
      }
    );

    // Grant read, write, and delete permissions to parse, copy, and move files
    importBucket.grantRead(importFileParserLambda);
    importBucket.grantWrite(importFileParserLambda);

    // Grant send message permission to SQS queue
    importFileParserLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sqs:SendMessage"],
        resources: [
          `arn:aws:sqs:${this.region}:${this.account}:catalogItemsQueue`,
        ],
      })
    );

    // Add S3 event notification for ObjectCreated events in the uploaded folder
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserLambda),
      {
        prefix: "uploaded/",
      }
    );

    // API Gateway setup
    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const importResource = api.root.addResource("import");

    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFileLambda),
      {
        requestParameters: {
          "method.request.querystring.name": true,
        },
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "400" },
          { statusCode: "500" },
        ],
      }
    );
  }
}