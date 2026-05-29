import { c as attr, g as escape_html } from "../../../chunks/attributes.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let selected = /* @__PURE__ */ new Set();
    let batchDeleting = false;
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-8"><div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-bold">管理後台</h1> <button class="text-sm text-[#8b7355] hover:text-[#3d2b1f]">登出</button></div> `);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="flex gap-2 mb-4"><button class="flex-1 py-2.5 bg-[#d4a373] text-white font-medium rounded-lg hover:bg-[#bc8a5f] transition-colors">+ 建立新婚禮</button> `);
      if (selected.size > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button${attr("disabled", batchDeleting, true)} class="px-4 py-2.5 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">${escape_html(`刪除 ${selected.size} 個`)}</button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="text-center py-8 text-[#8b7355]">載入中...</div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
export {
  _page as default
};
