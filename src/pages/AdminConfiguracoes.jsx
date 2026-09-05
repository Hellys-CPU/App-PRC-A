import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
import { useToast } from '../components/Toast.jsx';
import { ROLE_LABELS, ROLE_PERMISSIONS, ALL_PAGES, JOB_TITLES } from '../hooks/useAdminRole.js';

const CODE_PATTERN = /^[A-Z0-9]{2,12}_[A-Z0-9]{2,12}$/;
const TABS = ['rotas', 'clientes', 'logins'];

export default function AdminConfiguracoes() {
  const [tab, setTab] = useState('rotas');
  const navigate = useNavigate();

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Configurações</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
        Rotas, clientes e logins administrativos — tudo que define como a operação funciona.
      </p>

      <div className="mode-switch mode-switch-3" style={{ maxWidth: 420, marginBottom: 24, '--active-index': TABS.indexOf(tab) }}>
        <button type="button" className={tab === 'rotas' ? 'active' : ''} onClick={() => setTab('rotas')}>Rotas</button>
        <button type="button" className={tab === 'clientes' ? 'active' : ''} onClick={() => setTab('clientes')}>Clientes</button>
        <button type="button" className={tab === 'logins' ? 'active' : ''} onClick={() => setTab('logins')}>Logins</button>
      </div>

      {tab === 'rotas' && <RotasPanel />}
      {tab === 'clientes' && <ClientesPanel />}
      {tab === 'logins' && <LoginsPanel />}
    </div>
  );

}

