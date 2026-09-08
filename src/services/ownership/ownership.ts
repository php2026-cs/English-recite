let currentOwnerUserId: string | null = null;

export function getCurrentOwnerUserId(): string | null {
  return currentOwnerUserId;
}

export function setCurrentOwnerUserId(userId: string | null): void {
  currentOwnerUserId = userId;
}

export function isOwnedByCurrentUser(
  localOwnerUserId: string | null | undefined
): boolean {
  return (localOwnerUserId ?? null) === currentOwnerUserId;
}

export function currentOwnerFilter<T extends { localOwnerUserId?: string | null }>(
  items: T[]
): T[] {
  return items.filter((item) => isOwnedByCurrentUser(item.localOwnerUserId));
}
