import React from 'react';
import { TitleBar } from './components/TitleBar';
import { StatusCard } from './components/StatusCard';
import './styles/App.css';

export const App: React.FC = () => {
  return (
    <div className="app-container">
      <div className="window-frame">
        <TitleBar />
        <main className="main-content">
          <StatusCard />
        </main>
      </div>
    </div>
  );
};

export default App;
