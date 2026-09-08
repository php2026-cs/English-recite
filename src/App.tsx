import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { EnZhReviewPage } from './pages/EnZhReviewPage';
import { HomePage } from './pages/HomePage';
import { AccountPage } from './pages/AccountPage';
import { AdaptiveReviewPage } from './pages/AdaptiveReviewPage';
import { DebugPersonalizationPage } from './pages/DebugPersonalizationPage';
import { LexiconCET6Page } from './pages/LexiconCET6Page';
import { LexiconEntryDetailPage } from './pages/LexiconEntryDetailPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ReviewModePage } from './pages/ReviewModePage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { TodayReviewPage } from './pages/TodayReviewPage';
import { WordDetailPage } from './pages/WordDetailPage';
import { WordListPage } from './pages/WordListPage';
import { WordNewPage } from './pages/WordNewPage';
import { ZhEnReviewPage } from './pages/ZhEnReviewPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/words" element={<WordListPage />} />
        <Route path="/words/new" element={<WordNewPage />} />
        <Route path="/words/:id" element={<WordDetailPage />} />
        <Route path="/review" element={<ReviewModePage />} />
        <Route path="/review/today" element={<TodayReviewPage />} />
        <Route path="/review/adaptive" element={<AdaptiveReviewPage />} />
        <Route path="/debug/personalization" element={<DebugPersonalizationPage />} />
        <Route path="/review/zh-en" element={<ZhEnReviewPage />} />
        <Route path="/review/en-zh" element={<EnZhReviewPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/account" element={<AccountPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/lexicon/cet6" element={<LexiconCET6Page />} />
        <Route path="/lexicon/cet6/:word" element={<LexiconEntryDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
