import { db } from '../db/db';
import type { MeaningDifficulty, MeaningPerformanceProfile } from '../types';

export const performanceRepository = {
  async getProfile(meaningId: string): Promise<MeaningPerformanceProfile | undefined> {
    return db.performanceProfiles.get(meaningId);
  },

  async saveProfile(profile: MeaningPerformanceProfile): Promise<void> {
    await db.performanceProfiles.put(profile);
  },

  async getDifficulty(meaningId: string): Promise<MeaningDifficulty | undefined> {
    return db.meaningDifficulties.get(meaningId);
  },

  async saveDifficulty(difficulty: MeaningDifficulty): Promise<void> {
    await db.meaningDifficulties.put(difficulty);
  }
};
