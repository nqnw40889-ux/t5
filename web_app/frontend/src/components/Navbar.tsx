import React, { useState } from 'react';
import { Asterisk, Moon, Sun } from 'lucide-react';

interface NavbarProps {
  activeTab: 'home' | 'predict' | 'test' | 'history' | 'method';
  setActiveTab: (tab: 'home' | 'predict' | 'test' | 'history' | 'method') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, theme, onToggleTheme }) => {
  const [open, setOpen] = useState(false);
  const navigate = (tab: NavbarProps['activeTab']) => { setActiveTab(tab); setOpen(false); };
  return (
  <header className="cnc-header">
    <nav className="cnc-nav" aria-label="Điều hướng chính">
      <button
        type="button"
        className="cnc-nav-brand"
        aria-label="AI4I 2020, trang chủ"
        onClick={() => navigate('home')}
      >
        <Asterisk size={22} aria-hidden="true" />
      </button>
      <span className="mobile-nav-title">AI4I 2020</span>
      <button type="button" className="app-button mobile-menu-toggle" aria-controls="main-menu" aria-expanded={open} onClick={() => setOpen(!open)}>Điều hướng</button>
      <div id="main-menu" className={'cnc-nav-menu flex-wrap justify-center ' + (open ? 'nav-expanded' : '')}>
        <button type="button" aria-current={activeTab === 'home' ? 'page' : undefined} onClick={() => navigate('home')}>
          Trang chủ
        </button>
        <button type="button" aria-current={activeTab === 'predict' ? 'page' : undefined} onClick={() => navigate('predict')}>
          Dự đoán
        </button>
        <button type="button" aria-current={activeTab === 'test' ? 'page' : undefined} onClick={() => navigate('test')}>
          Kết quả kiểm thử
        </button>
        <button type="button" aria-current={activeTab === 'method' ? 'page' : undefined} onClick={() => navigate('method')}>Dữ liệu &amp; phương pháp</button>
        <button type="button" aria-current={activeTab === 'history' ? 'page' : undefined} onClick={() => navigate('history')}>
          Lịch sử
        </button>
      </div>
      <button type="button" className="cnc-nav-brand theme-toggle" aria-label="Chế độ tối" aria-pressed={theme === 'dark'} onClick={onToggleTheme}>
        {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
      </button>
    </nav>
  </header>
  );
};
