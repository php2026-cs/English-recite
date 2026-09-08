import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { PageHeader } from '../components/PageHeader';

export function AccountPage() {
  const { configured, user, signOut } = useAuth();

  return (
    <>
      <PageHeader title="账号" subtitle="多设备云同步与账号设置。" />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {!configured ? (
          <p className="text-sm text-slate-500">云同步未配置。</p>
        ) : user ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-base font-semibold text-slate-900">当前账号</div>
              <div className="mt-1 text-sm text-slate-500">{user.email}</div>
            </div>
            <Button variant="secondary" onClick={() => void signOut()}>
              退出登录
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">尚未登录。</p>
            <Link to="/login" className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              登录 / 注册
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
