import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import { useToast } from '../components/Toast.jsx';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminNovaViagem() {
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [clients, setClients] = useState([]);

  const [scheduledDate, setScheduledDate] = useState(todayISO());
  const [clientId, setClientId] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [quantities, setQuantities] = useState({}); // routeId -> quantidade

  const [rows, setRows] = useState([]); // linhas geradas no passo 2
  const [generating, setGenerating] = useState(false);

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

  function buildTable() {
    const newRows = [];
    routes.forEach((r) => {
      const qty = Number(quantities[r.id] || 0);
      for (let i = 0; i < qty; i++) {
        newRows.push({
          tempId: `${r.id}-${i}-${Date.now()}`,
          routeId: r.id,
          routeCode: r.code,
          origin: r.origin,
          destination: r.destination,
          freightValue: r.default_freight_value,
          driverId: '',
        });
      }
    });
    if (newRows.length === 0) {
      toast('Defina ao menos uma quantidade maior que zero.', 'error');
      return;
    }
    setRows(newRows);
  }

  function updateRowDriver(tempId, driverId) {
    setRows((prev) => prev.map((row) => (row.tempId === tempId ? { ...row, driverId } : row)));
  }

  function removeRow(tempId) {
    setRows((prev) => prev.filter((row) => row.tempId !== tempId));
  }

  async function handleGenerate() {
    const missing = rows.filter((r) => !r.driverId);
    if (missing.length > 0) {
      toast(`Falta escolher motorista em ${missing.length} linha(s).`, 'error');
      return;
    }

    const driverIds = rows.map((r) => r.driverId);
    const duplicated = driverIds.filter((id, i) => driverIds.indexOf(id) !== i);
    if (duplicated.length > 0) {
      toast('Tem motorista repetido em mais de uma linha — cada motorista só pode ter uma viagem por vez.', 'error');
      return;
    }

    setGenerating(true);

    const { data: openTrips } = await supabase
      .from('trips')
      .select('driver_id')
      .in('driver_id', driverIds)
      .in('status', ['assigned', 'in_progress']);

    const busyIds = new Set((openTrips || []).map((t) => t.driver_id));
    if (busyIds.size > 0) {
      const busyNames = rows
        .filter((r) => busyIds.has(r.driverId))
        .map((r) => drivers.find((d) => d.id === r.driverId)?.profiles?.full_name || r.driverId);
      setGenerating(false);
      toast(`Estes motoristas já têm viagem em aberto: ${busyNames.join(', ')}. Ajuste antes de gerar.`, 'error');
      return;
    }

    const selectedClient = clients.find((c) => c.id === clientId);

    const payload = rows.map((r) => ({
      driver_id: r.driverId,
      route_id: r.routeId,
      origin: r.origin,
      destination: r.destination,
      client_id: clientId || null,
      client_name: selectedClient ? selectedClient.name : null,
      cargo_description: cargoDescription || null,
      freight_value: r.freightValue,
      scheduled_date: scheduledDate || null,
      status: 'assigned',
    }));

    const { error } = await supabase.from('trips').insert(payload);
    setGenerating(false);

    if (error) {
      toast('Erro ao gerar viagens: ' + error.message, 'error');
      return;
    }

    toast(`${payload.length} viagem(ns) gerada(s) com sucesso!`, 'success');
    setRows([]);
    setQuantities({});
  }

  const totalQty = Object.values(quantities).reduce((s, v) => s + Number(v || 0), 0);

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Programação em Massa</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 20 }}>
        Defina quantas viagens gerar por rota, depois escolha o motorista de cada uma.
      </p>

      <div className="mass-step">
        <h2 style={{ marginTop: 0 }}>Passo 1 — Quantidades</h2>

        <div className="mass-batch-fields">
          <div>
            <label>Data da operação</label>
            <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div>
            <label>Cliente (aplica a todas as viagens desta geração)</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sem cliente / definir depois</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label>Descrição da carga (opcional, aplica a todas)</label>
            <input value={cargoDescription} onChange={(e) => setCargoDescription(e.target.value)} placeholder="Ex: Carga geral" />
          </div>
        </div>

        {routes.length === 0 && (
          <p className="error-text">Nenhuma rota ativa cadastrada. Cadastre em Configurações antes de programar em massa.</p>
        )}

        <div className="mass-route-grid">
          {routes.map((r) => (
            <div key={r.id} className="mass-route-card">
              <strong>{r.code}</strong>
              <span>{r.origin} → {r.destination}</span>
              <label>Qtd. Viagens</label>
              <input
                type="number"
                min="0"
                value={quantities[r.id] || ''}
                onChange={(e) => setQuantities({ ...quantities, [r.id]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <button className="primary-button" style={{ width: 'auto', padding: '12px 22px', marginTop: 16 }} onClick={buildTable}>
          Gerar Tabela {totalQty > 0 ? `(${totalQty})` : ''}
        </button>
      </div>

      {rows.length > 0 && (
        <div className="mass-step">
          <h2 style={{ marginTop: 0 }}>Passo 2 — {rows.length} viagem(ns)</h2>

          <table className="admin-table">
            <thead>
              <tr><th>#</th><th>Rota</th><th>Motorista</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.tempId}>
                  <td>{i + 1}</td>
                  <td>{row.routeCode}</td>
                  <td>
                    <select value={row.driverId} onChange={(e) => updateRowDriver(row.tempId, e.target.value)}>
                      <option value="">Selecione...</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>{d.profiles?.full_name} — {d.vehicle_plate}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="secondary-button" onClick={() => removeRow(row.tempId)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="primary-button" style={{ width: 'auto', padding: '12px 22px', marginTop: 16 }} onClick={handleGenerate} disabled={generating}>
            {generating ? 'Gerando...' : `Gerar ${rows.length} Viagem(ns)`}
          </button>
        </div>
      )}
    </div>
  );
}
