import React, { useMemo, useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
import { useToast } from '../components/Toast.jsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
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
const PIE_COLORS = [COLOR_AMBER, COLOR_ASSIGNED, COLOR_ROUTE, COLOR_ALERT, '#9d7fd4', '#4dc9c9'];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

// --- Cálculo de semana ISO (padrão internacional: semana começa na segunda) ---
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function getISOWeekRange(week, year) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const start = new Date(simple);
  if (dow <= 4) start.setUTCDate(simple.getUTCDate() - dow + 1);
  else start.setUTCDate(simple.getUTCDate() + 8 - dow);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const DIMENSIONS = [
  { key: 'motorista', label: 'Motorista' },
  { key: 'rota', label: 'Rota (origem → destino)' },
  { key: 'cliente', label: 'Cliente' },
  { key: 'status', label: 'Status' },
  { key: 'dia', label: 'Dia' },
];
const METRICS = [
  { key: 'count', label: 'Quantidade de viagens' },
  { key: 'frete', label: 'Soma do frete (cliente)' },
  { key: 'pagamento', label: 'Soma do pagamento ao motorista' },
];
const CHART_TYPES = [
  { key: 'bar', label: 'Barras' },
  { key: 'pie', label: 'Pizza' },
  { key: 'line', label: 'Linha' },
];

export default function AdminRelatorios() {
  const [mode, setMode] = useState('range'); // range | weeks | days | year
  const [start, setStart] = useState(firstDayOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [yearOnly, setYearOnly] = useState(new Date().getFullYear());
  const [weeksInput, setWeeksInput] = useState(String(getISOWeek(new Date())));
  const [weeksYear, setWeeksYear] = useState(new Date().getFullYear());
  const [specificDays, setSpecificDays] = useState([]);
  const [dayToAdd, setDayToAdd] = useState(todayISO());

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [pivotDimension, setPivotDimension] = useState('motorista');
  const [pivotMetric, setPivotMetric] = useState('count');
  const [pivotChart, setPivotChart] = useState('bar');
  const toast = useToast();

  function addSpecificDay() {
    if (!dayToAdd) return;
    if (specificDays.includes(dayToAdd)) return;
    setSpecificDays([...specificDays, dayToAdd].sort());
  }
  function removeSpecificDay(d) {
    setSpecificDays(specificDays.filter((x) => x !== d));
  }

  // Calcula o intervalo GERAL (pra consultar o banco de uma vez) e a função
  // que decide se uma data específica cai dentro do filtro escolhido.
  function resolveFilter() {
    if (mode === 'range') {
      return {
        queryStart: new Date(start + 'T00:00:00'),
        queryEnd: new Date(end + 'T23:59:59'),
        matches: () => true,
      };
    }
    if (mode === 'year') {
      return {
        queryStart: new Date(yearOnly, 0, 1, 0, 0, 0),
        queryEnd: new Date(yearOnly, 11, 31, 23, 59, 59),
        matches: () => true,
      };
    }
    if (mode === 'weeks') {
      const weekNumbers = weeksInput.split(',').map((w) => parseInt(w.trim(), 10)).filter(Boolean);
      const ranges = weekNumbers.map((w) => getISOWeekRange(w, Number(weeksYear)));
      if (ranges.length === 0) return null;
      const queryStart = new Date(Math.min(...ranges.map((r) => r.start.getTime())));
      const queryEnd = new Date(Math.max(...ranges.map((r) => r.end.getTime())));
      queryEnd.setHours(23, 59, 59);
      return {
        queryStart, queryEnd,
        matches: (d) => ranges.some((r) => d >= r.start && d <= r.end),
      };
    }
    if (mode === 'days') {
      if (specificDays.length === 0) return null;
      const dates = specificDays.map((d) => new Date(d + 'T00:00:00'));
      const queryStart = new Date(Math.min(...dates.map((d) => d.getTime())));
      const queryEnd = new Date(Math.max(...dates.map((d) => d.getTime())));
      queryEnd.setHours(23, 59, 59);
      return {
        queryStart, queryEnd,
        matches: (d) => dates.some((sd) => sameDay(sd, d)),
      };
    }
    return null;
  }

  async function handleSearch(e) {
    e?.preventDefault();
    const filter = resolveFilter();
    if (!filter) {
      toast('Preencha o filtro de data escolhido antes de buscar.', 'error');
      return;
    }

    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from('trips')
      .select(`
        id, origin, destination, status, created_at, client_name, cargo_description, freight_value,
        planned_apresentacao_at,
        drivers ( vehicle_plate, profiles ( full_name ) ),
        routes ( planned_saida_after_hours, planned_chegada_after_hours ),
        trip_stages ( status, recorded_at ),
        financial_entries ( entry_type, status, amount )
      `)
      .gte('created_at', filter.queryStart.toISOString())
      .lte('created_at', filter.queryEnd.toISOString())
      .order('created_at', { ascending: false });

    const filtered = (data || []).filter((t) => filter.matches(new Date(t.created_at)));
    setTrips(filtered);
    setLoading(false);
  }

  const totalFreight = trips.reduce((sum, t) => sum + (Number(t.freight_value) || 0), 0);
  const completedCount = trips.filter((t) => t.status === 'completed').length;

  function formatCurrency(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function computePlanned(trip) {
    if (!trip.planned_apresentacao_at) return null;
    const apresentacao = new Date(trip.planned_apresentacao_at);
    const saidaHours = Number(trip.routes?.planned_saida_after_hours) || 0;
    const chegadaHours = Number(trip.routes?.planned_chegada_after_hours) || 0;
    const saida = new Date(apresentacao.getTime() + saidaHours * 3600000);
    const chegada = new Date(saida.getTime() + chegadaHours * 3600000);
    return { apresentacao_base_origem: apresentacao, saida_base_origem: saida, chegada_base_destino: chegada };
  }

  // ---------- Cruzamento financeiro: viagem finalizada x cobrança do cliente ----------
  const financeSummary = useMemo(() => {
    const completed = trips.filter((t) => t.status === 'completed');
    let paidCount = 0, pendingCount = 0, noEntryCount = 0, paidValue = 0, pendingValue = 0;
    completed.forEach((t) => {
      const receivable = (t.financial_entries || []).find((f) => f.entry_type === 'receivable_client');
      if (!receivable) { noEntryCount++; return; }
      if (receivable.status === 'pago') { paidCount++; paidValue += Number(receivable.amount) || 0; }
      else { pendingCount++; pendingValue += Number(receivable.amount) || 0; }
    });
    return { total: completed.length, paidCount, pendingCount, noEntryCount, paidValue, pendingValue };
  }, [trips]);

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

  // ---------- Tabela dinâmica: dimensão x métrica escolhida pelo usuário ----------
  const pivotData = useMemo(() => {
    const map = {};
    trips.forEach((t) => {
      let key;
      if (pivotDimension === 'motorista') key = t.drivers?.profiles?.full_name || 'Sem motorista';
      else if (pivotDimension === 'rota') key = t.origin && t.destination ? `${t.origin} → ${t.destination}` : 'Sem rota';
      else if (pivotDimension === 'cliente') key = t.client_name || 'Sem cliente';
      else if (pivotDimension === 'status') key = t.status === 'completed' ? 'Finalizada' : t.status === 'in_progress' ? 'Em andamento' : 'Atribuída';
      else key = new Date(t.created_at).toLocaleDateString('pt-BR');

      if (!map[key]) map[key] = { name: key, count: 0, frete: 0, pagamento: 0 };
      map[key].count += 1;
      map[key].frete += Number(t.freight_value) || 0;
      const payable = (t.financial_entries || []).find((f) => f.entry_type === 'payable_driver');
      map[key].pagamento += Number(payable?.amount) || 0;
    });
    return Object.values(map).sort((a, b) => b[pivotMetric] - a[pivotMetric]).slice(0, 15);
  }, [trips, pivotDimension, pivotMetric]);

  const pivotMetricLabel = METRICS.find((m) => m.key === pivotMetric)?.label || '';
  const pivotValueFormatter = pivotMetric === 'count' ? (v) => v : (v) => formatCurrency(v);

  function exportPdf() {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(244, 97, 1);
    doc.text('PRC Transportes — Análise de Viagens', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 25);
    doc.text(`Viagens no período: ${trips.length}  |  Finalizadas: ${completedCount}  |  Faturamento: ${formatCurrency(totalFreight)}`, 14, 31);
    doc.text(
      `Cobrança: ${financeSummary.paidCount} pagas (${formatCurrency(financeSummary.paidValue)})  |  ${financeSummary.pendingCount} pendentes (${formatCurrency(financeSummary.pendingValue)})`,
      14, 37
    );

    autoTable(doc, {
      startY: 44,
      head: [['Data', 'Motorista', 'Cliente', 'Rota', 'Frete', 'Status']],
      body: trips.map((t) => [
        new Date(t.created_at).toLocaleDateString('pt-BR'),
        t.drivers?.profiles?.full_name || '-',
        t.client_name || '-',
        `${t.origin} → ${t.destination}`,
        t.freight_value != null ? formatCurrency(Number(t.freight_value)) : '-',
        t.status === 'completed' ? 'Finalizada' : t.status === 'in_progress' ? 'Em andamento' : 'Atribuída',
      ]),
      headStyles: { fillColor: [244, 97, 1] },
      styles: { fontSize: 8 },
    });

    doc.save(`prc-analise-${todayISO()}.pdf`);
  }

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
    link.download = `prc-analise-viagens.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Análise</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 20 }}>
        Faturamento, cobrança, pontualidade e uma tabela dinâmica pra você montar sua própria visão.
      </p>

      <form onSubmit={handleSearch} className="motorista-form" style={{ maxWidth: 640, marginBottom: 24 }}>
        <label>Tipo de período</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="range">Intervalo (de/até)</option>
          <option value="weeks">Semana(s) ISO</option>
          <option value="days">Dias específicos</option>
          <option value="year">Ano inteiro</option>
        </select>

        {mode === 'range' && (
          <div className="mass-batch-fields" style={{ marginTop: 4 }}>
            <div>
              <label>De</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label>Até</label>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        )}

        {mode === 'year' && (
          <>
            <label>Ano</label>
            <input type="number" value={yearOnly} onChange={(e) => setYearOnly(Number(e.target.value))} />
          </>
        )}

        {mode === 'weeks' && (
          <div className="mass-batch-fields" style={{ marginTop: 4 }}>
            <div>
              <label>Ano</label>
              <input type="number" value={weeksYear} onChange={(e) => setWeeksYear(Number(e.target.value))} />
            </div>
            <div>
              <label>Semanas ISO (separadas por vírgula)</label>
              <input type="text" placeholder="Ex: 34, 35, 36" value={weeksInput} onChange={(e) => setWeeksInput(e.target.value)} />
            </div>
          </div>
        )}

        {mode === 'days' && (
          <>
            <label>Adicionar dia</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input type="date" value={dayToAdd} onChange={(e) => setDayToAdd(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="secondary-button" onClick={addSpecificDay}>+ Adicionar</button>
            </div>
            {specificDays.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {specificDays.map((d) => (
                  <span key={d} className="chip-removable">
                    {new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')}
                    <button type="button" onClick={() => removeSpecificDay(d)}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        <div className="trip-actions" style={{ marginTop: 10 }}>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          {trips.length > 0 && (
            <button type="button" className="secondary-button" onClick={exportCsv}>
              Exportar CSV
            </button>
          )}
          {trips.length > 0 && (
            <button type="button" className="secondary-button" onClick={exportPdf}>
              📄 Exportar PDF
            </button>
          )}
        </div>
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
              <h2>Cobrança do Cliente (viagens finalizadas)</h2>
              <div className="cards" style={{ marginBottom: 28 }}>
                <div className="card">
                  <h3 style={{ color: 'var(--route)' }}>{financeSummary.paidCount}</h3>
                  <p>Pagas — {formatCurrency(financeSummary.paidValue)}</p>
                </div>
                <div className="card">
                  <h3 style={{ color: 'var(--alert)' }}>{financeSummary.pendingCount}</h3>
                  <p>Pendentes — {formatCurrency(financeSummary.pendingValue)}</p>
                </div>
                <div className="card">
                  <h3 style={{ color: 'var(--text-dim)' }}>{financeSummary.noEntryCount}</h3>
                  <p>Sem cobrança lançada (viagem sem cliente/frete)</p>
                </div>
              </div>

              <h2>Visão Rápida</h2>
              <div className="report-charts-grid">
                <div className="report-chart-card">
                  <h3 className="report-chart-title">Faturamento por Dia</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={revenueByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="day" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} formatter={(v) => formatCurrency(v)} />
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

                {punctualityByStage.length > 0 && (
                  <div className="report-chart-card report-chart-wide">
                    <h3 className="report-chart-title">Pontualidade por Etapa (planejado x real)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={punctualityByStage}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="label" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                        <Bar dataKey="No horário" stackId="a" fill={COLOR_ROUTE} />
                        <Bar dataKey="Atrasada" stackId="a" fill={COLOR_ALERT} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <h2>Tabela Dinâmica</h2>
              <p className="subtitle" style={{ textAlign: 'left', marginBottom: 16 }}>
                Escolha como agrupar e o que medir — o gráfico se monta sozinho.
              </p>
              <div className="mass-batch-fields" style={{ marginBottom: 16 }}>
                <div>
                  <label>Agrupar por</label>
                  <select value={pivotDimension} onChange={(e) => setPivotDimension(e.target.value)}>
                    {DIMENSIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Métrica</label>
                  <select value={pivotMetric} onChange={(e) => setPivotMetric(e.target.value)}>
                    {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label>Tipo de gráfico</label>
                  <select value={pivotChart} onChange={(e) => setPivotChart(e.target.value)}>
                    {CHART_TYPES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="report-chart-card" style={{ marginBottom: 28 }}>
                <h3 className="report-chart-title">{pivotMetricLabel} por {DIMENSIONS.find((d) => d.key === pivotDimension)?.label}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  {pivotChart === 'pie' ? (
                    <PieChart>
                      <Pie data={pivotData} dataKey={pivotMetric} nameKey="name" outerRadius={100} label={(d) => d.name}>
                        {pivotData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} formatter={pivotValueFormatter} />
                    </PieChart>
                  ) : pivotChart === 'line' ? (
                    <LineChart data={pivotData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} formatter={pivotValueFormatter} />
                      <Line type="monotone" dataKey={pivotMetric} stroke={COLOR_AMBER} strokeWidth={2} dot={{ fill: COLOR_AMBER }} />
                    </LineChart>
                  ) : (
                    <BarChart data={pivotData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-dim)', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 12 }} formatter={pivotValueFormatter} />
                      <Bar dataKey={pivotMetric} fill={COLOR_AMBER} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
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
                  <td className="tabular-money">{t.freight_value != null ? formatCurrency(Number(t.freight_value)) : '-'}</td>
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
