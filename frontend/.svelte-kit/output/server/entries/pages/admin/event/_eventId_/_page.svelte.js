import { f as stringify, a as attr_class, d as derived, c as store_get, u as unsubscribe_stores } from "../../../../../chunks/root.js";
import { g as escape_html, c as attr } from "../../../../../chunks/attributes.js";
import { p as page } from "../../../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/state.svelte.js";
import "clsx";
const API_BASE = "https://x5yiliyyb2.execute-api.ap-northeast-1.amazonaws.com";
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE_MS = 500;
function getAdminToken() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("admin_token");
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function randomJitter(base) {
  return base + Math.random() * base * 0.5;
}
async function request(path, options = {}, retries = MAX_RETRIES) {
  const { token = false, ...fetchOpts } = options;
  const headers = {
    "Content-Type": "application/json",
    ...fetchOpts.headers
  };
  if (token) {
    const t = getAdminToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });
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
const auth = {
  async login(username, password) {
    const res = await request("/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) throw new Error("登入失敗");
    const { token } = await res.json();
    localStorage.setItem("admin_token", token);
    return token;
  },
  logout() {
    localStorage.removeItem("admin_token");
  },
  isLoggedIn() {
    return !!getAdminToken();
  }
};
const events = {
  async list() {
    const res = await request("/admin/events", { token: true });
    if (res.status === 401) {
      auth.logout();
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error("取得婚禮列表失敗");
    const data = await res.json();
    return data.events ?? [];
  },
  async create(name, date, requiresReview = true) {
    const res = await request("/admin/events", {
      method: "POST",
      token: true,
      body: JSON.stringify({ name, date, requiresReview })
    });
    if (!res.ok) throw new Error("建立婚禮失敗");
    return res.json();
  },
  async update(eventId, body) {
    const res = await request(`/admin/events/${eventId}`, {
      method: "PATCH",
      token: true,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("更新婚禮失敗");
    return res.json();
  },
  async get(eventId) {
    const res = await request(`/admin/events/${eventId}`, { token: true });
    if (!res.ok) throw new Error("取得婚禮失敗");
    return res.json();
  },
  async photos(eventId) {
    const res = await request(`/admin/events/${eventId}/photos`, { token: true });
    if (!res.ok) throw new Error("取得照片失敗");
    const data = await res.json();
    return data.photos ?? [];
  },
  async approvePhoto(photoId) {
    const res = await request(`/admin/photos/${encodeURIComponent(photoId)}`, {
      method: "PATCH",
      token: true,
      body: JSON.stringify({ status: "approved" })
    });
    if (!res.ok) throw new Error("審核失敗");
  },
  async deletePhoto(photoId) {
    const res = await request(`/admin/photos/${encodeURIComponent(photoId)}`, {
      method: "DELETE",
      token: true
    });
    if (!res.ok) throw new Error("刪除照片失敗");
  },
  async remove(eventId) {
    const res = await request(`/admin/events/${eventId}`, {
      method: "DELETE",
      token: true
    });
    if (!res.ok) throw new Error("刪除失敗");
    return res.json();
  }
};
function WallPolicySelect($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { value = "approved_only", disabled = false, onChange } = $$props;
    function handleChange(event) {
      const next = event.currentTarget.value;
      onChange?.(next);
    }
    $$renderer2.push(`<label class="block space-y-2"><span class="text-xs font-semibold text-[#8b7355]">牆面顯示模式</span> `);
    $$renderer2.select(
      {
        value,
        disabled,
        onchange: handleChange,
        class: "w-full rounded-xl border border-[#e8d5c4] bg-white px-3 py-2 text-sm text-[#3d2b1f] shadow-sm focus:border-[#d4a373] focus:outline-none"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "approved_only" }, ($$renderer4) => {
          $$renderer4.push(`只顯示已審核`);
        });
        $$renderer3.option({ value: "all_uploads" }, ($$renderer4) => {
          $$renderer4.push(`顯示全部上傳`);
        });
      }
    );
    $$renderer2.push(`</label>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const eventId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.eventId ?? "");
    let event = {};
    let wallPolicy = "approved_only";
    async function saveWallPolicy(updatedValue) {
      try {
        await events.update(eventId(), { wallPolicy: updatedValue });
        wallPolicy = updatedValue;
        event = { ...event, wallPolicy: updatedValue };
      } catch (e) {
        alert(e.message || "更新失敗");
      }
    }
    const BASE_URL = "https://wedding.fishare.de";
    function buildUrls(evt) {
      const eid = evt.PK ?? eventId();
      const uk = evt.uploadKey;
      const sk = evt.showKey;
      if (!uk || !sk) return { hasKeys: false };
      const uploadUrl = `${BASE_URL}/event/${eid}/upload?key=${uk}`;
      const showUrl = `${BASE_URL}/event/${eid}?key=${sk}`;
      return { hasKeys: true, uploadUrl, showUrl };
    }
    function qrUrl(text) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text ?? "")}`;
    }
    const urls = derived(() => buildUrls(event));
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-6"><a href="/admin" class="text-sm text-[#8b7355] hover:text-[#3d2b1f]">← 返回列表</a> <div class="mt-4 mb-5 flex items-center justify-between gap-4"><div><h1 class="text-2xl font-bold">${escape_html(event.name ?? "婚禮管理")}</h1> `);
    if (event.date) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-sm text-[#8b7355] mt-1">${escape_html(event.date)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="flex items-center gap-1.5 bg-[#fcf8f2] px-2.5 py-1 rounded-full border border-[#f5ede3] shadow-sm flex-shrink-0">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span class="relative flex h-2 w-2"><span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span> <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span></span> <span class="text-[10px] font-semibold text-amber-700 tracking-wider">連線中...</span>`);
    }
    $$renderer2.push(`<!--]--></div></div> <a${attr("href", `/admin/event/${stringify(eventId())}/design`)} class="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3d2b1f] bg-white border border-[#e8d5c4] rounded-full px-4 py-2 shadow-sm hover:border-[#d4a373] hover:bg-[#fffaf3] transition-colors">🎨 編輯投屏模板</a> <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] mb-4"><h2 class="text-sm font-semibold mb-3">分享連結</h2> `);
    if (urls().hasKeys) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-start gap-3 mb-4"><img${attr("src", qrUrl(urls().uploadUrl))} alt="上傳 QR" class="w-20 h-20 rounded-lg border border-[#e8d5c4] flex-shrink-0"/> <div class="flex-1 min-w-0"><p class="text-xs text-[#8b7355] mb-1">👤 賓客上傳</p> <p class="text-xs font-mono break-all text-[#3d2b1f] bg-[#fdf8f3] rounded px-2 py-1">${escape_html(urls().uploadUrl)}</p> <button class="mt-1.5 text-xs bg-[#f5ede3] hover:bg-[#e8d5c4] text-[#8b7355] px-3 py-1 rounded-md transition-colors">📋 複製連結</button></div></div> <div class="flex items-start gap-3"><img${attr("src", qrUrl(urls().showUrl))} alt="瀏覽 QR" class="w-20 h-20 rounded-lg border border-[#e8d5c4] flex-shrink-0"/> <div class="flex-1 min-w-0"><p class="text-xs text-[#8b7355] mb-1">🎉 婚禮展示</p> <p class="text-xs font-mono break-all text-[#3d2b1f] bg-[#fdf8f3] rounded px-2 py-1">${escape_html(urls().showUrl)}</p> <button class="mt-1.5 text-xs bg-[#f5ede3] hover:bg-[#e8d5c4] text-[#8b7355] px-3 py-1 rounded-md transition-colors">📋 複製連結</button></div></div> <div class="mt-4 pt-4 border-t border-[#e8d5c4] flex items-center justify-between"><div><p class="text-xs font-semibold text-[#8b7355]">📢 照片發布設定</p> <p class="text-[11px] text-gray-500 mt-0.5">${escape_html(event.requiresReview ? "賓客上傳的照片需經管理員審核後才公開" : "賓客照片上傳完成後免審核直接公開發布")}</p></div> <button${attr_class(`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${event.requiresReview ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`)}>${escape_html(event.requiresReview ? "🔓 切換為免審核" : "🔒 切換為需審核")}</button></div> <div class="mt-4 pt-4 border-t border-[#e8d5c4] space-y-3">`);
      WallPolicySelect($$renderer2, { value: wallPolicy, onChange: saveWallPolicy });
      $$renderer2.push(`<!----> <a${attr("href", `/event/${stringify(eventId())}/wall`)} class="inline-flex items-center gap-2 rounded-full border border-[#e8d5c4] px-4 py-2 text-sm font-semibold text-[#3d2b1f] hover:bg-[#faf7f2] transition-colors">打開簽到牆</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<p class="text-sm text-[#8b7355] text-center py-4">此婚禮尚無金鑰，請重新建立。</p>`);
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="text-center py-12 text-[#8b7355]">載入中...</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
