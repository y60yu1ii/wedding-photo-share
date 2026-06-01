import type { GuestUpload, WallCard, WallPolicy } from "$lib/api/types";

function normalizeGuestKey(photo: Pick<GuestUpload, "guestKey" | "nickname">): string {
  return photo.guestKey?.trim() || photo.nickname.trim().toLowerCase();
}

function compareUploadsByAge(a: GuestUpload, b: GuestUpload): number {
  return a.createdAt.localeCompare(b.createdAt) || a.PK.localeCompare(b.PK);
}

function compareCardsByAge(a: WallCard, b: WallCard): number {
  return a.createdAt.localeCompare(b.createdAt) || a.photoId.localeCompare(b.photoId);
}

export function chooseRepresentativePhoto<T extends { photoId: string }>(
  photos: readonly T[],
  selectedPhotoId: string,
): T {
  if (photos.length === 0) {
    throw new Error("chooseRepresentativePhoto requires at least one photo");
  }

  return photos.find((photo) => photo.photoId === selectedPhotoId) ?? photos[0];
}

export function buildWallCards(
  photos: readonly GuestUpload[],
  wallPolicy: WallPolicy,
): WallCard[] {
  const eligiblePhotos =
    wallPolicy === "approved_only"
      ? photos.filter((photo) => photo.status === "approved")
      : [...photos];

  const photosByGuest = new Map<string, GuestUpload[]>();
  for (const photo of eligiblePhotos) {
    const guestKey = normalizeGuestKey(photo);
    const guestPhotos = photosByGuest.get(guestKey);
    if (guestPhotos) {
      guestPhotos.push(photo);
    } else {
      photosByGuest.set(guestKey, [photo]);
    }
  }

  return [...photosByGuest.entries()]
    .map(([guestKey, guestPhotos]) => {
      const sortedPhotos = [...guestPhotos].sort(compareUploadsByAge);
      const selectedPhotoId = sortedPhotos.find((photo) => photo.representativePhotoId)?.representativePhotoId;
      const selectedPhoto = selectedPhotoId
        ? sortedPhotos.find((photo) => photo.PK === selectedPhotoId)
        : undefined;
      const representative = selectedPhoto ?? sortedPhotos[0];

      return {
        photoId: representative.PK,
        guestKey,
        nickname: representative.nickname,
        createdAt: representative.createdAt,
        presignedUrl: representative.presignedUrl ?? "",
        status: representative.status,
      };
    })
    .sort(compareCardsByAge);
}

export function shuffleWallCards<T extends { photoId: string }>(
  cards: readonly T[],
  recentCount = 4,
): T[] {
  const boundedRecentCount = Math.max(0, Math.min(Math.trunc(recentCount), cards.length));
  if (boundedRecentCount < 2) {
    return [...cards];
  }

  const stableCount = cards.length - boundedRecentCount;
  const stableCards = cards.slice(0, stableCount);
  const recentCards = cards.slice(stableCount);

  return [...stableCards, ...recentCards.slice(1), recentCards[0]];
}
