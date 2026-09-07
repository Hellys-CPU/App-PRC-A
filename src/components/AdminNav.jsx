import React from 'react';
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

export default function AdminNav() {
  const { permissions } = useAdminRole();
  const location = useLocation();
  const { unreadCount } = useChatNotifications();

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="admin-nav">
      <div className="admin-nav-brand"><Brand /></div>
      <nav className="admin-nav-tabs">
        {NAV_TABS.filter((t) => pageAllowed(permissions, t.page)).map((t) => (
          <Link
            key={t.page}
            to={t.path}
            className={`admin-nav-tab${location.pathname === t.path ? ' active' : ''}`}
          >
            {t.label}
            {t.page === 'chat' && unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
          </Link>
        ))}
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
