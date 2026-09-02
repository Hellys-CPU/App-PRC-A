import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function AdminNovaViagem() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({
    driverId: '', origin: '', destination: '',
    clientName: '', cargoDescription: '', freightValue: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { loadDrivers(); }, []);

  async function loadDrivers() {
    const { data } = await supabase
      .from('drivers')
      .select('id, vehicle_plate, active, profiles(full_name)')
      .eq('active', true);
    setDrivers(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!form.driverId) {
      setMessage({ type: 'error', text: 'Selecione um motorista.' });
      setSaving(false);
      return;
    }

    const { data: existing } = await supabase
      .from('trips')
      .select('id')
      .eq('driver_id', form.driverId)
      .in('status', ['assigned', 'in_progress'])
      .maybeSingle();

    if (existing) {
      setMessage({ type: 'error', text: 'Este motorista já possui uma viagem em aberto.' });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('trips').insert({
      driver_id: form.driverId,
      origin: form.origin,
      destination: form.destination,
      client_name: form.clientName || null,
      cargo_description: form.cargoDescription || null,
      freight_value: form.freightValue ? Number(form.freightValue) : null,
      status: 'assigned',
    });

    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: 'Erro ao criar viagem: ' + error.message });
      return;
    }

    setMessage({ type: 'success', text: 'Viagem atribuída com sucesso!' });
    setForm({ driverId: '', origin: '', destination: '', clientName: '', cargoDescription: '', freightValue: '' });
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h1>Nova Viagem</h1>
      </header>

      <form onSubmit={handleSubmit} className="motorista-form">
        <label>Motorista</label>
        <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required>
          <option value="">Selecione um motorista</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.profiles?.full_name} — {d.vehicle_plate}</option>
          ))}
        </select>

        <label>Origem</label>
        <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required />

        <label>Destino</label>
        <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />

        <label>Cliente</label>
        <input
          value={form.clientName}
          onChange={(e) => setForm({ ...form, clientName: e.target.value })}
          placeholder="Nome do cliente/destinatário da carga"
        />

        <label>Descrição da carga</label>
        <input
          value={form.cargoDescription}
          onChange={(e) => setForm({ ...form, cargoDescription: e.target.value })}
          placeholder="Ex: 12 paletes de eletrônicos"
        />

        <label>Valor do frete (R$)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.freightValue}
          onChange={(e) => setForm({ ...form, freightValue: e.target.value })}
          placeholder="0,00"
        />

        {message && (
          <p className={message.type === 'error' ? 'error-text' : 'success-text'}>{message.text}</p>
        )}

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Atribuindo...' : 'Atribuir Viagem'}
        </button>
      </form>
    </div>
  );
}
