# Design Document: Fix CloudFront CORS Preflight Errors

## Problem Statement

When guest users attempt to upload photos via the frontend `https://wedding.fishare.de`, the browser blocks the preflight `POST` request to `https://api.fishare.de/upload/presign` with the following CORS error:

```
Access to fetch at 'https://api.fishare.de/upload/presign?key=RH9QY5YF8PR6YHMU' from origin 'https://wedding.fishare.de' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
POST https://api.fishare.de/upload/presign?key=RH9QY5YF8PR6YHMU net::ERR_FAILED
```

## Root Cause Analysis

1. **CloudFront Function Design**:
   The CloudFront function located in `cloudfront/cors-handler.js` is designed as a `viewer-response` handler. It processes `event.response` to dynamically inject CORS headers into all responses returning to the client.

2. **CDK Association Mismatch**:
   In `lib/wedding-photo-stack.ts`, this function is associated with `cloudfront.FunctionEventType.VIEWER_REQUEST`.

3. **Execution Runtime Error**:
   When triggered as a `VIEWER_REQUEST`, the `event` object does not contain a `response` property (`event.response` is `undefined`). Thus, accessing `event.response.headers` throws a runtime `TypeError` (e.g. `Cannot set property 'access-control-allow-origin' of undefined`).

4. **Consequences**:
   Because the CloudFront function crashes, CloudFront returns an error response (such as a `502 Bad Gateway` or `400 Bad Request`) to the client without forwarding the request to the origin. This error response lacks any CORS headers, leading the browser to block the request and raise a CORS policy error.

## Proposed Solution (Approach 1)

Correct the CloudFront function event type association in the CDK stack from `VIEWER_REQUEST` to `VIEWER_RESPONSE`. This aligns the infrastructure association with the implementation code in `cloudfront/cors-handler.js`.

### Changes to CDK Configuration

In `lib/wedding-photo-stack.ts`:

```diff
     const apiDist = new cloudfront.Distribution(this, "ApiCloudFront", {
       domainNames: ["api.fishare.de"],
       certificate: apiCert,
       defaultBehavior: {
         origin: new origins.HttpOrigin(
           `${this.restApi.httpApiId}.execute-api.${this.region}.amazonaws.com`
         ),
         viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
         allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
         functionAssociations: [{
           function: corsFunction,
-          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
+          eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
         }],
       },
     });
```

## Verification & Testing Plan

1. **Unit Tests**:
   Ensure existing CDK stack and Lambda tests still pass.
   
2. **Preflight Request Mock Verification**:
   Send a preflight `OPTIONS` request to `https://api.fishare.de/upload/presign` and verify that the response contains `Access-Control-Allow-Origin: *` and has a `204` or `200` status.
