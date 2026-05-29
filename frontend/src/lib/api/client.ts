// API client for wedding-photo backend
import type {
  EventTemplate,
  EventTemplateResponse,
  GuestUpload,
  MyGuestPhotosResponse,
  TemplateAsset,
  TemplateLayer,
  TemplatePlayback,
  TemplateTransition,
  WallPolicy,
  WallPhotosResponse,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 500;

function getAdminToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("admin_token");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitter(base: number): number {
  return base + Math.random() * base * 0.5;
}

type MyGuestPhotosMethod = {
  (eventId: string, nickname: string): Promise<GuestUpload[]>;
  (eventId: string, guestKey: string, nickname: string): Promise<GuestUpload[]>;
};

async function request(
  path: string,
  options: RequestInit & { token?: boolean } = {},
  retries = MAX_RETRIES,
): Promise<Response> {
  const { token = false, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOpts.headers as Record<string, string> | undefined),
  };
  if (token) {
    const t = getAdminToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });

    // Retry 5xx only
    if (res.status >= 500 && attempt < retries) {
      lastError = new Error(`Server error ${res.status} on ${path}, retry ${attempt + 1}/${retries}`);
      const backoff = randomJitter(RETRY_DELAY_BASE_MS * Math.pow(2, attempt));
      await delay(backoff);
      continue;
    }

    return res;
  }
  throw lastError ?? new Error(`Request failed after ${retries} retries: ${path}`);
}

