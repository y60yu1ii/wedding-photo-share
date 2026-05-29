import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import SignInWallCard from "$lib/components/SignInWallCard.svelte";

describe("SignInWallCard", () => {
  it("renders a polaroid-style card", () => {
    const { getByTestId } = render(SignInWallCard, {
      props: {
        card: {
          photoId: "PHOTO#1",
          guestKey: "guest-abc",
          nickname: "Alice",
          createdAt: "2026-05-29T00:00:01.000Z",
          presignedUrl: "https://example.com/photo.jpg",
          status: "approved",
        },
      },
    });

    expect(getByTestId("sign-in-wall-card")).toBeTruthy();
  });
});
