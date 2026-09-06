import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
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
  const [maintenanceId, setMaintenanceId] = useState(null);
  const toast = useToast();

  useEffect(() => { loadVehicles(); }, []);

  const needsReboque = form.vehicleType === 'carreta';

  async function loadVehicles() {
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate, plate_reboque, vehicle_type, model, year, crlv_validade, active, current_odometer_km')
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
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
        Veículos cadastrados, tipo (toco/3-4/VUC/carreta) e validade do CRLV.
      </p>

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
      <MobileTableReveal title="Frota" icon="🚚">
        <table className="admin-table">
        <thead>
          <tr><th>Tipo</th><th>Placa(s)</th><th>Modelo</th><th>Ano</th><th>KM Atual</th><th>CRLV</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {vehicles.map((v) => {
            const days = daysUntil(v.crlv_validade);
            const expiring = days != null && days <= 30;
            return (
              <tr key={v.id}>
                <td>{typeLabelShort(v.vehicle_type)}</td>
                <td className="mono-data">{v.plate}{v.plate_reboque ? ` / ${v.plate_reboque}` : ''}</td>
                <td>{v.model || '-'}</td>
                <td>{v.year || '-'}</td>
                <td className="mono-data">{v.current_odometer_km != null ? `${v.current_odometer_km.toLocaleString('pt-BR')} km` : '-'}</td>
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
                  <button
                    className="secondary-button"
                    style={{ marginLeft: 6 }}
                    onClick={() => setMaintenanceId(maintenanceId === v.id ? null : v.id)}
                  >
                    🔧 Manutenção
                  </button>
                </td>
              </tr>
            );
          })}
          {vehicles.length === 0 && (
            <tr><td colSpan="8" className="empty-state">Nenhum veículo cadastrado.</td></tr>
          )}
        </tbody>
        </table>
      </MobileTableReveal>

      {editingId && (
        <EditVehiclePanel
          vehicle={vehicles.find((v) => v.id === editingId)}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); loadVehicles(); }}
        />
      )}

      {maintenanceId && (
        <MaintenancePanel
          vehicle={vehicles.find((v) => v.id === maintenanceId)}
          onClose={() => setMaintenanceId(null)}
          onSaved={loadVehicles}
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

const SERVICE_TYPES = [
  { value: 'troca_oleo', label: 'Troca de óleo' },
  { value: 'revisao', label: 'Revisão geral' },
  { value: 'pneu', label: 'Pneu' },
  { value: 'freio', label: 'Freio' },
  { value: 'outro', label: 'Outro' },
];

function MaintenancePanel({ vehicle, onClose, onSaved }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    serviceType: 'troca_oleo',
    odometerKm: vehicle.current_odometer_km || '',
    serviceDate: new Date().toISOString().slice(0, 10),
    nextServiceKm: '',
    nextServiceDate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => { loadHistory(); }, []);

  async function loadHistory() {
    const { data } = await supabase
      .from('vehicle_maintenance')
      .select('*')
      .eq('vehicle_id', vehicle.id)
      .order('service_date', { ascending: false });
    setHistory(data || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from('vehicle_maintenance').insert({
      vehicle_id: vehicle.id,
      service_type: form.serviceType,
      odometer_km: form.odometerKm ? Number(form.odometerKm) : null,
      service_date: form.serviceDate,
      next_service_km: form.nextServiceKm ? Number(form.nextServiceKm) : null,
      next_service_date: form.nextServiceDate || null,
      notes: form.notes || null,
      created_by: userData?.user?.id,
    });

    if (!error && form.odometerKm) {
      await supabase.from('vehicles').update({ current_odometer_km: Number(form.odometerKm) }).eq('id', vehicle.id);
    }

    setSaving(false);

    if (error) {
      toast('Erro ao registrar: ' + error.message, 'error');
      return;
    }

    toast('Manutenção registrada!', 'success');
    setForm({ ...form, notes: '', nextServiceKm: '', nextServiceDate: '' });
    loadHistory();
    onSaved?.();
  }

  const nextService = history.find((h) => h.next_service_km || h.next_service_date);
  const kmUntilNext = nextService?.next_service_km && vehicle.current_odometer_km
    ? nextService.next_service_km - vehicle.current_odometer_km
    : null;

  return (
    <div className="motorista-form" style={{ marginTop: 20, maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Manutenção: {vehicle.plate}</h2>

      {nextService && (
        <p className={`subtitle`} style={{ textAlign: 'left', marginBottom: 16, color: kmUntilNext != null && kmUntilNext <= 1000 ? 'var(--alert)' : 'var(--text-dim)' }}>
          Próxima revisão: {nextService.next_service_km ? `${nextService.next_service_km.toLocaleString('pt-BR')} km` : ''}
          {nextService.next_service_date ? ` até ${new Date(nextService.next_service_date).toLocaleDateString('pt-BR')}` : ''}
          {kmUntilNext != null && ` (faltam ${kmUntilNext.toLocaleString('pt-BR')} km)`}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <label>Tipo de serviço</label>
        <select value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })}>
          {SERVICE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <label>Km no momento do serviço</label>
        <input type="number" value={form.odometerKm} onChange={(e) => setForm({ ...form, odometerKm: e.target.value })} />

        <label>Data do serviço</label>
        <input type="date" value={form.serviceDate} onChange={(e) => setForm({ ...form, serviceDate: e.target.value })} />

        <label>Próxima revisão — km (opcional)</label>
        <input type="number" value={form.nextServiceKm} onChange={(e) => setForm({ ...form, nextServiceKm: e.target.value })} />

        <label>Próxima revisão — data (opcional)</label>
        <input type="date" value={form.nextServiceDate} onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })} />

        <label>Observações</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />

        <button type="submit" className="primary-button" disabled={saving} style={{ marginTop: 10 }}>
          {saving ? 'Salvando...' : 'Registrar Manutenção'}
        </button>
      </form>

      <h2>Histórico</h2>
      {loading && <p className="empty-state">Carregando...</p>}
      <table className="admin-table">
        <thead>
          <tr><th>Data</th><th>Serviço</th><th>Km</th><th>Obs.</th></tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id}>
              <td>{new Date(h.service_date).toLocaleDateString('pt-BR')}</td>
              <td>{SERVICE_TYPES.find((s) => s.value === h.service_type)?.label || h.service_type}</td>
              <td className="mono-data">{h.odometer_km != null ? `${h.odometer_km.toLocaleString('pt-BR')} km` : '-'}</td>
              <td>{h.notes || '-'}</td>
            </tr>
          ))}
          {history.length === 0 && !loading && (
            <tr><td colSpan="4" className="empty-state">Nenhuma manutenção registrada ainda.</td></tr>
          )}
        </tbody>
      </table>

      <div className="trip-actions" style={{ marginTop: 16 }}>
        <button className="secondary-button" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}
