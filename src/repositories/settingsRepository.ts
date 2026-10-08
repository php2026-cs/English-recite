import { db } from '../db/db';
import type { UserSettings } from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'app',
  reviewFlow: 'two-rounds',
  dailyNewMeaningLimit: 20,
  desiredRetention: 0.9,
  dailyReminderEnabled: false,
  reminderTime: '20:00',
  reminderOnlyWhenDue: true,
  showDueCount: true,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'
};

export const settingsRepository = {
  async get(): Promise<UserSettings> {
    const saved = await db.settings.get('app');
    return { ...DEFAULT_SETTINGS, ...saved };
  },

  async update(patch: Partial<UserSettings>): Promise<UserSettings> {
    const current = await settingsRepository.get();
    const next: UserSettings = {
      ...current,
      ...patch,
      id: 'app'
    };
    await db.settings.put(next);
    return next;
  }
};
