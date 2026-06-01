import { beforeEach, describe, expect, it, vi } from "vitest";
import { myguest, wall } from "$lib/api/client";
import type { GuestUpload, WallCard, WallPolicy } from "$lib/api/types";
import {
  buildWallCards,
  chooseRepresentativePhoto,
  shuffleWallCards,
} from "$lib/utils/wall";

function makeUpload(overrides: Partial<GuestUpload> = {}): GuestUpload {
  return {
    PK: "PHOTO#1",
    eventId: "EVENT-1",
    nickname: "Alice",
    guestKey: "guest-alice",
    representativePhotoId: "PHOTO#1",
    status: "approved",
    createdAt: "2026-05-29T00:00:01.000Z",
    presignedUrl: "https://example.com/1.jpg",
    ...overrides,
  };
}

function makeCard(photoId: string): WallCard {
  return {
    photoId,
    guestKey: `guest-${photoId.toLowerCase()}`,
    nickname: photoId,
    createdAt: `2026-05-29T00:00:0${photoId.slice(-1)}.000Z`,
    presignedUrl: `https://example.com/${photoId}.jpg`,
    status: "approved",
  };
}

describe("wall helpers", () => {
  it("keeps one representative card per guest and orders the chosen cards oldest first", () => {
    const cards = buildWallCards(
      [
        makeUpload({
          PK: "PHOTO#1",
          representativePhotoId: "PHOTO#2",
          createdAt: "2026-05-29T00:00:01.000Z",
        }),
        makeUpload({
          PK: "PHOTO#2",
          representativePhotoId: "PHOTO#2",
          createdAt: "2026-05-29T00:00:02.000Z",
        }),
        makeUpload({
          PK: "PHOTO#3",
          nickname: "Bob",
          guestKey: "guest-bob",
          representativePhotoId: "PHOTO#3",
          createdAt: "2026-05-29T00:00:00.000Z",
          presignedUrl: "https://example.com/3.jpg",
        }),
      ],
      "approved_only",
    );

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.photoId)).toEqual(["PHOTO#3", "PHOTO#2"]);
  });

  it("filters pending uploads when the wall policy is approved_only", () => {
    const cards = buildWallCards(
      [
        makeUpload({
          PK: "PHOTO#1",
          status: "pending",
          representativePhotoId: "PHOTO#1",
        }),
        makeUpload({
          PK: "PHOTO#2",
          representativePhotoId: "PHOTO#1",
          createdAt: "2026-05-29T00:00:02.000Z",
          presignedUrl: "https://example.com/2.jpg",
        }),
      ],
      "approved_only",
    );

    expect(cards).toHaveLength(1);
    expect(cards[0].photoId).toBe("PHOTO#2");
    expect(cards[0].status).toBe("approved");
  });

  it("selects a photo by id and falls back to the first photo when the id is missing", () => {
    const photos = [makeCard("PHOTO#1"), makeCard("PHOTO#2")];

    expect(chooseRepresentativePhoto(photos, "PHOTO#2").photoId).toBe("PHOTO#2");
    expect(chooseRepresentativePhoto(photos, "PHOTO#9").photoId).toBe("PHOTO#1");
  });

  it("soft-shuffles only the recent subset", () => {
    const cards = [
      makeCard("PHOTO#1"),
      makeCard("PHOTO#2"),
      makeCard("PHOTO#3"),
      makeCard("PHOTO#4"),
      makeCard("PHOTO#5"),
    ];

    expect(shuffleWallCards(cards, 3).map((card) => card.photoId)).toEqual([
      "PHOTO#1",
      "PHOTO#2",
      "PHOTO#4",
      "PHOTO#5",
      "PHOTO#3",
    ]);
  });
});

describe("wall api client", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  it("requests wall photos by event id", async () => {
    const response: { eventId: string; wallPolicy: WallPolicy; photos: GuestUpload[] } = {
      eventId: "EVENT-1",
      wallPolicy: "approved_only",
      photos: [makeUpload()],
    };

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(wall.photos("EVENT-1")).resolves.toEqual(response);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/wall/photos?eventId=EVENT-1"),
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("requests guest photos with guestKey and nickname when both are provided", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ photos: [makeUpload()] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(myguest.photos("EVENT-1", "guest-alice", "Alice")).resolves.toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/myguest/photos?eventId=EVENT-1&guestKey=guest-alice&nickname=Alice"),
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
  });

  it("patches the representative photo with guest identity", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(
      myguest.setRepresentative("PHOTO#2", "EVENT-1", "guest-alice"),
    ).resolves.toBeUndefined();

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/myguest/photos/PHOTO%232/representative"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ eventId: "EVENT-1", guestKey: "guest-alice" }),
      }),
    );
  });
});
