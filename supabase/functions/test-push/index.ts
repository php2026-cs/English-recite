import { createClient } from 'npm:@supabase/supabase-js';
import webPush from 'npm:web-push';

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return json({ error: 'missing auth token' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'server misconfigured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) {
    return json({ error: 'unauthorized' }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const endpoint = body.endpoint as string | undefined;
  if (!endpoint) {
    return json({ error: 'missing endpoint' }, 400);
  }

  const { data: subscriptions, error: queryError } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', authData.user.id)
    .eq('endpoint', endpoint);

  if (queryError || !subscriptions?.length) {
    return json({ error: 'subscription not found' }, 404);
  }

  const subscription = subscriptions[0];
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: 'vapid not configured' }, 500);
  }

  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      JSON.stringify({
        title: '测试通知',
        body: '推送功能已连接成功',
        url: '/review/today'
      })
    );
    return json({ ok: true });
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
    return json({ error: 'push send failed', statusCode }, 502);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
