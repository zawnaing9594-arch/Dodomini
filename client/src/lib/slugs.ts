export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function getShareUrl(epId: number, _seriesTitle?: string, _epTitle?: string): string {
  return `/watch/${epId}`;
}

export function getShareLink(contentId: number, episodeNumber: number): string {
  return `/s/${contentId}/${episodeNumber}`;
}
