import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../services/supabase/supabaseClient';
import { SyncEngine } from '../services/sync/syncEngine';
import { friendlySyncStatus, type SyncStatusState } from '../services/sync/syncStatus';
import { getCurrentOwnerUserId } from '../services/ownership/ownership';

interface SyncContextValue {
  status: SyncStatusState;
  statusText: string;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SyncStatusState>({
    status: 'idle',
    message: ''
  });

  useEffect(() => {
    if (!supabase) {
      setStatus({ status: 'not-configured', message: '云同步未配置' });
      return;
    }
    if (!user) {
      setStatus({ status: 'not-authenticated', message: '未登录' });
      return;
    }
  }, [user, authLoading]);

  const syncNow = async () => {
    if (!supabase || !user) return;
    const syncUserId = user.id;
    setStatus({ status: 'syncing', message: '正在同步…' });
    try {
      await new SyncEngine(supabase).sync(syncUserId);
      if (getCurrentOwnerUserId() !== syncUserId) return;
      setStatus({
        status: 'synced',
        lastSyncAt: Date.now(),
        message: '已同步'
      });
    } catch (error) {
      console.error('[sync] failed', error);
      setStatus({ status: 'error', message: '同步失败，本地数据已保存' });
    }
  };

  useEffect(() => {
    if (!supabase || !user || authLoading) return;
    void syncNow();

    function handleOnline() {
      void syncNow();
    }
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, authLoading]);

  const value = useMemo(
    () => ({
      status,
      statusText: friendlySyncStatus(status),
      syncNow
    }),
    [status, user]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within SyncProvider');
  return context;
}
