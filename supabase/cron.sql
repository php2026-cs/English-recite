-- 在 Supabase SQL Editor 中执行，创建全局 Cron。
-- 说明：请勿将 service_role key 硬编码；优先通过 Supabase Vault 存储。

select cron.schedule(
  'send-review-reminders-every-15-minutes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/send-review-reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || vault.get('SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'
  );
  $$
);
