// src/renderer/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 💡 [핵심 패치] 글로벌 CSS 파일이 없으므로, 최상단 마운트 시점에 인라인으로 
        가로/세로 모든 유령 스크롤바와 여백을 강제로 지워버리고 격리합니다. */}
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      margin: 0, 
      padding: 0, 
      overflow: 'hidden', 
      background: 'transparent' 
    }}>
      <App />
    </div>
  </React.StrictMode>
);