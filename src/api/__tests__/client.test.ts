import { apiCall, ApiError, ConflictError, extractMessage, NetworkError, normalizeServer } from '../client';

const credentials = { server: 'https://dashboard.erpkenya.com', apiKey: 'key', apiSecret: 'secret' };

function mockFetch(status: number, body: unknown) {
  const fetchMock = jest.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function caught(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('Expected the call to fail');
    },
    (e: unknown) => e as ConflictError,
  );
}

describe('normalizeServer', () => {
  it('trims and drops trailing slashes', () => {
    expect(normalizeServer(' https://dashboard.erpkenya.com/ ')).toBe('https://dashboard.erpkenya.com');
  });
  it('refuses plain http and bare input', () => {
    expect(() => normalizeServer('http://dashboard.erpkenya.com')).toThrow('starting with https://');
    expect(() => normalizeServer('https://')).toThrow();
  });
});

describe('extractMessage', () => {
  it("reads Frappe's _server_messages", () => {
    const body = {
      _server_messages: JSON.stringify([JSON.stringify({ message: "This account isn't set up for Lift Log yet." })]),
    };
    expect(extractMessage(body)).toBe("This account isn't set up for Lift Log yet.");
  });
  it('falls back to message, then exception', () => {
    expect(extractMessage({ message: 'Invalid login credentials' })).toBe('Invalid login credentials');
    expect(extractMessage({ exception: 'frappe.exceptions.ValidationError: <b>Bad</b> value' })).toBe('Bad value');
    expect(extractMessage(null)).toBeNull();
  });
});

describe('apiCall', () => {
  it('sends the token and unwraps message', async () => {
    const fetchMock = mockFetch(200, { message: { ok: true } });
    await expect(apiCall('GET', 'today.get', { date: '2026-10-07' }, { credentials })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dashboard.erpkenya.com/api/method/lift_log.api.today.get?date=2026-10-07');
    expect((init.headers as Record<string, string>).Authorization).toBe('token key:secret');
  });

  it('posts JSON', async () => {
    const fetchMock = mockFetch(200, { message: {} });
    await apiCall('POST', 'profile.save', { weight_kg: 72 }, { credentials });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"weight_kg":72}');
  });

  it('turns 409 into ConflictError with the stored copy', async () => {
    mockFetch(409, { message: { stored: { session_date: '2026-10-06' } } });
    const error = await caught(apiCall('POST', 'sessions.save', {}, { credentials }));
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.stored).toEqual({ session_date: '2026-10-06' });
  });

  it("shows the server's message on failure", async () => {
    mockFetch(403, {
      _server_messages: JSON.stringify([JSON.stringify({ message: "This account isn't set up for Lift Log yet." })]),
    });
    const error = await caught(apiCall('POST', 'auth.sign_in', {}, { server: credentials.server }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(403);
    expect(error.message).toBe("This account isn't set up for Lift Log yet.");
  });

  it('reports an unreachable site as NetworkError', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(apiCall('GET', 'today.get', {}, { credentials })).rejects.toBeInstanceOf(NetworkError);
  });
});
