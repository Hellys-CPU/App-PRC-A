import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import { ROLE_LABELS } from '../hooks/useAdminRole.js';
import { useToast } from '../components/Toast.jsx';

const ROLES = ['diretoria', 'operacional', 'financeiro', 'trafego'];

export default function AdminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'operacional' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { loadAdmins(); }, []);

  async function loadAdmins() {
    const { data } = await supabase.from('admin_users').select('id, role, profiles(full_name)');
    setAdmins(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('create-admin', {
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });

    setSaving(false);

    if (error || data?.error) {
      toast(data?.error || error.message, 'error');
      return;
    }

    toast('Login administrativo criado!', 'success');
    setForm({ fullName: '', email: '', password: '', role: 'operacional' });
    loadAdmins();
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Logins Administrativos</h1>

      <form onSubmit={handleSubmit} className="motorista-form" style={{ marginBottom: 28 }}>
        <label>Nome completo</label>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />

        <label>Senha</label>
        <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />

        <label>Cargo</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Criando...' : 'Criar Login'}
        </button>
      </form>

      <h2>Logins Cadastrados</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Cargo</th></tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td>{a.profiles?.full_name}</td>
              <td>{ROLE_LABELS[a.role] || a.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
