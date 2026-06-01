import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig, type ProxyOptions } from "vite";
import { resolve } from "path";

const API_TARGET = "https://x5yiliyyb2.execute-api.ap-northeast-1.amazonaws.com";

// Proxy only the API sub-paths; let SvelteKit serve the /admin and /
// index pages. Bypass returns the request path to short-circuit the proxy.
const apiProxy = (pathPrefix: string): ProxyOptions => ({
  target: API_TARGET,
  changeOrigin: true,
  secure: true,
  bypass: (req) => {
    const url = req.url ?? "";
    if (url === pathPrefix || url === `${pathPrefix}/`) return url;
    return undefined;
  },
});

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  server: {
    port: 5173,
    proxy: {
      "/slideshow": apiProxy("/slideshow"),
      "/admin": apiProxy("/admin"),
      "/wall": apiProxy("/wall"),
      "/myguest": apiProxy("/myguest"),
      "/auth": apiProxy("/auth"),
    },
  },
  resolve: {
    alias: {
      $lib: resolve(__dirname, "./src/lib"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["./tests/unit/**/*.test.ts"],
    // Svelte 5 needs browser environment for mount()
    pool: "vmForks",
    poolOptions: {
      vmForks: {
        singleFork: true,
      },
    },
  },
});
