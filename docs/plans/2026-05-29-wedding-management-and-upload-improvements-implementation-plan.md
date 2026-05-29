# Wedding Management and Upload Improvements Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Solve critical bugs and add premium features to the wedding photo share application: Cascade deletion of weddings, direct guest upload bypass (no-review option), S3 presigned URL viewing in admin dashboard, comprehensive image format support, and CloudFront query-string/header forwarding.

**Architecture:**
*   Update CDK configuration (`lib/wedding-photo-stack.ts`) to configure CloudFront caching/origin policies, grant S3 read permission to `AdminLambda`, and map environment variables.
*   Refactor `AdminLambda` (`lambda/admin/index.ts`) to physically cascade delete events, keypairs, photos and S3 objects; introduce `requiresReview` setting and update route; generate S3 presigned URLs in admin photos list.
*   Refactor `UploadLambda` (`lambda/upload/index.ts`) to broaden MIME type support (`image/*`) and automatically bypass photo approval if `requiresReview` is false for the wedding.
*   Update SvelteKit frontend to add toggles for `requiresReview` both at wedding creation and on the detail dashboard.

**Tech Stack:** AWS CDK v2, AWS Lambda (Node.js 20.x), DynamoDB, S3, SvelteKit, Jest

---

### Task 1: CDK Architecture and Permissions Update

**Files:**
*   Modify: `lib/wedding-photo-stack.ts:180-205, 241-255, 456-476`

**Step 1: Write a failing stack test**
*   Modify: `test/wedding-photo-stack.test.ts` to assert that `AdminLambda` is granted S3 read access, environment variables are correctly mapped, and `ApiCloudFront` distribution has CachingDisabled and AllViewerExceptHostHeader policies.
```typescript
// Insert into test/wedding-photo-stack.test.ts
import { Template, Match } from "aws-cdk-lib/assertions";

// Add check for CloudFront distribution properties
test("CloudFront API distribution forwards headers and query strings", () => {
  const app = new cdk.App();
  const stack = new WeddingPhotoStack(app, "TestStack");
  const template = Template.fromStack(stack);

  template.hasResourceProperties("AWS::CloudFront::Distribution", {
    DistributionConfig: {
      DefaultBehavior: {
        CachePolicyId: {
          Ref: Match.stringLikeRegexp(".*")
        },
        OriginRequestPolicyId: {
          Ref: Match.stringLikeRegexp(".*")
        }
      }
    }
  });
});
```

**Step 2: Run test to verify it fails**
*   Run: `npm run build && npm run test:unit -- test/wedding-photo-stack.test.ts`
*   Expected: FAIL with missing properties in CloudFront template assertions.

**Step 3: Write minimal implementation**
*   Modify: `lib/wedding-photo-stack.ts`
```typescript
// 1. In imports:
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

// 2. In AdminLambda definition environment block:
this.adminLambda = new lambda.Function(this, "AdminLambda", {
  ...
  environment: {
    ...
    PHOTO_BUCKET: this.photoBucket.bucketName,
  }
});

// 3. In UploadLambda definition environment block:
this.uploadLambda = new lambda.Function(this, "UploadLambda", {
  ...
  environment: {
    ...
    EVENTS_TABLE: this.eventsTable.tableName,
  }
});

// 4. In IAM grants section:
this.photoBucket.grantRead(this.adminLambda);

// 5. In CloudFront ApiCloudFront block:
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
```

**Step 4: Run test to verify it passes**
*   Run: `npm run build && npm run test:unit -- test/wedding-photo-stack.test.ts`
*   Expected: PASS

**Step 5: Commit**
*   Run: `git add lib/wedding-photo-stack.ts test/wedding-photo-stack.test.ts && git commit -m "infra: update CloudFront distribution policies and grant AdminLambda S3 read access"`

---

### Task 2: Physical Cascade Deletion for Admin Lambda

**Files:**
*   Modify: `lambda/admin/index.ts:185-211`
*   Modify: `test/lambda/admin.test.ts`

