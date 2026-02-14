// ABOUTME: Encodes and decodes calendar configuration for URL-hash-based sharing.
// ABOUTME: Produces base64-encoded JSON fragments that stay client-side (never sent to server).

/**
 * Encode a share config into a base64 hash string.
 * Keys: c=country, g=green URL, y=yellow URL. Empty values are omitted.
 */
export function encodeShareHash({ countryCode, greenUrl, yellowUrl }) {
  const obj = {};
  if (countryCode) obj.c = countryCode;
  if (greenUrl) obj.g = greenUrl;
  if (yellowUrl) obj.y = yellowUrl;
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

/**
 * Decode a base64 hash string into a share config object.
 * Returns null if the hash is invalid.
 */
export function decodeShareHash(hash) {
  if (!hash) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(escape(atob(hash))));
    return {
      countryCode: obj.c || null,
      greenUrl: obj.g || null,
      yellowUrl: obj.y || null,
    };
  } catch {
    return null;
  }
}

/**
 * Build a status message for the share button based on what's being shared.
 */
export function buildShareStatus({ greenUrl, yellowUrl, greenHasEvents, yellowHasEvents }) {
  const fileBands = [];
  if (!greenUrl && greenHasEvents) fileBands.push('Committed');
  if (!yellowUrl && yellowHasEvents) fileBands.push('Possible');

  if (fileBands.length === 0) {
    return 'Link copied!';
  }

  const bandName = fileBands[0];
  return `Link copied! Your ${bandName} calendar is a file — you'll need to share that separately.`;
}
