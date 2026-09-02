import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const STAGE_LABELS = {
  apresentacao_base_origem: 'Apresentação na Base Origem',
  saida_base_origem: 'Saída da Base Origem',
  chegada_base_destino: 'Chegada na Base Destino',
  fim_descarga: 'Fim da Descarga',
  parada_eventual: 'Parada Eventual',
};

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
  const navigate = useNavigate();

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
        drivers ( vehicle_plate, profiles ( full_name ) ),
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
      <header className="admin-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <h1>Relatórios</h1>
      </header>

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
          <div className="cards" style={{ marginBottom: 20 }}>
            <div className="card"><h3>{trips.length}</h3><p>Viagens no Período</p></div>
            <div className="card"><h3>{completedCount}</h3><p>Finalizadas</p></div>
            <div className="card"><h3>{formatCurrency(totalFreight)}</h3><p>Faturamento (Frete)</p></div>
          </div>

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
        </>
      )}
    </div>
  );
}
