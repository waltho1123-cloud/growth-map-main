import React, { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { OpportunityProvider, useOpportunity } from './contexts/OpportunityContext';
import Dashboard from './components/Dashboard/Dashboard';
import { AuthWidget } from './components/AuthWidget';

const OpportunityEditor = lazy(() => import('./components/Editor/OpportunityEditor'));

function AppContent() {
  const { state } = useOpportunity();

  return (
    <>
      <Dashboard />
      {state.editingId && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/20 z-40 flex items-center justify-center">
            <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-gray-600 text-sm">載入編輯器…</div>
          </div>
        }>
          <OpportunityEditor />
        </Suspense>
      )}
    </>
  );
}

function App() {
  return (
    <OpportunityProvider>
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
    </OpportunityProvider>
  );
}

export default App;
