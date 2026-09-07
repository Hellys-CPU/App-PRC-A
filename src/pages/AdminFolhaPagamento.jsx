import React, { useState } from 'react';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import MobileTableReveal from '../components/MobileTableReveal.jsx';
import { useToast } from '../components/Toast.jsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function firstDayOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminFolhaPagamento() {
  const [start, setStart] = useState(firstDayOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [adjustingDriverId, setAdjustingDriverId] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ description: '', amount: '', type: 'desconto' });
  const toast = useToast();

  async function handleSearch(e) {
    e?.preventDefault();
    setLoading(true);
    setSearched(true);

    const { data: trips } = await supabase
      .from('trips')
      .select(`
        id, driver_id, created_at,
        drivers ( vehicle_plate, profiles ( full_name ) ),
        financial_entries ( entry_type, amount )
      `)
      .eq('status', 'completed')
      .gte('created_at', start + 'T00:00:00')
      .lte('created_at', end + 'T23:59:59');

    const { data: adjustments } = await supabase
      .from('payroll_adjustments')
      .select('*')
      .lte('period_start', end)
      .gte('period_end', start);

    const map = {};
    (trips || []).forEach((t) => {
      const id = t.driver_id;
      if (!map[id]) {
        map[id] = {
          driverId: id,
          name: t.drivers?.profiles?.full_name || 'Motorista',
          plate: t.drivers?.vehicle_plate || '-',
          tripsCount: 0,
          totalPayable: 0,
          adjustments: [],
        };
      }
      map[id].tripsCount += 1;
      const payable = (t.financial_entries || []).find((f) => f.entry_type === 'payable_driver');
      map[id].totalPayable += Number(payable?.amount) || 0;
    });

    (adjustments || []).forEach((a) => {
      if (map[a.driver_id]) map[a.driver_id].adjustments.push(a);
    });

    setRows(Object.values(map).sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }

  function netTotal(row) {
    const bonus = row.adjustments.filter((a) => a.adjustment_type === 'bonus').reduce((s, a) => s + Number(a.amount), 0);
    const desconto = row.adjustments.filter((a) => a.adjustment_type === 'desconto').reduce((s, a) => s + Number(a.amount), 0);
    return row.totalPayable + bonus - desconto;
  }

  async function addAdjustment(driverId) {
    if (!adjustForm.description || !adjustForm.amount) {
      toast('Preencha a descrição e o valor.', 'error');
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('payroll_adjustments').insert({
      driver_id: driverId,
      period_start: start,
      period_end: end,
      description: adjustForm.description,
      amount: Number(adjustForm.amount),
      adjustment_type: adjustForm.type,
      created_by: userData.user.id,
    });

    if (error) {
      toast('Erro: ' + error.message, 'error');
      return;
    }

    toast('Ajuste adicionado!', 'success');
    setAdjustingDriverId(null);
    setAdjustForm({ description: '', amount: '', type: 'desconto' });
    handleSearch();
  }

  function generateReceipt(row) {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(244, 97, 1);
    doc.text('PRC Transportes — Recibo de Pagamento', 14, 18);

    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text(`Motorista: ${row.name}  (${row.plate})`, 14, 28);
    doc.text(`Período: ${new Date(start + 'T00:00:00').toLocaleDateString('pt-BR')} a ${new Date(end + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, 34);
    doc.text(`Viagens realizadas: ${row.tripsCount}`, 14, 40);

    const lines = [['Viagens realizadas (base)', formatCurrency(row.totalPayable)]];
    row.adjustments.forEach((a) => {
      lines.push([`${a.adjustment_type === 'bonus' ? 'Bônus' : 'Desconto'}: ${a.description}`, `${a.adjustment_type === 'desconto' ? '-' : '+'} ${formatCurrency(a.amount)}`]);
    });
    lines.push(['TOTAL LÍQUIDO', formatCurrency(netTotal(row))]);

    autoTable(doc, {
      startY: 48,
      body: lines,
      styles: { fontSize: 10 },
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (data) => {
        if (data.row.index === lines.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [244, 97, 1];
          data.cell.styles.textColor = 255;
        }
      },
    });

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Documento gerado pelo sistema PRC App — não substitui recibo fiscal quando aplicável.', 14, 285);

    doc.save(`recibo-${row.name.replace(/\s+/g, '-').toLowerCase()}-${start}.pdf`);
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Folha de Pagamento</h1>
      <p className="subtitle" style={{ textAlign: 'left', marginBottom: 20 }}>
        Soma o pagamento por viagem no período, permite lançar desconto/bônus, e gera recibo em PDF.
      </p>

      <form onSubmit={handleSearch} className="mass-batch-fields" style={{ marginBottom: 20 }}>
        <div>
          <label>De</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label>Até</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Calculando...' : 'Calcular'}
          </button>
        </div>
      </form>

      {searched && !loading && (
        <MobileTableReveal title="Folha de Pagamento">
          <table className="admin-table">
            <thead>
              <tr><th>Motorista</th><th>Viagens</th><th>Base</th><th>Ajustes</th><th>Líquido</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <React.Fragment key={row.driverId}>
                  <tr>
                    <td>{row.name} <span className="mono-data">{row.plate}</span></td>
                    <td>{row.tripsCount}</td>
                    <td className="tabular-money">{formatCurrency(row.totalPayable)}</td>
                    <td style={{ fontSize: 11 }}>
                      {row.adjustments.length === 0 ? '-' : row.adjustments.map((a) => (
                        <div key={a.id}>{a.adjustment_type === 'bonus' ? '+' : '-'} {formatCurrency(a.amount)} ({a.description})</div>
                      ))}
                    </td>
                    <td className="tabular-money" style={{ fontWeight: 700, color: 'var(--route)' }}>{formatCurrency(netTotal(row))}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="secondary-button" onClick={() => setAdjustingDriverId(adjustingDriverId === row.driverId ? null : row.driverId)}>
                        + Ajuste
                      </button>
                      <button className="secondary-button" onClick={() => generateReceipt(row)}>📄 Recibo</button>
                    </td>
                  </tr>
                  {adjustingDriverId === row.driverId && (
                    <tr>
                      <td colSpan="6">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
                          <select value={adjustForm.type} onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                            <option value="desconto">Desconto</option>
                            <option value="bonus">Bônus</option>
                          </select>
                          <input placeholder="Descrição (ex: vale, avaria)" value={adjustForm.description} onChange={(e) => setAdjustForm({ ...adjustForm, description: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                          <input type="number" step="0.01" placeholder="Valor R$" value={adjustForm.amount} onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })} style={{ width: 120 }} />
                          <button className="primary-button" style={{ width: 'auto', padding: '8px 14px' }} onClick={() => addAdjustment(row.driverId)}>Salvar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="6" className="empty-state">Nenhuma viagem finalizada no período.</td></tr>
              )}
            </tbody>
          </table>
        </MobileTableReveal>
      )}
    </div>
  );
}
