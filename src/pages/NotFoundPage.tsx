import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-5xl">404</div>
      <p className="mt-3 text-slate-600">这个页面不存在。</p>
      <Link
        to="/"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
      >
        返回首页
      </Link>
    </div>
  );
}
