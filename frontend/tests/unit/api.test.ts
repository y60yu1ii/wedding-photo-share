import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "$lib/api/client";

describe("auth API", () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    localStorage.clear();
  });

  it("login sets token in localStorage", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ token: "abc123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await auth.login("admin", "password");
    expect(localStorage.getItem("admin_token")).toBe("abc123");
  });

  it("login throws on failure", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 401 })
    );
    await expect(auth.login("bad", "cred")).rejects.toThrow("登入失敗");
  });

  it("isLoggedIn returns true when token exists", () => {
    localStorage.setItem("admin_token", "tok");
    expect(auth.isLoggedIn()).toBe(true);
  });

  it("isLoggedIn returns false when no token", () => {
    localStorage.removeItem("admin_token");
    expect(auth.isLoggedIn()).toBe(false);
  });

  it("logout removes token", () => {
    localStorage.setItem("admin_token", "tok");
    auth.logout();
    expect(localStorage.getItem("admin_token")).toBeNull();
  });
});