**Step 1: Write a failing delete event test**
*   Modify: `test/lambda/admin.test.ts` to assert that `deleteEvent` physically removes event metadata, associated keypairs, DynamoDB photo records, and invokes S3 delete commands for photo files.
```typescript
// Inside test/lambda/admin.test.ts
describe("DELETE /admin/events/{eventId}", () => {
  test("performs physical cascade deletion", async () => {
    // Mock DynamoDB queries for cascade deletion
    // 1. Scan keypairs returns 1 item
    // 2. Scan photos returns 1 item
    (globalThis as any).__mockSend
      .mockResolvedValueOnce({ Items: [{ PK: "KEY#1", SK: "METADATA", eventId: "EVENT-1" }] }) // keypairs
      .mockResolvedValueOnce({ Items: [{ PK: "PHOTO#1", SK: "METADATA", eventId: "EVENT-1", s3Key: "prod/EVENT-1/PHOTO#1.jpg" }] }) // photos
      .mockResolvedValueOnce({}) // delete event
      .mockResolvedValueOnce({}) // delete keypair
      .mockResolvedValueOnce({}); // delete photo

    const event = {
      requestContext: { http: { method: "DELETE", path: "/admin/events/EVENT-1" } },
      headers: authHeaders(),
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    // Should execute scan + delete commands for cascade deletion
    expect((globalThis as any).__mockSend).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**
*   Run: `npm run test:unit -- test/lambda/admin.test.ts`
*   Expected: FAIL (or missing mock definitions/assert mismatches since we mock AWS SDK)

**Step 3: Write minimal implementation**
*   Modify: `lambda/admin/index.ts` to implement physical cascade delete:
```typescript
import { S3Client, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});

