import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { settingsRepository } from '../repositories/settingsRepository';
import {
  disablePushForCurrentDevice,
  enablePushForCurrentDevice,
  getCurrentPushStatus,
  isIOSPwa,
  isPushSupported,
  sendTestNotification,
  type PushStatus
} from '../services/push/pushService';
import { useSync } from '../sync/SyncContext';

const LIMIT_OPTIONS = [10, 20, 30, 50];
const RETENTION_OPTIONS = [0.85, 0.9, 0.95];

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { statusText, syncNow } = useSync();
  const settings = useLiveQuery(() => settingsRepository.get(), []);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getCurrentPushStatus().then(setPushStatus);
  }, []);

  async function updateSettings(patch: Parameters<typeof settingsRepository.update>[0]) {
    setSaving(true);
    try {
      await settingsRepository.update(patch);
    } finally {
      setSaving(false);
    }
  }

  async function handleEnablePush() {
    if (!user) {
      setPushStatus({
        capability: 'error',
        message: '请先登录后再开启通知。'
      });
      return;
    }
    setPushStatus(await enablePushForCurrentDevice(user?.id));
  }

  async function handleDisablePush() {
    setPushStatus(await disablePushForCurrentDevice(user?.id));
  }

  async function handleTestPush() {
    setPushStatus(await sendTestNotification());
  }

  const limit = settings?.dailyNewMeaningLimit ?? 20;
  const retention = settings?.desiredRetention ?? 0.9;

  return (
    <>
      <PageHeader title="设置" subtitle="学习计划与复习提醒。" />

      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">账号与同步</h2>
        {user ? (
          <div className="mt-3">
            <div className="text-sm font-medium text-slate-900">当前账号</div>
            <div className="mt-1 text-sm text-slate-500">{user.email}</div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/settings/account" className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                账号设置
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                退出登录
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="text-sm text-slate-500">未登录</span>
            <Link to="/login" className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              登录 / 注册
            </Link>
          </div>
        )}
      </section>

      <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm text-slate-600">云同步：{statusText}</div>
        <div className="flex gap-2">
          <Link to="/settings/account" className="text-sm text-brand-700 hover:text-brand-600">
            账号
          </Link>
          <button type="button" onClick={() => void syncNow()} className="text-sm text-brand-700 hover:text-brand-600">
            立即同步
          </button>
        </div>
      </div>

      <section className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">每日学习</h2>
          <p className="mt-1 text-sm text-slate-500">每天最多学习多少个新义项。</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {LIMIT_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => void updateSettings({ dailyNewMeaningLimit: value })}
                className={`h-10 rounded-xl px-4 text-sm font-medium ${
                  limit === value
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {value}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const custom = window.prompt('请输入每天新学义项数（1-500）');
                const parsed = Number(custom);
                if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 500) {
                  void updateSettings({ dailyNewMeaningLimit: Math.round(parsed) });
                }
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
            >
              自定义
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">目标记忆率</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {RETENTION_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => void updateSettings({ desiredRetention: value })}
                className={`rounded-xl px-3 py-3 text-sm ${
                  retention === value
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                <div className="font-semibold">{Math.round(value * 100)}%</div>
                <div className="mt-0.5 text-xs opacity-75">
                  {value === 0.85 ? '复习较少' : value === 0.9 ? '推荐' : '复习更多'}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">学习提醒</h2>
          {!isPushSupported() ? (
            <p className="mt-3 text-sm text-slate-500">当前浏览器不支持后台推送提醒。</p>
          ) : null}
          {isIOSPwa() ? (
            <p className="mt-3 text-sm text-amber-700">
              要接收复习提醒，请先将应用添加到主屏幕。
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handleEnablePush} disabled={saving}>
              开启通知
            </Button>
            <Button variant="secondary" onClick={handleTestPush} disabled={saving}>
              发送测试通知
            </Button>
            <Button variant="secondary" onClick={handleDisablePush} disabled={saving}>
              关闭通知
            </Button>
          </div>
          {pushStatus ? (
            <p className="mt-3 text-sm text-slate-500">{pushStatus.message}</p>
          ) : null}

          <label className="mt-5 flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings?.dailyReminderEnabled ?? false}
              onChange={(event) =>
                void updateSettings({ dailyReminderEnabled: event.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">开启每日复习提醒</span>
          </label>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                提醒时间
              </label>
              <input
                type="time"
                value={settings?.reminderTime ?? '20:00'}
                onChange={(event) => void updateSettings({ reminderTime: event.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">时区</label>
              <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                {settings?.timezone ?? '自动检测'}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings?.reminderOnlyWhenDue ?? true}
                onChange={(event) =>
                  void updateSettings({ reminderOnlyWhenDue: event.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">仅有待复习内容时提醒</span>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings?.showDueCount ?? true}
                onChange={(event) =>
                  void updateSettings({ showDueCount: event.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700">通知中显示待复习数量</span>
            </label>
          </div>
        </div>
      </section>
    </>
  );
}
