import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
import { useToast } from '../components/Toast.jsx';

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminFinanceiro() {
  const [tab, setTab] = useState('receber');
  const [entries, setEntries] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ tripId: '', amount: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { loadEntries(); loadTrips(); }, [tab]);

  async function loadEntries() {
    setLoading(true);
    const entryType = tab === 'receber' ? 'receivable_client' : 'payable_driver';
    const { data } = await supabase
      .from('financial_entries')
      .select(`
        id, amount, status, due_date, paid_at, nf_status, nf_reference, notes, entry_type,
        trips ( id, origin, destination, client_name, drivers ( vehicle_plate, profiles ( full_name ) ) )
      `)
      .eq('entry_type', entryType)
      .order('created_at', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }

  async function loadTrips() {
    const { data } = await supabase
      .from('trips')
      .select('id, origin, destination, client_name, drivers(vehicle_plate, profiles(full_name))')
      .order('created_at', { ascending: false })
      .limit(50);
    setTrips(data || []);
  }

  async function markPaid(entry) {
    await supabase.from('financial_entries').update({ status: 'pago', paid_at: new Date().toISOString() }).eq('id', entry.id);
    toast(tab === 'receber' ? 'Recebimento confirmado!' : 'Pagamento marcado como feito.', 'success');
    loadEntries();
  }

  async function requestNfIntegration(entry) {
    await supabase.from('financial_entries').update({ nf_status: 'integracao_pendente' }).eq('id', entry.id);
    toast('Marcado para emissão — aguardando integração com emissor de NF.', 'success');
    loadEntries();
  }

  async function handleAddPayable(e) {
    e.preventDefault();
    if (!form.tripId || !form.amount) {
      toast('Selecione a viagem e o valor.', 'error');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('financial_entries').insert({
      trip_id: form.tripId,
      entry_type: 'payable_driver',
      amount: Number(form.amount),
      due_date: form.dueDate || null,
    });
    setSaving(false);
    if (error) {
      toast('Erro ao lançar: ' + error.message, 'error');
      return;
    }
    toast('Pagamento lançado!', 'success');
    setForm({ tripId: '', amount: '', dueDate: '' });
    loadEntries();
  }

  const totalPendente = entries.filter((e) => e.status === 'pendente').reduce((s, e) => s + Number(e.amount), 0);
  const totalPago = entries.filter((e) => e.status === 'pago').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Financeiro</h1>

      <div className="mode-switch" data-active={tab} style={{ maxWidth: 360, marginBottom: 24 }}>
        <button type="button" className={tab === 'receber' ? 'active' : ''} onClick={() => setTab('receber')}>A Receber</button>
        <button type="button" className={tab === 'pagar' ? 'active' : ''} onClick={() => setTab('pagar')}>A Pagar Motorista</button>
      </div>

      <div className="cards" style={{ marginBottom: 24 }}>
        <div className="card"><h3>{formatCurrency(totalPendente)}</h3><p>Pendente</p></div>
        <div className="card"><h3>{formatCurrency(totalPago)}</h3><p>Pago/Recebido</p></div>
        <div className="card"><h3>{entries.length}</h3><p>Lançamentos</p></div>
      </div>

      {tab === 'pagar' && (
        <>
          <p className="subtitle" style={{ textAlign: 'left', marginBottom: 12 }}>
            Viagens feitas em rotas cadastradas (com pagamento ao motorista definido em
            Configurações) já entram aqui sozinhas. Use este formulário só pra viagens avulsas,
            sem rota cadastrada.
          </p>
          <form onSubmit={handleAddPayable} className="motorista-form" style={{ marginBottom: 28 }}>
          <label>Viagem</label>
          <select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })} required>
            <option value="">Selecione a viagem</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.drivers?.profiles?.full_name} — {t.origin} → {t.destination}
              </option>
            ))}
          </select>

          <label>Valor a pagar ao motorista (R$)</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />

          <label>Vencimento</label>
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />

          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? 'Lançando...' : 'Lançar Pagamento'}
          </button>
        </form>
        </>
      )}

      <h2>{tab === 'receber' ? 'Contas a Receber (Clientes)' : 'Contas a Pagar (Motoristas)'}</h2>

      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 16 }}>
        Emissão de nota fiscal ainda não integrada — esta seção só marca o lançamento como
        "aguardando emissão" até que um provedor de NF seja conectado.
      </p>

      {loading && <p className="empty-state">Carregando...</p>}

      <MobileTableReveal title="Lançamentos">
        <table className="admin-table">
        <thead>
          <tr>
            <th>Viagem</th>
            <th>{tab === 'receber' ? 'Cliente' : 'Motorista'}</th>
            <th>Valor</th>
            <th>Vencimento</th>
            <th>Status</th>
            <th>NF</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{e.trips?.origin} → {e.trips?.destination}</td>
              <td>{tab === 'receber' ? (e.trips?.client_name || '-') : (e.trips?.drivers?.profiles?.full_name || '-')}</td>
              <td>{formatCurrency(e.amount)}</td>
              <td>{e.due_date ? new Date(e.due_date).toLocaleDateString('pt-BR') : '-'}</td>
              <td>
                <span className={`trip-badge ${e.status === 'pago' ? 'badge-done' : 'badge-assigned'}`}>
                  {e.status === 'pago' ? (tab === 'receber' ? 'Recebido' : 'Pago') : 'Pendente'}
                </span>
              </td>
              <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {e.nf_status === 'emitida' ? 'Emitida' : e.nf_status === 'integracao_pendente' ? 'Aguardando integração' : 'Não emitida'}
              </td>
              <td style={{ display: 'flex', gap: 6 }}>
                {e.status === 'pendente' && (
                  <button className="secondary-button" onClick={() => markPaid(e)}>
                    {tab === 'receber' ? 'Marcar recebido' : 'Marcar pago'}
                  </button>
                )}
                {e.nf_status === 'nao_emitida' && (
                  <button className="secondary-button" onClick={() => requestNfIntegration(e)}>Preparar NF</button>
                )}
              </td>
            </tr>
          ))}
          {entries.length === 0 && !loading && (
            <tr><td colSpan="7" className="empty-state">Nenhum lançamento ainda.</td></tr>
          )}
        </tbody>
        </table>
      </MobileTableReveal>
    </div>
  );
}
