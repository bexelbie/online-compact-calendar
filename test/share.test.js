// ABOUTME: Tests for the share module.
// ABOUTME: Covers encoding/decoding of share config in both new multi-calendar and legacy formats.
import { describe, it, expect } from 'vitest';
import { encodeShareHash, decodeShareHash, buildShareStatus } from '../src/share.js';

describe('encodeShareHash — legacy format', () => {
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

describe('encodeShareHash — new format', () => {
  it('encodes calendars array', () => {
    const hash = encodeShareHash({
      countryCode: 'CZ',
      calendars: [
        { name: 'Work', color: '#1a60a8', status: 'committed', url: 'https://example.com/work.ics' },
        { name: 'Family', color: '#b5145a', status: 'possible', url: 'https://example.com/family.ics' },
      ],
    });
    const decoded = JSON.parse(atob(hash));
    expect(decoded.c).toBe('CZ');
    expect(decoded.calendars).toHaveLength(2);
    expect(decoded.calendars[0].name).toBe('Work');
    expect(decoded.calendars[1].status).toBe('possible');
    expect(decoded).not.toHaveProperty('g');
    expect(decoded).not.toHaveProperty('y');
  });

  it('omits country if empty', () => {
    const hash = encodeShareHash({
      countryCode: '',
      calendars: [{ name: 'Test', color: '#000', status: 'committed', url: 'https://example.com/test.ics' }],
    });
    const decoded = JSON.parse(atob(hash));
    expect(decoded).not.toHaveProperty('c');
    expect(decoded.calendars).toHaveLength(1);
  });
});

describe('decodeShareHash — legacy format', () => {
  it('decodes a valid legacy hash to config object', () => {
    const original = { c: 'CZ', g: 'https://example.com/green.ics', y: 'https://example.com/yellow.ics' };
    const hash = btoa(JSON.stringify(original));
    const config = decodeShareHash(hash);
    expect(config).toEqual({
      countryCode: 'CZ',
      calendars: null,
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
      calendars: null,
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
});

describe('decodeShareHash — new format', () => {
  it('decodes a new format hash with calendars array', () => {
    const original = {
      c: 'GB',
      calendars: [
        { name: 'Work', color: '#1a60a8', status: 'committed', url: 'https://example.com/work.ics' },
      ],
    };
    const hash = btoa(JSON.stringify(original));
    const config = decodeShareHash(hash);
    expect(config.countryCode).toBe('GB');
    expect(config.calendars).toHaveLength(1);
    expect(config.calendars[0].name).toBe('Work');
    expect(config.greenUrl).toBeNull();
    expect(config.yellowUrl).toBeNull();
  });

  it('roundtrips new format', () => {
    const input = {
      countryCode: 'JP',
      calendars: [
        { name: 'Personal', color: '#1a60a8', status: 'committed', url: 'https://example.com/日本語.ics' },
        { name: 'Social', color: '#827717', status: 'possible', url: 'https://example.com/social.ics' },
      ],
    };
    const hash = encodeShareHash(input);
    const result = decodeShareHash(hash);
    expect(result.countryCode).toBe('JP');
    expect(result.calendars).toEqual(input.calendars);
  });

  it('roundtrips legacy format', () => {
    const input = {
      countryCode: 'GB',
      greenUrl: 'webcal://calendar.example.com/feed',
      yellowUrl: 'https://other.example.com/cal.ics',
    };
    const hash = encodeShareHash(input);
    const result = decodeShareHash(hash);
    expect(result.countryCode).toBe(input.countryCode);
    expect(result.greenUrl).toBe(input.greenUrl);
    expect(result.yellowUrl).toBe(input.yellowUrl);
  });
});

describe('buildShareStatus', () => {
  it('returns simple message when no file-based calendars', () => {
    const status = buildShareStatus({ fileCalendarNames: [] });
    expect(status).toBe('Link copied!');
  });

  it('returns simple message when fileCalendarNames is undefined', () => {
    const status = buildShareStatus({});
    expect(status).toBe('Link copied!');
  });

  it('warns about single file-based calendar', () => {
    const status = buildShareStatus({ fileCalendarNames: ['Work'] });
    expect(status).toContain('Link copied!');
    expect(status).toContain('Work');
    expect(status).toContain('separately');
  });

  it('warns about multiple file-based calendars', () => {
    const status = buildShareStatus({ fileCalendarNames: ['Work', 'Kids'] });
    expect(status).toContain('Link copied!');
    expect(status).toContain('Work, Kids');
    expect(status).toContain('separately');
  });
});
