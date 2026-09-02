import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import { useToast } from '../components/Toast.jsx';

const CODE_PATTERN = /^[A-Z0-9]{2,12}_[A-Z0-9]{2,12}$/;

export default function AdminConfiguracoes() {
  const [tab, setTab] = useState('rotas');
  const navigate = useNavigate();

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Configurações</h1>

      <div className="mode-switch" style={{ maxWidth: 340, marginBottom: 24 }}>
        <button type="button" className={tab === 'rotas' ? 'active' : ''} onClick={() => setTab('rotas')}>Rotas</button>
        <button type="button" className={tab === 'clientes' ? 'active' : ''} onClick={() => setTab('clientes')}>Clientes</button>
      </div>

      {tab === 'rotas' ? <RotasPanel /> : <ClientesPanel />}
    </div>
  );
}

function RotasPanel() {
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState({ code: '', origin: '', destination: '', defaultFreightValue: '', driverPayoutValue: '' });
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
    });

    setSaving(false);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe uma rota com este código.' : error.message;
      setMessage({ type: 'error', text: msg });
      return;
    }

    setMessage({ type: 'success', text: 'Rota cadastrada!' });
    setForm({ code: '', origin: '', destination: '', defaultFreightValue: '', driverPayoutValue: '' });
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

        {message && (
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>{message.text}</p>
        )}

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Salvando...' : 'Cadastrar Rota'}
        </button>
      </form>

      <h2>Rotas Cadastradas</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Código</th><th>Origem → Destino</th><th>Frete Cliente</th><th>Pagto. Motorista</th><th>Status</th><th></th></tr>
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
            <tr><td colSpan="6" className="empty-state">Nenhuma rota cadastrada.</td></tr>
          )}
        </tbody>
      </table>
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
      <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Telefone</th><th>Status</th><th></th></tr>
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
                <td>
                  <button className="secondary-button" onClick={() => startEdit(c)}>Editar</button>
                </td>
              </tr>
            );
          })}
          {clients.length === 0 && (
            <tr><td colSpan="4" className="empty-state">Nenhum cliente cadastrado.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
