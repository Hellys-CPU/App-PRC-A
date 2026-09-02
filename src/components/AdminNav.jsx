import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../supabase';
import Brand from './Brand.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { useAdminRole, canAccess } from '../hooks/useAdminRole.js';

const TABS = [
  { page: 'dashboard', path: '/', label: 'Painel' },
  { page: 'nova-viagem', path: '/nova-viagem', label: 'Nova Viagem' },
  { page: 'motoristas', path: '/motoristas', label: 'Motoristas' },
  { page: 'frota', path: '/frota', label: 'Frota' },
  { page: 'mapa', path: '/mapa', label: 'Mapa' },
  { page: 'chat', path: '/chat', label: 'Chat' },
  { page: 'financeiro', path: '/financeiro', label: 'Financeiro' },
  { page: 'relatorios', path: '/relatorios', label: 'Relatórios' },
  { page: 'configuracoes', path: '/configuracoes', label: 'Configurações' },
  { page: 'admins', path: '/admins', label: 'Logins' },
];

export default function AdminNav() {
  const { role } = useAdminRole();
  const location = useLocation();

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="admin-nav">
      <div className="admin-nav-brand"><Brand /></div>
      <nav className="admin-nav-tabs">
        {TABS.filter((t) => canAccess(role, t.page)).map((t) => (
          <Link
            key={t.page}
            to={t.path}
            className={`admin-nav-tab${location.pathname === t.path ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="admin-nav-right">
        <ThemeToggle />
        <button className="logout-button" onClick={handleLogout}>Sair</button>
      </div>
    </div>
  );
}
