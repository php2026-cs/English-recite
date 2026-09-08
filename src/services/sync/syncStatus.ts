export type CloudSyncStatus =
  | 'not-configured'
  | 'not-authenticated'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

export interface SyncStatusState {
  status: CloudSyncStatus;
  lastSyncAt?: number;
  message: string;
}

export function friendlySyncStatus(state: SyncStatusState): string {
  switch (state.status) {
    case 'not-configured':
      return '云同步未配置';
    case 'not-authenticated':
      return '未登录';
    case 'syncing':
      return '正在同步…';
    case 'synced':
      return '已同步';
    case 'offline':
      return '离线';
    case 'error':
      return '同步失败';
    default:
      return '待同步';
  }
}
