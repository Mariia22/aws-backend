import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const getProductsListLambda = new lambda.Function(this, "GetProductsListFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "getProductsList.handler",
      code: lambda.Code.fromAsset("lambda"),
    });

    const getProductByIdLambda = new lambda.Function(this, "GetProductByIdFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "getProductById.handler",
      code: lambda.Code.fromAsset("lambda"),
    });

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
      new apigateway.LambdaIntegration(getProductsListLambda)
    );

    const singleProduct = products.addResource("{productId}");

    singleProduct.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductByIdLambda)
    );
  }
}