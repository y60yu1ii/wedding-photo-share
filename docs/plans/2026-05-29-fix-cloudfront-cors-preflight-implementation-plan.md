# CloudFront CORS Preflight Fix Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Fix the guest upload CORS preflight issue by correcting the CloudFront Function association type from `VIEWER_REQUEST` to `VIEWER_RESPONSE`.

**Architecture:** We will modify the CDK stack code to associate the `corsFunction` with `cloudfront.FunctionEventType.VIEWER_RESPONSE` instead of `VIEWER_REQUEST`. We will also add a Jest test to `test/wedding-photo-stack.test.ts` checking for this event type to follow Test-Driven Development (TDD).

**Tech Stack:** AWS CDK (v2), AWS CloudFront, TypeScript, Jest.

---

### Task 1: Add a failing test for CloudFront Function association event type

**Files:**
- Modify: `test/wedding-photo-stack.test.ts`

**Step 1: Write the failing test**
Add the following test block inside `test/wedding-photo-stack.test.ts` under `describe("WeddingPhotoStack", () => { ... })`:

```typescript
  // ---- CloudFront ----
  describe("CloudFront Distribution", () => {
    test("CloudFront API distribution exists and associates CORS function as viewer-response", () => {
      const dists = byType(resources, "AWS::CloudFront::Distribution");
      expect(dists.length).toBeGreaterThan(0);
      const apiDist = dists.find((d: any) => 
        d.Properties.DistributionConfig?.DomainNames?.includes("api.fishare.de")
      );
      expect(apiDist).toBeDefined();
      const associations = apiDist.Properties.DistributionConfig?.DefaultCacheBehavior?.FunctionAssociations ?? 
                           apiDist.Properties.DistributionConfig?.DefaultBehavior?.FunctionAssociations;
      expect(associations).toBeDefined();
      expect(associations[0].EventType).toBe("viewer-response");
    });
  });
```

**Step 2: Run test to verify it fails**
Run: `npm test test/wedding-photo-stack.test.ts`
Expected: FAIL (specifically the new test fails because the event type is currently `"viewer-request"`).

**Step 3: Minimal implementation to pass the test**
Modify `lib/wedding-photo-stack.ts` at line 467:

```typescript
        functionAssociations: [{
          function: corsFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
        }],
```

**Step 4: Run test to verify it passes**
Run: `npm test test/wedding-photo-stack.test.ts`
Expected: PASS

**Step 5: Commit changes**
```bash
git add test/wedding-photo-stack.test.ts lib/wedding-photo-stack.ts
git commit -m "fix: correct CloudFront CORS function association type to viewer-response"
```
