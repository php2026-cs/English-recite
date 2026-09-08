import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

function readMigration(file: string): string {
  return readFileSync(join(migrationsDir, file), 'utf8');
}

describe('Supabase schema', () => {
  it('RLS SQL 包含 authenticated 限制', () => {
    expect(readMigration('003_rls.sql')).toContain('to authenticated');
  });

  it('INSERT policy 使用 with check', () => {
    expect(readMigration('003_rls.sql')).toContain('with check');
  });

  it('UPDATE policy 同时有 using + with check', () => {
    const rls = readMigration('003_rls.sql');
    expect(rls).toContain('using');
    expect(rls).toContain('with check');
  });

  it('用户不能写别人的 user_id', () => {
    const rls = readMigration('003_rls.sql');
    expect(rls).toContain("auth.uid() = user_id");
    expect(rls).toContain("auth.uid() = id");
  });

  it('push subscription endpoint 唯一', () => {
    expect(readMigration('002_push.sql')).toContain('endpoint text not null unique');
  });

  it('notification_logs 防止重复通知', () => {
    expect(readMigration('002_push.sql')).toContain(
      'unique (user_id, notification_date, notification_type)'
    );
  });
});
