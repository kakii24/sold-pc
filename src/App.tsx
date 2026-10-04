import React, { useEffect, useState } from 'react';
import { WholesaleView } from './WholesaleView';
import './App.css';

function App() {
  const [activeView, setActiveView] = useState('wholesale');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveView('wholesale');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {activeView === 'wholesale' ? (
        <WholesaleView />
      ) : (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold">App Setup Complete</h1>
          <p>Press F1 to open Wholesale View.</p>
        </div>
      )}
    </div>
  );
}

export default App;
