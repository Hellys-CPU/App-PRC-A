import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';

export default function AdminMotoristas() {
  const [form, setForm] = useState({
    fullName: '', cpf: '', phone: '', vehicleId: '',
    cnhNumero: '', cnhCategoria: '', cnhValidade: '', password: '',
  });
  const [vehicles, setVehicles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, model')
      .eq('active', true)
      .order('plate');
    setVehicles(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const { data, error } = await supabase.functions.invoke('create-driver', {
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });

    setSaving(false);

    if (error || data?.error) {
      setMessage({ type: 'error', text: data?.error || error.message });
      return;
    }

    setMessage({ type: 'success', text: `Motorista cadastrado! Login (CPF): ${data.loginCpf}` });
    setForm({ fullName: '', cpf: '', phone: '', vehicleId: '', cnhNumero: '', cnhCategoria: '', cnhValidade: '', password: '' });
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Novo Motorista</h1>

      {vehicles.length === 0 && (
        <p className="error-text">
          Nenhum veículo ativo na frota ainda. Cadastre um veículo em "Frota" antes de criar o motorista.
        </p>
      )}

      <form onSubmit={handleSubmit} className="motorista-form">
        <label>Nome completo</label>
        <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />

        <label>CPF (será o login do motorista)</label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Somente números"
          value={form.cpf}
          onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
          maxLength={11}
          required
        />

        <label>Telefone / WhatsApp (opcional, para contato)</label>
        <input
          type="tel"
          placeholder="Ex: 11999998888"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
        />

        <label>Veículo da frota</label>
        <select
          value={form.vehicleId}
          onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
          required
        >
          <option value="">Selecione um veículo</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.plate} {v.model ? `— ${v.model}` : ''}</option>
          ))}
        </select>

        <label>Número da CNH</label>
        <input value={form.cnhNumero} onChange={(e) => setForm({ ...form, cnhNumero: e.target.value })} />

        <label>Categoria da CNH</label>
        <input
          placeholder="Ex: D, E"
          value={form.cnhCategoria}
          onChange={(e) => setForm({ ...form, cnhCategoria: e.target.value.toUpperCase() })}
        />

        <label>Validade da CNH</label>
        <input
          type="date"
          value={form.cnhValidade}
          onChange={(e) => setForm({ ...form, cnhValidade: e.target.value })}
        />

        <label>Senha de acesso (defina uma senha simples para o motorista)</label>
        <input
          type="text"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={6}
        />

        {message && (
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>{message.text}</p>
        )}

        <button type="submit" className="primary-button" disabled={saving || vehicles.length === 0}>
          {saving ? 'Cadastrando...' : 'Cadastrar Motorista'}
        </button>
      </form>
    </div>
  );
}