// Auth
export const auth = {
  async login(username: string, password: string) {
    const res = await request("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("登入失敗");
    const { token } = await res.json();
    localStorage.setItem("admin_token", token);
    return token;
  },
  logout() {
    localStorage.removeItem("admin_token");
  },
  isLoggedIn(): boolean {
    return !!getAdminToken();
  },
};

// Events
export const events = {
  async list() {
    const res = await request("/admin/events", { token: true });
    if (res.status === 401) { auth.logout(); throw new Error("Unauthorized"); }
    if (!res.ok) throw new Error("取得婚禮列表失敗");
    const data = await res.json();
    return data.events ?? [];
  },
  async create(name: string, date: string, requiresReview = true) {
    const res = await request("/admin/events", {
      method: "POST",
      token: true,
      body: JSON.stringify({ name, date, requiresReview }),
    });
    if (!res.ok) throw new Error("建立婚禮失敗");
    return res.json();
  },
  async update(eventId: string, body: { name?: string; date?: string; requiresReview?: boolean; wallPolicy?: WallPolicy }) {
    const res = await request(`/admin/events/${eventId}`, {
      method: "PATCH",
      token: true,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("更新婚禮失敗");
    return res.json();
  },
  async get(eventId: string) {
    const res = await request(`/admin/events/${eventId}`, { token: true });
    if (!res.ok) throw new Error("取得婚禮失敗");
    return res.json();
  },
  async photos(eventId: string) {
    const res = await request(`/admin/events/${eventId}/photos`, { token: true });
    if (!res.ok) throw new Error("取得照片失敗");
    const data = await res.json();
    return data.photos ?? [];
  },
  async approvePhoto(photoId: string) {
    const res = await request(`/admin/photos/${encodeURIComponent(photoId)}`, {
      method: "PATCH",
      token: true,
      body: JSON.stringify({ status: "approved" }),
    });
    if (!res.ok) throw new Error("審核失敗");
  },
  async deletePhoto(photoId: string) {
    const res = await request(`/admin/photos/${encodeURIComponent(photoId)}`, {
      method: "DELETE",
      token: true,
    });
    if (!res.ok) throw new Error("刪除照片失敗");
  },
  async remove(eventId: string) {
    const res = await request(`/admin/events/${eventId}`, {
      method: "DELETE",
      token: true,
    });
    if (!res.ok) throw new Error("刪除失敗");
    return res.json();
  },
};

// Guest flows
export const slideshow = {
  async photos(eventId: string) {
    const res = await request(`/slideshow/photos?eventId=${eventId}`);
    if (!res.ok) throw new Error("取得照片失敗");
    const data = await res.json();
    return { event: data.event ?? {}, photos: data.photos ?? [] };
  },
};

export const wall = {
  async photos(eventId: string): Promise<WallPhotosResponse> {
    const res = await request(`/wall/photos?eventId=${encodeURIComponent(eventId)}`);
    if (!res.ok) throw new Error("取得簽到牆失敗");
    return res.json() as Promise<WallPhotosResponse>;
  },
};

const myguestPhotos: MyGuestPhotosMethod = async (
  eventId: string,
  guestKeyOrNickname: string,
  nickname?: string,
): Promise<GuestUpload[]> => {
  const params = new URLSearchParams({ eventId });
  if (nickname === undefined) {
    params.set("nickname", guestKeyOrNickname);
  } else {
    params.set("guestKey", guestKeyOrNickname);
    params.set("nickname", nickname);
  }

  const res = await request(`/myguest/photos?${params.toString()}`);
  if (!res.ok) throw new Error("取得上傳記錄失敗");
  const data = (await res.json()) as MyGuestPhotosResponse;
  return data.photos ?? [];
};

export const myguest = {
  photos: myguestPhotos,
  async setRepresentative(photoId: string, eventId: string, guestKey?: string, nickname?: string) {
    const payload: Record<string, string> = { eventId };
    if (guestKey) payload.guestKey = guestKey;
    if (nickname) payload.nickname = nickname;
    const res = await request(`/myguest/photos/${encodeURIComponent(photoId)}/representative`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("更新簽到照片失敗");
  },
  async delete(photoPK: string, eventId: string, nickname: string) {
    const res = await request(`/myguest/photos/${encodeURIComponent(photoPK)}`, {
      method: "DELETE",
      body: JSON.stringify({ eventId, nickname }),
    });
    if (!res.ok) throw new Error("刪除失敗");
  },
};

export const upload = {
  async presign(eventId: string, filename: string, contentType: string, key?: string) {
    const url = key ? `/upload/presign?key=${encodeURIComponent(key)}` : "/upload/presign";
    const res = await request(url, {
      method: "POST",
      body: JSON.stringify({ eventId, filename, contentType }),
    });
    if (!res.ok) throw new Error("取得上傳連結失敗");
    return res.json(); // { uploadUrl, photoId }
  },
  async confirm(
    eventId: string,
    photoId: string,
    nickname: string,
    key?: string,
    guestKey?: string,
    greeting?: string,
  ) {
    const url = key ? `/upload/confirm?key=${encodeURIComponent(key)}` : "/upload/confirm";
    const payload: Record<string, string> = { eventId, photoId, nickname };
    if (guestKey) payload.guestKey = guestKey;
    if (greeting) payload.greeting = greeting;
    const res = await request(url, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("確認上傳失敗");
    return res.json();
  },
};

export const templates = {
  async get(eventId: string): Promise<EventTemplateResponse> {
    const res = await request(`/admin/events/${encodeURIComponent(eventId)}/template`, { token: true });
    if (!res.ok) throw new Error("取得模板失敗");
    return res.json();
  },
  async save(eventId: string, template: EventTemplate, publish = false): Promise<EventTemplateResponse> {
    const res = await request(`/admin/events/${encodeURIComponent(eventId)}/template`, {
      method: "PUT",
      token: true,
      body: JSON.stringify({ template, publish }),
    });
    if (!res.ok) throw new Error("儲存模板失敗");
    return res.json();
  },
  async presignAsset(eventId: string, filename: string, contentType: string) {
    const res = await request(`/admin/events/${encodeURIComponent(eventId)}/template-assets/presign`, {
      method: "POST",
      token: true,
      body: JSON.stringify({ filename, contentType }),
    });
    if (!res.ok) throw new Error("取得裝飾素材上傳連結失敗");
    return res.json() as Promise<{ assetId: string; assetKey: string; uploadUrl: string }>;
  },
  async confirmAsset(
    eventId: string,
    assetId: string,
    filename: string,
    contentType: string,
    assetKey: string,
  ) {
    const res = await request(`/admin/events/${encodeURIComponent(eventId)}/template-assets/confirm`, {
      method: "POST",
      token: true,
      body: JSON.stringify({ assetId, filename, contentType, assetKey }),
    });
    if (!res.ok) throw new Error("確認裝飾素材失敗");
    return res.json() as Promise<{ asset: TemplateAsset; template: EventTemplate }>;
  },
  async slideshow(eventId: string) {
    const res = await request(`/slideshow/template?eventId=${encodeURIComponent(eventId)}`);
    if (!res.ok) throw new Error("取得投屏模板失敗");
    return res.json() as Promise<{ eventId: string; template: EventTemplate; published: boolean }>;
  },
};
