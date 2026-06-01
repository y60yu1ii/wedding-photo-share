import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vite";
import { resolve } from "path";

const API_TARGET = "https://x5yiliyyb2.execute-api.ap-northeast-1.amazonaws.com";

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  server: {
    port: 5173,
    proxy: {
      "/slideshow": { target: API_TARGET, changeOrigin: true, secure: true },
      "/admin": { target: API_TARGET, changeOrigin: true, secure: true },
      "/wall": { target: API_TARGET, changeOrigin: true, secure: true },
      "/myguest": { target: API_TARGET, changeOrigin: true, secure: true },
      "/auth": { target: API_TARGET, changeOrigin: true, secure: true },
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
