/**
 * Fetch wrapper with timeout support.
 * Prevents API calls from hanging indefinitely when external services are slow/down.
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds

export const fetchWithTimeout = (
    url: string,
    options: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT
): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
        ...options,
        signal: controller.signal,
    }).finally(() => clearTimeout(timer));
};
