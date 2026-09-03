import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useToast } from './Toast.jsx';

export default function NewTripModal({ onClose, onCreated }) {
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    driverId: '', routeId: '', origin: '', destination: '',
    clientId: '', cargoDescription: '', freightValue: '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { loadDrivers(); loadRoutes(); loadClients(); }, []);

  async function loadDrivers() {
    const { data } = await supabase
      .from('drivers')
      .select('id, vehicle_plate, active, profiles(full_name)')
      .eq('active', true);
    setDrivers(data || []);
  }
  async function loadRoutes() {
    const { data } = await supabase.from('routes').select('*').eq('active', true).order('code');
    setRoutes(data || []);
  }
  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').eq('active', true).order('name');
    setClients(data || []);
  }

  function handleRouteChange(routeId) {
    const route = routes.find((r) => r.id === routeId);
    setForm({
      ...form,
      routeId,
      origin: route ? route.origin : form.origin,
      destination: route ? route.destination : form.destination,
      freightValue: route?.default_freight_value != null ? String(route.default_freight_value) : form.freightValue,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.driverId) {
      toast('Selecione um motorista.', 'error');
      return;
    }
    setSaving(true);

    const { data: existing } = await supabase
      .from('trips')
      .select('id')
      .eq('driver_id', form.driverId)
      .in('status', ['assigned', 'in_progress'])
      .maybeSingle();

    if (existing) {
      setSaving(false);
      toast('Este motorista já possui uma viagem em aberto.', 'error');
      return;
    }

    const selectedClient = clients.find((c) => c.id === form.clientId);

    const { error } = await supabase.from('trips').insert({
      driver_id: form.driverId,
      route_id: form.routeId || null,
      origin: form.origin,
      destination: form.destination,
      client_id: form.clientId || null,
      client_name: selectedClient ? selectedClient.name : null,
      cargo_description: form.cargoDescription || null,
      freight_value: form.freightValue ? Number(form.freightValue) : null,
      status: 'assigned',
    });

    setSaving(false);

    if (error) {
      toast('Erro ao criar viagem: ' + error.message, 'error');
      return;
    }

    toast('Viagem atribuída com sucesso!', 'success');
    onCreated?.();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0 }}>Nova Viagem</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="motorista-form" style={{ border: 'none', padding: 0 }}>
          <label>Motorista</label>
          <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} required>
            <option value="">Selecione um motorista</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.profiles?.full_name} — {d.vehicle_plate}</option>
            ))}
          </select>

          <label>Rota cadastrada (opcional)</label>
          <select value={form.routeId} onChange={(e) => handleRouteChange(e.target.value)}>
            <option value="">Sem rota cadastrada — preencher manualmente</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.code} — {r.origin} → {r.destination}</option>
            ))}
          </select>

          <label>Origem</label>
          <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} required />

          <label>Destino</label>
          <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />

          <label>Cliente</label>
          <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            <option value="">Sem cliente cadastrado</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

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

          <div className="trip-actions" style={{ marginTop: 6 }}>
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? 'Criando...' : 'Criar Viagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
