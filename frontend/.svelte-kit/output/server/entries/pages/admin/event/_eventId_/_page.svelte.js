import { a as attr_class, d as derived, b as store_get, u as unsubscribe_stores } from "../../../../../chunks/root.js";
import { g as escape_html, c as attr } from "../../../../../chunks/attributes.js";
import { p as page } from "../../../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../../../chunks/exports.js";
import "../../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const eventId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.eventId);
    let event = {};
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
      return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}`;
    }
    const urls = derived(() => buildUrls(event));
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-6"><a href="/admin" class="text-sm text-[#8b7355] hover:text-[#3d2b1f]">← 返回列表</a> <div class="mt-4 mb-5"><h1 class="text-2xl font-bold">${escape_html(event.name ?? "婚禮管理")}</h1> `);
    if (event.date) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-sm text-[#8b7355] mt-1">${escape_html(event.date)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> <div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] mb-4"><h2 class="text-sm font-semibold mb-3">分享連結</h2> `);
    if (urls().hasKeys) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-start gap-3 mb-4"><img${attr("src", qrUrl(urls().uploadUrl))} alt="上傳 QR" class="w-20 h-20 rounded-lg border border-[#e8d5c4] flex-shrink-0"/> <div class="flex-1 min-w-0"><p class="text-xs text-[#8b7355] mb-1">👤 賓客上傳</p> <p class="text-xs font-mono break-all text-[#3d2b1f] bg-[#fdf8f3] rounded px-2 py-1">${escape_html(urls().uploadUrl)}</p> <button class="mt-1.5 text-xs bg-[#f5ede3] hover:bg-[#e8d5c4] text-[#8b7355] px-3 py-1 rounded-md transition-colors">📋 複製連結</button></div></div> <div class="flex items-start gap-3"><img${attr("src", qrUrl(urls().showUrl))} alt="瀏覽 QR" class="w-20 h-20 rounded-lg border border-[#e8d5c4] flex-shrink-0"/> <div class="flex-1 min-w-0"><p class="text-xs text-[#8b7355] mb-1">🎉 婚禮展示</p> <p class="text-xs font-mono break-all text-[#3d2b1f] bg-[#fdf8f3] rounded px-2 py-1">${escape_html(urls().showUrl)}</p> <button class="mt-1.5 text-xs bg-[#f5ede3] hover:bg-[#e8d5c4] text-[#8b7355] px-3 py-1 rounded-md transition-colors">📋 複製連結</button></div></div> <div class="mt-4 pt-4 border-t border-[#e8d5c4] flex items-center justify-between"><div><p class="text-xs font-semibold text-[#8b7355]">📢 照片發布設定</p> <p class="text-[11px] text-gray-500 mt-0.5">${escape_html(event.requiresReview ? "賓客上傳的照片需經管理員審核後才公開" : "賓客照片上傳完成後免審核直接公開發布")}</p></div> <button${attr_class(`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${event.requiresReview ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"}`)}>${escape_html(event.requiresReview ? "🔓 切換為免審核" : "🔒 切換為需審核")}</button></div>`);
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