async function deleteEvent(eventId: string) {
  // 1. Find all keypairs
  const keypairsResp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.KEYPAIRS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );

  // 2. Find all photos
  const photosResp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.PHOTOS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );

  const deletes: Promise<any>[] = [];

  // 3. Delete S3 files
  const photoItems = photosResp.Items ?? [];
  if (photoItems.length > 0) {
    const s3Keys = photoItems.map((p: any) => p.s3Key).filter(Boolean);
    if (s3Keys.length > 0) {
      deletes.push(
        s3.send(
          new DeleteObjectsCommand({
            Bucket: process.env.PHOTO_BUCKET!,
            Delete: { Objects: s3Keys.map((k) => ({ Key: k })) },
          })
        ).catch((err) => console.error("Failed to delete S3 photos:", err))
      );
    }
  }

  // 4. Physical delete Event Metadata
  deletes.push(
    dynamo.send(
      new DeleteCommand({
        TableName: process.env.EVENTS_TABLE!,
        Key: { PK: eventId, SK: "METADATA" },
      })
    )
  );

  // 5. Physical delete Keypairs
  for (const k of (keypairsResp.Items ?? [])) {
    deletes.push(
      dynamo.send(
        new DeleteCommand({
          TableName: process.env.KEYPAIRS_TABLE!,
          Key: { PK: k.PK, SK: k.SK },
        })
      )
    );
  }

  // 6. Physical delete Photos Metadata
  for (const p of photoItems) {
    deletes.push(
      dynamo.send(
        new DeleteCommand({
          TableName: process.env.PHOTOS_TABLE!,
          Key: { PK: p.PK, SK: p.SK },
        })
      )
    );
  }

  await Promise.all(deletes);
}
```

**Step 4: Run test to verify it passes**
*   Run: `npm run test:unit -- test/lambda/admin.test.ts`
*   Expected: PASS

**Step 5: Commit**
*   Run: `git add lambda/admin/index.ts test/lambda/admin.test.ts && git commit -m "feat: implement physical cascade deletion for events, keypairs, photos and S3 files"`

---

### Task 3: Admin Real Photo Preview in Dashboard

**Files:**
*   Modify: `lambda/admin/index.ts:153-162`
*   Modify: `test/lambda/admin.test.ts`

**Step 1: Write a failing test for photos presignedUrl**
*   Modify: `test/lambda/admin.test.ts` to assert that listing event photos returns items with generated S3 presigned URLs.
```typescript
// Inside test/lambda/admin.test.ts
describe("GET /admin/events/{eventId}/photos", () => {
  test("returns photos with S3 presigned URLs", async () => {
    (globalThis as any).__mockSend.mockResolvedValueOnce({
      Items: [
        { PK: "PHOTO#1", SK: "METADATA", eventId: "EVENT-1", s3Key: "prod/EVENT-1/PHOTO#1.jpg" }
      ]
    });

    const event = {
      requestContext: { http: { method: "GET", path: "/admin/events/EVENT-1/photos" } },
      headers: authHeaders(),
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body as string);
    expect(body.photos[0].presignedUrl).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**
*   Run: `npm run test:unit -- test/lambda/admin.test.ts`
*   Expected: FAIL (presignedUrl is undefined in output)

**Step 3: Write minimal implementation**
*   Modify: `lambda/admin/index.ts` to import `GetObjectCommand` and `getSignedUrl`, and attach presigned URLs inside `listEventPhotos`:
```typescript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function presignPhoto(s3Key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET!,
    Key: s3Key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: 900 });
}

async function listEventPhotos(eventId: string) {
  const resp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.PHOTOS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );
  
  const photos = resp.Items ?? [];
  return Promise.all(
    photos.map(async (p: any) => ({
      ...p,
      presignedUrl: p.s3Key ? await presignPhoto(p.s3Key) : undefined,
    }))
  );
}
```

**Step 4: Run test to verify it passes**
*   Run: `npm run test:unit -- test/lambda/admin.test.ts`
*   Expected: PASS

**Step 5: Commit**
*   Run: `git add lambda/admin/index.ts test/lambda/admin.test.ts && git commit -m "feat: attach S3 presigned URLs in admin photos list"`

---

### Task 4: Optional Photo Review Support (requiresReview Toggle)

**Files:**
*   Modify: `lambda/admin/index.ts:76-130, 303-331`
*   Modify: `lambda/upload/index.ts:161-212`
*   Modify: `test/lambda/admin.test.ts`
*   Modify: `test/lambda/upload.test.ts`

**Step 1: Write failing tests for requiresReview toggle**
*   Modify `test/lambda/admin.test.ts` to verify event creation saves `requiresReview` (default true) and `PATCH /admin/events/{id}` updates it.
*   Modify `test/lambda/upload.test.ts` to verify confirmation sets `status = "approved"` if `requiresReview` is false, and `"pending"` if true.

**Step 2: Run tests to verify they fail**
*   Run: `npm run test:unit -- test/lambda/admin.test.ts test/lambda/upload.test.ts`
*   Expected: FAIL

**Step 3: Write minimal implementation**
*   Modify `lambda/admin/index.ts` to save `requiresReview` and accept `PATCH /admin/events/{eventId}`:
```typescript
// 1. In createEvent:
  const item = {
    PK,
    SK: "METADATA",
    name: body.name,
    date: body.date,
    status: "active",
    createdAt: now,
    requiresReview: body.requiresReview ?? true, // default to true
    uploadKey,
    showKey,
    uploadKeyHash,
    showKeyHash,
  };

// 2. In getEventWithKeys:
  return {
    ...item,
    photoCount: 0,
    hasKeys: !!(item.uploadKey && item.showKey),
    uploadKey: item.uploadKey ?? "[已產生，請於建立時複製]",
    showKey: item.showKey ?? "[已產生，請於建立時複製]",
    requiresReview: item.requiresReview !== false, // default true
    keyNote: item.uploadKey && item.showKey
      ? null
      : "金鑰僅於建立時顯示，請複製並妥善保存。若需重設，請刪除婚禮後重新建立。",
  };

// 3. Add updateEvent:
async function updateEvent(eventId: string, body: { name?: string; date?: string; requiresReview?: boolean }) {
  const updates: string[] = [];
  const attrNames: Record<string, string> = {};
  const attrValues: Record<string, any> = {};

  if (body.name !== undefined) {
    updates.push("#n = :name");
    attrNames["#n"] = "name";
    attrValues[":name"] = body.name;
  }
  if (body.date !== undefined) {
    updates.push("#d = :date");
    attrNames["#d"] = "date";
    attrValues[":date"] = body.date;
  }
  if (body.requiresReview !== undefined) {
    updates.push("#r = :reqRev");
    attrNames["#r"] = "requiresReview";
    attrValues[":reqRev"] = body.requiresReview;
  }

  if (updates.length === 0) return { success: true };

  await dynamo.send(new UpdateCommand({
    TableName: process.env.EVENTS_TABLE!,
    Key: { PK: eventId, SK: "METADATA" },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  }));
  return { success: true };
}

// 4. In handler:
    // PATCH /admin/events/{eventId}
    if (path.match(/^\/admin\/events\/[^/]+$/) && method === "PATCH") {
      const eventId = decodeURIComponent(path.split("/")[3]);
      const body = JSON.parse(event.body ?? "{}");
      const result = await updateEvent(eventId, body);
      return res(200, result);
    }
```

*   Modify `lambda/upload/index.ts` to inspect `requiresReview` in `confirmUpload`:
```typescript
// In confirmUpload:
  // Fetch event settings
  const eventGet = await dynamo.send(
    new GetCommand({
      TableName: process.env.EVENTS_TABLE!,
      Key: { PK: eventId, SK: "METADATA" },
    })
  );
  const requiresReview = eventGet.Item?.requiresReview !== false; // default true

  // Update DynamoDB record
  await dynamo.send(
    new UpdateCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
      UpdateExpression: "SET nickname = :n, #status = :s, confirmedAt = :c",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":n": cleanNickname,
        ":s": requiresReview ? "pending" : "approved",
        ":c": new Date().toISOString(),
      },
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );
```

**Step 4: Run tests to verify they pass**
*   Run: `npm run test:unit -- test/lambda/admin.test.ts test/lambda/upload.test.ts`
*   Expected: PASS

**Step 5: Commit**
*   Run: `git add lambda/admin/index.ts lambda/upload/index.ts test/lambda/admin.test.ts test/lambda/upload.test.ts && git commit -m "feat: add support for optional photo review requiresReview setting"`

---

### Task 5: Comprehensive MIME Type and Unicode Nickname Validation

**Files:**
*   Modify: `lambda/upload/index.ts:15-21, 58-67, 112-115`
*   Modify: `test/lambda/upload.test.ts`

**Step 1: Write failing tests for MIME types and Unicode Nicknames**
*   Modify: `test/lambda/upload.test.ts` to assert:
    *   `image/jpg`, `image/gif`, `image/webp` are accepted, and any `image/*` format is allowed.
    *   Chinese nickname `"張三"` and alphanumeric space nickname `"Alice 王 12"` are valid.
    *   HTML tags like `"<script>"` are invalid.

**Step 2: Run test to verify they fail**
*   Run: `npm run test:unit -- test/lambda/upload.test.ts`
*   Expected: FAIL (unsupported file type error for new formats, and validation/assertion errors for Chinese nicknames)

**Step 3: Write minimal implementation**
*   Modify `lambda/upload/index.ts` to support image regex matching, expand `MAGIC_BYTES`, and allow multi-language Unicode nicknames:
```typescript
// 1. Expand MAGIC_BYTES keys
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }> = {
  "image/jpeg": { bytes: [0xff, 0xd8, 0xff] },
  "image/jpg": { bytes: [0xff, 0xd8, 0xff] },
  "image/png": { bytes: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
  "image/heic": { bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63] },
  "image/heif": { bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63] },
  "image/gif": { bytes: [0x47, 0x49, 0x46, 0x38] },
  "image/bmp": { bytes: [0x42, 0x4d] },
  "image/tiff": { bytes: [0x49, 0x49, 0x2a, 0x00] },
};

// 2. In sanitizeNickname:
function sanitizeNickname(nickname: string): string {
  // Strip dangerous HTML tag delimiters < and > to prevent basic XSS injections
  return nickname
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 20);
}

// 3. In isValidNickname:
function isValidNickname(nickname: string): boolean {
  // Allow Chinese, English, numbers, spaces, common punctuation between 2 and 20 characters.
  // Must not contain HTML tag delimiters < and >.
  const hasHtml = /[<>]/.test(nickname);
  const trimmed = nickname.trim();
  return !hasHtml && trimmed.length >= 2 && trimmed.length <= 20;
}

// 4. In presignUpload:
  // Validate content type (accept any image/* format)
  if (!contentType.toLowerCase().startsWith("image/")) {
    return { statusCode: 400, body: JSON.stringify({ error: "Unsupported file type" }) };
  }
```

**Step 4: Run test to verify it passes**
*   Run: `npm run test:unit -- test/lambda/upload.test.ts`
*   Expected: PASS

**Step 5: Commit**
*   Run: `git add lambda/upload/index.ts test/lambda/upload.test.ts && git commit -m "feat: broaden upload MIME validation and support multi-language Unicode nicknames"`

---

### Task 6: Frontend API Client Update

**Files:**
*   Modify: `frontend/src/lib/api/client.ts:80-116`

**Step 1: Inspect and prepare client updates**
*   Add `update` and modify `create` parameters in `frontend/src/lib/api/client.ts`.
```typescript
  async create(name: string, date: string, requiresReview = true) {
    const res = await request("/admin/events", {
      method: "POST",
      token: true,
      body: JSON.stringify({ name, date, requiresReview }),
    });
    if (!res.ok) throw new Error("建立婚禮失敗");
    return res.json();
  },
  async update(eventId: string, body: { name?: string; date?: string; requiresReview?: boolean }) {
    const res = await request(`/admin/events/${eventId}`, {
      method: "PATCH",
      token: true,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("更新婚禮失敗");
    return res.json();
  },
```

**Step 2: Commit**
*   Run: `git add frontend/src/lib/api/client.ts && git commit -m "frontend: add update API method and support requiresReview parameter in event creation"`

---

### Task 7: Frontend UI Review Option Implementation

**Files:**
*   Modify: `frontend/src/routes/admin/+page.svelte`
*   Modify: `frontend/src/routes/admin/event/[eventId]/+page.svelte`

**Step 1: Update event creation form to support requiresReview**
*   Modify: `frontend/src/routes/admin/+page.svelte` to add checkbox for `requiresReview`:
```svelte
// Add state
let requiresReview = $state(true);

// Update createEvent:
async function createEvent() {
  if (!newName.trim() || !newDate) return;
  const result = await events.create(newName, newDate, requiresReview);
  showCreate = false;
  newName = "";
  newDate = "";
  requiresReview = true;
  loadEvents();
  goto(`/admin/event/${result.PK}`);
}

// In HTML creation card:
<div class="flex items-center gap-2 py-1 px-1">
  <input
    type="checkbox"
    bind:checked={requiresReview}
    id="newRequiresReview"
    class="w-4 h-4 accent-[#d4a373]"
  />
  <label for="newRequiresReview" class="text-sm text-[#8b7355] cursor-pointer">賓客上傳的照片需管理員審核</label>
</div>
```

**Step 2: Update event details page to add requiresReview dynamic toggle**
*   Modify: `frontend/src/routes/admin/event/[eventId]/+page.svelte` to show current setting and support toggle:
```svelte
// Add toggle handler:
async function toggleReviewSetting() {
  const nextValue = !event.requiresReview;
  try {
    await events.update(eventId, { requiresReview: nextValue });
    event.requiresReview = nextValue;
  } catch {
    alert("更新設定失敗，請重試");
  }
}

// In HTML (add below shared links metadata card or inside it):
<div class="mt-4 pt-3 border-t border-[#e8d5c4] flex items-center justify-between">
  <div>
    <p class="text-xs text-[#8b7355]">📢 照片發布設定</p>
    <p class="text-xs text-gray-500 mt-0.5">
      {event.requiresReview ? "賓客上傳的照片需經管理員審核後才公開" : "賓客照片上傳完成後免審核直接公開發布"}
    </p>
  </div>
  <button
    onclick={toggleReviewSetting}
    class="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors {event.requiresReview ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}"
  >
    {event.requiresReview ? "🔓 切換為免審核" : "🔒 切換為需審核"}
  </button>
</div>
```

**Step 3: Commit**
*   Run: `git add frontend/src/routes/admin/+page.svelte frontend/src/routes/admin/event/[eventId]/+page.svelte && git commit -m "frontend: implement requiresReview setting toggle on admin pages"`

---

### Task 8: Rebuild and Final Verification

**Step 1: Compile TS and Rebuild frontend**
*   Run: `npm run build` inside frontend folder (if package.json specifies a frontend script, or via terminal command).
*   Wait, let's specify commands to clean and build project.
    *   Root: `npm run clean && npm run build`
    *   Frontend: `cd frontend && npm run build`
*   Expected: Both builds complete without typescript or syntax errors.

**Step 2: Run all unit tests**
*   Run: `npm run test`
*   Expected: PASS
