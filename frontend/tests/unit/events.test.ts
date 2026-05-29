import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { events } from "$lib/api/client";

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  localStorage.setItem("admin_token", "valid-token");
});

describe("events API", () => {
  it("list returns events array", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [{ PK: "e1", name: "婚禮A" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const result = await events.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("婚禮A");
  });

  it("list throws on 401 and clears token", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    await expect(events.list()).rejects.toThrow("Unauthorized");
    expect(localStorage.getItem("admin_token")).toBeNull();
  });

  it("create posts correct payload", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ PK: "new-event" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
    await events.create("婚禮B", "2026-06-01");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/events"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer valid-token" }),
        body: JSON.stringify({ name: "婚禮B", date: "2026-06-01" }),
      })
    );
  });
});
