import * as cdk from "aws-cdk-lib";
import { WeddingPhotoStack } from "../lib/wedding-photo-stack";

const app = new cdk.App();

new WeddingPhotoStack(app, "WeddingPhotoStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  hostedZoneId: "Z3RXA1N6WFQCGC",
});

app.synth();
