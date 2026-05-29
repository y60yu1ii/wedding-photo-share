# Design Document: Wedding Photo Sharing Usability Improvements (Batch 1, 2, 3)

This document outlines the detailed system architecture, API contracts, frontend components, and user experience designs for elevating the wedding photo sharing application to a production-ready, highly interactive premium product.

## 1. Objectives

1. **Robust Client-side Upload Experience (Batch 1)**: Prevent network timeouts by compressing high-resolution phone pictures on the browser before uploading. Allow guests to select and upload multiple images in one queue, displaying percentage progress indicators and gathering personalized blessing messages.
2. **WebSocket-driven Dynamic Screen & Danmaku (Batch 2)**: Create a fullscreen slideshow player for wedding projectors that plays approved photos with smooth transitions and floats real-time guest blessings using a high-performance CSS3 hardware-accelerated Danmaku (bullet screen) engine connected to WebSockets.
3. **Robust Admin Management (Batch 3)**: Give administrators real-time feedback on screen connection status, direct bulk approval/rejection actions, and cascading immediate pull-down/deletion mechanisms for uploaded photos.

---

## 2. Architecture & Database Schema Changes

### 2.1 Database Enhancements
We extend the `PHOTOS_TABLE` metadata records to support guest-written messages.

* **`PHOTOS_TABLE` Schema Extension**:
  * `greeting` (String, Optional): A text string of up to 50 characters containing the guest's congratulatory message/blessing (e.g. "祝百年好合，早生貴子！").

### 2.2 API Contract Extensions

#### `POST /upload/confirm`
* **Request Body**:
  ```json
  {
    "eventId": "string",
    "photoId": "string",
    "nickname": "string",
    "greeting": "string" 
  }
  ```

#### `GET /admin/events/{eventId}/photos` & `GET /slideshow/photos`
* **Response Payload (Photo Metadata Object)**:
  ```json
  {
    "PK": "PHOTO#1780047318245-uo7kuur",
    "SK": "METADATA",
    "eventId": "string",
    "nickname": "string",
    "greeting": "string",
    "status": "approved",
    "presignedUrl": "string",
    "createdAt": "string"
  }
  ```

### 2.3 WebSocket Real-time Broadcast Event Payload
When a guest photo is uploaded and auto-approved, or manually approved by the administrator, the API Gateway WebSocket connection broadcasts the following dynamic event to all active slideshow connections:
```json
{
  "action": "new_photo",
  "photoId": "string",
  "presignedUrl": "string",
  "nickname": "string",
  "greeting": "string"
}
```
When a photo is deleted or pulled down by the administrator, a pull-down event is broadcasted:
```json
{
  "action": "delete_photo",
  "photoId": "string"
}
```

---

## 3. Detailed Component Designs

### 3.1 Batch 1: Guest Upload Experience

#### Client-side Image Compression (HTML5 Canvas Uploader)
Mobile phones capture photos ranging from 5MB to 15MB. To ensure extreme reliability under dense venue networks, client-side pre-compression is mandatory.
* **Algorithm**:
  1. Load the selected image into an HTML5 `Image` object.
  2. Detect orientation and check dimensions. If the width or height exceeds `1920px`, scale the image proportionally so the maximum side is exactly `1920px`.
  3. Render the resized image to an offscreen `<canvas>`.
  4. Call `canvas.toBlob(blob => { ... }, 'image/webp', 0.8)` to yield a compressed WebP file (averaging 250KB - 400KB).
  5. Fallback automatically to `image/jpeg` at `0.8` quality if the browser does not support WebP encoding.

#### Multi-file Queue Manager
* **UI Component**:
  - Replace the single file picker with a multiple-selection input: `<input type="file" multiple accept="image/*">`.
  - Display thumbnails of the selected photos in a dynamic grid.
  - Allow writing the "Nickname" and "Greeting" once.
  - On clicking "Submit", initiate a sequential queue that compresses, requests presigned S3 URLs, performs S3 upload, and confirms to the database one by one.

#### Real-time Progress Bar
* **Implementation**:
  - Switch S3 upload from standard `fetch()` to `XMLHttpRequest` to gain granular upload progress hooks.
  - Track upload percentage:
    ```javascript
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        // Update UI state for current file percent
      }
    });
    ```
  - Display a beautiful glowing progress bar above each thumbnail in the uploading state.

---

### 3.2 Batch 2: Slideshow & High-performance Danmaku Engine

#### Fullscreen Slideshow Player
* **UI / UX**:
  - A clean, dark-mode backdrop (`bg-neutral-950`) optimized for projectors.
  - Fullscreen toggle via the browser standard `requestFullscreen()` API.
  - Auto-advance carousel displaying the active photo for `8 seconds`.
  - Elegant cross-fade animations using CSS `opacity` transitions (duration: `1.2 seconds`) to prevent harsh flashing between landscape and portrait formats.

#### High-performance CSS3 Danmaku (Bullet Screen) Engine
* **Danmaku Track Allocation**:
  - Set up a fixed region of the screen (top 45% of the page) divided into `5 independent horizontal tracks`.
  - Track height: `64px` with a `16px` gap.
* **Collision Prevention Logic**:
  - Maintain a record of the last spawned item in each track with its timestamp and scroll speed.
  - A new blessing message searches for the first track where the previous message has traveled far enough from the right edge to avoid overlaps.
* **Animations**:
  - Render each blessing as a luxurious glassmorphic capsule:
    ```css
    .danmaku-capsule {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(212, 163, 115, 0.35); /* Elegant gold outline */
      border-radius: 9999px;
      padding: 8px 20px;
      font-size: 1.125rem;
      white-space: nowrap;
      position: absolute;
      transform: translateX(100vw);
      will-change: transform;
    }
    ```
  - Animate using CSS `@keyframes danmaku-scroll { from { transform: translateX(100vw); } to { transform: translateX(-100%); } }` driven by GPU-acceleration for 60FPS fluidity.

---

### 3.3 Batch 3: Admin Power Controls

#### Absolute Pull-down (Immediate Delete)
* **API Route**: `DELETE /admin/events/{eventId}/photos/{photoId}`
  - Under the hood, this deletes the item from `PHOTOS_TABLE` and uses S3 `DeleteObjectCommand` to permanently purge the file.
  - Instantly broadcasts a `delete_photo` message via WebSockets.
  - The slideshow page receives the `delete_photo` command and immediately pulls the offending picture out of its local queue and advances to the next slide within 200ms.

#### WebSocket Connection Indicator
* **Admin Dashboard UI**:
  - Display a floating status bar showing the real-time health of the system.
  - Monitor WebSocket connection status (green glowing dot for "CONNECTED", red blinking for "DISCONNECTED").
  - Show a counter of current active projector screens listening to the event to give organizers confidence that the slideshow is actively connected and receiving uploads.

---

## 4. Testing & Verification

1. **Unit Tests (Jest & Vitest)**:
   - Verify `greeting` payload storage during confirmation.
   - Verify WebSocket broadcast includes `greeting` content when a photo is approved.
2. **E2E Usability Validations**:
   - Verify that uploading a 10MB JPEG is compressed to <500KB before network dispatch.
   - Verify that entering a blessing message triggers a smooth CSS3 bullet track animation across the slideshow page.
   - Verify that deleting a photo from the admin console instantly clears it from the active slideshow carousel.
