import { c as stringify, d as derived, b as store_get, u as unsubscribe_stores } from "../../../../../chunks/root.js";
import { c as attr, g as escape_html } from "../../../../../chunks/attributes.js";
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
    let nickname = "";
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-6"><a${attr("href", `/event/${stringify(eventId())}`)} class="text-sm text-[#8b7355] hover:text-[#3d2b1f]">← 返回</a> <h1 class="text-2xl font-bold mt-3 mb-5">上傳照片</h1> `);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4]">`);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="space-y-3"><input type="file" accept="image/*" class="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-[#faf7f2] file:text-[#3d2b1f] file:cursor-pointer"/> <input${attr("value", nickname)} placeholder="您的暱稱（顯示在照片旁）" class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"/> <button${attr("disabled", true, true)} class="w-full py-2.5 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors disabled:opacity-50">${escape_html("送出照片")}</button></div></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
