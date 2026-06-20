import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';
import './styles/global.css';
import './styles/layout.css';
import './styles/navigation.css';
import './styles/cards.css';
import './styles/forms.css';
import './styles/modals.css';
import './styles/auth.css';
import './styles/responsive.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

let isReloadingForUpdate = false;
const hadServiceWorkerController = Boolean(navigator.serviceWorker?.controller);

if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController || isReloadingForUpdate) {
      return;
    }

    isReloadingForUpdate = true;
    window.location.reload();
  });
}

let updateServiceWorker = () => Promise.resolve();

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateServiceWorker(true);
  },
  onRegisteredSW(swUrl, registration) {
    if (!registration) {
      return;
    }

    const checkForUpdate = () => registration.update().catch(() => undefined);
    const intervalId = window.setInterval(checkForUpdate, 15 * 60 * 1000);

    checkForUpdate();
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    });

    window.addEventListener('pagehide', () => window.clearInterval(intervalId), { once: true });
  }
});
