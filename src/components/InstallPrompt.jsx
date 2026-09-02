import React, { useEffect, useState } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (standalone) return; // já instalado, não mostra nada

    function handler(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    window.addEventListener('beforeinstallprompt', handler);

    if (iosDevice) {
      setIsIos(true);
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="install-banner">
      {isIos ? (
        <span>Instale o app: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".</span>
      ) : (
        <>
          <span>Instale o app da PRC no seu celular pra acesso rápido.</span>
          <button onClick={handleInstallClick}>Instalar</button>
        </>
      )}
      <button className="install-dismiss" onClick={() => setVisible(false)} aria-label="Fechar">✕</button>
    </div>
  );
}
