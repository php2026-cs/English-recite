import type {
  Meaning,
  MeaningReviewState,
  ReviewRecord,
  Word
} from '../../types';

export interface RemoteWord {
  id: string;
  word: string;
  normalized_word: string;
  phonetic?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteMeaning {
  id: string;
  word_id: string;
  part_of_speech: string;
  chinese_meaning: string;
  selected_for_study: boolean;
  correct_count: number;
  incorrect_count: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteReviewState {
  meaning_id: string;
  state: MeaningReviewState['state'];
  due_at: string;
  last_review_at: string | null;
  stability: number | null;
  difficulty: number | null;
  reps: number;
  lapses: number;
  elapsed_days: number | null;
  scheduled_days: number | null;
  fsrs_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteReviewRecord {
  id: string;
  word_id: string;
  meaning_id: string;
  mode: 'zh-to-en' | 'en-to-zh';
  result: 'again' | 'hard' | 'good' | 'easy';
  correct: boolean;
  reviewed_at: string;
  previous_due_at: string | null;
  next_due_at: string | null;
  response_time_ms: number | null;
  created_at: string;
}

function toIso(value: number): string {
  return new Date(value).toISOString();
}

function fromIso(value: string | null | undefined): number | undefined {
  return value ? Date.parse(value) : undefined;
}

export function wordToRemote(word: Word): RemoteWord {
  return {
    id: word.id,
    word: word.word,
    normalized_word: word.word.trim().toLowerCase(),
    phonetic: word.phonetic ?? null,
    created_at: toIso(word.createdAt),
    updated_at: toIso(word.updatedAt),
    deleted_at: null
  };
}

export function wordFromRemote(remote: RemoteWord): Word {
  return {
    id: remote.id,
    word: remote.word,
    phonetic: remote.phonetic ?? undefined,
    createdAt: fromIso(remote.created_at) ?? Date.now(),
    updatedAt: fromIso(remote.updated_at) ?? Date.now()
  };
}

export function meaningToRemote(meaning: Meaning): RemoteMeaning {
  return {
    id: meaning.id,
    word_id: meaning.wordId,
    part_of_speech: meaning.partOfSpeech,
    chinese_meaning: meaning.chineseMeaning,
    selected_for_study: meaning.selectedForStudy,
    correct_count: meaning.correctCount,
    incorrect_count: meaning.incorrectCount,
    last_reviewed_at: meaning.lastReviewedAt
      ? toIso(meaning.lastReviewedAt)
      : null,
    created_at: toIso(meaning.createdAt),
    updated_at: toIso(meaning.updatedAt),
    deleted_at: null
  };
}

export function meaningFromRemote(remote: RemoteMeaning): Meaning {
  return {
    id: remote.id,
    wordId: remote.word_id,
    partOfSpeech: remote.part_of_speech,
    chineseMeaning: remote.chinese_meaning,
    selectedForStudy: remote.selected_for_study,
    correctCount: remote.correct_count,
    incorrectCount: remote.incorrect_count,
    lastReviewedAt: fromIso(remote.last_reviewed_at),
    createdAt: fromIso(remote.created_at) ?? Date.now(),
    updatedAt: fromIso(remote.updated_at) ?? Date.now()
  };
}

export function reviewStateToRemote(
  state: MeaningReviewState
): RemoteReviewState {
  return {
    meaning_id: state.meaningId,
    state: state.state,
    due_at: toIso(state.dueAt),
    last_review_at: state.lastReviewAt ? toIso(state.lastReviewAt) : null,
    stability: state.stability ?? null,
    difficulty: state.difficulty ?? null,
    reps: state.reps,
    lapses: state.lapses,
    elapsed_days: state.elapsedDays ?? null,
    scheduled_days: state.scheduledDays ?? null,
    fsrs_data: state.fsrsData ?? null,
    created_at: toIso(state.createdAt),
    updated_at: toIso(state.updatedAt)
  };
}

export function reviewStateFromRemote(
  remote: RemoteReviewState
): MeaningReviewState {
  return {
    meaningId: remote.meaning_id,
    state: remote.state,
    dueAt: fromIso(remote.due_at) ?? Date.now(),
    lastReviewAt: fromIso(remote.last_review_at),
    stability: remote.stability ?? undefined,
    difficulty: remote.difficulty ?? undefined,
    reps: remote.reps,
    lapses: remote.lapses,
    elapsedDays: remote.elapsed_days ?? undefined,
    scheduledDays: remote.scheduled_days ?? undefined,
    fsrsData: remote.fsrs_data ?? undefined,
    createdAt: fromIso(remote.created_at) ?? Date.now(),
    updatedAt: fromIso(remote.updated_at) ?? Date.now()
  };
}

export function reviewRecordToRemote(record: ReviewRecord): RemoteReviewRecord {
  return {
    id: record.id,
    word_id: record.wordId,
    meaning_id: record.meaningId ?? '',
    mode: record.mode,
    result: record.result ?? 'good',
    correct: record.correct,
    reviewed_at: toIso(record.reviewedAt),
    previous_due_at: record.previousDueAt
      ? toIso(record.previousDueAt)
      : null,
    next_due_at: record.nextDueAt ? toIso(record.nextDueAt) : null,
    response_time_ms: record.responseTimeMs ?? null,
    created_at: toIso(record.reviewedAt)
  };
}

export function reviewRecordFromRemote(
  remote: RemoteReviewRecord
): ReviewRecord {
  return {
    id: remote.id,
    wordId: remote.word_id,
    meaningId: remote.meaning_id,
    mode: remote.mode,
    correct: remote.correct,
    result: remote.result,
    previousDueAt: fromIso(remote.previous_due_at),
    nextDueAt: fromIso(remote.next_due_at),
    responseTimeMs: remote.response_time_ms ?? undefined,
    reviewedAt: fromIso(remote.reviewed_at) ?? Date.now()
  };
}
