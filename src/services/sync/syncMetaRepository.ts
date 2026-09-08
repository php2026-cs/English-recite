import { db } from '../../db/db';
import type { SyncMeta } from '../../db/db';
import { getCurrentOwnerUserId } from '../ownership/ownership';

export const syncMetaRepository = {
  async markDirty(entityKey: string, updatedAt = Date.now()): Promise<void> {
    const existing = await db.syncMeta.get(entityKey);
    await db.syncMeta.put({
      entityKey,
      syncStatus: 'dirty',
      deletedAt: existing?.deletedAt,
      localOwnerUserId: getCurrentOwnerUserId(),
      updatedAt: Math.max(existing?.updatedAt ?? 0, updatedAt)
    });
  },

  async markSynced(entityKey: string, updatedAt = Date.now()): Promise<void> {
    const existing = await db.syncMeta.get(entityKey);
    await db.syncMeta.put({
      entityKey,
      syncStatus: 'synced',
      deletedAt: existing?.deletedAt,
      localOwnerUserId: getCurrentOwnerUserId(),
      updatedAt: Math.max(existing?.updatedAt ?? 0, updatedAt)
    });
  },

  async markDeleted(entityKey: string, deletedAt = Date.now()): Promise<void> {
    await db.syncMeta.put({
      entityKey,
      syncStatus: 'dirty',
      deletedAt,
      localOwnerUserId: getCurrentOwnerUserId(),
      updatedAt: deletedAt
    });
  },

  async listDirty(): Promise<SyncMeta[]> {
    return db.syncMeta
      .where('syncStatus')
      .equals('dirty')
      .filter((meta) => (meta.localOwnerUserId ?? null) === getCurrentOwnerUserId())
      .toArray();
  }
};
