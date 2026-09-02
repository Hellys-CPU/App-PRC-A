import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import { useToast } from '../components/Toast.jsx';

const VEHICLE_TYPES = [
  { value: 'toco', label: 'Toco (1 placa)' },
  { value: '3/4', label: '3/4 (1 placa)' },
  { value: 'vuc', label: 'VUC (1 placa)' },
  { value: 'carreta', label: 'Carreta (2 placas)' },
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function typeLabelShort(value) {
  return VEHICLE_TYPES.find((t) => t.value === value)?.label.split(' (')[0] || value;
}

export default function AdminFrota() {
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ plate: '', plateReboque: '', vehicleType: 'toco', model: '', year: '', crlvValidade: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();

  useEffect(() => { loadVehicles(); }, []);

  const needsReboque = form.vehicleType === 'carreta';

  async function loadVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, plate_reboque, vehicle_type, model, year, crlv_validade, active')
      .order('plate');
    setVehicles(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (needsReboque && !form.plateReboque.trim()) {
      setMessage({ type: 'error', text: 'Carreta exige a placa do reboque.' });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('vehicles').insert({
      plate: form.plate.toUpperCase().trim(),
      plate_reboque: needsReboque ? form.plateReboque.toUpperCase().trim() : null,
      vehicle_type: form.vehicleType,
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
    setForm({ plate: '', plateReboque: '', vehicleType: 'toco', model: '', year: '', crlvValidade: '' });
    loadVehicles();
  }

  async function toggleActive(vehicle) {
    await supabase.from('vehicles').update({ active: !vehicle.active }).eq('id', vehicle.id);
    loadVehicles();
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Frota</h1>

      <form onSubmit={handleSubmit} className="motorista-form" style={{ marginBottom: 28 }}>
        <label>Tipo de veículo</label>
        <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
          {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <label>{needsReboque ? 'Placa do cavalo' : 'Placa'}</label>
        <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} required />

        {needsReboque && (
          <>
            <label>Placa do reboque/carreta</label>
            <input
              value={form.plateReboque}
              onChange={(e) => setForm({ ...form, plateReboque: e.target.value.toUpperCase() })}
              required
            />
          </>
        )}

        <label>Modelo</label>
        <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Ex: VW Delivery 9.170" />

        <label>Ano</label>
        <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />

        <label>Validade do CRLV</label>
        <input type="date" value={form.crlvValidade} onChange={(e) => setForm({ ...form, crlvValidade: e.target.value })} />

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
          <tr><th>Tipo</th><th>Placa(s)</th><th>Modelo</th><th>Ano</th><th>CRLV</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const days = daysUntil(v.crlv_validade);
            const expiring = days != null && days <= 30;
            return (
              <tr key={v.id}>
                <td>{typeLabelShort(v.vehicle_type)}</td>
                <td>{v.plate}{v.plate_reboque ? ` / ${v.plate_reboque}` : ''}</td>
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
                <td>
                  <button className="secondary-button" onClick={() => setEditingId(editingId === v.id ? null : v.id)}>
                    {editingId === v.id ? 'Fechar' : 'Editar'}
                  </button>
                </td>
              </tr>
            );
          })}
          {vehicles.length === 0 && (
            <tr><td colSpan="7" className="empty-state">Nenhum veículo cadastrado.</td></tr>
          )}
        </tbody>
      </table>

      {editingId && (
        <EditVehiclePanel
          vehicle={vehicles.find((v) => v.id === editingId)}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); loadVehicles(); }}
        />
      )}
    </div>
  );
}

function EditVehiclePanel({ vehicle, onClose, onSaved }) {
  const [form, setForm] = useState({
    vehicleType: vehicle.vehicle_type,
    plate: vehicle.plate,
    plateReboque: vehicle.plate_reboque || '',
    model: vehicle.model || '',
    year: vehicle.year || '',
    crlvValidade: vehicle.crlv_validade || '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const needsReboque = form.vehicleType === 'carreta';

  async function handleSave() {
    if (needsReboque && !form.plateReboque.trim()) {
      toast('Carreta exige a placa do reboque.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('vehicles').update({
      vehicle_type: form.vehicleType,
      plate: form.plate.toUpperCase().trim(),
      plate_reboque: needsReboque ? form.plateReboque.toUpperCase().trim() : null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      crlv_validade: form.crlvValidade || null,
    }).eq('id', vehicle.id);
    setSaving(false);

    if (error) {
      const msg = error.message.includes('duplicate') ? 'Já existe um veículo com esta placa.' : error.message;
      toast(msg, 'error');
      return;
    }
    toast('Veículo atualizado!', 'success');
    onSaved();
  }

  return (
    <div className="motorista-form" style={{ marginTop: 20, maxWidth: 460 }}>
      <h2 style={{ marginTop: 0 }}>Editando: {vehicle.plate}</h2>

      <label>Tipo de veículo</label>
      <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
        {VEHICLE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <label>{needsReboque ? 'Placa do cavalo' : 'Placa'}</label>
      <input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} />

      {needsReboque && (
        <>
          <label>Placa do reboque/carreta</label>
          <input value={form.plateReboque} onChange={(e) => setForm({ ...form, plateReboque: e.target.value.toUpperCase() })} />
        </>
      )}

      <label>Modelo</label>
      <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />

      <label>Ano</label>
      <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />

      <label>Validade do CRLV</label>
      <input type="date" value={form.crlvValidade} onChange={(e) => setForm({ ...form, crlvValidade: e.target.value })} />

      <div className="trip-actions" style={{ marginTop: 16 }}>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>
    </div>
  );
}
