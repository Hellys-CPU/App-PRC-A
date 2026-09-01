import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function AdminDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [stats, setStats] = useState({ activeDrivers: 0, activeTrips: 0, todayStages: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('trip_stages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_stages' }, () => loadData())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function loadData() {
    const { data: driversData } = await supabase
      .from('drivers')
      .select('id, vehicle_plate, active, profiles(full_name, phone)')
      .eq('active', true);
    setDrivers(driversData || []);

    const { count: activeTrips } = await supabase
      .from('trips').select('*', { count: 'exact', head: true }).eq('status', 'in_progress');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayStages } = await supabase
      .from('trip_stages').select('*', { count: 'exact', head: true }).gte('recorded_at', todayStart.toISOString());

    setStats({ activeDrivers: driversData?.length || 0, activeTrips: activeTrips || 0, todayStages: todayStages || 0 });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Painel Administrativo</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/motoristas')}>Motoristas</button>
          <button className="logout-button" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      <div className="cards">
        <div className="card"><h3>{stats.activeDrivers}</h3><p>Motoristas Ativos</p></div>
        <div className="card"><h3>{stats.activeTrips}</h3><p>Viagens em Andamento</p></div>
        <div className="card"><h3>{stats.todayStages}</h3><p>Registros Hoje</p></div>
      </div>

      <h2>Motoristas</h2>
      <table className="admin-table">
        <thead>
          <tr><th>Nome</th><th>Placa</th><th>Telefone</th><th>Contato</th></tr>
        </thead>
        <tbody>
          {drivers.map((d) => (
            <tr key={d.id}>
              <td>{d.profiles?.full_name}</td>
              <td>{d.vehicle_plate}</td>
              <td>{d.profiles?.phone}</td>
              <td className="contact-cell">
                <a href={`tel:${d.profiles?.phone}`} title="Ligar">📞</a>
                <a href={`https://wa.me/55${d.profiles?.phone}`} target="_blank" rel="noreferrer" title="WhatsApp">💬</a>
              </td>
            </tr>
          ))}
          {drivers.length === 0 && (
            <tr><td colSpan="4" className="empty-state">Nenhum motorista cadastrado ainda.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
