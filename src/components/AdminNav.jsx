import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import Brand from './Brand.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import MobileNavMenu from './MobileNavMenu.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useChatNotifications } from '../hooks/useChatNotifications.js';
import { useAdminRole, pageAllowed } from '../hooks/useAdminRole.js';

export const NAV_TABS = [
  { page: 'dashboard', path: '/', label: 'Painel', icon: '📊' },
  { page: 'nova-viagem', path: '/nova-viagem', label: 'Programação em Massa', icon: '🗓️' },
  { page: 'motoristas', path: '/motoristas', label: 'Motoristas', icon: '🧑‍✈️' },
  { page: 'frota', path: '/frota', label: 'Frota', icon: '🚚' },
  { page: 'mapa', path: '/mapa', label: 'Mapa', icon: '🗺️' },
  { page: 'chat', path: '/chat', label: 'Chat', icon: '💬' },
  { page: 'financeiro', path: '/financeiro', label: 'Financeiro', icon: '💰' },
  { page: 'folha-pagamento', path: '/folha-pagamento', label: 'Folha de Pagamento', icon: '🧾' },
  { page: 'relatorios', path: '/relatorios', label: 'Análise', icon: '📈' },
  { page: 'configuracoes', path: '/configuracoes', label: 'Configurações', icon: '⚙️' },
  { page: 'changelog', path: '/changelog', label: 'Novidades', icon: '🆕' },
];

// Só na aba horizontal do desktop: agrupa itens de dinheiro/análise num
// dropdown só, pra não estourar a largura da tela com 11 abas soltas.
// No celular (grade do MobileNavMenu) cada item continua aparecendo solto.
const GROUP_PAGES = ['financeiro', 'folha-pagamento', 'relatorios'];
const GROUP_LABEL = 'Financeiro';

function FinanceDropdown({ items, location }) {
  const [open, setOpen] = useState(false);
  const isActive = items.some((t) => t.path === location.pathname);

  return (
    <div className="admin-nav-dropdown" onMouseLeave={() => setOpen(false)}>
      <button
        className={`admin-nav-tab admin-nav-dropdown-trigger${isActive ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
      >
        {GROUP_LABEL} ▾
      </button>
      {open && (
        <div className="admin-nav-dropdown-menu">
          {items.map((t) => (
            <Link
              key={t.page}
              to={t.path}
              className={`admin-nav-dropdown-item${location.pathname === t.path ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminNav() {
  const { permissions } = useAdminRole();
  const location = useLocation();
  const { unreadCount } = useChatNotifications();

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  const allowedTabs = NAV_TABS.filter((t) => pageAllowed(permissions, t.page));
  const groupTabs = allowedTabs.filter((t) => GROUP_PAGES.includes(t.page));
  let groupRendered = false;

  return (
    <div className="admin-nav">
      <div className="admin-nav-brand"><Brand /></div>
      <nav className="admin-nav-tabs">
        {allowedTabs.map((t) => {
          if (GROUP_PAGES.includes(t.page)) {
            if (groupRendered) return null;
            groupRendered = true;
            return <FinanceDropdown key="finance-group" items={groupTabs} location={location} />;
          }
          return (
            <Link
              key={t.page}
              to={t.path}
              className={`admin-nav-tab${location.pathname === t.path ? ' active' : ''}`}
            >
              {t.label}
              {t.page === 'chat' && unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="admin-nav-right">
        <GlobalSearch />
        <NotificationBell />
        <ThemeToggle />
        <button className="logout-button" onClick={handleLogout}>Sair</button>
      </div>
      <MobileNavMenu />
    </div>
  );
}
