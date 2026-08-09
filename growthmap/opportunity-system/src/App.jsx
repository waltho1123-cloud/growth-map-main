import React, { useEffect, Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { OpportunityProvider, useOpportunity } from './contexts/OpportunityContext';
import { NavProvider, useNav } from './contexts/NavContext';
import Dashboard from './components/Dashboard/Dashboard';
import ToolLibrary from './components/Tools/ToolLibrary';
import ToolAnalysis from './components/Tools/ToolAnalysis';
import CheckPanel from './components/Check/CheckPanel';
import HandoffPanel from './components/Handoff/HandoffPanel';
import { AuthWidget } from './components/AuthWidget';
import CoachDrawer from './components/ai/CoachDrawer';
import { isAiEnabled } from './lib/ai/aiClient';

const OpportunityEditor = lazy(() => import('./components/Editor/OpportunityEditor'));

function AppContent() {
  const { state } = useOpportunity();
  const { view, activeToolCode, toggleCoach } = useNav();

  return (
    <>
      {view === 'dashboard' && <Dashboard />}
      {view === 'tools' && <ToolLibrary />}
      {view === 'tool-analysis' && <ToolAnalysis key={activeToolCode} />}
      {view === 'check' && <CheckPanel />}
      {view === 'handoff' && <HandoffPanel />}
      {state.editingId && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
            <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-gray-600 text-sm">載入編輯器…</div>
          </div>
        }>
          <OpportunityEditor />
        </Suspense>
      )}
      {isAiEnabled() && (
        <button
          onClick={toggleCoach}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 flex items-center justify-center transition-colors"
          aria-label="AI 教練"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.2-3.6A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}
      <CoachDrawer />
    </>
  );
}

function App() {
  useEffect(() => { document.getElementById('app-skeleton')?.remove() }, []);
  return (
    <OpportunityProvider>
      <NavProvider>
        <div className="min-h-screen">
          <AuthWidget />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '10px',
                fontSize: '14px',
              },
            }}
          />
          <AppContent />
        </div>
      </NavProvider>
    </OpportunityProvider>
  );
}

export default App;
