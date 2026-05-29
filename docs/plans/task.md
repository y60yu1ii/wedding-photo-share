| Task | Status | Description |
| --- | --- | --- |
| Task 1: CDK Architecture and Permissions Update | Completed | Update CloudFront policies, grant S3 read permission, and configure environment variables. |
| Task 2: Physical Cascade Deletion for Admin Lambda | Completed | Refactor deleteEvent to physically delete event, keypairs, photos, and S3 objects. |
| Task 3: Admin Real Photo Preview in Dashboard | Completed | Instantiated S3Client and generate presigned GET URLs for admin photo list. |
| Task 4: Optional Photo Review Support (requiresReview Toggle) | Completed | Support requiresReview configuration on creation, PATCH update, and confirm upload status. |
| Task 5: Comprehensive MIME Type and Unicode Nickname Validation | Completed | Allow image/* uploads and any Unicode combination for guest nicknames excluding HTML tags. |
| Task 6: Frontend API Client Update | Completed | Add PATCH /admin/events/{id} route support to frontend events client. |
| Task 7: Frontend UI Review Option Implementation | Completed | Add requiresReview checkbox to creation form and dynamic toggle button to details page. |
| Task 8: Rebuild and Final Verification | Completed | Compile typescript, rebuild frontend, and run full test suites. |
| Task 9: Implement Photo Deletion API | Completed | Create deletePhoto helper in Admin Lambda, physically delete from S3 & DynamoDB, broadcast WS delete_photo event, and bind to DELETE /admin/photos/{photoId} route. |
| Task 10: Update Frontend API Client for Photo Deletion | Completed | Add deletePhoto method using DELETE /admin/photos/{photoId} to client.ts. |
| Task 11: Upgrade Admin Event Details UI with WebSocket & Deletion | Completed | Establish WebSocket on mount, support dynamic hot-reloading list on WS message, add connection indicator, and implement multi-action photo cards with "下架並刪除" button. |
| Task 12: Rebuild & Final Verification | Completed | Compile Lambda bundles, rebuild frontend, and run all Jest unit tests (50/50 passing). |
