// Supabase Edge Function：每 15 分钟由 pg_cron 触发一次。
// 这里只做服务端骨架；真实 VAPID 私钥和 Web Push 发送需部署到 Supabase。

interface PushSubscriptionRow {
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const webPush = null as unknown as {
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<unknown>;
};

Deno.serve(async () => {
  const now = new Date();
  const dueUsers = await fetchDueUsers(now);
  for (const userId of dueUsers) {
    const dueCount = await countDueMeanings(userId, now);
    if (dueCount <= 0) continue;
    await ensureNotAlreadySent(userId, now);
    const subscriptions = await getSubscriptions(userId);
    for (const subscription of subscriptions) {
      await sendPush(subscription, dueCount);
    }
  }
  return new Response(JSON.stringify({ ok: true, users: dueUsers.length }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

async function fetchDueUsers(now: Date): Promise<string[]> {
  return ['demo-user'];
}

async function countDueMeanings(_userId: string, _now: Date): Promise<number> {
  return 0;
}

async function ensureNotAlreadySent(_userId: string, _now: Date): Promise<void> {}

async function getSubscriptions(_userId: string): Promise<PushSubscriptionRow[]> {
  return [];
}

async function sendPush(
  subscription: PushSubscriptionRow,
  dueCount: number
): Promise<void> {
  if (!webPush) return;
  await webPush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth }
    },
    JSON.stringify({
      title: '该复习单词了',
      body: `今天有 ${dueCount} 个释义等你复习。`,
      url: '/review/today'
    })
  );
}
