import React from 'react';
import { Asterisk, Moon, Sun } from 'lucide-react';

interface NavbarProps {
  activeTab: 'home' | 'predict' | 'test' | 'history';
  setActiveTab: (tab: 'home' | 'predict' | 'test' | 'history') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, theme, onToggleTheme }) => (
  <header className="cnc-header">
    <nav className="cnc-nav" aria-label="Điều hướng chính">
      <button
        type="button"
        className="cnc-nav-brand"
        aria-label="AI4I 2020, trang chủ"
        onClick={() => setActiveTab('home')}
      >
        <Asterisk size={22} aria-hidden="true" />
      </button>
      <div className="cnc-nav-menu flex-wrap justify-center">
        <button type="button" aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => setActiveTab('home')}>
          Trang chủ
        </button>
        <button type="button" aria-current={activeTab === 'predict' ? 'page' : undefined} onClick={() => setActiveTab('predict')}>
          Dự đoán
        </button>
        <button type="button" aria-current={activeTab === 'test' ? 'page' : undefined} onClick={() => setActiveTab('test')}>
          Kết quả kiểm thử
        </button>
        <button type="button" aria-current={activeTab === 'history' ? 'page' : undefined} onClick={() => setActiveTab('history')}>
          Lịch sử
        </button>
      </div>
      <button type="button" className="cnc-nav-brand theme-toggle" aria-label="Chế độ tối" aria-pressed={theme === 'dark'} onClick={onToggleTheme}>
        {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
      </button>
    </nav>
  </header>
);
