# Wedding Photo Usability Improvements Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Implement client-side image compression, multi-file queued uploading, percentage-based progress bars, guest greeting messages in database metadata, and WebSocket-driven fullscreen slideshow with CSS3 hardware-accelerated Danmaku (bullet screen) animations.

**Architecture:** Extend S3/DynamoDB schemas to store greetings, compress images to WebP/JPEG in canvas, queue files serially in Svelte state, stream uploads using XMLHttp, and animate overlay tracks dynamically inside the slideshow over WebSockets.

**Tech Stack:** HTML5 Canvas, Svelte 5 Runes, S3 REST XMLHttp, API Gateway WebSockets, DynamoDB Document Client, Tailwind CSS.

---

## Batch 1: Guest Upload Experience Upgrade

### Task 1: Extend Backend Database Schema and Lambda Upload Confirm Handler

**Files:**
- Modify: `lambda/upload/index.ts`
- Test: `test/lambda/upload.test.ts`

**Step 1: Write the failing test**
In `test/lambda/upload.test.ts`, add a test case verifying that `confirm` accepts `greeting` and writes it to the database:
```typescript
it("should save greeting message in DynamoDB when confirm is called", async () => {
  const event = {
    httpMethod: "POST",
    path: "/upload/confirm",
    body: JSON.stringify({
      eventId: "EVENT-1",
      photoId: "PHOTO-1",
      nickname: "張三",
      greeting: "祝新婚快樂，白頭偕老！"
    })
  };
  const res = await handler(event as any);
  expect(res.statusCode).toBe(200);
  
  // Verify DynamoDB put call includes greeting
  const lastPut = mockDynamoDb.put.mock.calls[0][0];
  expect(lastPut.Item.greeting).toBe("祝新婚快樂，白頭偕老！");
});
```

**Step 2: Run test to verify it fails**
Run: `npm run test -- test/lambda/upload.test.ts`
Expected: FAIL (since the confirm handler ignores the `greeting` property)

**Step 3: Write minimal implementation**
In `lambda/upload/index.ts`, update `confirmUpload` handler to read `greeting` and include it in the item put operation:
```typescript
interface ConfirmRequest {
  eventId: string;
  photoId: string;
  nickname: string;
  greeting?: string;
}

// In confirmUpload:
const { eventId, photoId, nickname, greeting } = JSON.parse(event.body || "{}") as ConfirmRequest;
// ... validation checks ...
const item = {
  PK: photoId,
  SK: "METADATA",
  eventId,
  nickname,
  greeting: greeting ? greeting.substring(0, 50) : undefined, // limit to 50 chars
  status: requiresReview ? "pending" : "approved",
  createdAt: new Date().toISOString()
};
```

**Step 4: Run test to verify it passes**
Run: `npm run test -- test/lambda/upload.test.ts`
Expected: PASS

**Step 5: Commit**
```bash
git add lambda/upload/index.ts test/lambda/upload.test.ts
git commit -m "feat(backend): support greeting message in confirmUpload metadata"
```

---

### Task 2: Extend Frontend API Client for Greeting Support

**Files:**
- Modify: `frontend/src/lib/api/client.ts`

**Step 1: Write the implementation**
Update `upload.confirm` method signature and body:
```typescript
  async confirm(eventId: string, photoId: string, nickname: string, key?: string, greeting?: string) {
    const url = key ? `/upload/confirm?key=${encodeURIComponent(key)}` : "/upload/confirm";
    const res = await request(url, {
      method: "POST",
      body: JSON.stringify({ eventId, photoId, nickname, greeting }),
    });
    if (!res.ok) throw new Error("確認上傳失敗");
    return res.json();
  },
```

**Step 2: Verify compilation**
Run: `cd frontend && npm run build`
Expected: PASS

**Step 3: Commit**
```bash
git add frontend/src/lib/api/client.ts
git commit -m "feat(frontend): extend API client to pass greeting to confirm endpoint"
```

---

### Task 3: Implement Client-side Image Compression Helper

**Files:**
- Create: `frontend/src/lib/utils/compressor.ts`
- Test: `frontend/src/lib/utils/compressor.test.ts` (or verify via vite preview)

**Step 1: Write the compressor logic**
```typescript
export function compressImage(file: File, maxDimension: number = 1920, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get 2d context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Check for WebP support
      const isWebPSupported = canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
      const outputType = isWebPSupported ? "image/webp" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas compression returned null blob"));
          }
        },
        outputType,
        quality
      );
    };
    img.onerror = () => {
      reject(new Error("Failed to load image into element"));
    };
  });
}
```

**Step 2: Commit**
```bash
git add frontend/src/lib/utils/compressor.ts
git commit -m "feat(frontend): implement browser canvas-based image compressor"
```

---

### Task 4: Redesign Guest Upload Page for Multi-file Queued Upload & Progress Bars

**Files:**
- Modify: `frontend/src/routes/event/[eventId]/upload/+page.svelte`

**Step 1: Write the implementation**
Refactor the Svelte 5 page to support:
1. Multiple file selection: `<input type="file" multiple accept="image/*">`.
2. Tracking an array of items in queue state: `let queue = $state<{ file: File; progress: number; status: 'pending'|'compressing'|'uploading'|'completed'|'failed' }[]>([]);`.
3. Integrating `compressImage` inside the uploader loop.
4. Implementing XMLHttpRequest with `progress` listener:
   ```typescript
   function uploadFile(blob: Blob, uploadUrl: string, onProgress: (p: number) => void): Promise<void> {
     return new Promise((resolve, reject) => {
       const xhr = new XMLHttpRequest();
       xhr.open("PUT", uploadUrl);
       xhr.setRequestHeader("Content-Type", blob.type);
       xhr.upload.onprogress = (e) => {
         if (e.lengthComputable) {
           onProgress(Math.round((e.loaded / e.total) * 100));
         }
       };
       xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("S3 Upload Failed"));
       xhr.onerror = () => reject(new Error("Network Error"));
       xhr.send(blob);
     });
   }
   ```
5. Rendering a glowing Progress Bar next to each file thumbnail in Svelte HTML.

**Step 2: Verify compilation**
Run: `cd frontend && npm run build`
Expected: PASS

**Step 3: Commit**
```bash
git add frontend/src/routes/event/[eventId]/upload/+page.svelte
git commit -m "feat(frontend): implement multi-file upload queue with image compression and progress bars"
```

---

## Batch 2 & Batch 3: High-performance Danmaku Slideshow & Admin Controls

These batches will be fully designed, compiled, and implemented in the next consecutive plans once Batch 1 is verified in the production baseline environment.
