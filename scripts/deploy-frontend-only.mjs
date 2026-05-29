#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const stackName = process.env.CDK_STACK_NAME ?? "WeddingPhotoStack";
const siteDomain = process.env.FRONTEND_DOMAIN ?? "wedding.fishare.de";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    ...options,
  });
}

function capture(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  }).trim();
}

function readStackOutput(key) {
  try {
    const raw = capture("aws", [
      "cloudformation",
      "describe-stacks",
      "--stack-name",
      stackName,
      "--query",
      `Stacks[0].Outputs[?OutputKey==\`${key}\`].OutputValue | [0]`,
      "--output",
      "text",
    ]);
    return raw && raw !== "None" ? raw : null;
  } catch {
    return null;
  }
}

function getAccountId() {
  return capture("aws", [
    "sts",
    "get-caller-identity",
    "--query",
    "Account",
    "--output",
    "text",
  ]);
}

function getFrontendBucketName() {
  const fromStack = readStackOutput("FrontendBucketName");
  if (fromStack) return fromStack;
  const accountId = process.env.AWS_ACCOUNT_ID ?? getAccountId();
  return `wedding-photo-frontend-prod-${accountId}`;
}

function getDistributionId() {
  const fromStack = readStackOutput("FrontendDistributionId");
  if (fromStack) return fromStack;

  const raw = capture("aws", [
    "cloudfront",
    "list-distributions",
    "--output",
    "json",
  ]);
  const parsed = JSON.parse(raw);
  const items = parsed?.DistributionList?.Items ?? [];
  const match = items.find((item) => (item.Aliases?.Items ?? []).includes(siteDomain));
  if (!match?.Id) {
    throw new Error(`Could not find CloudFront distribution for ${siteDomain}`);
  }
  return match.Id;
}

function ensureBuildExists() {
  run("npm", ["run", "build:frontend"]);
}

function syncFrontend(bucketName) {
  run("aws", [
    "s3",
    "sync",
    "frontend/build",
    `s3://${bucketName}`,
    "--delete",
    "--only-show-errors",
  ]);
}

function invalidateDistribution(distributionId) {
  run("aws", [
    "cloudfront",
    "create-invalidation",
    "--distribution-id",
    distributionId,
    "--paths",
    "/*",
  ]);
}

function main() {
  ensureBuildExists();
  const bucketName = getFrontendBucketName();
  const distributionId = getDistributionId();

  console.log(`Deploying frontend to s3://${bucketName}`);
  syncFrontend(bucketName);

  console.log(`Invalidating CloudFront distribution ${distributionId}`);
  invalidateDistribution(distributionId);
}

main();
