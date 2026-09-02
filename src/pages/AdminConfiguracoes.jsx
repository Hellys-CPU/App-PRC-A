import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const CODE_PATTERN = /^[A-Z0-9]{2,12}_[A-Z0-9]{2,12}$/;

export default function AdminConfiguracoes() {
  const [tab, setTab] = useState('rotas');
  const navigate = useNavigate();

  return (
    <div className="admin-container">
      <header className="admin-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h1>Configurações</h1>
      </header>

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
  const [form, setForm] = useState({ code: '', origin: '', destination: '', defaultFreightValue: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

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
    });

    setSaving(false);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe uma rota com este código.' : error.message;
      setMessage({ type: 'error', text: msg });
      return;
    }

    setMessage({ type: 'success', text: 'Rota cadastrada!' });
    setForm({ code: '', origin: '', destination: '', defaultFreightValue: '' });
    loadRoutes();
  }

  async function toggleActive(route) {
    await supabase.from('routes').update({ active: !route.active }).eq('id', route.id);
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

        <label>Valor de frete padrão (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.defaultFreightValue}
          onChange={(e) => setForm({ ...form, defaultFreightValue: e.target.value })}
          placeholder="Opcional — sugerido automaticamente ao criar viagem"
        />

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
          <tr><th>Código</th><th>Origem → Destino</th><th>Frete Padrão</th><th>Status</th></tr>
        </thead>
        <tbody>
          {routes.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.origin} → {r.destination}</td>
              <td>{r.default_freight_value != null ? Number(r.default_freight_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
              <td>
                <button className="secondary-button" onClick={() => toggleActive(r)}>
                  {r.active ? 'Ativa' : 'Inativa'}
                </button>
              </td>
            </tr>
          ))}
          {routes.length === 0 && (
            <tr><td colSpan="4" className="empty-state">Nenhuma rota cadastrada.</td></tr>
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
          <tr><th>Nome</th><th>Telefone</th><th>Status</th></tr>
        </thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.contact_phone || '-'}</td>
              <td>
                <button className="secondary-button" onClick={() => toggleActive(c)}>
                  {c.active ? 'Ativo' : 'Inativo'}
                </button>
              </td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr><td colSpan="3" className="empty-state">Nenhum cliente cadastrado.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
