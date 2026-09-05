import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NAV_TABS } from './AdminNav.jsx';
import { useAdminRole, pageAllowed } from '../hooks/useAdminRole.js';

// Substitui a lista de abas horizontal no celular: um botão flutuante que
// abre uma grade com todas as seções, pra pular direto pra qualquer uma
// sem precisar rolar por um monte de abas espremidas.
export default function MobileNavMenu() {
  const [open, setOpen] = useState(false);
  const { permissions } = useAdminRole();
  const navigate = useNavigate();
  const location = useLocation();

  const items = NAV_TABS.filter((t) => pageAllowed(permissions, t.page));

  function goTo(path) {
    setOpen(false);
    navigate(path);
  }

  return (
    <>
      <button
        className="mobile-nav-fab"
        onClick={() => setOpen(true)}
        aria-label="Abrir navegação"
      >
        <span className="mobile-nav-fab-bars" />
      </button>

      {open && (
        <div className="modal-backdrop mobile-nav-backdrop" onClick={() => setOpen(false)}>
          <div className="mobile-nav-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-sheet-header">
              <span>Ir para</span>
              <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="mobile-nav-grid">
              {items.map((t) => (
                <button
                  key={t.page}
                  className={`mobile-nav-tile${location.pathname === t.path ? ' active' : ''}`}
                  onClick={() => goTo(t.path)}
                >
                  <span className="mobile-nav-tile-icon">{t.icon}</span>
                  <span className="mobile-nav-tile-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
