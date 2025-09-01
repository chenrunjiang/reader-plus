import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import App from './App'
import Settings from './Settings'
import Reader from './Reader'

// 全局样式重置
const globalStyles = `
  * {
    box-sizing: border-box;
  }
  
  html, body {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
  }
  
  #root {
    height: 100vh;
    width: 100%;
  }
`;

// 创建并插入样式标签
const styleElement = document.createElement('style');
styleElement.textContent = globalStyles;
document.head.appendChild(styleElement);

// PWA Service Worker 注册
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((registration) => {
        console.log('✅ PWA: Service Worker registered successfully', registration.scope);
        
        // 检查更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新版本可用
                console.log('🆕 PWA: New version available');
                // 这里可以显示更新提示
                if (confirm('发现新版本，是否立即更新？')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ PWA: Service Worker registration failed', error);
      });
    
    // 监听Service Worker控制权变化
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 PWA: Service Worker controller changed');
      window.location.reload();
    });
  });
}

// PWA基础支持（简化版）
window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA: 应用已安装');
});

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