function RotasPanel() {
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState({
    code: '', origin: '', destination: '', defaultFreightValue: '', driverPayoutValue: '',
    plannedSaidaAfterHours: '', plannedChegadaAfterHours: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const toast = useToast();

  useEffect(() => { loadRoutes(); }, []);

  async function loadRoutes() {
    const { data } = await supabase.from('routes').select('*').order('code');
    setRoutes(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const code = form.code.toUpperCase().trim();
    if (!CODE_PATTERN.test(code)) {
      setMessage({ type: 'error', text: 'Formato inválido. Use SIGLA_SIGLA, ex: TZX_XCV9, TZX_GRU8, TEX_SJP.' });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('routes').insert({
      code,
      origin: form.origin,
      destination: form.destination,
      default_freight_value: form.defaultFreightValue ? Number(form.defaultFreightValue) : null,
      driver_payout_value: form.driverPayoutValue ? Number(form.driverPayoutValue) : null,
      planned_saida_after_hours: form.plannedSaidaAfterHours ? Number(form.plannedSaidaAfterHours) : null,
      planned_chegada_after_hours: form.plannedChegadaAfterHours ? Number(form.plannedChegadaAfterHours) : null,
    });

    setSaving(false);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe uma rota com este código.' : error.message;
      setMessage({ type: 'error', text: msg });
      return;
    }

    setMessage({ type: 'success', text: 'Rota cadastrada!' });
    setForm({
      code: '', origin: '', destination: '', defaultFreightValue: '', driverPayoutValue: '',
      plannedSaidaAfterHours: '', plannedChegadaAfterHours: '',
    });
    loadRoutes();
  }

  async function toggleActive(route) {
    await supabase.from('routes').update({ active: !route.active }).eq('id', route.id);
    loadRoutes();
  }

  function startEdit(r) {
    setEditingId(r.id);
    setEditForm({
      code: r.code,
      origin: r.origin,
      destination: r.destination,
      defaultFreightValue: r.default_freight_value != null ? String(r.default_freight_value) : '',
      driverPayoutValue: r.driver_payout_value != null ? String(r.driver_payout_value) : '',
      plannedSaidaAfterHours: r.planned_saida_after_hours != null ? String(r.planned_saida_after_hours) : '',
      plannedChegadaAfterHours: r.planned_chegada_after_hours != null ? String(r.planned_chegada_after_hours) : '',
    });
  }

  async function saveEdit(id) {
    const code = editForm.code.toUpperCase().trim();
    if (!CODE_PATTERN.test(code)) {
      toast('Formato de código inválido. Use SIGLA_SIGLA.', 'error');
      return;
    }
    const { error } = await supabase.from('routes').update({
      code,
      origin: editForm.origin,
      destination: editForm.destination,
      default_freight_value: editForm.defaultFreightValue ? Number(editForm.defaultFreightValue) : null,
      driver_payout_value: editForm.driverPayoutValue ? Number(editForm.driverPayoutValue) : null,
      planned_saida_after_hours: editForm.plannedSaidaAfterHours ? Number(editForm.plannedSaidaAfterHours) : null,
      planned_chegada_after_hours: editForm.plannedChegadaAfterHours ? Number(editForm.plannedChegadaAfterHours) : null,
    }).eq('id', id);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe uma rota com este código.' : error.message;
      toast(msg, 'error');
      return;
    }
    toast('Rota atualizada!', 'success');
    setEditingId(null);
    loadRoutes();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="motorista-form" style={{ marginBottom: 28 }}>
        <label>Código da rota (formato SIGLA_SIGLA)</label>
        <input
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          placeholder="Ex: TZX_XCV9"
          required
        />
        <p className="subtitle" style={{ textAlign: 'left', margin: '-8px 0 12px', fontSize: 12 }}>
          Exemplos: TZX_XCV9, TZX_GRU8, TEX_SJP — pode usar qualquer sigla, só mantenha esse formato.
        </p>

        <label>Origem</label>
        <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required />

        <label>Destino</label>
        <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />

        <label>Frete cobrado do cliente (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.defaultFreightValue}
          onChange={(e) => setForm({ ...form, defaultFreightValue: e.target.value })}
          placeholder="Valor formalizado com o cliente pra essa rota"
        />

        <label>Pagamento ao motorista (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.driverPayoutValue}
          onChange={(e) => setForm({ ...form, driverPayoutValue: e.target.value })}
          placeholder="Quanto o motorista recebe por rodar essa rota"
        />
        <p className="subtitle" style={{ textAlign: 'left', margin: '-8px 0 12px', fontSize: 12 }}>
          Com esses dois valores preenchidos, toda viagem criada nessa rota já gera
          automaticamente a conta a receber do cliente e a pagar ao motorista no Financeiro.
        </p>

        <label>Horas até a saída planejada (depois da apresentação da viagem)</label>
        <input
          type="number"
          step="0.25"
          min="0"
          value={form.plannedSaidaAfterHours}
          onChange={(e) => setForm({ ...form, plannedSaidaAfterHours: e.target.value })}
          placeholder="Ex: 2 (ou 1.5 para 1h30)"
        />

        <label>Horas até a chegada planejada (depois da saída)</label>
        <input
          type="number"
          step="0.25"
          min="0"
          value={form.plannedChegadaAfterHours}
          onChange={(e) => setForm({ ...form, plannedChegadaAfterHours: e.target.value })}
          placeholder="Ex: 5 (ou 4.5 para 4h30)"
        />
        <p className="subtitle" style={{ textAlign: 'left', margin: '-8px 0 12px', fontSize: 12 }}>
          Opcional. O horário de apresentação é definido em cada viagem (na criação) —
          aqui só a duração até saída e chegada, que é fixa pra essa rota.
        </p>

        {message && (
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>{message.text}</p>
        )}

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Salvando...' : 'Cadastrar Rota'}
        </button>
      </form>

      <h2>Rotas Cadastradas</h2>
      <MobileTableReveal title="Rotas" icon="🛣️">
        <table className="admin-table">
        <thead>
          <tr><th>Código</th><th>Origem → Destino</th><th>Frete Cliente</th><th>Pagto. Motorista</th><th>Duração Planejada</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {routes.map((r) => {
            const isEditing = editingId === r.id;
            if (isEditing) {
              return (
                <tr key={r.id}>
                  <td><input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })} style={{ width: 110 }} /></td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <input value={editForm.origin} onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })} placeholder="Origem" />
                    <input value={editForm.destination} onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })} placeholder="Destino" />
                  </td>
                  <td><input type="number" step="0.01" value={editForm.defaultFreightValue} onChange={(e) => setEditForm({ ...editForm, defaultFreightValue: e.target.value })} style={{ width: 100 }} /></td>
                  <td><input type="number" step="0.01" value={editForm.driverPayoutValue} onChange={(e) => setEditForm({ ...editForm, driverPayoutValue: e.target.value })} style={{ width: 100 }} /></td>
                  <td style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
                    <input type="number" step="0.25" placeholder="h até saída" value={editForm.plannedSaidaAfterHours} onChange={(e) => setEditForm({ ...editForm, plannedSaidaAfterHours: e.target.value })} title="Horas até a saída" />
                    <input type="number" step="0.25" placeholder="h até chegada" value={editForm.plannedChegadaAfterHours} onChange={(e) => setEditForm({ ...editForm, plannedChegadaAfterHours: e.target.value })} title="Horas até a chegada" />
                  </td>
                  <td>
                    <span className={`trip-badge ${r.active ? 'badge-done' : 'badge-assigned'}`}>{r.active ? 'Ativa' : 'Inativa'}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="secondary-button" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button className="primary-button" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => saveEdit(r.id)}>Salvar</button>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.origin} → {r.destination}</td>
                <td>{r.default_freight_value != null ? Number(r.default_freight_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                <td>{r.driver_payout_value != null ? Number(r.driver_payout_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {r.planned_saida_after_hours != null || r.planned_chegada_after_hours != null
                    ? `+${r.planned_saida_after_hours ?? '?'}h saída · +${r.planned_chegada_after_hours ?? '?'}h cheg. (após apresentação da viagem)`
                    : '-'}
                </td>
                <td>
                  <button className="secondary-button" onClick={() => toggleActive(r)}>
                    {r.active ? 'Ativa' : 'Inativa'}
                  </button>
                </td>
                <td>
                  <button className="secondary-button" onClick={() => startEdit(r)}>Editar</button>
                </td>
              </tr>
            );
          })}
          {routes.length === 0 && (
            <tr><td colSpan="7" className="empty-state">Nenhuma rota cadastrada.</td></tr>
          )}
        </tbody>
        </table>
      </MobileTableReveal>
    </>
  );
}

