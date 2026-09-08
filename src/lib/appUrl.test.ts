import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUrl } from './appUrl';

afterEach(() => vi.unstubAllEnvs());

describe('notification links on each host', () => {
  it('keeps root-host routes unchanged', () => {
    vi.stubEnv('BASE_URL', '/');
    vi.stubEnv('VITE_ROUTER_MODE', '');
    expect(appUrl()).toBe('/review/today');
  });
  it('uses the repository and hash route on Pages without double-prefixing', () => {
    vi.stubEnv('BASE_URL', '/English-recite/');
    vi.stubEnv('VITE_ROUTER_MODE', 'hash');
    expect(appUrl()).toBe('/English-recite/#/review/today');
    expect(appUrl(appUrl())).toBe('/English-recite/#/review/today');
    expect(appUrl('/review/adaptive')).toBe('/English-recite/#/review/adaptive');
  });
});
