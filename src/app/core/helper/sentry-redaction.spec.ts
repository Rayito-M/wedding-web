import { redactAuthorizationHeaders } from './sentry-redaction';

describe('redactAuthorizationHeaders', () => {
  it('redacts a top-level Authorization key', () => {
    const input = { Authorization: 'Bearer secret-token', method: 'GET' };
    expect(redactAuthorizationHeaders(input)).toEqual({ Authorization: '[Filtered]', method: 'GET' });
  });

  it('is case-insensitive', () => {
    const input = { authorization: 'Bearer secret-token' };
    expect(redactAuthorizationHeaders(input)).toEqual({ authorization: '[Filtered]' });
  });

  it('redacts nested Authorization keys, e.g. a breadcrumb data.request_headers shape', () => {
    const input = {
      category: 'fetch',
      data: {
        method: 'GET',
        url: '/api/wedding-config',
        request_headers: { Authorization: 'Bearer secret-token', Accept: 'application/json' },
      },
    };
    expect(redactAuthorizationHeaders(input)).toEqual({
      category: 'fetch',
      data: {
        method: 'GET',
        url: '/api/wedding-config',
        request_headers: { Authorization: '[Filtered]', Accept: 'application/json' },
      },
    });
  });

  it('redacts inside arrays', () => {
    const input = { breadcrumbs: [{ data: { Authorization: 'Bearer secret-token' } }] };
    expect(redactAuthorizationHeaders(input)).toEqual({
      breadcrumbs: [{ data: { Authorization: '[Filtered]' } }],
    });
  });

  it('leaves values with no Authorization key untouched', () => {
    const input = { method: 'GET', url: '/api/wedding-config', status_code: 200 };
    expect(redactAuthorizationHeaders(input)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = { Authorization: 'Bearer secret-token' };
    redactAuthorizationHeaders(input);
    expect(input.Authorization).toBe('Bearer secret-token');
  });

  it('passes through primitives and null unchanged', () => {
    expect(redactAuthorizationHeaders('plain string')).toBe('plain string');
    expect(redactAuthorizationHeaders(42)).toBe(42);
    expect(redactAuthorizationHeaders(null)).toBeNull();
    expect(redactAuthorizationHeaders(undefined)).toBeUndefined();
  });
});
