import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';
import { toFriendlyAuthError } from '../auth/authErrors';

export function LoginPage() {
  const { configured, signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (user) navigate('/settings/account');
  }, [user, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!configured) {
      setMessage('云同步未配置，本地功能仍可正常使用。');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = mode === 'login' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
      if (result.error) {
        setMessage(toFriendlyAuthError(result.error));
      } else if ('confirmationRequired' in result && result.confirmationRequired) {
        setMessage('注册申请已提交，请查看邮箱中的验证邮件，完成验证后再登录。');
      } else {
        navigate('/settings/account');
      }
    } catch (error) {
      setMessage(toFriendlyAuthError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="登录 / 注册" subtitle="登录后开启多设备同步。" />
      {!configured ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          云同步未配置。你仍然可以离线使用词库、复习和 PWA。
        </div>
      ) : null}
      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            密码
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={mode === 'signup' ? 6 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={saving || !configured} className="flex-1">
            {saving ? '正在连接…' : mode === 'login' ? '登录' : '注册'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={saving || !configured}
            onClick={() => { setMessage(null); setMode((current) => (current === 'login' ? 'signup' : 'login')); }}
            className="flex-1"
          >
            {mode === 'login' ? '去注册' : '去登录'}
          </Button>
        </div>
        {message ? <p role="status" className="text-sm leading-6 text-slate-700">{message}</p> : null}
      </form>
    </>
  );
}
