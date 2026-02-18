export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getShareUrl(seriesTitle: string, epTitle: string): string {
  return `/${toSlug(seriesTitle)}/${toSlug(epTitle)}`;
}
