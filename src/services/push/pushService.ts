import { appUrl } from '../../lib/appUrl';

export type PushCapability =
  | 'unsupported'
  | 'unconfigured'
  | 'denied'
  | 'granted'
  | 'subscribed'
  | 'error';

export interface PushStatus {
  capability: PushCapability;
  message: string;
  subscription?: PushSubscriptionJSON;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 5000);
    })
  ]).catch(() => null);
}

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIOSPwa(): boolean {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && !isStandalone;
}

export async function getCurrentPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return {
      capability: 'unsupported',
      message: '当前浏览器不支持后台推送提醒。'
    };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      capability: 'unconfigured',
      message: '推送尚未配置，客户端仍可正常使用。'
    };
  }
  if (Notification.permission === 'denied') {
    return {
      capability: 'denied',
      message: '通知权限已被拒绝。'
    };
  }

  const registration = await getServiceWorkerRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    return {
      capability: 'subscribed',
      message: '当前设备已开启提醒。',
      subscription: subscription.toJSON()
    };
  }

  return {
    capability: Notification.permission === 'granted' ? 'granted' : 'unconfigured',
    message:
      Notification.permission === 'granted'
        ? '通知权限已开启，可订阅提醒。'
        : '尚未开启每日复习提醒。'
  };
}

export async function enablePushForCurrentDevice(userId?: string): Promise<PushStatus> {
  if (!isPushSupported()) {
    return { capability: 'unsupported', message: '当前浏览器不支持后台推送提醒。' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { capability: 'unconfigured', message: '推送尚未配置，客户端仍可正常使用。' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { capability: 'denied', message: '通知权限未开启。' };
    }

    const registration = await getServiceWorkerRegistration();
    if (!registration) {
      return { capability: 'error', message: 'Service Worker 尚未准备好。' };
    }

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await uploadSubscription(existing, userId);
      return {
        capability: 'subscribed',
        message: '当前设备已开启提醒。',
        subscription: existing.toJSON()
      };
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY
      ) as unknown as BufferSource
    });
    await uploadSubscription(subscription, userId);
    return {
      capability: 'subscribed',
      message: '当前设备已开启提醒。',
      subscription: subscription.toJSON()
    };
  } catch (error) {
    console.error('[push] enable failed', error);
    return { capability: 'error', message: '开启通知失败，请重试。' };
  }
}

export async function sendTestNotification(): Promise<PushStatus> {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { capability: 'error', message: 'Service Worker 尚未准备好。' };
  }
  const subscription = await registration.pushManager.getSubscription();
  if (subscription && supabase) {
    try {
      const { error } = await supabase.functions.invoke('test-push', {
        body: {
          endpoint: subscription.endpoint
        }
      });
      if (!error) {
        return { capability: 'subscribed', message: '测试通知已发送。' };
      }
    } catch (testError) {
      console.error('[push] test-push failed', testError);
    }
  }
  if (!('showNotification' in registration)) {
    return { capability: 'unsupported', message: '当前环境不支持显示测试通知。' };
  }
  await registration.showNotification('该复习单词了', {
    body: '这是一条测试通知，表示复习提醒已就绪。',
    tag: 'lightwords-test',
    data: { url: appUrl() }
  });
  return { capability: 'subscribed', message: '测试通知已发送。' };
}

async function uploadSubscription(
  subscription: PushSubscription,
  userId?: string
): Promise<void> {
  if (!userId || !supabase) return;
  const json = subscription.toJSON();
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    device_name: getDeviceName()
  }, { onConflict: 'endpoint' });
}

export async function disablePushForCurrentDevice(userId?: string): Promise<PushStatus> {
  const registration = await getServiceWorkerRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    return { capability: 'denied', message: '当前设备没有开启通知。' };
  }
  await subscription.unsubscribe();
  if (userId && supabase) {
    const json = subscription.toJSON();
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', json.endpoint)
      .eq('user_id', userId);
  }
  return { capability: 'denied', message: '已关闭当前设备的通知。' };
}

export function getDeviceName(): string {
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'iPhone';
  if (/android/i.test(navigator.userAgent)) return 'Android';
  if (/edg\//i.test(navigator.userAgent)) return 'Edge Desktop';
  return 'Chrome Desktop';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
import { supabase } from '../supabase/supabaseClient';
