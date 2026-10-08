import { db } from '../db/db';
import { createId, now } from '../lib/id';
import type { Meaning } from '../types';
import { syncMetaRepository } from '../services/sync/syncMetaRepository';
import { getCurrentOwnerUserId } from '../services/ownership/ownership';
import type { StudyWeakness } from '../core/studySupport';
import { saveStudyWeaknesses } from '../services/srs/studySupportRepository';

export interface MeaningInput {
  studyWeaknesses?: StudyWeakness[];
  partOfSpeech: string;
  chineseMeaning: string;
  selectedForStudy: boolean;
}

export const meaningRepository = {
  async listByWord(wordId: string): Promise<Meaning[]> {
    return db.meanings
      .where('wordId')
      .equals(wordId)
      .filter((meaning) => (meaning.localOwnerUserId ?? null) === getCurrentOwnerUserId())
      .sortBy('createdAt');
  },

  async listSelected(): Promise<Meaning[]> {
    return db.meanings
      .filter(
        (meaning) =>
          meaning.selectedForStudy &&
          (meaning.localOwnerUserId ?? null) === getCurrentOwnerUserId()
      )
      .toArray();
  },

  async create(wordId: string, input: MeaningInput): Promise<Meaning> {
    const timestamp = now();
    const meaning: Meaning = {
      id: createId(),
      wordId,
      partOfSpeech: input.partOfSpeech.trim(),
      chineseMeaning: input.chineseMeaning.trim(),
      selectedForStudy: input.selectedForStudy,
      localOwnerUserId: getCurrentOwnerUserId(),
      correctCount: 0,
      incorrectCount: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await db.meanings.add(meaning);
    await db.words.update(wordId, { updatedAt: timestamp });
    await syncMetaRepository.markDirty(`meaning:${meaning.id}`, timestamp);
    if (input.studyWeaknesses?.length) await saveStudyWeaknesses(meaning.id, input.studyWeaknesses);
    return meaning;
  },

  async update(meaningId: string, input: MeaningInput): Promise<Meaning | undefined> {
    const existing = await db.meanings.get(meaningId);
    if (!existing) return undefined;
    await db.meanings.update(meaningId, {
      partOfSpeech: input.partOfSpeech.trim(),
      chineseMeaning: input.chineseMeaning.trim(),
      selectedForStudy: input.selectedForStudy,
      updatedAt: now()
    });
    await syncMetaRepository.markDirty(`meaning:${meaningId}`);
    if (input.studyWeaknesses !== undefined) await saveStudyWeaknesses(meaningId, input.studyWeaknesses);
    return db.meanings.get(meaningId);
  },

  async setSelected(meaningId: string, selectedForStudy: boolean): Promise<void> {
    const existing = await db.meanings.get(meaningId);
    if (!existing) return;
    await db.meanings.update(meaningId, {
      selectedForStudy,
      updatedAt: now()
    });
    await syncMetaRepository.markDirty(`meaning:${meaningId}`);
  },

  async remove(meaningId: string): Promise<void> {
    const existing = await db.meanings.get(meaningId);
    if (!existing) return;
    await db.transaction('rw', db.meanings, db.reviewRecords, db.words, db.syncMeta, async () => {
      const records = await db.reviewRecords.where('meaningId').equals(meaningId).toArray();
      await db.reviewRecords.where('meaningId').equals(meaningId).delete();
      await db.meanings.delete(meaningId);
      await db.words.update(existing.wordId, { updatedAt: now() });
      for (const record of records) {
        await syncMetaRepository.markDeleted(`review:${record.id}`);
      }
      await syncMetaRepository.markDeleted(`meaning:${meaningId}`);
    });
  }
};
