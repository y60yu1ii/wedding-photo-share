import { b as stringify, d as derived, a as store_get, u as unsubscribe_stores } from "../../../../chunks/root.js";
import { p as page } from "../../../../chunks/stores.js";
import { c as attr } from "../../../../chunks/attributes.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const eventId = derived(() => store_get($$store_subs ??= {}, "$page", page).params.eventId);
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-8"><div class="text-center mb-6"><h1 class="text-2xl font-bold">我的上傳</h1> <p class="text-sm text-[#8b7355] mt-1">您上傳的所有照片</p></div> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="text-center py-12 text-[#8b7355]">載入中...</div>`);
    }
    $$renderer2.push(`<!--]--> <div class="mt-8 text-center"><a${attr("href", `/event/${stringify(eventId())}`)}><button class="py-2.5 px-6 border border-[#e8d5c4] text-[#3d2b1f] font-medium rounded-lg hover:bg-[#faf7f2] transition-colors">返回婚禮</button></a></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
