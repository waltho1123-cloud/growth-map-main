import React, { createContext, useContext, useState, useCallback } from 'react';

// 輕量 SPA 視圖導航（不持久化，與資料 context 分離）。
// view: 'dashboard'（長清單） | 'tools'（工具庫） | 'tool-analysis'（工具分析頁） | 'check'（綜合檢查）
const NavContext = createContext();

export function NavProvider({ children }) {
  const [view, setView] = useState('dashboard');
  const [activeToolCode, setActiveToolCode] = useState(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const toggleCoach = useCallback(() => setCoachOpen((v) => !v), []);

  const goDashboard = useCallback(() => {
    setActiveToolCode(null);
    setView('dashboard');
  }, []);

  const goToolLibrary = useCallback(() => {
    setActiveToolCode(null);
    setView('tools');
  }, []);

  const goCheck = useCallback(() => {
    setActiveToolCode(null);
    setView('check');
  }, []);

  const goHandoff = useCallback(() => {
    setActiveToolCode(null);
    setView('handoff');
  }, []);

  const openToolAnalysis = useCallback((code) => {
    setActiveToolCode(code);
    setView('tool-analysis');
  }, []);

  return (
    <NavContext.Provider
      value={{ view, activeToolCode, coachOpen, toggleCoach, setView, goDashboard, goToolLibrary, goCheck, goHandoff, openToolAnalysis }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
