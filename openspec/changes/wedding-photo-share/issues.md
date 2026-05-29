# Open Issues — wedding-photo-share

## 1. 刪除是假的（soft delete 無效）

**根本原因：**
- `listEvents()` 的 Scan 沒有過濾 `status: "archived"`
- `deleteEvent()` 只設 `status: "archived"`，但 list 又回傳所有記錄

**現況：**
- `deleteEvent()` (Lambda) → DynamoDB Update: `status = "archived"`
- `listEvents()` (Lambda) → DynamoDB Scan: **無 FilterExpression**，所有 status 都回傳
- 前端 `events.remove(id)` call DELETE → 200 → 前端從 local list 移除 → 看起來成功
- 但下次 `loadEvents()`（或重整）→ `listEvents()` 回傳包含 archived → 消失的 event 又出現

**修復方向：**
- `listEvents()` 加 `FilterExpression: "#s <> :archived"`
- 考慮：刪除時是否 cascade 刪除關聯的 photos（S3 + DynamoDB）

---

## 2. 上傳流程需要 uploadKey

**現況：**
- `POST /upload/presign` 需要從 upload keypair table 驗證 `key` query param
- 前端上傳頁面 `upload/+page.svelte` 不傳 `key` query param
- 詳：`lambda/upload/index.ts` — presign 需要驗證 `keyHash-index` GSI

**修復方向：**
- 前端上傳頁面 URL 格式：`/event/{eventId}/upload?key={uploadKey}`
- 從 URL query param 取 `key`，傳給 `upload.presign()`

---

## 3. 前端上傳頁面需要 showKey 才能看 slideshow

**現況：**
- `slideshow/photos?eventId=xxx` 目前不需要 key（任何人可見）
- 但上傳完成後的 confirm 流程是獨立的

---

## 4. presign `Invalid or expired key`

**現況：**
- `POST /upload/presign` → `{"error":"Invalid or expired key"}`
- 可能原因：keypair 驗證邏輯（`keyHash-index` GSI query）與 keypair 格式不符
- 需確認上傳 flow 中 key 的產生與驗證方式是否匹配

---

## 5. 照片審核流程（approve/reject）未實作

**現況：**
- `PATCH /admin/photos/{photoId}` → `approvePhoto()` 存在（status → "approved"）
- 前端無 approve/reject UI
- 嘉賓上傳 → `status: "pending"` → 無法在 slideshow 看到 → 需要管理員 approve

**修復方向：**
- 前端 admin/event/[eventId] 頁面加 photos list + approve/reject 按鈕
