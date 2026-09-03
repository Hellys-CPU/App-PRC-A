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
import AdminFinanceiro from './pages/AdminFinanceiro.jsx';
import AdminChat from './pages/AdminChat.jsx';
import AdminAdmins from './pages/AdminAdmins.jsx';
import AdminChangelog from './pages/AdminChangelog.jsx';
import RequireRole from './components/RequireRole.jsx';
import DriverChat from './pages/DriverChat.jsx';
import DriverHome from './pages/DriverHome.jsx';
import DriverCamera from './pages/DriverCamera.jsx';
import DriverHistory from './pages/DriverHistory.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';

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
      <>
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
        <InstallPrompt />
      </>
    );
  }

  if (role === null) {
    return <div className="loading-screen">Verificando acesso...</div>;
  }

  if (role === 'admin') {
    return (
      <>
        <Routes>
          <Route path="/" element={<RequireRole page="dashboard"><AdminDashboard /></RequireRole>} />
          <Route path="/motoristas" element={<RequireRole page="motoristas"><AdminMotoristas /></RequireRole>} />
          <Route path="/nova-viagem" element={<RequireRole page="nova-viagem"><AdminNovaViagem /></RequireRole>} />
          <Route path="/frota" element={<RequireRole page="frota"><AdminFrota /></RequireRole>} />
          <Route path="/mapa" element={<RequireRole page="mapa"><AdminMapa /></RequireRole>} />
          <Route path="/relatorios" element={<RequireRole page="relatorios"><AdminRelatorios /></RequireRole>} />
          <Route path="/configuracoes" element={<RequireRole page="configuracoes"><AdminConfiguracoes /></RequireRole>} />
          <Route path="/financeiro" element={<RequireRole page="financeiro"><AdminFinanceiro /></RequireRole>} />
          <Route path="/chat" element={<RequireRole page="chat"><AdminChat /></RequireRole>} />
          <Route path="/admins" element={<RequireRole page="admins"><AdminAdmins /></RequireRole>} />
          <Route path="/changelog" element={<RequireRole page="changelog"><AdminChangelog /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <InstallPrompt />
      </>
    );
  }

  if (role === 'driver') {
    return (
      <>
        <Routes>
          <Route path="/" element={<DriverHome />} />
          <Route path="/camera/:status" element={<DriverCamera />} />
          <Route path="/historico" element={<DriverHistory />} />
          <Route path="/chat" element={<DriverChat />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <InstallPrompt />
      </>
    );
  }

  return (
    <div className="loading-screen">
      <p>Este usuário não tem um perfil configurado. Contate o administrador.</p>
      <button onClick={() => supabase.auth.signOut()}>Sair</button>
    </div>
  );
}
