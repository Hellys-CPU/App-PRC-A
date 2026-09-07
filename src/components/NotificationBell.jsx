import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { useAdminRole } from '../hooks/useAdminRole.js';

// Junta em um lugar só os avisos que hoje ficam espalhados: CNH vencendo,
// viagem atrasada, cobrança finalizada sem pagamento lançado.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const { role } = useAdminRole();

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5 * 60 * 1000); // atualiza a cada 5min
    return () => clearInterval(interval);
  }, [role]);

  async function loadNotifications() {
    const list = [];

    // CNH vencendo em até 30 dias
    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, profiles(full_name, cnh_validade)')
      .eq('active', true);
    (drivers || []).forEach((d) => {
      const cnhDate = d.profiles?.cnh_validade;
      if (!cnhDate) return;
      const daysLeft = Math.ceil((new Date(cnhDate).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 30) {
        list.push({
          type: 'cnh',
          text: daysLeft >= 0
            ? `CNH de ${d.profiles.full_name} vence em ${daysLeft} dia(s)`
            : `CNH de ${d.profiles.full_name} está vencida`,
          severity: daysLeft < 0 ? 'alert' : 'warning',
        });
      }
    });

    // Viagens em andamento sem etapa nova há mais de 2h
    const { data: activeTrips } = await supabase
      .from('trips')
      .select('id, drivers(profiles(full_name)), trip_stages(recorded_at), created_at')
      .in('status', ['assigned', 'in_progress']);
    (activeTrips || []).forEach((t) => {
      const stages = t.trip_stages || [];
      const last = stages.length ? stages.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0] : null;
      const refTime = last ? last.recorded_at : t.created_at;
      const mins = (Date.now() - new Date(refTime).getTime()) / 60000;
      if (mins > 120) {
        list.push({
          type: 'atraso',
          text: `Viagem de ${t.drivers?.profiles?.full_name || 'motorista'} parada há ${Math.floor(mins / 60)}h${Math.floor(mins % 60)}m`,
          severity: 'alert',
        });
      }
    });

    // Cobrança pendente (só quem tem acesso ao financeiro)
    if (role === 'diretoria' || role === 'financeiro') {
      const { data: completedTrips } = await supabase
        .from('trips')
        .select('id, client_name, financial_entries(entry_type, status)')
        .eq('status', 'completed')
        .not('client_id', 'is', null);
      (completedTrips || []).forEach((t) => {
        const receivable = (t.financial_entries || []).find((f) => f.entry_type === 'receivable_client');
        if (!receivable) {
          list.push({ type: 'cobranca', text: `Viagem de ${t.client_name || 'cliente'} finalizada sem cobrança lançada`, severity: 'warning' });
        }
      });
    }

    setItems(list);
  }

  return (
    <div className="notification-bell-wrapper">
      <button className="secondary-button" onClick={() => setOpen(!open)} aria-label="Notificações">
        🔔{items.length > 0 && <span className="nav-badge">{items.length}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="global-search-group">Avisos</div>
          {items.length === 0 && <p className="empty-state" style={{ margin: '10px 14px' }}>Tudo em ordem por aqui.</p>}
          {items.map((n, i) => (
            <div key={i} className={`notification-item notification-${n.severity}`}>
              {n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
