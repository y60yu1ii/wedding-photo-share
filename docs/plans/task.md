| Task | Status | Description |
| --- | --- | --- |
| Task 1: CDK Architecture and Permissions Update | Completed | Update CloudFront policies, grant S3 read permission, and configure environment variables. |
| Task 2: Physical Cascade Deletion for Admin Lambda | Completed | Refactor deleteEvent to physically delete event, keypairs, photos, and S3 objects. |
| Task 3: Admin Real Photo Preview in Dashboard | Completed | Instantiated S3Client and generate presigned GET URLs for admin photo list. |
| Task 4: Optional Photo Review Support (requiresReview Toggle) | Completed | Support requiresReview configuration on creation, PATCH update, and confirm upload status. |
| Task 5: Comprehensive MIME Type and Unicode Nickname Validation | Completed | Allow image/* uploads and any Unicode combination for guest nicknames excluding HTML tags. |
| Task 6: Frontend API Client Update | Completed | Add PATCH /admin/events/{id} route support to frontend events client. |
| Task 7: Frontend UI Review Option Implementation | In Progress | Add requiresReview checkbox to creation form and dynamic toggle button to details page. |
| Task 8: Rebuild and Final Verification | Pending | Compile typescript, rebuild frontend, and run full test suites. |
