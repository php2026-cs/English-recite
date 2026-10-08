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

// Remote rows only carry the columns that have a cloud counterpart, so a remote
// object must never blank out local-only fields (questionType, confidence,
// inputValue, hintUsed, ...). A remote value only wins when it is actually present.
export function mergeAppendOnlyByIdPreservingLocal<T extends { id: string }>(
  local: T[],
  remote: T[]
): T[] {
  const merged = new Map<string, T>(local.map((item) => [item.id, item]));
  for (const item of remote) {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? overlayDefined(existing, item) : item);
  }
  return [...merged.values()];
}

function overlayDefined<T extends object>(local: T, remote: T): T {
  const next = { ...local } as Record<string, unknown>;
  for (const [key, value] of Object.entries(remote)) {
    if (value !== undefined) next[key] = value;
  }
  return next as T;
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
