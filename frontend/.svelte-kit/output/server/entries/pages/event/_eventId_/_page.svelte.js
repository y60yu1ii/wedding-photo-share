import { c as stringify, d as derived, b as store_get, u as unsubscribe_stores } from "../../../../chunks/root.js";
import { g as escape_html, c as attr } from "../../../../chunks/attributes.js";
import { p as page } from "../../../../chunks/stores.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const eventId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.eventId);
    let event = {};
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-8"><div class="text-center mb-6"><h1 class="text-2xl font-bold">${escape_html(event.name ?? "婚禮照片")}</h1> `);
    if (event.date) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="text-sm text-[#8b7355] mt-1">${escape_html(event.date)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="text-center py-12 text-[#8b7355]">載入中...</div>`);
    }
    $$renderer2.push(`<!--]--> <div class="mt-8 text-center"><a${attr("href", `/event/${stringify(eventId())}/upload`)}><button class="py-2.5 px-6 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors">上傳照片</button></a></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
