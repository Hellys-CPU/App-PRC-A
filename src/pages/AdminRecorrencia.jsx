import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
import { useToast } from '../components/Toast.jsx';

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function AdminRecorrencia() {
  const [templates, setTemplates] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ routeId: '', driverId: '', weekday: '1', plannedTime: '' });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{ data: t }, { data: r }, { data: d }] = await Promise.all([
      supabase.from('recurring_trip_templates').select('*, routes(code, origin, destination), drivers(vehicle_plate, profiles(full_name))').order('weekday'),
      supabase.from('routes').select('id, code, origin, destination, default_freight_value, driver_payout_value').eq('active', true),
      supabase.from('drivers').select('id, vehicle_plate, profiles(full_name)').eq('active', true),
    ]);
    setTemplates(t || []);
    setRoutes(r || []);
    setDrivers(d || []);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.routeId) {
      toast('Escolha uma rota.', 'error');
      return;
    }
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('recurring_trip_templates').insert({
      route_id: form.routeId,
      driver_id: form.driverId || null,
      weekday: Number(form.weekday),
      planned_apresentacao_time: form.plannedTime || null,
      created_by: userData.user.id,
    });

    setSaving(false);

    if (error) {
      toast('Erro: ' + error.message, 'error');
      return;
    }
    toast('Recorrência criada!', 'success');
    setForm({ routeId: '', driverId: '', weekday: '1', plannedTime: '' });
    loadAll();
  }

  async function toggleActive(tpl) {
    await supabase.from('recurring_trip_templates').update({ active: !tpl.active }).eq('id', tpl.id);
    loadAll();
  }

  async function removeTemplate(id) {
    await supabase.from('recurring_trip_templates').delete().eq('id', id);
    loadAll();
  }

  // Gera as viagens dos próximos 7 dias, uma por template ativo, no dia da
  // semana configurado. Não duplica se já tiver sido gerada (checa por rota+data).
  async function generateNextWeek() {
    setGenerating(true);
    const active = templates.filter((t) => t.active);
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const weekday = date.getDay();
      const dateStr = date.toISOString().slice(0, 10);

      for (const tpl of active) {
        if (tpl.weekday !== weekday) continue;

        const { data: existing } = await supabase
          .from('trips')
          .select('id')
          .eq('route_id', tpl.route_id)
          .eq('scheduled_date', dateStr)
          .maybeSingle();

        if (existing) { skipped++; continue; }
        if (!tpl.driver_id) { skipped++; continue; }

        const route = routes.find((r) => r.id === tpl.route_id);
        let plannedAt = null;
        if (tpl.planned_apresentacao_time) {
          plannedAt = new Date(`${dateStr}T${tpl.planned_apresentacao_time}`).toISOString();
        }

        const { error } = await supabase.from('trips').insert({
          driver_id: tpl.driver_id,
          route_id: tpl.route_id,
          origin: route?.origin || tpl.routes?.origin,
          destination: route?.destination || tpl.routes?.destination,
          freight_value: route?.default_freight_value,
          scheduled_date: dateStr,
          planned_apresentacao_at: plannedAt,
          status: 'assigned',
        });

        if (error) skipped++; else created++;
      }
    }

    setGenerating(false);
    toast(`${created} viagem(ns) criada(s), ${skipped} pulada(s) (já existiam ou sem motorista).`, created > 0 ? 'success' : 'error');
    navigate('/');
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Programação Recorrente</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 24 }}>
        Cadastre "toda segunda, rota X" uma vez. Depois é só gerar as viagens da semana com um clique.
      </p>

      <form onSubmit={handleCreate} className="motorista-form" style={{ marginBottom: 28 }}>
        <label>Rota</label>
        <select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} required>
          <option value="">Selecione</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.code} ({r.origin} → {r.destination})</option>)}
        </select>

        <label>Motorista (opcional — pode definir depois)</label>
        <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
          <option value="">Sem motorista fixo</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.profiles?.full_name} — {d.vehicle_plate}</option>)}
        </select>

        <label>Dia da semana</label>
        <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>
          {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
        </select>

        <label>Horário de apresentação (opcional)</label>
        <input type="time" value={form.plannedTime} onChange={(e) => setForm({ ...form, plannedTime: e.target.value })} />

        <button type="submit" className="primary-button" disabled={saving} style={{ marginTop: 10 }}>
          {saving ? 'Salvando...' : 'Criar Recorrência'}
        </button>
      </form>

      <div className="trip-actions" style={{ marginBottom: 20 }}>
        <button className="primary-button" onClick={generateNextWeek} disabled={generating || templates.every((t) => !t.active)}>
          {generating ? 'Gerando...' : '⚡ Gerar Viagens dos Próximos 7 Dias'}
        </button>
      </div>

      <h2>Recorrências Cadastradas</h2>
      <MobileTableReveal title="Recorrências">
        <table className="admin-table">
          <thead>
            <tr><th>Dia</th><th>Rota</th><th>Motorista</th><th>Horário</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {templates.map((tpl) => (
              <tr key={tpl.id}>
                <td>{WEEKDAYS[tpl.weekday]}</td>
                <td className="mono-data">{tpl.routes?.code}</td>
                <td>{tpl.drivers?.profiles?.full_name || 'A definir'}</td>
                <td>{tpl.planned_apresentacao_time?.slice(0, 5) || '-'}</td>
                <td>
                  <button className="secondary-button" onClick={() => toggleActive(tpl)}>
                    {tpl.active ? 'Ativa' : 'Pausada'}
                  </button>
                </td>
                <td>
                  <button className="secondary-button" onClick={() => removeTemplate(tpl.id)}>Excluir</button>
                </td>
              </tr>
            ))}
            {templates.length === 0 && (
              <tr><td colSpan="6" className="empty-state">Nenhuma recorrência cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </MobileTableReveal>
    </div>
  );
}
