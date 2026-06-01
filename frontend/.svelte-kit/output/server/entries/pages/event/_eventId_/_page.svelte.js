import { f as stringify, d as derived, c as store_get, u as unsubscribe_stores } from "../../../../chunks/root.js";
import { g as escape_html, c as attr } from "../../../../chunks/attributes.js";
import { p as page } from "../../../../chunks/stores.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const eventId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.eventId ?? "");
    let event = {};
    let photos = [];
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-6 pb-16"><a href="/admin" class="text-sm text-[#8b7355] hover:text-[#3d2b1f] transition-colors">← 返回管理中心</a> <div class="text-center mt-3 mb-6"><h1 class="text-2xl font-bold text-[#3d2b1f]">${escape_html(event.name ?? "婚禮相簿")}</h1> `);
      if (event.date) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="text-xs text-[#8b7355] mt-1 tracking-wider">${escape_html(event.date)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div> <div class="grid grid-cols-2 gap-2.5 mb-6"><button${attr("disabled", photos.length === 0, true)} class="py-3 px-4 bg-[#3d2b1f] text-amber-200 hover:text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"><span>📺 開啟即時大螢幕投屏</span></button> <a${attr("href", `/event/${stringify(eventId())}/upload`)}><button class="w-full py-3 px-4 bg-[#d4a373] text-white hover:bg-[#bc8a5f] font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"><span>🚀 賓客上傳照片</span></button></a></div> `);
      {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="text-center py-12 text-[#8b7355]">載入中...</div>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
