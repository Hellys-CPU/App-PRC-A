import React, { useMemo, useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const STAGE_LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

const COLOR_AMBER = '#f46101';
const COLOR_ROUTE = '#2fae6f';
const COLOR_ALERT = '#e0393f';
const COLOR_ASSIGNED = '#4f80b8';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function AdminRelatorios() {
  const [start, setStart] = useState(firstDayOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);

    const startDate = new Date(start + 'T00:00:00');
    const endDate = new Date(end + 'T23:59:59');

    const { data } = await supabase
      .from('trips')
      .select(`
        id, origin, destination, status, created_at, client_name, cargo_description, freight_value,
        planned_apresentacao_at,
        drivers ( vehicle_plate, profiles ( full_name ) ),
        routes ( planned_saida_after_hours, planned_chegada_after_hours ),
        trip_stages ( status, recorded_at )
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    setTrips(data || []);
    setLoading(false);
  }

  const totalFreight = trips.reduce((sum, t) => sum + (Number(t.freight_value) || 0), 0);
  const completedCount = trips.filter((t) => t.status === 'completed').length;

  function formatCurrency(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Calcula planejado (apresentação/saída/chegada) igual ao Painel: apresentação
  // vem da viagem, saída/chegada somam a duração cadastrada na rota.
  function computePlanned(trip) {
    if (!trip.planned_apresentacao_at) return null;
    const apresentacao = new Date(trip.planned_apresentacao_at);
    const saidaHours = Number(trip.routes?.planned_saida_after_hours) || 0;
    const chegadaHours = Number(trip.routes?.planned_chegada_after_hours) || 0;
    const saida = new Date(apresentacao.getTime() + saidaHours * 3600000);
    const chegada = new Date(saida.getTime() + chegadaHours * 3600000);
    return { apresentacao_base_origem: apresentacao, saida_base_origem: saida, chegada_base_destino: chegada };
  }

  // ---------- Dados dos gráficos ----------
  const revenueByDay = useMemo(() => {
    const map = {};
    trips.forEach((t) => {
      const day = new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      map[day] = (map[day] || 0) + (Number(t.freight_value) || 0);
    });
    return Object.entries(map).map(([day, total]) => ({ day, total }));
  }, [trips]);

  const statusData = useMemo(() => {
    const assigned = trips.filter((t) => t.status === 'assigned').length;
    const inProgress = trips.filter((t) => t.status === 'in_progress').length;
    const completed = trips.filter((t) => t.status === 'completed').length;
    return [
      { name: 'Atribuídas', value: assigned, color: COLOR_ASSIGNED },
      { name: 'Em andamento', value: inProgress, color: COLOR_AMBER },
      { name: 'Finalizadas', value: completed, color: COLOR_ROUTE },
    ].filter((d) => d.value > 0);
  }, [trips]);

  const punctualityByStage = useMemo(() => {
    const types = [
      { key: 'apresentacao_base_origem', label: 'Apresentação' },
      { key: 'saida_base_origem', label: 'Saída' },
      { key: 'chegada_base_destino', label: 'Chegada' },
    ];
    return types.map(({ key, label }) => {
      let onTime = 0, late = 0;
      trips.forEach((t) => {
        const planned = computePlanned(t);
        if (!planned?.[key]) return;
        const stage = (t.trip_stages || []).find((s) => s.status === key);
        if (!stage) return;
        if (new Date(stage.recorded_at) <= planned[key]) onTime++; else late++;
      });
      return { label, 'No horário': onTime, 'Atrasada': late };
    }).filter((d) => d['No horário'] + d['Atrasada'] > 0);
  }, [trips]);

  const driverPunctuality = useMemo(() => {
    const map = {};
    trips.forEach((t) => {
      const planned = computePlanned(t);
      if (!planned?.apresentacao_base_origem) return;
      const stage = (t.trip_stages || []).find((s) => s.status === 'apresentacao_base_origem');
      if (!stage) return;
      const name = t.drivers?.profiles?.full_name || 'Motorista';
      if (!map[name]) map[name] = { name, onTime: 0, total: 0 };
      map[name].total += 1;
      if (new Date(stage.recorded_at) <= planned.apresentacao_base_origem) map[name].onTime += 1;
    });
    return Object.values(map)
      .map((d) => ({ ...d, pct: Math.round((d.onTime / d.total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [trips]);

  function exportCsv() {
    const headers = ['Data', 'Motorista', 'Placa', 'Cliente', 'Origem', 'Destino', 'Carga', 'Frete (R$)', 'Status', 'Última Etapa'];
    const rows = trips.map((t) => {
      const stages = [...(t.trip_stages || [])].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
      const last = stages[stages.length - 1];
      return [
        new Date(t.created_at).toLocaleDateString('pt-BR'),
        t.drivers?.profiles?.full_name || '-',
        t.drivers?.vehicle_plate || '-',
        t.client_name || '-',
        t.origin || '-',
        t.destination || '-',
        t.cargo_description || '-',
        t.freight_value != null ? Number(t.freight_value).toFixed(2).replace('.', ',') : '-',
        t.status === 'completed' ? 'Finalizada' : t.status === 'in_progress' ? 'Em andamento' : 'Atribuída',
        last ? `${STAGE_LABELS[last.status] || last.status} (${new Date(last.recorded_at).toLocaleString('pt-BR')})` : '-',
      ];
    });

    const csvLines = [headers, ...rows].map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
    );
    const csvContent = '\uFEFF' + csvLines.join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prc-relatorio-viagens-${start}-a-${end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Relatórios</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 20 }}>
        Faturamento, status das viagens e pontualidade — comparando planejado x real.
      </p>

      <form onSubmit={handleSearch} className="trips-toolbar" style={{ alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>De</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ flex: 'none' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, color: 'var(--text-dim)' }}>Até</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ flex: 'none' }} />
        </div>
        <button type="submit" className="primary-button" style={{ width: 'auto', padding: '10px 20px' }} disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
        {trips.length > 0 && (
          <button type="button" className="secondary-button" onClick={exportCsv}>
            Exportar CSV (Excel)
          </button>
        )}
      </form>

      {searched && !loading && (
        <>
          <div className="cards" style={{ marginBottom: 24 }}>
            <div className="card"><h3>{trips.length}</h3><p>Viagens no Período</p></div>
            <div className="card"><h3>{completedCount}</h3><p>Finalizadas</p></div>
            <div className="card"><h3>{formatCurrency(totalFreight)}</h3><p>Faturamento (Frete)</p></div>
          </div>

          {trips.length === 0 ? (
            <p className="empty-state">Nenhuma viagem no período selecionado.</p>
          ) : (
            <>
              <h2>Análise</h2>
              <div className="report-charts-grid">
                <div className="report-chart-card">
                  <h3 className="report-chart-title">Faturamento por Dia</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={revenueByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="day" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }}
                        formatter={(v) => formatCurrency(v)}
                      />
                      <Bar dataKey="total" fill={COLOR_AMBER} name="Frete" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="report-chart-card">
                  <h3 className="report-chart-title">Viagens por Status</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                        {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="report-chart-card report-chart-wide">
                  <h3 className="report-chart-title">Pontualidade por Etapa (planejado x real)</h3>
                  {punctualityByStage.length === 0 ? (
                    <p className="empty-state">Nenhuma viagem no período tem horário planejado cadastrado ainda.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={punctualityByStage}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                        <Bar dataKey="No horário" stackId="a" fill={COLOR_ROUTE} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Atrasada" stackId="a" fill={COLOR_ALERT} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {driverPunctuality.length > 0 && (
                <>
                  <h2>Pontualidade por Motorista (Apresentação)</h2>
                  <MobileTableReveal title="Pontualidade por Motorista">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Motorista</th><th>No horário</th><th>Total medido</th><th>% Pontualidade</th></tr>
                    </thead>
                    <tbody>
                      {driverPunctuality.map((d) => (
                        <tr key={d.name}>
                          <td>{d.name}</td>
                          <td>{d.onTime}</td>
                          <td>{d.total}</td>
                          <td style={{ color: d.pct >= 80 ? 'var(--route)' : d.pct >= 50 ? 'var(--amber)' : 'var(--alert)', fontWeight: 700 }}>
                            {d.pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </MobileTableReveal>
                </>
              )}
            </>
          )}

          <h2>Viagens do Período</h2>
          <MobileTableReveal title="Viagens do Período" offset={70}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data</th><th>Motorista</th><th>Cliente</th><th>Rota</th><th>Frete</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{t.drivers?.profiles?.full_name || '-'}</td>
                  <td>{t.client_name || '-'}</td>
                  <td>{t.origin} → {t.destination}</td>
                  <td>{t.freight_value != null ? formatCurrency(Number(t.freight_value)) : '-'}</td>
                  <td>{t.status === 'completed' ? 'Finalizada' : t.status === 'in_progress' ? 'Em andamento' : 'Atribuída'}</td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr><td colSpan="6" className="empty-state">Nenhuma viagem no período selecionado.</td></tr>
              )}
            </tbody>
          </table>
          </MobileTableReveal>
        </>
      )}
    </div>
  );
}
