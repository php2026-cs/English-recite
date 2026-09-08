import { afterEach, describe, expect, it } from 'vitest';
import {
  currentOwnerFilter,
  isOwnedByCurrentUser,
  setCurrentOwnerUserId
} from './ownership';

afterEach(() => {
  setCurrentOwnerUserId(null);
});

describe('local owner isolation', () => {
  it('匿名数据只匹配 null owner', () => {
    setCurrentOwnerUserId(null);
    expect(isOwnedByCurrentUser(null)).toBe(true);
    expect(isOwnedByCurrentUser('user-a')).toBe(false);
  });

  it('User A 只看到 A 数据', () => {
    setCurrentOwnerUserId('user-a');
    const items = [
      { id: '1', localOwnerUserId: null },
      { id: '2', localOwnerUserId: 'user-a' },
      { id: '3', localOwnerUserId: 'user-b' }
    ];
    expect(currentOwnerFilter(items).map((item) => item.id)).toEqual(['2']);
  });

  it('切换用户后过滤结果改变', () => {
    setCurrentOwnerUserId('user-a');
    const items = [
      { id: '1', localOwnerUserId: 'user-a' },
      { id: '2', localOwnerUserId: 'user-b' }
    ];
    expect(currentOwnerFilter(items).map((item) => item.id)).toEqual(['1']);

    setCurrentOwnerUserId('user-b');
    expect(currentOwnerFilter(items).map((item) => item.id)).toEqual(['2']);
  });
});
