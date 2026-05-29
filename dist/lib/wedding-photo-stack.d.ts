import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
export interface WeddingPhotoStackProps extends cdk.StackProps {
    /** Route53 hosted zone ID for fishare.de (avoids AWS lookup during synth) */
    hostedZoneId?: string;
}
export declare class WeddingPhotoStack extends cdk.Stack {
    readonly eventsTable: dynamodb.Table;
    readonly keypairsTable: dynamodb.Table;
    readonly photosTable: dynamodb.Table;
    readonly connectionsTable: dynamodb.Table;
    readonly photoBucket: s3.Bucket;
    readonly restApi: apigwv2.HttpApi;
    readonly websocketApi: apigwv2.CfnApi;
    readonly uploadLambda: lambda.Function;
    readonly adminLambda: lambda.Function;
    readonly slideshowLambda: lambda.Function;
    readonly myguestLambda: lambda.Function;
    readonly websocketLambda: lambda.Function;
    readonly dlq: sqs.Queue;
    constructor(scope: Construct, id: string, props?: WeddingPhotoStackProps);
}
//# sourceMappingURL=wedding-photo-stack.d.ts.map