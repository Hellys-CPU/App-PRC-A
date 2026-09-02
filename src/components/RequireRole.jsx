import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminRole, canAccess } from '../hooks/useAdminRole.js';

export default function RequireRole({ page, children }) {
  const { role, loading } = useAdminRole();

  if (loading) return <div className="loading-screen">Verificando permissão...</div>;

  if (!canAccess(role, page)) {
    return (
      <div className="loading-screen">
        <p>Seu cargo não tem acesso a esta área.</p>
        <button onClick={() => window.history.back()}>Voltar</button>
      </div>
    );
  }

  return children;
}
