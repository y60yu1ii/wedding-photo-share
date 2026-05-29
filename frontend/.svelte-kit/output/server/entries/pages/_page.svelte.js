import { c as attr } from "../../chunks/attributes.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let eventId = "";
    let loading = false;
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-12"><div class="text-center mb-8"><h1 class="text-3xl font-bold text-[#3d2b1f]">💍 婚禮照片分享</h1> <p class="mt-2 text-[#8b7355] text-sm">上傳與瀏覽婚禮精彩瞬間</p></div> <div class="bg-white rounded-2xl p-6 shadow-sm mb-4 border border-[#e8d5c4]"><h2 class="text-base font-semibold mb-3">新郎新娘管理</h2> <button class="w-full py-2.5 px-4 bg-[#d4a373] hover:bg-[#bc8a5f] text-white font-medium rounded-lg transition-colors">管理登入</button></div> <div class="bg-white rounded-2xl p-6 shadow-sm border border-[#e8d5c4]"><h2 class="text-base font-semibold mb-1">賓客上傳</h2> <p class="text-sm text-[#8b7355] mb-4">輸入婚禮方提供的婚禮ID即可上傳照片</p> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="space-y-3"><input${attr("value", eventId)} placeholder="婚禮ID（向工作人員取得）" class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"/> <button${attr("disabled", loading, true)} class="w-full py-2.5 px-4 border border-[#e8d5c4] text-[#3d2b1f] font-medium rounded-lg hover:bg-[#faf7f2] transition-colors disabled:opacity-50">進入上傳</button></div></div></div>`);
  });
}
export {
  _page as default
};
