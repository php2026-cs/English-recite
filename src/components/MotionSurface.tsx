import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function MotionSurface({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const animation = ref.current?.animate([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
    return () => animation?.cancel();
  }, [pathname]);
  return <div ref={ref} className="page-motion">{children}</div>;
}

export function animateControl(event: MouseEvent<HTMLElement>) {
  if (reducedMotion() || !(event.target instanceof Element)) return;
  const control = event.target.closest<HTMLElement>('button, a, [role="button"], input[type="checkbox"], input[type="radio"], summary');
  if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
  // Individual scale preserves transforms used by menus and positioned controls.
  control.getAnimations().filter(animation => animation.id === 'control-feedback').forEach(animation => animation.cancel());
  const animation = control.animate([{ scale: '0.975' }, { scale: '1' }], {
    duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)'
  });
  animation.id = 'control-feedback';
}