function ClientesPanel() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: '', contactPhone: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [loginForClientId, setLoginForClientId] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [creatingLogin, setCreatingLogin] = useState(false);
  const toast = useToast();

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from('clients').insert({
      name: form.name.trim(),
      contact_phone: form.contactPhone ? form.contactPhone.replace(/\D/g, '') : null,
    });

    setSaving(false);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe um cliente com este nome.' : error.message;
      setMessage({ type: 'error', text: msg });
      return;
    }

    setMessage({ type: 'success', text: 'Cliente cadastrado!' });
    setForm({ name: '', contactPhone: '' });
    loadClients();
  }

  async function toggleActive(client) {
    await supabase.from('clients').update({ active: !client.active }).eq('id', client.id);
    loadClients();
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditForm({ name: c.name, contactPhone: c.contact_phone || '' });
  }

  async function saveEdit(id) {
    if (!editForm.name.trim()) {
      toast('Nome não pode ficar vazio.', 'error');
      return;
    }
    const { error } = await supabase.from('clients').update({
      name: editForm.name.trim(),
      contact_phone: editForm.contactPhone ? editForm.contactPhone.replace(/\D/g, '') : null,
    }).eq('id', id);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe um cliente com este nome.' : error.message;
      toast(msg, 'error');
      return;
    }
    toast('Cliente atualizado!', 'success');
    setEditingId(null);
    loadClients();
  }

  async function handleCreateLogin(clientId) {
    if (!loginForm.email || !loginForm.password) {
      toast('Preencha email e senha.', 'error');
      return;
    }
    setCreatingLogin(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('create-client-login', {
      body: { clientId, email: loginForm.email, password: loginForm.password },
      headers: { Authorization: `Bearer ${token}` },
    });

    setCreatingLogin(false);

    if (error || data?.error) {
      toast(data?.error || error.message, 'error');
      return;
    }

    toast('Login do cliente criado!', 'success');
    setLoginForClientId(null);
    setLoginForm({ email: '', password: '' });
    loadClients();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="motorista-form" style={{ marginBottom: 28 }}>
        <label>Nome do cliente</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <label>Telefone de contato (opcional)</label>
        <input
          type="tel"
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
        />

        {message && (
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>{message.text}</p>
        )}

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Salvando...' : 'Cadastrar Cliente'}
        </button>
      </form>

      <h2>Clientes Cadastrados</h2>
      <MobileTableReveal title="Clientes" icon="🏢">
        <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Telefone</th><th>Status</th><th>Login</th><th></th></tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const isEditing = editingId === c.id;
            if (isEditing) {
              return (
                <tr key={c.id}>
                  <td><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                  <td><input type="tel" value={editForm.contactPhone} onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })} /></td>
                  <td><span className={`trip-badge ${c.active ? 'badge-done' : 'badge-assigned'}`}>{c.active ? 'Ativo' : 'Inativo'}</span></td>
                  <td>-</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="secondary-button" onClick={() => setEditingId(null)}>Cancelar</button>
                    <button className="primary-button" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => saveEdit(c.id)}>Salvar</button>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.contact_phone || '-'}</td>
                <td>
                  <button className="secondary-button" onClick={() => toggleActive(c)}>
                    {c.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td style={{ fontSize: 12, color: c.auth_user_id ? 'var(--route)' : 'var(--text-dim)' }}>
                  {c.auth_user_id ? '✓ Tem login' : 'Sem login'}
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="secondary-button" onClick={() => startEdit(c)}>Editar</button>
                  {!c.auth_user_id && (
                    <button
                      className="secondary-button"
                      onClick={() => setLoginForClientId(loginForClientId === c.id ? null : c.id)}
                    >
                      Gerar Login
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {clients.length === 0 && (
            <tr><td colSpan="5" className="empty-state">Nenhum cliente cadastrado.</td></tr>
          )}
        </tbody>
        </table>
      </MobileTableReveal>

      {loginForClientId && (
        <div className="motorista-form" style={{ marginTop: 20, maxWidth: 420 }}>
          <h2 style={{ marginTop: 0 }}>Gerar login para: {clients.find((c) => c.id === loginForClientId)?.name}</h2>

          <label>Email do cliente</label>
          <input
            type="email"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />

          <label>Senha</label>
          <input
            type="text"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            minLength={6}
          />

          <div className="trip-actions" style={{ marginTop: 6 }}>
            <button className="secondary-button" onClick={() => setLoginForClientId(null)}>Cancelar</button>
            <button className="primary-button" onClick={() => handleCreateLogin(loginForClientId)} disabled={creatingLogin}>
              {creatingLogin ? 'Criando...' : 'Criar Login'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const ROLES = ['diretoria', 'operacional', 'financeiro', 'trafego', 'captacao', 'manutencao'];

function LoginsPanel() {
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
    <>
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
      <MobileTableReveal title="Logins" icon="🔑">
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
      </MobileTableReveal>

      {editingId && (
        <EditAdminPanel
          admin={admins.find((a) => a.id === editingId)}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); loadAdmins(); }}
        />
      )}
    </>
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
        {ROLES.map((r) => (
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
