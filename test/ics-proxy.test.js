// ABOUTME: Tests for the ICS proxy Azure Function request validation.
// ABOUTME: Covers input validation (missing URL, invalid JSON, non-HTTPS) without network calls.
import { describe, it, expect, vi } from 'vitest';

// Mock @azure/functions before importing the handler
vi.mock('@azure/functions', () => ({
  app: { http: vi.fn() },
}));

const { icsProxyHandler } = await import('../api/src/functions/ics-proxy.js');

function makeRequest(body) {
  return {
    json: () => {
      if (body === undefined) return Promise.reject(new Error('no body'));
      return Promise.resolve(body);
    },
  };
}

const mockContext = { error: vi.fn() };

describe('ics-proxy validation', () => {
  it('returns 400 for invalid JSON body', async () => {
    const result = await icsProxyHandler(makeRequest(undefined), mockContext);
    expect(result.status).toBe(400);
    expect(result.body).toBe('Invalid JSON body');
  });

  it('returns 400 for missing url field', async () => {
    const result = await icsProxyHandler(makeRequest({}), mockContext);
    expect(result.status).toBe(400);
    expect(result.body).toBe('Missing url parameter');
  });

  it('returns 400 for invalid URL format', async () => {
    const result = await icsProxyHandler(makeRequest({ url: 'not-a-url' }), mockContext);
    expect(result.status).toBe(400);
    expect(result.body).toBe('Invalid URL');
  });

  it('returns 400 for non-HTTPS URL', async () => {
    const result = await icsProxyHandler(makeRequest({ url: 'http://example.com/cal.ics' }), mockContext);
    expect(result.status).toBe(400);
    expect(result.body).toBe('Only HTTPS URLs are allowed');
  });

  it('returns 400 for empty url field', async () => {
    const result = await icsProxyHandler(makeRequest({ url: '' }), mockContext);
    expect(result.status).toBe(400);
    expect(result.body).toBe('Missing url parameter');
  });
});
