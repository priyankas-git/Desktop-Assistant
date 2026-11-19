import React from 'react';
import { Companion } from './components/Companion';
import './styles/App.css';

export const App: React.FC = () => {
  return (
    <div className="app-canvas">
      <Companion />
    </div>
  );
};

export default App;
