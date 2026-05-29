import * as cdk from "aws-cdk-lib";
import { WeddingPhotoStack } from "../lib/wedding-photo-stack";

const app = new cdk.App();
new WeddingPhotoStack(app, "WeddingPhotoShare", {
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

app.synth();
