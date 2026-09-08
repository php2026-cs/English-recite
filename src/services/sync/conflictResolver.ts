import type { MeaningReviewState } from '../../types';

export interface SyncEntity {
  id: string;
  updatedAt: number;
}

export function resolveLastWriteWins<T extends SyncEntity>(
  local: T,
  remote: T
): T {
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

export function mergeAppendOnlyById<T extends { id: string }>(
  local: T[],
  remote: T[]
): T[] {
  const merged = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    merged.set(item.id, item);
  }
  return [...merged.values()];
}

export function resolveMeaningReviewState(
  local: MeaningReviewState | undefined,
  remote: MeaningReviewState | undefined
): MeaningReviewState | undefined {
  if (!local) return remote;
  if (!remote) return local;

  const localPriority = local.lastReviewAt ?? 0;
  const remotePriority = remote.lastReviewAt ?? 0;
  if (localPriority !== remotePriority) {
    return localPriority > remotePriority ? local : remote;
  }
  return local.updatedAt >= remote.updatedAt ? local : remote;
}
