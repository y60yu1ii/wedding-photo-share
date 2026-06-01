import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { GuestUpload } from "$lib/api/types";
import GuestRepresentativePicker from "$lib/components/GuestRepresentativePicker.svelte";
import WallPolicySelect from "$lib/components/WallPolicySelect.svelte";

describe("guest representative picker", () => {
  it("lets a guest switch the selected sign-in photo", async () => {
    const onChoose = vi.fn();
    const photos: GuestUpload[] = [
      {
        PK: "PHOTO#1",
        eventId: "EVENT-1",
        nickname: "Alice",
        status: "approved",
        createdAt: "2026-05-29T00:00:00.000Z",
        presignedUrl: "https://example.com/1.jpg",
      },
      {
        PK: "PHOTO#2",
        eventId: "EVENT-1",
        nickname: "Alice",
        status: "approved",
        createdAt: "2026-05-29T00:01:00.000Z",
        presignedUrl: "https://example.com/2.jpg",
      },
    ];
    const { getByRole } = render(GuestRepresentativePicker, {
      props: {
        photos,
        selectedPhotoId: "PHOTO#1",
        onChoose,
      },
    });

    await fireEvent.click(getByRole("button", { name: "設為簽到照" }));
    expect(onChoose).toHaveBeenCalledWith("PHOTO#2");
  });
});

describe("wall policy select", () => {
  it("switches the wall policy value", async () => {
    const onChange = vi.fn();
    const { getByRole } = render(WallPolicySelect, {
      props: {
        value: "approved_only",
        onChange,
      },
    });

    const select = getByRole("combobox") as HTMLSelectElement;
    await fireEvent.change(select, { target: { value: "all_uploads" } });

    expect(onChange).toHaveBeenCalledWith("all_uploads");
  });
});
