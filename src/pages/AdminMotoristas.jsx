import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function AdminMotoristas() {
  const [form, setForm] = useState({ fullName: '', phone: '', plate: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

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

    setMessage({ type: 'success', text: `Motorista cadastrado! Login (telefone): ${data.loginPhone}` });
    setForm({ fullName: '', phone: '', plate: '', password: '' });
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h1>Novo Motorista</h1>
      </header>

      <form onSubmit={handleSubmit} className="motorista-form">
        <label>Nome completo</label>
        <input
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />

        <label>Telefone / WhatsApp</label>
        <input
          type="tel"
          placeholder="Ex: 11999998888"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />

        <label>Placa do veículo</label>
        <input
          value={form.plate}
          onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
          required
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

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Cadastrando...' : 'Cadastrar Motorista'}
        </button>
      </form>
    </div>
  );
}
