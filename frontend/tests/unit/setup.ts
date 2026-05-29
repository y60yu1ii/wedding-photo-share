import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/svelte";
import { afterEach, vi } from "vitest";

// Mock localStorage
vi.stubGlobal("localStorage", (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})());

// Mock fetch
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
vi.stubGlobal("fetch", (...args: Parameters<typeof fetch>) => fetchMock(...args));

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});
