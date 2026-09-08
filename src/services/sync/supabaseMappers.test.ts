import { describe, expect, it } from 'vitest';
import {
  meaningFromRemote,
  reviewRecordFromRemote,
  reviewStateFromRemote,
  wordFromRemote
} from './supabaseMappers';

describe('Supabase remote to local mappers', () => {
  it('selected_for_study 映射为 selectedForStudy', () => {
    const meaning = meaningFromRemote({
      id: 'm1',
      word_id: 'w1',
      part_of_speech: 'v.',
      chinese_meaning: '收费',
      selected_for_study: true,
      correct_count: 1,
      incorrect_count: 0,
      last_reviewed_at: null,
      created_at: '2026-08-31T12:00:00.000Z',
      updated_at: '2026-08-31T12:00:00.000Z',
      deleted_at: null
    });
    expect(meaning.selectedForStudy).toBe(true);
  });

  it('normalized_word 映射为 normalizedWord 语义来源', () => {
    const word = wordFromRemote({
      id: 'w1',
      word: 'Charge',
      normalized_word: 'charge',
      phonetic: null,
      created_at: '2026-08-31T12:00:00.000Z',
      updated_at: '2026-08-31T12:00:00.000Z',
      deleted_at: null
    });
    expect(word.word).toBe('Charge');
    expect(word.updatedAt).toBe(Date.parse('2026-08-31T12:00:00.000Z'));
  });

  it('part_of_speech 和 chinese_meaning 正确映射', () => {
    const meaning = meaningFromRemote({
      id: 'm1',
      word_id: 'w1',
      part_of_speech: 'n.',
      chinese_meaning: '费用',
      selected_for_study: true,
      correct_count: 0,
      incorrect_count: 0,
      last_reviewed_at: null,
      created_at: '2026-08-31T12:00:00.000Z',
      updated_at: '2026-08-31T12:00:00.000Z',
      deleted_at: null
    });
    expect(meaning.partOfSpeech).toBe('n.');
    expect(meaning.chineseMeaning).toBe('费用');
  });

  it('due_at 和 last_review_at 正确映射为 number', () => {
    const state = reviewStateFromRemote({
      meaning_id: 'm1',
      state: 'review',
      due_at: '2026-09-01T00:00:00.000Z',
      last_review_at: '2026-08-31T12:00:00.000Z',
      stability: 1.5,
      difficulty: 4,
      reps: 1,
      lapses: 0,
      elapsed_days: 0,
      scheduled_days: 1,
      fsrs_data: null,
      created_at: '2026-08-31T12:00:00.000Z',
      updated_at: '2026-08-31T12:00:00.000Z'
    });
    expect(state.dueAt).toBe(Date.parse('2026-09-01T00:00:00.000Z'));
    expect(state.lastReviewAt).toBe(Date.parse('2026-08-31T12:00:00.000Z'));
  });

  it('response_time_ms 映射为 responseTimeMs', () => {
    const record = reviewRecordFromRemote({
      id: 'r1',
      word_id: 'w1',
      meaning_id: 'm1',
      mode: 'zh-to-en',
      result: 'good',
      correct: true,
      reviewed_at: '2026-08-31T12:00:00.000Z',
      previous_due_at: null,
      next_due_at: '2026-09-01T00:00:00.000Z',
      response_time_ms: 1234,
      created_at: '2026-08-31T12:00:00.000Z'
    });
    expect(record.responseTimeMs).toBe(1234);
    expect(record.nextDueAt).toBe(Date.parse('2026-09-01T00:00:00.000Z'));
  });
});
