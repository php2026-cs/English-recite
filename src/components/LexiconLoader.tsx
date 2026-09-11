import { Component, Suspense, type ReactNode } from 'react';
import { Button } from './Button';

export class LexiconLoader extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <p className="mb-4 text-slate-600">词典暂时无法打开，请检查网络后重试。</p>
      <Button onClick={() => window.location.reload()}>重新加载</Button>
    </div>;
    return <Suspense fallback={<p role="status" className="py-12 text-center text-slate-500">正在打开六级词典…</p>}>
      {this.props.children}
    </Suspense>;
  }
}
