import { f as stringify, e as ensure_array_like, b as attr_style, d as derived, c as store_get, u as unsubscribe_stores } from "../../../../../chunks/root.js";
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
    let queue = [];
    let nickname = "";
    let greeting = "";
    let uploading = false;
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-6 pb-12"><a${attr("href", `/event/${stringify(eventId())}`)} class="text-sm text-[#8b7355] hover:text-[#3d2b1f] transition-colors">← 返回婚禮相簿</a> <h1 class="text-2xl font-bold mt-3 mb-5 text-[#3d2b1f]">📸 上傳照片</h1> `);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="bg-white rounded-2xl p-5 shadow-sm border border-[#e8d5c4] space-y-5">`);
      {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="relative border-2 border-dashed border-[#e8d5c4] hover:border-[#d4a373] rounded-xl p-6 text-center transition-colors bg-[#faf7f2]/50"><input type="file" multiple="" accept="image/*" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/> <div class="space-y-1.5 pointer-events-none"><p class="text-4xl">➕</p> <p class="text-sm font-semibold text-[#3d2b1f]">點擊或拖曳照片至此</p> <p class="text-xs text-[#8b7355]">支援批量上傳多張照片</p></div></div>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (queue.length > 0) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="space-y-2"><p class="text-xs font-semibold text-[#8b7355]">已選擇的照片 (${escape_html(queue.length)})</p> <div class="grid grid-cols-2 gap-2"><!--[-->`);
        const each_array = ensure_array_like(queue);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let item = each_array[$$index];
          $$renderer2.push(`<div class="relative aspect-square rounded-xl overflow-hidden border border-[#e8d5c4] bg-[#faf7f2] flex flex-col justify-end">`);
          if (item.preview) {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<img${attr("src", item.preview)} alt="preview" class="absolute inset-0 w-full h-full object-cover"/>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> `);
          if (item.status !== "completed") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<button class="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80 transition-colors">✕</button>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--> <div class="relative z-10 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white"><div class="flex items-center justify-between text-[10px] mb-1"><span>`);
          if (item.status === "pending") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`等待中`);
          } else if (item.status === "compressing") {
            $$renderer2.push("<!--[1-->");
            $$renderer2.push(`壓縮中...`);
          } else if (item.status === "uploading") {
            $$renderer2.push("<!--[2-->");
            $$renderer2.push(`上傳中...`);
          } else if (item.status === "completed") {
            $$renderer2.push("<!--[3-->");
            $$renderer2.push(`✓ 已完成`);
          } else if (item.status === "failed") {
            $$renderer2.push("<!--[4-->");
            $$renderer2.push(`✕ 失敗`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></span> `);
          if (item.status === "uploading") {
            $$renderer2.push("<!--[0-->");
            $$renderer2.push(`<span>${escape_html(item.progress)}%</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></div> <div class="w-full bg-white/30 h-1 rounded-full overflow-hidden"><div class="bg-[#d4a373] h-full transition-all duration-300"${attr_style(`width: ${stringify(item.progress)}%`)}></div></div></div></div>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="space-y-3 pt-2"><div><label for="nickname" class="block text-xs font-semibold text-[#8b7355] mb-1.5">您的暱稱 <span class="text-red-500">*</span></label> <input id="nickname"${attr("value", nickname)}${attr("disabled", uploading, true)} placeholder="如：伴郎小張 / 大學同學雅婷" class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373] bg-[#faf7f2]/20 disabled:opacity-50"/></div> <div><label for="greeting" class="block text-xs font-semibold text-[#8b7355] mb-1.5">暖心祝福留言 <span class="text-gray-400 font-normal">(選填)</span></label> <input id="greeting"${attr("value", greeting)}${attr("disabled", uploading, true)} maxlength="50" placeholder="寫下您對新人的滿滿祝福吧（50字以內）" class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373] bg-[#faf7f2]/20 disabled:opacity-50"/></div> <button${attr("disabled", queue.length === 0 || !nickname.trim(), true)} class="w-full py-3 mt-4 bg-[#d4a373] hover:bg-[#bc8a5f] text-white font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">`);
      {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<span>🚀 送出照片與祝福</span>`);
      }
      $$renderer2.push(`<!--]--></button></div></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
