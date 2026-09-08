import { db } from '../../db/db';

export async function claimAnonymousData(userId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.words, db.meanings, db.meaningReviewStates, db.reviewRecords, db.reviewSessions, db.syncMeta],
    async () => {
      const words = await db.words
        .filter((word) => (word.localOwnerUserId ?? null) === null)
        .toArray();
      for (const word of words) {
        await db.words.update(word.id, { localOwnerUserId: userId });
      }

      const meanings = await db.meanings
        .filter((meaning) => (meaning.localOwnerUserId ?? null) === null)
        .toArray();
      for (const meaning of meanings) {
        await db.meanings.update(meaning.id, { localOwnerUserId: userId });
      }

      const states = await db.meaningReviewStates
        .filter((state) => (state.localOwnerUserId ?? null) === null)
        .toArray();
      for (const state of states) {
        await db.meaningReviewStates.update(state.meaningId, { localOwnerUserId: userId });
      }

      const records = await db.reviewRecords
        .filter((record) => (record.localOwnerUserId ?? null) === null)
        .toArray();
      for (const record of records) {
        await db.reviewRecords.update(record.id, { localOwnerUserId: userId });
      }

      const sessions = await db.reviewSessions
        .filter((session) => (session.localOwnerUserId ?? null) === null)
        .toArray();
      for (const session of sessions) {
        await db.reviewSessions.update(session.id, { localOwnerUserId: userId });
      }

      const metas = await db.syncMeta
        .filter((meta) => (meta.localOwnerUserId ?? null) === null)
        .toArray();
      for (const meta of metas) {
        await db.syncMeta.update(meta.entityKey, { localOwnerUserId: userId });
      }
    }
  );
}
