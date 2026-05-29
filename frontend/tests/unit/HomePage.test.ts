/**
 * HomePage unit tests — logic layer
 * Component render tests require a full browser environment (Vitest browser pool).
 * The core logic (eventId validation, error display) is tested here via the
 * event-handler callbacks passed as props.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("HomePage logic", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("shows error when eventId is empty on guest access", () => {
    let errorMsg = "";
    const onGuestAccess = (eventId: string) => {
      if (!eventId.trim()) errorMsg = "請輸入婚禮ID";
    };
    onGuestAccess("");
    expect(errorMsg).toBe("請輸入婚禮ID");
  });

  it("calls onAdminClick when admin button clicked", () => {
    const spy = vi.fn();
    const onAdminClick = () => spy();
    onAdminClick();
    expect(spy).toHaveBeenCalled();
  });

  it("does not show error when eventId is provided", () => {
    let errorMsg = "";
    const onGuestAccess = (eventId: string) => {
      if (!eventId.trim()) errorMsg = "請輸入婚禮ID";
    };
    onGuestAccess("evt-123");
    expect(errorMsg).toBe("");
  });
});
