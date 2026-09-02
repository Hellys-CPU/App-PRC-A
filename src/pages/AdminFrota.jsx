import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function AdminFrota() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ plate: '', model: '', year: '', crlvValidade: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadVehicles(); }, []);

  async function loadVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, model, year, crlv_validade, active')
      .order('plate');
    setVehicles(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const { error } = await supabase.from('vehicles').insert({
      plate: form.plate.toUpperCase().trim(),
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      crlv_validade: form.crlvValidade || null,
    });

    setSaving(false);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe um veículo com esta placa.' : error.message;
      setMessage({ type: 'error', text: msg });
      return;
    }

    setMessage({ type: 'success', text: 'Veículo cadastrado na frota!' });
    setForm({ plate: '', model: '', year: '', crlvValidade: '' });
    loadVehicles();
  }

  async function toggleActive(vehicle) {
    await supabase.from('vehicles').update({ active: !vehicle.active }).eq('id', vehicle.id);
    loadVehicles();
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h1>Frota</h1>
      </header>

      <form onSubmit={handleSubmit} className="motorista-form" style={{ marginBottom: 28 }}>
        <label>Placa</label>
        <input
          value={form.plate}
          onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })}
          required
        />

        <label>Modelo</label>
        <input
          value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })}
          placeholder="Ex: VW Delivery 9.170"
        />

        <label>Ano</label>
        <input
          type="number"
          value={form.year}
          onChange={(e) => setForm({ ...form, year: e.target.value })}
        />

        <label>Validade do CRLV</label>
        <input
          type="date"
          value={form.crlvValidade}
          onChange={(e) => setForm({ ...form, crlvValidade: e.target.value })}
        />

        {message && (
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>{message.text}</p>
        )}

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Salvando...' : 'Adicionar Veículo'}
        </button>
      </form>

      <h2>Veículos Cadastrados</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Placa</th><th>Modelo</th><th>Ano</th><th>CRLV</th><th>Status</th></tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const days = daysUntil(v.crlv_validade);
            const expiring = days != null && days <= 30;
            return (
              <tr key={v.id}>
                <td>{v.plate}</td>
                <td>{v.model || '-'}</td>
                <td>{v.year || '-'}</td>
                <td style={expiring ? { color: 'var(--alert)', fontWeight: 700 } : undefined}>
                  {v.crlv_validade ? new Date(v.crlv_validade).toLocaleDateString('pt-BR') : '-'}
                  {expiring && days >= 0 && ` (${days}d)`}
                  {expiring && days < 0 && ' (vencido)'}
                </td>
                <td>
                  <button className="secondary-button" onClick={() => toggleActive(v)}>
                    {v.active ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
              </tr>
            );
          })}
          {vehicles.length === 0 && (
            <tr><td colSpan="5" className="empty-state">Nenhum veículo cadastrado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
