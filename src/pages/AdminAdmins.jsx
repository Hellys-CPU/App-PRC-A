import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import { ROLE_LABELS, ROLE_PERMISSIONS, ALL_PAGES, JOB_TITLES } from '../hooks/useAdminRole.js';
import { useToast } from '../components/Toast.jsx';

const ROLES = ['diretoria', 'operacional', 'financeiro', 'trafego', 'captacao', 'manutencao'];

export default function AdminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', jobTitle: '', role: 'operacional' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();

  useEffect(() => { loadAdmins(); }, []);

  async function loadAdmins() {
    const { data } = await supabase.from('admin_users').select('id, role, job_title, custom_permissions, profiles(full_name)');
    setAdmins(data || []);
  }

  function handleJobTitleChange(title) {
    const match = JOB_TITLES.find((j) => j.title === title);
    setForm({ ...form, jobTitle: title, role: match ? match.suggestedRole : form.role });
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
    setForm({ fullName: '', email: '', password: '', jobTitle: '', role: 'operacional' });
    loadAdmins();
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Admin</h1>

      <form onSubmit={handleSubmit} className="motorista-form" style={{ marginBottom: 28 }}>
        <label>Nome completo</label>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />

        <label>Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />

        <label>Senha</label>
        <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />

        <label>Cargo</label>
        <select value={form.jobTitle} onChange={(e) => handleJobTitleChange(e.target.value)} required>
          <option value="">Selecione o cargo</option>
          {JOB_TITLES.map((j) => <option key={j.title} value={j.title}>{j.title}</option>)}
        </select>

        <label>Nível de acesso</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <p className="subtitle" style={{ textAlign: 'left', margin: '-8px 0 12px', fontSize: 12 }}>
          Preenchido automaticamente pelo cargo, mas pode ajustar se essa pessoa precisar de mais ou menos acesso.
        </p>

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Criando...' : 'Criar Login'}
        </button>
      </form>

      <h2>Logins Cadastrados</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Cargo</th><th>Nível de Acesso</th><th>Permissões</th><th></th></tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td>{a.profiles?.full_name}</td>
              <td>{a.job_title || '-'}</td>
              <td>{ROLE_LABELS[a.role] || a.role}</td>
              <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {a.custom_permissions !== null ? 'Personalizada' : 'Padrão do nível'}
              </td>
              <td>
                <button className="secondary-button" onClick={() => setEditingId(editingId === a.id ? null : a.id)}>
                  {editingId === a.id ? 'Fechar' : 'Editar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editingId && (
        <EditAdminPanel
          admin={admins.find((a) => a.id === editingId)}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); loadAdmins(); }}
        />
      )}
    </div>
  );
}

function EditAdminPanel({ admin, onClose, onSaved }) {
  const [jobTitle, setJobTitle] = useState(admin.job_title || '');
  const [role, setRole] = useState(admin.role);
  const [override, setOverride] = useState(admin.custom_permissions !== null);
  const [pages, setPages] = useState(new Set(admin.custom_permissions ?? ROLE_PERMISSIONS[admin.role] ?? []));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function togglePage(key) {
    setPages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleRoleChange(newRole) {
    setRole(newRole);
    if (!override) setPages(new Set(ROLE_PERMISSIONS[newRole] ?? []));
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('admin_users')
      .update({
        role,
        job_title: jobTitle || null,
        custom_permissions: override ? Array.from(pages) : null,
      })
      .eq('id', admin.id);
    setSaving(false);

    if (error) {
      toast('Erro ao salvar: ' + error.message, 'error');
      return;
    }
    toast('Permissões atualizadas!', 'success');
    onSaved();
  }

  return (
    <div className="motorista-form" style={{ marginTop: 20, maxWidth: 520 }}>
      <h2 style={{ marginTop: 0 }}>Editando: {admin.profiles?.full_name}</h2>

      <label>Cargo</label>
      <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}>
        <option value="">Sem cargo definido</option>
        {JOB_TITLES.map((j) => <option key={j.title} value={j.title}>{j.title}</option>)}
      </select>

      <label>Nível de acesso</label>
      <select value={role} onChange={(e) => handleRoleChange(e.target.value)}>
        {['diretoria', 'operacional', 'financeiro', 'trafego', 'captacao', 'manutencao'].map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>

      <label className="override-checkbox">
        <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
        Personalizar permissões deste usuário (sobrescreve o padrão do nível de acesso)
      </label>

      <p className="subtitle" style={{ textAlign: 'left', margin: '4px 0 10px', fontSize: 12 }}>
        {override
          ? 'Marque exatamente as abas que esta pessoa deve ver, independente do nível de acesso.'
          : 'Desmarcado: esta pessoa usa o padrão do nível de acesso selecionado acima.'}
      </p>

      <div className="permission-grid">
        {ALL_PAGES.map((p) => (
          <label key={p.key} className={`permission-item${!override ? ' disabled' : ''}`}>
            <input
              type="checkbox"
              disabled={!override}
              checked={pages.has(p.key)}
              onChange={() => togglePage(p.key)}
            />
            {p.label}
          </label>
        ))}
      </div>

      <div className="trip-actions" style={{ marginTop: 16 }}>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
