import React, { useState } from 'react';
import { supabase } from '../supabase';
import { useToast } from './Toast.jsx';

// Botão pequeno que abre um campo inline pra redefinir senha de qualquer
// login (motorista, admin ou cliente) — só Diretoria consegue usar de verdade
// (a Edge Function recusa qualquer outro cargo).
export default function ResetPasswordButton({ userId, label = '🔑 Senha' }) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleReset() {
    if (newPassword.length < 8) {
      toast('A senha precisa ter pelo menos 8 caracteres.', 'error');
      return;
    }
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('reset-password', {
      body: { userId, newPassword },
      headers: { Authorization: `Bearer ${token}` },
    });

    setSaving(false);

    if (error || data?.error) {
      toast(data?.error || error.message, 'error');
      return;
    }

    toast('Senha redefinida!', 'success');
    setOpen(false);
    setNewPassword('');
  }

  if (!open) {
    return (
      <button className="secondary-button" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="reset-password-inline">
      <input
        type="text"
        placeholder="Nova senha"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        style={{ width: 120 }}
      />
      <button className="primary-button" style={{ width: 'auto', padding: '8px 12px' }} onClick={handleReset} disabled={saving}>
        {saving ? '...' : 'OK'}
      </button>
      <button className="secondary-button" onClick={() => { setOpen(false); setNewPassword(''); }}>✕</button>
    </span>
  );
}
