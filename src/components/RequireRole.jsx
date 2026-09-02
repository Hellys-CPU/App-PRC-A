import React from 'react';
import { useAdminRole, pageAllowed } from '../hooks/useAdminRole.js';

export default function RequireRole({ page, children }) {
  const { permissions, loading } = useAdminRole();

  if (loading) return <div className="loading-screen">Verificando permissão...</div>;

  if (!pageAllowed(permissions, page)) {
    return (
      <div className="loading-screen">
        <p>Você não tem permissão de acesso a esta área.</p>
        <button onClick={() => window.history.back()}>Voltar</button>
      </div>
    );
  }

  return children;
}
