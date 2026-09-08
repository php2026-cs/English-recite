import { db } from '../db/db';
import { createId, now } from '../lib/id';
import type {
  ImportExportPayload,
  Meaning,
  MeaningReviewState,
  ReviewRecord,
  ReviewSession,
  Word
} from '../types';

export type ImportMode = 'overwrite' | 'merge';

interface NormalizedImport {
  words: Word[];
  meanings: Meaning[];
  reviewRecords: ReviewRecord[];
  reviewSessions: ReviewSession[];
  meaningReviewStates: MeaningReviewState[];
}

const REQUIRED_STRING_FIELDS: ReadonlyArray<keyof Meaning> = [
  'id',
  'wordId',
  'partOfSpeech',
  'chineseMeaning'
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasStrings(record: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof record[field] === 'string');
}

function parseWord(value: unknown): Word | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.word !== 'string') {
    return null;
  }
  return {
    id: value.id,
    word: value.word,
    phonetic: typeof value.phonetic === 'string' ? value.phonetic : undefined,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now()
  };
}

function parseMeaning(value: unknown): Meaning | null {
  if (!isRecord(value) || !hasStrings(value, REQUIRED_STRING_FIELDS)) return null;
  return {
    id: value.id as string,
    wordId: value.wordId as string,
    partOfSpeech: value.partOfSpeech as string,
    chineseMeaning: value.chineseMeaning as string,
    selectedForStudy: value.selectedForStudy !== false,
    correctCount: typeof value.correctCount === 'number' ? value.correctCount : 0,
    incorrectCount: typeof value.incorrectCount === 'number' ? value.incorrectCount : 0,
    lastReviewedAt:
      typeof value.lastReviewedAt === 'number' ? value.lastReviewedAt : undefined,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now()
  };
}

function parseReviewRecord(value: unknown): ReviewRecord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.wordId !== 'string' ||
    (value.mode !== 'zh-to-en' && value.mode !== 'en-to-zh') ||
    typeof value.correct !== 'boolean'
  ) {
    return null;
  }
  return {
    id: value.id,
    wordId: value.wordId,
    meaningId: typeof value.meaningId === 'string' ? value.meaningId : undefined,
    mode: value.mode,
    correct: value.correct,
    reviewedAt: typeof value.reviewedAt === 'number' ? value.reviewedAt : now()
  };
}

function parseReviewSession(value: unknown): ReviewSession | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.wordId !== 'string' ||
    !Array.isArray(value.recalledMeaningIds) ||
    !Array.isArray(value.revealedMeaningIds) ||
    typeof value.totalMeanings !== 'number'
  ) {
    return null;
  }
  return {
    id: value.id,
    wordId: value.wordId,
    mode: 'en-to-zh',
    totalMeanings: value.totalMeanings,
    recalledMeaningIds: value.recalledMeaningIds.filter(
      (id): id is string => typeof id === 'string'
    ),
    revealedMeaningIds: value.revealedMeaningIds.filter(
      (id): id is string => typeof id === 'string'
    ),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now()
  };
}

function parseMeaningReviewState(value: unknown): MeaningReviewState | null {
  if (!isRecord(value) || typeof value.meaningId !== 'string') return null;
  return {
    meaningId: value.meaningId,
    state: ['new', 'learning', 'review', 'relearning'].includes(String(value.state))
      ? (value.state as MeaningReviewState['state'])
      : 'new',
    dueAt: typeof value.dueAt === 'number' ? value.dueAt : now(),
    lastReviewAt: typeof value.lastReviewAt === 'number' ? value.lastReviewAt : undefined,
    stability: typeof value.stability === 'number' ? value.stability : undefined,
    difficulty: typeof value.difficulty === 'number' ? value.difficulty : undefined,
    reps: typeof value.reps === 'number' ? value.reps : 0,
    lapses: typeof value.lapses === 'number' ? value.lapses : 0,
    elapsedDays: typeof value.elapsedDays === 'number' ? value.elapsedDays : undefined,
    scheduledDays: typeof value.scheduledDays === 'number' ? value.scheduledDays : undefined,
    fsrsData: isRecord(value.fsrsData) ? value.fsrsData : undefined,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now()
  };
}

export function validateImportPayload(value: unknown): ImportExportPayload | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (!Array.isArray(value.words) || !Array.isArray(value.meanings)) return null;

  const words = value.words.map(parseWord).filter((word): word is Word => word !== null);
  const meanings = value.meanings
    .map(parseMeaning)
    .filter((meaning): meaning is Meaning => meaning !== null);
  const reviewRecords = Array.isArray(value.reviewRecords)
    ? value.reviewRecords
        .map(parseReviewRecord)
        .filter((record): record is ReviewRecord => record !== null)
    : [];
  const reviewSessions = Array.isArray(value.reviewSessions)
    ? value.reviewSessions
        .map(parseReviewSession)
        .filter((session): session is ReviewSession => session !== null)
    : [];
  const meaningReviewStates = Array.isArray(value.meaningReviewStates)
    ? value.meaningReviewStates
        .map(parseMeaningReviewState)
        .filter((state): state is MeaningReviewState => state !== null)
    : [];

  const wordIds = new Set(words.map((word) => word.id));
  const validMeanings = meanings.filter((meaning) => wordIds.has(meaning.wordId));

  return {
    schemaVersion: 1,
    exportedAt: typeof value.exportedAt === 'number' ? value.exportedAt : now(),
    words,
    meanings: validMeanings,
    reviewRecords,
    reviewSessions,
    meaningReviewStates
  };
}

