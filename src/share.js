// ABOUTME: Encodes and decodes calendar configuration for URL-hash-based sharing.
// ABOUTME: Supports new multi-calendar format and legacy green/yellow format (read-only).

/**
 * Encode a share config into a base64 hash string.
 * New format: { c: country, calendars: [{ name, color, status, url }, ...] }
 * Legacy format: { c: country, g: greenUrl, y: yellowUrl } (still produced for backward compat when only 2 calendars)
 */
export function encodeShareHash({ countryCode, calendars, greenUrl, yellowUrl }) {
  const obj = {};
  if (countryCode) obj.c = countryCode;

  if (calendars) {
    obj.calendars = calendars;
  } else {
    // Legacy encoding path
    if (greenUrl) obj.g = greenUrl;
    if (yellowUrl) obj.y = yellowUrl;
  }
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

/**
 * Decode a base64 hash string into a share config object.
 * Detects new format (has 'calendars' key) vs legacy format (has 'g'/'y' keys).
 * Returns null if the hash is invalid.
 */
export function decodeShareHash(hash) {
  if (!hash) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob(hash))));

    if (obj.calendars) {
      return {
        countryCode: obj.c || null,
        calendars: obj.calendars,
        greenUrl: null,
        yellowUrl: null,
      };
    }

    // Legacy format
    return {
      countryCode: obj.c || null,
      calendars: null,
      greenUrl: obj.g || null,
      yellowUrl: obj.y || null,
    };
  } catch {
    return null;
  }
}

/**
 * Build a status message for the share button.
 * Accepts { fileCalendarNames: string[] } for calendars loaded from files (not shareable).
 */
export function buildShareStatus({ fileCalendarNames }) {
  if (!fileCalendarNames || fileCalendarNames.length === 0) {
    return 'Link copied!';
  }

  const names = fileCalendarNames.join(', ');
  return `Link copied! ${names} ${fileCalendarNames.length === 1 ? 'is' : 'are'} file-based — share ${fileCalendarNames.length === 1 ? 'it' : 'them'} separately.`;
}
