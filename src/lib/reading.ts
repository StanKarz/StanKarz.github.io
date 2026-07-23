import type { ReadingEntry } from '../types/components';

/** Slug of the most recent reading month, e.g. "july-2026". Empty string if there are no entries. */
export function latestReadingSlug(entries: ReadingEntry[]): string {
  let latestSlug = '';
  let latestKey = '';

  for (const entry of entries) {
    const d = new Date(entry.addedDate + 'T00:00:00Z');
    const sortKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, '0')}`;
    if (sortKey > latestKey) {
      latestKey = sortKey;
      const label = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      });
      latestSlug = label.toLowerCase().replace(/\s+/g, '-');
    }
  }

  return latestSlug;
}

/**
 * Canonical, trailing-slashed link to the latest reading month.
 * Trailing slash matters: linking to `/reading/july-2026` makes GitHub Pages 301 to the
 * slashed URL, which knocks Astro's client router out of its transition into a full page load.
 */
export function latestReadingHref(entries: ReadingEntry[]): string {
  const slug = latestReadingSlug(entries);
  return slug ? `/reading/${slug}/` : '/reading/';
}
