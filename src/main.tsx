import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import App from './App'
import Settings from './Settings'
import Reader from './Reader'

// 全局样式重置（禁用下拉刷新）
const globalStyles = `
  * {
    box-sizing: border-box;
  }
  
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    overscroll-behavior: none;
    overscroll-behavior-y: none;
  }
  
  #root {
    height: 100vh;
    width: 100%;
    overscroll-behavior: none;
    overscroll-behavior-y: none;
  }
`;

// 创建并插入样式标签
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/read/:id" element={<Reader />} />
      </Routes>
    </Router>
  </StrictMode>,
)