// Notification payloads use application routes; resolve them for the active host.
export function appUrl(route = '/review/today'): string {
  const base = import.meta.env.BASE_URL;
  if (route.startsWith(base) && base !== '/') return route;
  if (!route.startsWith('/') || route.startsWith('//')) return route;
  return `${base}${import.meta.env.VITE_ROUTER_MODE === 'hash' ? '#' : ''}${route.replace(/^\//, import.meta.env.VITE_ROUTER_MODE === 'hash' ? '/' : '')}`;
}
