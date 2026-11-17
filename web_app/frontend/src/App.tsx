import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { PredictPage } from './pages/PredictPage';
import { TestResultsPage } from './pages/TestResultsPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { HistoryPage } from './pages/HistoryPage';
import { PredictionReport } from './components/PredictionReport';
import type { HistoryEntry } from './reporting';
import { ShieldCheck, Cpu } from 'lucide-react';
import './app-theme.css';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'predict' | 'test' | 'history' | 'method'>('home');
  const [sample, setSample] = useState<'normal' | 'failure'>();
  const [testSection, setTestSection] = useState<'validation' | 'missed'>();
  const [report, setReport] = useState<HistoryEntry>();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('ai4i-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // Some browsers disable storage for this page.
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d151d' : '#f5f8fa');
    try {
      localStorage.setItem('ai4i-theme', theme);
    } catch {
      // The selected theme still applies to the current page.
    }
  }, [theme]);
  const historyKey = 'ai4i-prediction-history-v1';
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const entries = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
      return Array.isArray(entries) ? entries.filter(entry =>
        entry && typeof entry.id === 'string' && Number.isFinite(entry.time)
        && (entry.mode === 'manual' || entry.mode === 'csv')
        && Number.isFinite(entry.total) && Number.isFinite(entry.failures),
      ).slice(0, 50) : [];
    } catch {
      return [];
    }
  });
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try {
      localStorage.setItem(historyKey, JSON.stringify(history));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [history]);

  const record = (summary: Omit<HistoryEntry, 'id' | 'time'>) => {
    const time = Date.now();
    const id = crypto.randomUUID?.() ?? `${time}-${Math.random().toString(36).slice(2)}`;
    const entry = { ...summary, time, id };
    setHistory(previous => [entry, ...previous].slice(0, 50));
    return entry;
  };
  const navigate = (tab: typeof activeTab) => {
    setSample(undefined);
    setTestSection(undefined);
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };
  const trySample = (preset: 'normal' | 'failure') => {
    navigate('predict');
    setSample(preset);
  };
  const openTest = (section: 'validation' | 'missed') => {
    navigate('test');
    setTestSection(section);
  };

  return (
    <div className={`ai4i-app min-h-screen flex flex-col font-sans ${activeTab === 'home' ? 'ai4i-home-shell bg-white text-neutral-950' : 'watt-dashboard'}`}>
        <a href="#noi-dung-chinh" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-teal-900">
          Đến nội dung chính
        </a>
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={navigate} theme={theme} onToggleTheme={() => setTheme(current => current === 'light' ? 'dark' : 'light')} />

      {/* Main Container */}
      <main id="noi-dung-chinh" tabIndex={-1} className={activeTab === 'home' ? 'ai4i-home flex-1' : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6'}>
        {activeTab === 'home' && <HomePage onNavigate={navigate} onTrySample={() => trySample('normal')} onTryWarning={() => trySample('failure')} onOpenTest={openTest} />}
        {activeTab === 'predict' && <PredictPage sample={sample} onRecord={record} onReport={setReport} />}
        {activeTab === 'test' && <TestResultsPage section={testSection} />}
        {activeTab === 'method' && <MethodologyPage />}
        {activeTab === 'history' && <HistoryPage entries={history} saved={saved} onStart={() => trySample('normal')} onReport={setReport} />}
      </main>

      {/* Footer */}
      <footer className={`border-t border-slate-200 bg-white text-xs text-slate-500 py-6 ${activeTab === 'home' ? '' : 'mt-12'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-teal-600" />
            <span className="font-semibold text-slate-700">
              Bảo trì dự đoán AI4I 2020 · Nhóm 16
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 text-center sm:text-right">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>
              Dữ liệu và kết quả thực nghiệm được sử dụng ở chế độ chỉ đọc.
            </span>
          </div>
        </div>
      </footer>
      {report && <PredictionReport entry={report} onClose={() => setReport(undefined)} />}
    </div>
  );
};

export default App;
