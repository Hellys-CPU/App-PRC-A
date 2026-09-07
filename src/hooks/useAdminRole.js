import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export const ROLE_LABELS = {
  diretoria: 'Diretoria',
  operacional: 'Operacional',
  financeiro: 'Financeiro',
  trafego: 'Torre de Controle',
  captacao: 'Captação',
  manutencao: 'Manutenção',
};

// Cargos reais da transportadora (exibição) -> nível de acesso sugerido.
// A pessoa que cadastra pode trocar o nível de acesso mesmo depois de escolher o cargo.
export const JOB_TITLES = [
  { title: 'Diretora de Operação', suggestedRole: 'diretoria' },
  { title: 'Supervisora de Operação', suggestedRole: 'operacional' },
  { title: 'Líder de Operação', suggestedRole: 'operacional' },
  { title: 'Manutenção', suggestedRole: 'manutencao' },
  { title: 'Captação', suggestedRole: 'captacao' },
  { title: 'Torre de Controle', suggestedRole: 'trafego' },
  { title: 'Diretor Financeiro', suggestedRole: 'financeiro' },
  { title: 'Assistente Financeiro 01', suggestedRole: 'financeiro' },
  { title: 'Assistente Financeiro 02', suggestedRole: 'financeiro' },
];

// Todas as páginas administrativas existentes, com um rótulo pra tela de permissões.
export const ALL_PAGES = [
  { key: 'dashboard', label: 'Painel' },
  { key: 'nova-viagem', label: 'Nova Viagem' },
  { key: 'motoristas', label: 'Motoristas' },
  { key: 'frota', label: 'Frota' },
  { key: 'mapa', label: 'Mapa' },
  { key: 'chat', label: 'Chat' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'folha-pagamento', label: 'Folha de Pagamento' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'changelog', label: 'Novidades' },
];

// Padrão de cada nível de acesso — só é usado quando o usuário NÃO tem permissão personalizada.
// Configurações (rotas/clientes/valores de frete) fica só com Diretoria.
export const ROLE_PERMISSIONS = {
  diretoria: ['dashboard', 'nova-viagem', 'motoristas', 'frota', 'configuracoes', 'mapa', 'relatorios', 'financeiro', 'folha-pagamento', 'chat', 'changelog'],
  operacional: ['dashboard', 'nova-viagem', 'motoristas', 'frota', 'changelog'],
  financeiro: ['dashboard', 'financeiro', 'folha-pagamento', 'relatorios', 'changelog'],
  trafego: ['dashboard', 'mapa', 'chat', 'changelog'],
  captacao: ['dashboard', 'motoristas', 'changelog'],
  manutencao: ['dashboard', 'frota', 'changelog'],
};

export function pageAllowed(permissions, page) {
  return Array.isArray(permissions) && permissions.includes(page);
}

export function useAdminRole() {
  const [role, setRole] = useState(null);
  const [customPermissions, setCustomPermissions] = useState(null);
  const [jobTitle, setJobTitle] = useState(null);
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
        .select('role, custom_permissions, job_title')
        .eq('id', userData.user.id)
        .maybeSingle();
      if (active) {
        setRole(data?.role || null);
        setCustomPermissions(data?.custom_permissions ?? null);
        setJobTitle(data?.job_title ?? null);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Se o usuário tem permissão personalizada (mesmo lista vazia), ela manda.
  // Senão, cai no padrão do nível de acesso.
  const permissions = customPermissions !== null ? customPermissions : (ROLE_PERMISSIONS[role] || []);

  return { role, permissions, customPermissions, jobTitle, loading };
}
