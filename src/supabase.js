import { createClient } from '@supabase/supabase-js';

// Credenciais do projeto "App PRC controle A" (Supabase)
const SUPABASE_URL = 'https://kmfbkxxfuagdocuknaxh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mo8etwyChA-0B5A2eqkcgw_CK9-chju';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Converte um CPF (só números) no "email técnico" usado internamente
// pelo Supabase Auth. O motorista nunca vê nem usa esse email, loga só com CPF.
export function cpfToInternalEmail(cpf) {
  const clean = String(cpf).replace(/\D/g, '');
  return `${clean}@drivers.internal`;
}

export function cleanCpf(cpf) {
  return String(cpf).replace(/\D/g, '').slice(0, 11);
}

export function cleanPhone(phone) {
  return String(phone).replace(/\D/g, '');
}
