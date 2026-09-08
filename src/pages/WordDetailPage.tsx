import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { CandidateMeaningCard } from '../components/CandidateMeaningCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MeaningCard } from '../components/MeaningCard';
import { MeaningEditor } from '../components/MeaningEditor';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { meaningRepository, type MeaningInput } from '../repositories/meaningRepository';
import { wordRepository } from '../repositories/wordRepository';
import {
  createCandidateMeaning,
  deduplicateCandidates,
  filterMissingCandidates,
  removeCandidateMeaning,
  toMeaningInput,
  toggleCandidateMeaning,
  updateCandidateMeaning,
  type CandidateMeaning
} from '../services/dictionary/candidates';
import { dictionaryService } from '../services/dictionary/dictionaryService';
import { resolveCandidatesFromLocalFirst } from '../services/lexicon/localLexicon';
import type { Meaning } from '../types';
import { useAuth } from '../auth/AuthContext';

type EditorState =
  | { type: 'create' }
  | { type: 'edit'; meaning: Meaning }
  | null;

export function WordDetailPage() {
  const { user } = useAuth();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const word = useLiveQuery(
    () => wordRepository.getWithMeanings(id),
    [id, user?.id ?? null]
  );
  const [editor, setEditor] = useState<EditorState>(null);
  const [pendingDelete, setPendingDelete] = useState<Meaning | null>(null);
  const [confirmingWordDelete, setConfirmingWordDelete] = useState(false);
  const [wordForm, setWordForm] = useState({ word: '', phonetic: '' });
  const [moreCandidates, setMoreCandidates] = useState<CandidateMeaning[]>([]);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [moreNotice, setMoreNotice] = useState<string | null>(null);
  const [moreEditorOpen, setMoreEditorOpen] = useState(false);
  const [moreEditingId, setMoreEditingId] = useState<string | null>(null);
  const [moreSaving, setMoreSaving] = useState(false);

  if (!word) {
    return (
      <EmptyState
        icon="🔍"
        title="单词不存在"
        description="它可能已经被删除。"
        action={
          <Button variant="secondary" onClick={() => navigate('/words')}>
            返回词库
          </Button>
        }
      />
    );
  }

  const currentWord = word;
  const editingMoreCandidate = moreEditingId
    ? moreCandidates.find((candidate) => candidate.id === moreEditingId)
    : undefined;

  async function fetchMoreMeanings(forceRefresh = false) {
    if (moreLoading) return;
    setMoreLoading(true);
    setMoreError(null);
    setMoreNotice(null);

    try {
      const resolved = await resolveCandidatesFromLocalFirst(
        currentWord.word,
        (lookupWord) => dictionaryService.lookup(lookupWord, { forceRefresh })
      );
      if (resolved.phonetic && !currentWord.phonetic && !wordForm.phonetic) {
        setWordForm((current) => ({
          ...current,
          phonetic: resolved.phonetic ?? ''
        }));
      }

      const missing = filterMissingCandidates(currentWord.meanings, resolved.candidates);
      setMoreCandidates(deduplicateCandidates(missing));
      if (resolved.source === 'lexicon') {
        setMoreNotice('CET6 本地词库');
      } else if (resolved.fromCache) {
        setMoreNotice('使用本地缓存释义。');
      }
      if (missing.length === 0) {
        setMoreNotice(
          resolved.source === 'lexicon'
            ? 'CET6 本地词库 · 没有新的释义'
            : '没有找到新的释义，当前释义已经很完整。'
        );
      }
    } catch (lookupError) {
      setMoreError(
        lookupError instanceof Error
          ? lookupError.message
          : '暂时无法获取释义，你仍然可以手动添加。'
      );
    } finally {
      setMoreLoading(false);
    }
  }

  function openMoreCreateEditor() {
    setMoreEditingId(null);
    setMoreEditorOpen(true);
  }

  function openMoreEditEditor(candidate: CandidateMeaning) {
    setMoreEditingId(candidate.id);
    setMoreEditorOpen(true);
  }

  function handleMoreEditorSubmit(input: MeaningInput) {
    if (moreEditingId) {
      setMoreCandidates((current) =>
        deduplicateCandidates(updateCandidateMeaning(current, moreEditingId, input))
      );
    } else {
      setMoreCandidates((current) =>
        deduplicateCandidates([...current, createCandidateMeaning(input, 'manual')])
      );
    }
    setMoreEditorOpen(false);
    setMoreEditingId(null);
  }

  async function addSelectedMoreCandidates() {
    if (moreSaving) return;
    const selected = moreCandidates.filter((candidate) => candidate.selectedForStudy);
    if (selected.length === 0) return;
    setMoreSaving(true);
    try {
      for (const candidate of selected) {
        await meaningRepository.create(currentWord.id, {
          ...toMeaningInput(candidate),
          selectedForStudy: true
        });
      }
      setMoreCandidates((current) =>
        current.filter((candidate) => !selected.some((item) => item.id === candidate.id))
      );
    } finally {
      setMoreSaving(false);
    }
  }

  async function saveWordForm() {
    await wordRepository.update(currentWord.id, {
      word: wordForm.word,
      phonetic: wordForm.phonetic || undefined
    });
  }

  async function createMeaning(input: MeaningInput) {
    await meaningRepository.create(currentWord.id, input);
    setEditor(null);
  }

  async function updateMeaning(input: MeaningInput) {
    if (editor?.type !== 'edit') return;
    await meaningRepository.update(editor.meaning.id, input);
    setEditor(null);
  }

  async function toggleSelected(meaning: Meaning) {
    await meaningRepository.setSelected(meaning.id, !meaning.selectedForStudy);
  }

  async function deleteMeaning() {
    if (!pendingDelete) return;
    await meaningRepository.remove(pendingDelete.id);
    setPendingDelete(null);
  }

  async function deleteWord() {
    await wordRepository.remove(currentWord.id);
    navigate('/words', { replace: true });
  }

  return (
    <>
      <PageHeader
        title={word.word}
        subtitle={word.phonetic ? `音标：${word.phonetic}` : '编辑单词和它的多个释义。'}
        action={
          <Button variant="secondary" size="sm" onClick={() => setConfirmingWordDelete(true)}>
            删除单词
          </Button>
        }
      />

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="word-edit" className="mb-1.5 block text-sm font-medium text-slate-700">
              英文单词
            </label>
            <input
              id="word-edit"
              value={wordForm.word || word.word}
              onChange={(event) =>
                setWordForm((current) => ({ ...current, word: event.target.value }))
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="phonetic-edit" className="mb-1.5 block text-sm font-medium text-slate-700">
              音标
            </label>
            <input
              id="phonetic-edit"
              value={wordForm.phonetic || word.phonetic || ''}
              onChange={(event) =>
                setWordForm((current) => ({ ...current, phonetic: event.target.value }))
              }
              placeholder="可选"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={!wordForm.word.trim()}
            onClick={saveWordForm}
          >
            保存单词
          </Button>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">补充释义</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              只显示当前没有的候选义项，不会覆盖你已编辑的内容。
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchMoreMeanings(moreCandidates.length > 0)}
            disabled={moreLoading}
          >
            {moreLoading
              ? '正在获取…'
              : moreCandidates.length > 0
                ? '重新获取'
                : '获取更多释义'}
          </Button>
        </div>

        {moreError ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p>{moreError}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void fetchMoreMeanings(true)}
              disabled={moreLoading}
            >
              重新获取
            </Button>
          </div>
        ) : null}

        {moreNotice ? (
          <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-700">
            {moreNotice}
          </div>
        ) : null}

        {moreCandidates.length > 0 ? (
          <div className="mt-4">
            <div className="space-y-3">
              {moreCandidates.map((candidate) => (
                <CandidateMeaningCard
                  key={candidate.id}
                  candidate={candidate}
                  onToggle={(selected) =>
                    setMoreCandidates((current) =>
                      toggleCandidateMeaning(current, selected.id)
                    )
                  }
                  onEdit={openMoreEditEditor}
                  onDelete={(selected) =>
                    setMoreCandidates((current) =>
                      removeCandidateMeaning(current, selected.id)
                    )
                  }
                />
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={openMoreCreateEditor}
                className="flex-1"
              >
                ＋ 手动添加
              </Button>
              <Button
                type="button"
                onClick={() => void addSelectedMoreCandidates()}
                disabled={moreSaving || !moreCandidates.some((candidate) => candidate.selectedForStudy)}
                className="flex-1"
              >
                {moreSaving
                  ? '添加中…'
                  : `添加选中释义 · ${
                      moreCandidates.filter((candidate) => candidate.selectedForStudy)
                        .length
                    } 个`}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">中文释义模块</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              勾选的释义会进入背诵范围。
            </p>
          </div>
          <Button size="sm" onClick={() => setEditor({ type: 'create' })}>
            添加一个中文意思
          </Button>
        </div>

        {word.meanings.length === 0 ? (
          <EmptyState
            icon="＋"
            title="还没有释义"
            description="添加“一词多义”的每个意思，它们会成为独立记忆点。"
          />
        ) : (
          <div className="space-y-3">
            {word.meanings.map((meaning) => (
              <MeaningCard
                key={meaning.id}
                meaning={meaning}
                onToggleSelected={toggleSelected}
                onEdit={(selected) => setEditor({ type: 'edit', meaning: selected })}
                onDelete={setPendingDelete}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={editor !== null}
        title={editor?.type === 'edit' ? '编辑释义' : '添加一个中文意思'}
        onClose={() => setEditor(null)}
      >
        <MeaningEditor
          initialValue={
            editor?.type === 'edit'
              ? {
                  partOfSpeech: editor.meaning.partOfSpeech,
                  chineseMeaning: editor.meaning.chineseMeaning,
                  selectedForStudy: editor.meaning.selectedForStudy
                }
              : undefined
          }
          submitText={editor?.type === 'edit' ? '保存修改' : '保存'}
          onCancel={() => setEditor(null)}
          onSubmit={editor?.type === 'edit' ? updateMeaning : createMeaning}
        />
      </Modal>

      <Modal
        open={moreEditorOpen}
        title={editingMoreCandidate ? '编辑候选释义' : '添加自定义释义'}
        onClose={() => {
          setMoreEditorOpen(false);
          setMoreEditingId(null);
        }}
      >
        <MeaningEditor
          initialValue={
            editingMoreCandidate
              ? {
                  partOfSpeech: editingMoreCandidate.partOfSpeech,
                  chineseMeaning: editingMoreCandidate.chineseMeaning,
                  selectedForStudy: editingMoreCandidate.selectedForStudy
                }
              : undefined
          }
          submitText={editingMoreCandidate ? '保存修改' : '添加'}
          onCancel={() => {
            setMoreEditorOpen(false);
            setMoreEditingId(null);
          }}
          onSubmit={handleMoreEditorSubmit}
        />
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这个释义？"
        description={
          pendingDelete
            ? `“${pendingDelete.partOfSpeech} ${pendingDelete.chineseMeaning}”会被删除，但不会影响其他释义。`
            : ''
        }
        confirmText="删除"
        onCancel={() => setPendingDelete(null)}
        onConfirm={deleteMeaning}
      />

      <ConfirmDialog
        open={confirmingWordDelete}
        title="删除单词？"
        description={`将删除“${word.word}”及其所有释义和复习记录，此操作无法撤销。`}
        confirmText="删除单词"
        onCancel={() => setConfirmingWordDelete(false)}
        onConfirm={deleteWord}
      />
    </>
  );
}
