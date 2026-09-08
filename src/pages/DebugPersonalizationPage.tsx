import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../db/db';
import { meaningRepository } from '../repositories/meaningRepository';
import { performanceRepository } from '../repositories/performanceRepository';
import { wordRepository } from '../repositories/wordRepository';
import {
  createEmptyPerformanceProfile,
  selectQuestionType
} from '../services/personalization/personalizationEngine';
import { getAvailableQuestionTypes } from '../core/adaptiveReview';
import { reviewStateRepository } from '../services/srs/reviewState';

export function DebugPersonalizationPage() {
  const [notice, setNotice] = useState('');
  const meanings = useLiveQuery(() => meaningRepository.listSelected(), []);
  const words = useLiveQuery(() => wordRepository.list(), []);
  const meaning = meanings?.[0];
  const word = words?.find((item) => item.id === meaning?.wordId);
  const profile = useLiveQuery(
    () => (meaning ? performanceRepository.getProfile(meaning.id) : Promise.resolve(undefined)),
    [meaning?.id]
  );
  const reviewState = useLiveQuery(
    () => (meaning ? reviewStateRepository.get(meaning.id) : Promise.resolve(undefined)),
    [meaning?.id]
  );
  const difficulty = useLiveQuery(
    () => (meaning ? performanceRepository.getDifficulty(meaning.id) : Promise.resolve(undefined)),
    [meaning?.id]
  );
  const recentRecords = useLiveQuery(
    () => db.reviewRecords.orderBy('reviewedAt').reverse().limit(8).toArray(),
    []
  );

  async function saveTestProfile(patch: {
    recognitionScore?: number;
    recallScore?: number;
    spellingScore?: number;
  }) {
    if (!meaning) return;
    const current = profile ?? createEmptyPerformanceProfile(meaning.id);
    await performanceRepository.saveProfile({
      ...current,
      recognitionScore: patch.recognitionScore ?? current.recognitionScore,
      recallScore: patch.recallScore ?? current.recallScore,
      spellingScore: patch.spellingScore ?? current.spellingScore,
      correctCount: 10,
      incorrectCount: 2,
      updatedAt: Date.now()
    });
    setNotice('已写入测试 PerformanceProfile');
  }

  async function resetTestProfile() {
    if (!meaning) return;
    await performanceRepository.saveProfile(createEmptyPerformanceProfile(meaning.id));
    setNotice('已恢复正常 Profile');
  }

  async function clearTestData() {
    if (!meaning) return;
    await db.reviewRecords.where('meaningId').equals(meaning.id).delete();
    await db.meaningReviewStates.delete(meaning.id);
    await db.meaningDifficulties.delete(meaning.id);
    await db.performanceProfiles.delete(meaning.id);
    setNotice('已清除当前 Meaning 的测试复习数据');
  }

  if (!meaning || !word) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        请先至少加入一个 selectedForStudy Meaning。
      </div>
    );
  }

  const suggested = selectQuestionType(profile, reviewState);
  const available = getAvailableQuestionTypes({ hasContextExample: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Debug Personalization</h1>
        <p className="mt-1 text-sm text-slate-500">仅用于开发验收，不改变业务规则。</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">当前 Meaning</h2>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {JSON.stringify(
            {
              meaningId: meaning.id,
              word: word.word,
              partOfSpeech: meaning.partOfSpeech,
              chineseMeaning: meaning.chineseMeaning
            },
            null,
            2
          )}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">PerformanceProfile</h2>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {JSON.stringify(profile ?? null, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">MeaningDifficulty</h2>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {JSON.stringify(difficulty ?? null, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">QuestionSelector 决策</h2>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {JSON.stringify(
            {
              availableQuestionTypes: available,
              suggestedTypeMix: null,
              selectedQuestionType: suggested.questionType,
              selectionReason: suggested.reason
            },
            null,
            2
          )}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">最近 ReviewRecord</h2>
        <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
          {JSON.stringify(recentRecords ?? [], null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">验收测试按钮</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveTestProfile({ recognitionScore: 0.25, recallScore: 0.8 })}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700"
          >
            模拟 Recognition 弱项
          </button>
          <button
            type="button"
            onClick={() => void saveTestProfile({ recognitionScore: 0.85, recallScore: 0.25 })}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700"
          >
            模拟 Recall 弱项
          </button>
          <button
            type="button"
            onClick={() => void saveTestProfile({ spellingScore: 0.2 })}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700"
          >
            模拟 Spelling 弱项
          </button>
          <button
            type="button"
            onClick={() => void resetTestProfile()}
            className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700"
          >
            恢复正常状态
          </button>
          <button
            type="button"
            onClick={() => void clearTestData()}
            className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm text-red-600"
          >
            清除测试数据
          </button>
        </div>
        {notice ? <p className="mt-3 text-sm text-slate-500">{notice}</p> : null}
      </section>
    </div>
  );
}