function normalizeForMerge(payload: ImportExportPayload, existingWordIds: Set<string>): NormalizedImport {
  const wordIdMap = new Map<string, string>();
  const meaningIdMap = new Map<string, string>();
  const words = payload.words.map((word) => {
    const nextId = existingWordIds.has(word.id) ? createId() : word.id;
    wordIdMap.set(word.id, nextId);
    return { ...word, id: nextId };
  });

  const meanings = payload.meanings.map((meaning) => {
    const nextId = existingWordIds.has(meaning.id) ? createId() : meaning.id;
    meaningIdMap.set(meaning.id, nextId);
    return {
      ...meaning,
      id: nextId,
      wordId: wordIdMap.get(meaning.wordId) ?? meaning.wordId
    };
  });

  const reviewRecords = payload.reviewRecords.map((record) => ({
    ...record,
    id: createId(),
    wordId: wordIdMap.get(record.wordId) ?? record.wordId,
    meaningId: record.meaningId ? meaningIdMap.get(record.meaningId) ?? record.meaningId : undefined
  }));

  const reviewSessions = (payload.reviewSessions ?? []).map((session) => ({
    ...session,
    id: createId(),
    wordId: wordIdMap.get(session.wordId) ?? session.wordId,
    recalledMeaningIds: session.recalledMeaningIds.map(
      (meaningId) => meaningIdMap.get(meaningId) ?? meaningId
    ),
    revealedMeaningIds: session.revealedMeaningIds.map(
      (meaningId) => meaningIdMap.get(meaningId) ?? meaningId
    )
  }));

  const meaningReviewStates = (payload.meaningReviewStates ?? []).map((state) => ({
    ...state,
    meaningId: meaningIdMap.get(state.meaningId) ?? state.meaningId
  }));

  return { words, meanings, reviewRecords, reviewSessions, meaningReviewStates };
}

export async function importPayload(
  value: unknown,
  mode: ImportMode
): Promise<{ importedWords: number; importedMeanings: number }> {
  const payload = validateImportPayload(value);
  if (!payload) {
    throw new Error('导入文件格式不正确，请确认是从本应用导出的 JSON。');
  }

  if (mode === 'overwrite') {
    await db.transaction('rw', db.words, db.meanings, db.reviewRecords, db.reviewSessions, db.meaningReviewStates, async () => {
      await db.words.clear();
      await db.meanings.clear();
      await db.reviewRecords.clear();
      await db.reviewSessions.clear();
      await db.meaningReviewStates.clear();
      await db.words.bulkAdd(payload.words);
      await db.meanings.bulkAdd(payload.meanings);
      await db.reviewRecords.bulkAdd(payload.reviewRecords);
      await db.reviewSessions.bulkAdd(payload.reviewSessions ?? []);
      await db.meaningReviewStates.bulkAdd(payload.meaningReviewStates ?? []);
    });
    return { importedWords: payload.words.length, importedMeanings: payload.meanings.length };
  }

  const existingWordIds = new Set((await db.words.toArray()).map((word) => word.id));
  const normalized = normalizeForMerge(payload, existingWordIds);
  await db.transaction('rw', db.words, db.meanings, db.reviewRecords, db.reviewSessions, db.meaningReviewStates, async () => {
    await db.words.bulkAdd(normalized.words);
    await db.meanings.bulkAdd(normalized.meanings);
    await db.reviewRecords.bulkAdd(normalized.reviewRecords);
    await db.reviewSessions.bulkAdd(normalized.reviewSessions);
    await db.meaningReviewStates.bulkAdd(normalized.meaningReviewStates);
  });
  return { importedWords: normalized.words.length, importedMeanings: normalized.meanings.length };
}

export async function exportPayload(): Promise<ImportExportPayload> {
  const [words, meanings, reviewRecords, reviewSessions, meaningReviewStates] = await Promise.all([
    db.words.toArray(),
    db.meanings.toArray(),
    db.reviewRecords.toArray(),
    db.reviewSessions.toArray(),
    db.meaningReviewStates.toArray()
  ]);
  return {
    schemaVersion: 1,
    exportedAt: now(),
    words,
    meanings,
    reviewRecords,
    reviewSessions,
    meaningReviewStates
  };
}

export function downloadJson(payload: ImportExportPayload, filename = 'lightwords-backup.json'): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
