import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function AdminNovaViagem() {
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ driverId: '', origin: '', destination: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadDrivers();
  }, []);

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

    // Verifica se o motorista já tem viagem em aberto (atribuída ou em andamento)
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
      status: 'assigned',
    });

    setSaving(false);

    if (error) {
      setMessage({ type: 'error', text: 'Erro ao criar viagem: ' + error.message });
      return;
    }

    setMessage({ type: 'success', text: 'Viagem atribuída com sucesso!' });
    setForm({ driverId: '', origin: '', destination: '' });
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h1>Nova Viagem</h1>
      </header>

      <form onSubmit={handleSubmit} className="motorista-form">
        <label>Motorista</label>
        <select
          value={form.driverId}
          onChange={(e) => setForm({ ...form, driverId: e.target.value })}
          required
        >
          <option value="">Selecione um motorista</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.profiles?.full_name} — {d.vehicle_plate}
            </option>
          ))}
        </select>

        <label>Origem</label>
        <input
          value={form.origin}
          onChange={(e) => setForm({ ...form, origin: e.target.value })}
          required
        />

        <label>Destino</label>
        <input
          value={form.destination}
          onChange={(e) => setForm({ ...form, destination: e.target.value })}
          required
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
