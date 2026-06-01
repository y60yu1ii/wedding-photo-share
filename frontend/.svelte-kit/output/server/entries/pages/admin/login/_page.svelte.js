import { c as attr } from "../../../../chunks/attributes.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let username = "";
    let password = "";
    $$renderer2.push(`<div class="max-w-md mx-auto px-4 pt-12"><div class="text-center mb-6"><h1 class="text-2xl font-bold">管理登入</h1></div> <form class="bg-white rounded-2xl p-6 shadow-sm border border-[#e8d5c4]">`);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="space-y-4"><div><label for="username" class="block text-sm text-[#8b7355] mb-1.5">帳號</label> <input id="username"${attr("value", username)} placeholder="管理員帳號" autocomplete="username" class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"/></div> <div><label for="password" class="block text-sm text-[#8b7355] mb-1.5">密碼</label> <input id="password" type="password"${attr("value", password)} placeholder="管理員密碼" autocomplete="current-password" class="w-full px-4 py-2.5 border border-[#e8d5c4] rounded-lg text-sm focus:outline-none focus:border-[#d4a373]"/></div> <button type="submit" class="w-full py-2.5 bg-[#d4a373] hover:bg-[#bc8a5f] text-white font-medium rounded-lg transition-colors">登入</button></div></form></div>`);
  });
}
export {
  _page as default
};
