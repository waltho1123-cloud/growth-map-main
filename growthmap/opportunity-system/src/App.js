import React from 'react';
import { Toaster } from 'react-hot-toast';
import { OpportunityProvider, useOpportunity } from './contexts/OpportunityContext';
import Dashboard from './components/Dashboard/Dashboard';
import OpportunityEditor from './components/Editor/OpportunityEditor';
import { AuthWidget } from './components/AuthWidget';

function AppContent() {
  const { state } = useOpportunity();

  return (
    <>
      <Dashboard />
      {state.editingId && <OpportunityEditor />}
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
