import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import AdminNav from '../components/AdminNav.jsx';
import { useAdminRole } from '../hooks/useAdminRole.js';
import { useChatNotifications } from '../hooks/useChatNotifications.js';

export default function AdminChat() {
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const { role } = useAdminRole();
  const canSend = role === 'diretoria' || role === 'trafego';
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { loadDrivers(); }, []);

  const { markAsRead } = useChatNotifications();
  useEffect(() => { markAsRead(); }, []);

  useEffect(() => {
    if (!selectedDriver) return;
    loadMessages(selectedDriver.id);

    const channel = supabase
      .channel(`chat_admin_${selectedDriver.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `driver_id=eq.${selectedDriver.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedDriver]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadDrivers() {
    const { data } = await supabase
      .from('drivers')
      .select('id, vehicle_plate, profiles(full_name)')
      .eq('active', true);
    setDrivers(data || []);
  }

  async function loadMessages(driverId) {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !selectedDriver) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('chat_messages').insert({
      driver_id: selectedDriver.id,
      sender_type: 'admin',
      sender_admin_id: userData.user.id,
      message: text.trim(),
    });
    setText('');
  }

  return (
    <div className="admin-container">
      <AdminNav />
      <h1 className="page-title">Chat com Motoristas</h1>

      <div className="chat-layout">
        <div className="chat-driver-list">
          {drivers.map((d) => (
            <button
              key={d.id}
              className={`chat-driver-item${selectedDriver?.id === d.id ? ' active' : ''}`}
              onClick={() => setSelectedDriver(d)}
            >
              <strong>{d.profiles?.full_name}</strong>
              <span>{d.vehicle_plate}</span>
            </button>
          ))}
          {drivers.length === 0 && <p className="empty-state" style={{ padding: 12 }}>Nenhum motorista ativo.</p>}
        </div>

        <div className="chat-thread">
          {!selectedDriver && <p className="empty-state" style={{ padding: 20 }}>Selecione um motorista para conversar.</p>}
          {selectedDriver && (
            <>
              <div className="chat-messages">
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble ${m.sender_type === 'admin' ? 'chat-bubble-admin' : 'chat-bubble-driver'}`}>
                    {m.message}
                    <span className="chat-bubble-time">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              {canSend ? (
                <form className="chat-input-row" onSubmit={sendMessage}>
                  <input
                    type="text"
                    placeholder="Digite uma mensagem..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <button type="submit" className="primary-button" style={{ width: 'auto', padding: '12px 20px' }}>Enviar</button>
                </form>
              ) : (
                <p className="empty-state" style={{ padding: 12 }}>Apenas Diretoria e Tráfego podem responder.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
