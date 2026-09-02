import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export const ROLE_LABELS = {
  diretoria: 'Diretoria',
  operacional: 'Operacional',
  financeiro: 'Financeiro',
  trafego: 'Tráfego/Rastreamento',
};

// Cada cargo enxerga só as páginas da sua área. Diretoria sempre tem tudo.
const ROLE_PERMISSIONS = {
  diretoria: ['dashboard', 'nova-viagem', 'motoristas', 'frota', 'configuracoes', 'mapa', 'relatorios', 'financeiro', 'chat', 'admins'],
  operacional: ['dashboard', 'nova-viagem', 'motoristas', 'frota', 'configuracoes'],
  financeiro: ['dashboard', 'financeiro', 'relatorios'],
  trafego: ['dashboard', 'mapa', 'chat'],
};

export function canAccess(role, page) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(page) || false;
}

export function useAdminRole() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        if (active) { setRole(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (active) { setRole(data?.role || null); setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  return { role, loading };
}
