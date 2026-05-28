# robustness

## ADDED Requirements

### Requirement: ROB-1 — Lambda Concurrency Limits

The system SHALL configure Lambda reserved concurrency to ensure upload handlers can scale under burst traffic without starving other functions.

#### Scenario: Burst upload traffic
- **GIVEN** 100 guests uploading photos simultaneously
- **WHEN** the Lambda concurrency limit is set to 100 for upload-handler
- **THEN** all upload requests SHALL be processed without throttling

### Requirement: ROB-2 — DynamoDB On-Demand Capacity

The system SHALL use DynamoDB on-demand capacity mode (PAY_PER_REQUEST) to handle variable traffic without manual capacity planning.

#### Scenario: Traffic spike
- **GIVEN** a sudden surge of photo uploads during the wedding reception
- **WHEN** DynamoDB is configured with on-demand mode
- **THEN** DynamoDB SHALL automatically scale to handle the write throughput

### Requirement: ROB-3 — WebSocket Connection TTL

The system SHALL set a 1-hour TTL on WebSocket connection records in DynamoDB to automatically clean up stale connections after client disconnects.

#### Scenario: Client disconnect without clean close
- **GIVEN** a client loses network connectivity without sending a disconnect message
- **WHEN** 1 hour passes
- **THEN** DynamoDB TTL SHALL automatically delete the connection record

### Requirement: ROB-4 — Dead Letter Queue for Lambda Failures

The system SHALL configure a DLQ (SQS) on all Lambda functions to capture failed invocations for later replay.

#### Scenario: Lambda invocation failure
- **GIVEN** a Lambda function throws an unhandled exception
- **WHEN** the invocation fails
- **THEN** the event SHALL be sent to the configured DLQ SQS queue

### Requirement: ROB-5 — CloudWatch Alarms

The system SHALL create CloudWatch alarms for Lambda error rate > 1% for 5 minutes and Lambda duration > 20 seconds.

#### Scenario: Error rate alarm
- **GIVEN** Lambda error rate exceeds 1% for 5 consecutive minutes
- **WHEN** the CloudWatch alarm fires
- **THEN** an SNS notification SHALL be sent to the configured alert email

### Requirement: ROB-6 — Upload Retry with Backoff

The system SHALL implement client-side retry logic for the upload confirm step, retrying up to 3 times with exponential backoff on 5xx responses.

#### Scenario: Transient server error
- **GIVEN** a 503 response from `/upload/confirm`
- **WHEN** the client has retries remaining
- **THEN** the client SHALL wait 1s, 2s, 4s and retry up to 3 times total

### Requirement: ROB-7 — Slideshow localStorage Backup

The system SHALL store the last known photo list in localStorage so the slideshow can display the last photos even if WebSocket is disconnected.

#### Scenario: Offline slideshow
- **GIVEN** the WebSocket connection is lost and reconnection is in progress
- **WHEN** the slideshow page renders
- **THEN** the system SHALL display photos from localStorage while waiting for reconnection

### Requirement: ROB-8 — API Gateway Timeout Matching

The system SHALL configure API Gateway timeout to match Lambda timeout (30s for upload/websocket, 10s for admin) to prevent hanging connections.

#### Scenario: Slow Lambda response
- **GIVEN** a Lambda function takes 25 seconds due to cold start
- **WHEN** API Gateway timeout is set to 30s
- **THEN** the request SHALL complete successfully without API Gateway timeout error

### Requirement: ROB-9 — S3 Multipart Upload for Large Files

The system SHALL use S3 multipart upload for files exceeding 5MB to ensure reliable large file transfers.

#### Scenario: Large photo upload
- **GIVEN** a photo file larger than 5MB
- **WHEN** the upload is initiated
- **THEN** the client or Lambda SHALL use S3 multipart upload to transfer the file
