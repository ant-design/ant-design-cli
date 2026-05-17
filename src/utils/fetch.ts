/**
 * Fetch a URL with a timeout. Aborts the request if it takes longer than `timeoutMs`.
 * Follows redirects by default.
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  /* v8 ignore next -- timeout callback only fires when fetch exceeds timeoutMs; tests use mocked fetch */
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Race multiple URLs and return the first successful JSON response.
 * Returns null if all URLs fail.
 */
export async function fetchFirstJson<T>(
  urls: string[],
  timeoutMs: number,
): Promise<T | null> {
  return Promise.any(
    urls.map(async (url) => {
      const res = await fetchWithTimeout(url, timeoutMs);
      return res.json() as Promise<T>;
    }),
  ).catch(() => null);
}
