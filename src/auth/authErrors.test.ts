import { describe, expect, it } from 'vitest';
import { toFriendlyAuthError } from './authErrors';

describe('authentication failure guidance', () => {
  it.each(['Failed to fetch', 'Load failed', 'Network request failed', 'connection closed', 'Request timed out'])('identifies connectivity failure: %s', message => {
    expect(toFriendlyAuthError(new Error(message))).toContain('无法连接登录服务');
  });
  it('distinguishes credentials from unverified email', () => {
    expect(toFriendlyAuthError('Invalid login credentials')).toContain('邮箱或密码错误');
    expect(toFriendlyAuthError('Email not confirmed')).toContain('邮箱尚未验证');
  });
  it('does not echo unknown server text or account information', () => {
    expect(toFriendlyAuthError('Unexpected error for private@example.com')).not.toContain('private@example.com');
  });
});
