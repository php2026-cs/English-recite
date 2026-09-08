export interface ReminderSettings {
  dailyReminderEnabled: boolean;
  reminderOnlyWhenDue: boolean;
  showDueCount: boolean;
}

export function shouldSendReminder(
  settings: ReminderSettings,
  dueCount: number
): boolean {
  if (!settings.dailyReminderEnabled) return false;
  if (settings.reminderOnlyWhenDue && dueCount <= 0) return false;
  return dueCount >= 0;
}

export function buildReminderBody(
  settings: ReminderSettings,
  dueCount: number
): string {
  return settings.showDueCount
    ? `今天有 ${dueCount} 个释义等你复习。`
    : '该复习单词了。';
}

export function canSendForDate(
  sentDates: string[],
  notificationDate: string,
  notificationType: string
): boolean {
  return !sentDates.includes(`${notificationDate}:${notificationType}`);
}

export function dedupePushSubscriptions<T extends { endpoint: string }>(
  subscriptions: T[]
): T[] {
  const seen = new Set<string>();
  return subscriptions.filter((subscription) => {
    if (seen.has(subscription.endpoint)) return false;
    seen.add(subscription.endpoint);
    return true;
  });
}
