import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';

import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminMotoristas from './pages/AdminMotoristas.jsx';
import AdminNovaViagem from './pages/AdminNovaViagem.jsx';
import AdminFrota from './pages/AdminFrota.jsx';
import AdminMapa from './pages/AdminMapa.jsx';
import AdminRelatorios from './pages/AdminRelatorios.jsx';
import AdminConfiguracoes from './pages/AdminConfiguracoes.jsx';
import DriverHome from './pages/DriverHome.jsx';
import DriverCamera from './pages/DriverCamera.jsx';
import DriverHistory from './pages/DriverHistory.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = carregando
  const [role, setRole] = useState(null); // 'admin' | 'driver' | null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) checkRole(data.session.user.id);
      else setRole(null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) checkRole(newSession.user.id);
      else setRole(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function checkRole(userId) {
    const { data: adminRow } = await supabase.from('admin_users').select('id').eq('id', userId).maybeSingle();
    if (adminRow) { setRole('admin'); return; }
    const { data: driverRow } = await supabase.from('drivers').select('id').eq('id', userId).maybeSingle();
    setRole(driverRow ? 'driver' : 'unknown');
  }

  if (session === undefined) {
    return <div className="loading-screen">Carregando...</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (role === null) {
    return <div className="loading-screen">Verificando acesso...</div>;
  }

  if (role === 'admin') {
    return (
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/motoristas" element={<AdminMotoristas />} />
        <Route path="/nova-viagem" element={<AdminNovaViagem />} />
        <Route path="/frota" element={<AdminFrota />} />
        <Route path="/mapa" element={<AdminMapa />} />
        <Route path="/relatorios" element={<AdminRelatorios />} />
        <Route path="/configuracoes" element={<AdminConfiguracoes />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  if (role === 'driver') {
    return (
      <Routes>
        <Route path="/" element={<DriverHome />} />
        <Route path="/camera/:status" element={<DriverCamera />} />
        <Route path="/historico" element={<DriverHistory />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    );
  }

  return (
    <div className="loading-screen">
      <p>Este usuário não tem um perfil configurado. Contate o administrador.</p>
      <button onClick={() => supabase.auth.signOut()}>Sair</button>
    </div>
  );
}
