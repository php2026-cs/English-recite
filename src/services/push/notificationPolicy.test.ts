import { describe, expect, it } from 'vitest';
import {
  buildReminderBody,
  canSendForDate,
  dedupePushSubscriptions,
  shouldSendReminder
} from './notificationPolicy';

const baseSettings = {
  dailyReminderEnabled: true,
  reminderOnlyWhenDue: true,
  showDueCount: true
};

describe('notification policy', () => {
  it('notification disabled 不发送', () => {
    expect(
      shouldSendReminder(
        { ...baseSettings, dailyReminderEnabled: false },
        10
      )
    ).toBe(false);
  });

  it('dueCount=0 不发送', () => {
    expect(shouldSendReminder(baseSettings, 0)).toBe(false);
  });

  it('dueCount>0 正确发送', () => {
    expect(shouldSendReminder(baseSettings, 5)).toBe(true);
  });

  it('同一天不会重复发送提醒', () => {
    expect(canSendForDate(['2026-08-29:review'], '2026-08-29', 'review')).toBe(false);
    expect(canSendForDate(['2026-08-29:review'], '2026-08-30', 'review')).toBe(true);
  });

  it('同一个用户支持多个 push subscriptions，并按 endpoint 去重', () => {
    const subscriptions = [
      { endpoint: 'a', user_id: 'u1' },
      { endpoint: 'b', user_id: 'u1' },
      { endpoint: 'a', user_id: 'u1' }
    ];
    expect(dedupePushSubscriptions(subscriptions)).toHaveLength(2);
  });

  it('通知正文默认只显示数量', () => {
    expect(buildReminderBody(baseSettings, 37)).toBe('今天有 37 个释义等你复习。');
  });
});
