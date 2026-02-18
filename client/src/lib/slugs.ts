export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

export function getShareUrl(epId: number): string {
  return `/e/${epId}`;
}
