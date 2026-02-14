// ABOUTME: Tests for the share module.
// ABOUTME: Covers encoding/decoding of share config to/from URL hash fragments.
import { describe, it, expect } from 'vitest';
import { encodeShareHash, decodeShareHash, buildShareStatus } from '../src/share.js';

describe('encodeShareHash', () => {
  it('encodes country and both URLs', () => {
    const hash = encodeShareHash({
      countryCode: 'CZ',
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: 'https://example.com/yellow.ics',
    });
    const decoded = JSON.parse(atob(hash));
    expect(decoded).toEqual({
      c: 'CZ',
      g: 'https://example.com/green.ics',
      y: 'https://example.com/yellow.ics',
    });
  });

  it('omits keys with no value', () => {
    const hash = encodeShareHash({
      countryCode: 'US',
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: null,
    });
    const decoded = JSON.parse(atob(hash));
    expect(decoded).toEqual({
      c: 'US',
      g: 'https://example.com/green.ics',
    });
    expect(decoded).not.toHaveProperty('y');
  });

  it('omits country if empty', () => {
    const hash = encodeShareHash({
      countryCode: '',
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: null,
    });
    const decoded = JSON.parse(atob(hash));
    expect(decoded).not.toHaveProperty('c');
    expect(decoded).toHaveProperty('g');
  });

  it('omits keys with empty string values', () => {
    const hash = encodeShareHash({
      countryCode: 'DE',
      greenUrl: '',
      yellowUrl: 'https://example.com/yellow.ics',
    });
    const decoded = JSON.parse(atob(hash));
    expect(decoded).toEqual({
      c: 'DE',
      y: 'https://example.com/yellow.ics',
    });
  });
});

describe('decodeShareHash', () => {
  it('decodes a valid hash to config object', () => {
    const original = { c: 'CZ', g: 'https://example.com/green.ics', y: 'https://example.com/yellow.ics' };
    const hash = btoa(JSON.stringify(original));
    const config = decodeShareHash(hash);
    expect(config).toEqual({
      countryCode: 'CZ',
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: 'https://example.com/yellow.ics',
    });
  });

  it('returns null values for missing keys', () => {
    const original = { c: 'US', g: 'https://example.com/green.ics' };
    const hash = btoa(JSON.stringify(original));
    const config = decodeShareHash(hash);
    expect(config).toEqual({
      countryCode: 'US',
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: null,
    });
  });

  it('returns null for invalid base64', () => {
    expect(decodeShareHash('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for valid base64 but invalid JSON', () => {
    const hash = btoa('not json at all');
    expect(decodeShareHash(hash)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(decodeShareHash('')).toBeNull();
  });

  it('roundtrips with encodeShareHash', () => {
    const input = {
      countryCode: 'GB',
      greenUrl: 'webcal://calendar.example.com/feed',
      yellowUrl: 'https://other.example.com/cal.ics',
    };
    const hash = encodeShareHash(input);
    const result = decodeShareHash(hash);
    expect(result).toEqual(input);
  });

  it('roundtrips URLs with non-ASCII characters', () => {
    const input = {
      countryCode: 'JP',
      greenUrl: 'https://example.com/日本語.ics',
      yellowUrl: null,
    };
    const hash = encodeShareHash(input);
    const result = decodeShareHash(hash);
    expect(result).toEqual(input);
  });
});

describe('buildShareStatus', () => {
  it('returns simple message when both bands are URLs', () => {
    const status = buildShareStatus({
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: 'https://example.com/yellow.ics',
      greenHasEvents: true,
      yellowHasEvents: true,
    });
    expect(status).toBe('Link copied!');
  });

  it('returns simple message when only one URL and no other band', () => {
    const status = buildShareStatus({
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: null,
      greenHasEvents: true,
      yellowHasEvents: false,
    });
    expect(status).toBe('Link copied!');
  });

  it('warns about file-based Committed band', () => {
    const status = buildShareStatus({
      greenUrl: null,
      yellowUrl: 'https://example.com/yellow.ics',
      greenHasEvents: true,
      yellowHasEvents: true,
    });
    expect(status).toContain('Link copied!');
    expect(status).toContain('Committed');
    expect(status).toContain('share that separately');
  });

  it('warns about file-based Possible band', () => {
    const status = buildShareStatus({
      greenUrl: 'https://example.com/green.ics',
      yellowUrl: null,
      greenHasEvents: true,
      yellowHasEvents: true,
    });
    expect(status).toContain('Link copied!');
    expect(status).toContain('Possible');
    expect(status).toContain('share that separately');
  });
});
