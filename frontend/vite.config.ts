import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [sveltekit(), svelteTesting()],
  server: { port: 5173 },
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
