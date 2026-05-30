import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = new dynamodb.Table(this, "ProductsTable", {
      tableName: "products",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const stocksTable = new dynamodb.Table(this, "StocksTable", {
      tableName: "stocks",
      partitionKey: { name: "product_id", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Import the existing SQS queue
    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      "CatalogItemsQueue",
      `arn:aws:sqs:${this.region}:${this.account}:catalogItemsQueue`
    );

    // Create SNS topic for product creation notifications
    const createProductTopic = sns.Topic.fromTopicArn(
      this,
      "CreateProductTopic",
      `arn:aws:sns:${this.region}:${this.account}:createProductTopic`
    );

    // Email subscriptions with filter policies
    // High-price products (>= $100) to premium-deals@example.com
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("premium-deals@example.com", {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            greaterThanOrEqualTo: 100,
          }),
        },
      })
    );

    // Budget products (< $50) to budget-deals@example.com
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("budget-deals@example.com", {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            lessThan: 50,
          }),
        },
      })
    );

    // Mid-range products ($50-$99.99) to mid-range@example.com
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("mid-range@example.com", {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            greaterThanOrEqualTo: 50,
            lessThan: 100,
          }),
        },
      })
    );

    // All products to admin@example.com (no filter)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("admin@example.com")
    );

    const catalogBatchProcessLambda = new lambda.Function(this, "CatalogBatchProcessFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "catalogBatchProcess.handler",
      code: lambda.Code.fromAsset("dist/lambda"),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        SNS_TOPIC_ARN: createProductTopic.topicArn,
      },
      timeout: cdk.Duration.seconds(60),
    });

    // Grant SNS publish permission to the lambda
    createProductTopic.grantPublish(catalogBatchProcessLambda);

    catalogBatchProcessLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
      })
    );

    productsTable.grantWriteData(catalogBatchProcessLambda);
    stocksTable.grantWriteData(catalogBatchProcessLambda);

    const getProductsListLambda = new lambda.Function(this, "GetProductsListFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "getProductsList.handler",
      code: lambda.Code.fromAsset("dist/lambda"),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    const getProductByIdLambda = new lambda.Function(this, "GetProductByIdFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "getProductById.handler",
      code: lambda.Code.fromAsset("dist/lambda"),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    productsTable.grantReadData(getProductsListLambda);
    stocksTable.grantReadData(getProductsListLambda);
    
    productsTable.grantReadData(getProductByIdLambda);
    stocksTable.grantReadData(getProductByIdLambda);

    const api = new apigateway.RestApi(this, "ProductApi", {
      restApiName: "Product Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });


    const products = api.root.addResource("products");

    products.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsListLambda),
      {
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "500" },
        ],
      }
    );

    const singleProduct = products.addResource("{productId}");

    singleProduct.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductByIdLambda),
      {
        methodResponses: [
          { statusCode: "200" },
          { statusCode: "400" },
          { statusCode: "404" },
          { statusCode: "500" },
        ],
      }
    );
  }
}