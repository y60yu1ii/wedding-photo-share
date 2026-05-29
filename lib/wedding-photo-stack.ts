import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as certificatemanager from "aws-cdk-lib/aws-certificatemanager";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface WeddingPhotoStackProps extends cdk.StackProps {
  /** Route53 hosted zone ID for fishare.de (avoids AWS lookup during synth) */
  hostedZoneId?: string;
}

export class WeddingPhotoStack extends cdk.Stack {
  public readonly eventsTable: dynamodb.Table;
  public readonly keypairsTable: dynamodb.Table;
  public readonly photosTable: dynamodb.Table;
  public readonly connectionsTable: dynamodb.Table;
  public readonly photoBucket: s3.Bucket;
  public readonly restApi: apigwv2.HttpApi;
  public readonly websocketApi: apigwv2.CfnApi;
  public readonly uploadLambda: lambda.Function;
  public readonly adminLambda: lambda.Function;
  public readonly slideshowLambda: lambda.Function;
  public readonly myguestLambda: lambda.Function;
  public readonly websocketLambda: lambda.Function;
  public readonly dlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: WeddingPhotoStackProps = {}) {
    super(scope, id, props);

    const STAGE = this.node.tryGetContext("stage") ?? "prod";

    // ---------------------------------------------------------------------------
    // 1. DLQ
    // ---------------------------------------------------------------------------
    this.dlq = new sqs.Queue(this, "DeadLetterQueue", {
      queueName: `wedding-photo-dlq-${STAGE}`,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    // ---------------------------------------------------------------------------
    // 2. S3 Bucket
    // ---------------------------------------------------------------------------
    this.photoBucket = new s3.Bucket(this, "PhotoBucket", {
      bucketName: `wedding-photo-share-${STAGE}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      cors: [
        {
          allowedOrigins: ["*"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        {
          id: "abort-incomplete-uploads",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    // ---------------------------------------------------------------------------
    // 3. DynamoDB Tables
    // ---------------------------------------------------------------------------

    this.eventsTable = new dynamodb.Table(this, "EventsTable", {
      tableName: `wedding-photo-events-${STAGE}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.eventsTable.addGlobalSecondaryIndex({
      indexName: "status-createdAt-index",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.keypairsTable = new dynamodb.Table(this, "KeypairsTable", {
      tableName: `wedding-photo-keypairs-${STAGE}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    this.keypairsTable.addGlobalSecondaryIndex({
      indexName: "keyHash-index",
      partitionKey: { name: "keyHash", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.photosTable = new dynamodb.Table(this, "PhotosTable", {
      tableName: `wedding-photo-photos-${STAGE}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: "expireAt",
    });
    this.photosTable.addGlobalSecondaryIndex({
      indexName: "eventId-nickname-index",
      partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "nickname", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    this.photosTable.addGlobalSecondaryIndex({
      indexName: "eventId-status-index",
      partitionKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "status", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.connectionsTable = new dynamodb.Table(this, "ConnectionsTable", {
      tableName: `wedding-photo-connections-${STAGE}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: "expireAt",
    });

    // ---------------------------------------------------------------------------
    // 4. Secrets Manager
    // ---------------------------------------------------------------------------
    const jwtSecret = new secretsmanager.Secret(this, "JwtSecret", {
      secretName: `wedding-photo-jwt-secret-${STAGE}`,
      generateSecretString: {
        passwordLength: 64,
        excludePunctuation: false,
      },
    });

    // ---------------------------------------------------------------------------
    // 5. REST API Gateway (created before Lambdas so wsApiUrl is available)
    // ---------------------------------------------------------------------------
    this.restApi = new apigwv2.HttpApi(this, "RestApi", {
      apiName: `wedding-photo-api-${STAGE}`,
      corsPreflight: {
        allowCredentials: true,
        allowOrigins: ["https://wedding.fishare.de"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ["content-type", "authorization", "origin", "x-requested-with", "accept"],
        maxAge: cdk.Duration.days(1),
      },
    });

    const wsApiUrl = `https://${this.restApi.httpApiId}.execute-api.${this.region}.amazonaws.com`;

    // -------------------------------------------------------------------------
    // 6. Lambda Functions (using prebuilt zip to avoid Docker/esbuild bundling)
    // -------------------------------------------------------------------------
    const baseLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      deadLetterQueue: this.dlq,
      deadLetterQueueEnabled: true,
    };

    this.adminLambda = new lambda.Function(this, "AdminLambda", {
      ...baseLambdaProps,
      code: lambda.Code.fromAsset(`lambda-pkgs/admin`),
      handler: "index.handler",
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        KEYPAIRS_TABLE: this.keypairsTable.tableName,
        PHOTOS_TABLE: this.photosTable.tableName,
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
        JWT_SECRET_NAME: jwtSecret.secretName,
        PHOTO_BUCKET: this.photoBucket.bucketName,
        WEBSOCKET_API_URL: wsApiUrl,
        STAGE,
      },
    });

    this.uploadLambda = new lambda.Function(this, "UploadLambda", {
      ...baseLambdaProps,
      code: lambda.Code.fromAsset(`lambda-pkgs/upload`),
      handler: "index.handler",
      environment: {
        PHOTOS_TABLE: this.photosTable.tableName,
        KEYPAIRS_TABLE: this.keypairsTable.tableName,
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
        PHOTO_BUCKET: this.photoBucket.bucketName,
        EVENTS_TABLE: this.eventsTable.tableName,
        WEBSOCKET_API_URL: wsApiUrl,
        STAGE,
      },
    });

    this.slideshowLambda = new lambda.Function(this, "SlideshowLambda", {
      ...baseLambdaProps,
      code: lambda.Code.fromAsset(`lambda-pkgs/slideshow`),
      handler: "index.handler",
      timeout: cdk.Duration.seconds(10),
      environment: {
        PHOTOS_TABLE: this.photosTable.tableName,
        PHOTO_BUCKET: this.photoBucket.bucketName,
        STAGE,
      },
    });

    this.myguestLambda = new lambda.Function(this, "MyGuestLambda", {
      ...baseLambdaProps,
      code: lambda.Code.fromAsset(`lambda-pkgs/myguest`),
      handler: "index.handler",
      timeout: cdk.Duration.seconds(10),
      environment: {
        PHOTOS_TABLE: this.photosTable.tableName,
        PHOTO_BUCKET: this.photoBucket.bucketName,
        STAGE,
      },
    });

    this.websocketLambda = new lambda.Function(this, "WebSocketLambda", {
      ...baseLambdaProps,
      code: lambda.Code.fromAsset(`lambda-pkgs/websocket`),
      handler: "index.handler",
      environment: {
        CONNECTIONS_TABLE: this.connectionsTable.tableName,
        STAGE,
      },
    });

    // IAM grants
    for (const tbl of [this.eventsTable, this.keypairsTable, this.photosTable, this.connectionsTable]) {
      tbl.grantReadWriteData(this.adminLambda);
      tbl.grantReadWriteData(this.uploadLambda);
      tbl.grantReadData(this.slideshowLambda);
      tbl.grantReadWriteData(this.myguestLambda);
      tbl.grantReadWriteData(this.websocketLambda);
    }
    this.photoBucket.grantReadWrite(this.uploadLambda);
    this.photoBucket.grantRead(this.slideshowLambda);
    this.photoBucket.grantRead(this.adminLambda);
    this.photoBucket.grantReadWrite(this.myguestLambda);
    jwtSecret.grantRead(this.adminLambda);
    this.dlq.grantSendMessages(this.uploadLambda);

    // ---------------------------------------------------------------------------
    // 7. REST API Routes
    // ---------------------------------------------------------------------------
    const adminInt = new integrations.HttpLambdaIntegration("AdminIntegration", this.adminLambda);
    const uploadInt = new integrations.HttpLambdaIntegration("UploadIntegration", this.uploadLambda);
    const slideshowInt = new integrations.HttpLambdaIntegration("SlideshowIntegration", this.slideshowLambda);
    const myguestInt = new integrations.HttpLambdaIntegration("MyGuestIntegration", this.myguestLambda);

    this.restApi.addRoutes({
      path: "/admin/login",
      methods: [apigwv2.HttpMethod.ANY, apigwv2.HttpMethod.OPTIONS],
      integration: adminInt,
    });
    this.restApi.addRoutes({
      path: "/admin/events",
      methods: [apigwv2.HttpMethod.ANY, apigwv2.HttpMethod.OPTIONS],
      integration: adminInt,
    });
    this.restApi.addRoutes({
      path: "/admin/events/{eventId}",
      methods: [apigwv2.HttpMethod.ANY, apigwv2.HttpMethod.OPTIONS],
      integration: adminInt,
    });
    this.restApi.addRoutes({
      path: "/admin/events/{eventId}/photos",
      methods: [apigwv2.HttpMethod.GET],
      integration: adminInt,
    });
    this.restApi.addRoutes({
      path: "/admin/photos/{photoId}",
      methods: [apigwv2.HttpMethod.ANY, apigwv2.HttpMethod.OPTIONS],
      integration: adminInt,
    });
    this.restApi.addRoutes({
      path: "/upload/presign",
      methods: [apigwv2.HttpMethod.ANY, apigwv2.HttpMethod.OPTIONS],
      integration: uploadInt,
    });
    this.restApi.addRoutes({
      path: "/upload/confirm",
      methods: [apigwv2.HttpMethod.ANY, apigwv2.HttpMethod.OPTIONS],
      integration: uploadInt,
    });
    this.restApi.addRoutes({
      path: "/slideshow/photos",
      methods: [apigwv2.HttpMethod.GET],
      integration: slideshowInt,
    });
    this.restApi.addRoutes({
      path: "/slideshow/presign/{photoId}",
      methods: [apigwv2.HttpMethod.GET],
      integration: slideshowInt,
    });
    this.restApi.addRoutes({
      path: "/myguest/photos",
      methods: [apigwv2.HttpMethod.GET],
      integration: myguestInt,
    });
    this.restApi.addRoutes({
      path: "/myguest/photos/{photoId}",
      methods: [apigwv2.HttpMethod.DELETE],
      integration: myguestInt,
    });

    // ---------------------------------------------------------------------------
    // 8. WebSocket API (L1 for full control)
    // ---------------------------------------------------------------------------
    this.websocketApi = new apigwv2.CfnApi(this, "WebSocketApi", {
      name: `wedding-photo-websocket-${STAGE}`,
      protocolType: "WEBSOCKET",
      routeSelectionExpression: "$request.body.type",
    });

    // Use L1 CfnIntegration to get attrIntegrationId for routes
    const wsLambdaIntegration = new apigwv2.CfnIntegration(this, "WsLambdaIntegration", {
      apiId: this.websocketApi.ref,
      integrationType: "AWS_PROXY",
      integrationUri: this.websocketLambda.functionArn,
    });

    new apigwv2.CfnRoute(this, "WsConnectRoute", {
      apiId: this.websocketApi.ref,
      routeKey: "$connect",
      authorizationType: "NONE",
    });
    new apigwv2.CfnRoute(this, "WsDisconnectRoute", {
      apiId: this.websocketApi.ref,
      routeKey: "$disconnect",
      authorizationType: "NONE",
    });
    new apigwv2.CfnRoute(this, "WsBroadcastRoute", {
      apiId: this.websocketApi.ref,
      routeKey: "broadcast",
      target: `integrations/${wsLambdaIntegration.attrIntegrationId}`,
    });

    new apigwv2.CfnStage(this, "WsStage", {
      apiId: this.websocketApi.ref,
      stageName: STAGE,
      autoDeploy: true,
    });

    // ---------------------------------------------------------------------------
    // 9. CloudWatch Alarms
    // ---------------------------------------------------------------------------
    const lambdas = [
      { name: "AdminLambda", fn: this.adminLambda },
      { name: "UploadLambda", fn: this.uploadLambda },
      { name: "SlideshowLambda", fn: this.slideshowLambda },
      { name: "MyGuestLambda", fn: this.myguestLambda },
      { name: "WebSocketLambda", fn: this.websocketLambda },
    ];

    for (const { name, fn } of lambdas) {
      new cloudwatch.Alarm(this, `${name}ErrorRate`, {
        alarmName: `${name}-error-rate-${STAGE}`,
        metric: fn.metricErrors({ period: cdk.Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      });

      new cloudwatch.Alarm(this, `${name}Duration`, {
        alarmName: `${name}-duration-${STAGE}`,
        metric: fn.metricDuration({ period: cdk.Duration.minutes(5) }),
        threshold: 20_000,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      });
    }

    // -------------------------------------------------------------------------
    // 10. Frontend Hosting — S3 + CloudFront + Route53
    // -------------------------------------------------------------------------
    // hostedZoneId passed as prop to avoid AWS lookup during synth/test
    const hostedZone = props?.hostedZoneId
      ? route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
          hostedZoneId: props.hostedZoneId,
          zoneName: "fishare.de",
        })
      : new route53.PublicHostedZone(this, "HostedZone", {
          zoneName: "fishare.de",
        });

    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      bucketName: `wedding-photo-frontend-${STAGE}-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Import existing wildcard cert (already validated, covers *.fishare.de and wedding.fishare.de)
    const siteCert = certificatemanager.Certificate.fromCertificateArn(
      this, "SiteCert",
      "arn:aws:acm:us-east-1:127537619055:certificate/94ea226c-488d-491d-8a23-0e80d0e2ef73"
    );

    const distribution = new cloudfront.Distribution(this, "CloudFrontDist", {
      defaultRootObject: "index.html",
      domainNames: ["wedding.fishare.de"],
      certificate: siteCert,
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket),
        compress: true,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      // SPA routing: all 403/404 fall back to index.html for client-side router
      errorResponses: [
        { httpStatus: 403, responsePagePath: "/index.html", responseHttpStatus: 200 },
        { httpStatus: 404, responsePagePath: "/index.html", responseHttpStatus: 200 },
      ],
    });

    new route53.ARecord(this, "SiteAlias", {
      zone: hostedZone,
      recordName: "wedding",
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new BucketDeployment(this, "DeployFrontend", {
      sources: [Source.asset("./frontend/build")],
      destinationBucket: frontendBucket,
      prune: false,
      distribution,
      distributionPaths: ["/*"],
    });

    // API subdomain CloudFront → API Gateway
    // Use same wildcard cert for API subdomain (already validated)
    const apiCert = certificatemanager.Certificate.fromCertificateArn(
      this, "ApiCert",
      "arn:aws:acm:us-east-1:127537619055:certificate/94ea226c-488d-491d-8a23-0e80d0e2ef73"
    );

    // CloudFront Function to handle CORS preflight directly at edge (bypasses API Gateway)
    const corsFunction = new cloudfront.Function(this, "CorsPreflightFunction", {
      functionName: `wedding-cors-${STAGE}`,
      code: cloudfront.FunctionCode.fromFile({
        filePath: "cloudfront/cors-handler.js",
      }),
    });

    const apiDist = new cloudfront.Distribution(this, "ApiCloudFront", {
      domainNames: ["api.fishare.de"],
      certificate: apiCert,
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          `${this.restApi.httpApiId}.execute-api.${this.region}.amazonaws.com`
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        functionAssociations: [{
          function: corsFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
        }],
      },
    });

    new route53.ARecord(this, "ApiAlias", {
      zone: hostedZone,
      recordName: "api",
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(apiDist)),
    });

    // ---------------------------------------------------------------------------
    // 11. Outputs
    // ---------------------------------------------------------------------------
    new cdk.CfnOutput(this, "PhotoBucketName", {
      value: this.photoBucket.bucketName,
      exportName: `wedding-photo-bucket-${STAGE}`,
    });
    new cdk.CfnOutput(this, "RestApiUrl", {
      value: this.restApi.url ?? "unknown",
      exportName: `wedding-photo-api-url-${STAGE}`,
    });
    new cdk.CfnOutput(this, "WebSocketApiUrl", {
      value: `wss://${this.websocketApi.ref}.execute-api.${this.region}.amazonaws.com/${STAGE}`,
      exportName: `wedding-photo-websocket-url-${STAGE}`,
    });
    new cdk.CfnOutput(this, "EventsTableName", {
      value: this.eventsTable.tableName,
      exportName: `wedding-photo-events-table-${STAGE}`,
    });
    new cdk.CfnOutput(this, "PhotosTableName", {
      value: this.photosTable.tableName,
      exportName: `wedding-photo-photos-table-${STAGE}`,
    });
  }
}
