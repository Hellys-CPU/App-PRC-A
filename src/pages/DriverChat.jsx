import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import Brand from '../components/Brand.jsx';

export default function DriverChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [driverId, setDriverId] = useState(null);
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const id = userData?.user?.id;
      setDriverId(id);
      if (!id) return;

      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('driver_id', id)
        .order('created_at', { ascending: true });
      setMessages(data || []);

      const channel = supabase
        .channel(`chat_driver_${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `driver_id=eq.${id}` }, (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        })
        .subscribe();

      return () => supabase.removeChannel(channel);
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !driverId) return;
    await supabase.from('chat_messages').insert({
      driver_id: driverId,
      sender_type: 'driver',
      message: text.trim(),
    });
    setText('');
  }

  return (
    <div className="driver-home" style={{ display: 'flex', flexDirection: 'column', height: '100vh', paddingBottom: 12 }}>
      <header className="driver-header">
        <button className="back-button" onClick={() => navigate('/')}>← Voltar</button>
        <Brand subtitle="Fale com a central" />
      </header>

      <div className="chat-messages" style={{ flex: 1 }}>
        {messages.length === 0 && <p className="empty-state" style={{ padding: 16 }}>Nenhuma mensagem ainda. Mande uma dúvida ou aviso pra central.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender_type === 'driver' ? 'chat-bubble-admin' : 'chat-bubble-driver'}`}>
            {m.message}
            <span className="chat-bubble-time">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input-row" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Digite uma mensagem..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="primary-button" style={{ width: 'auto', padding: '12px 20px' }}>Enviar</button>
      </form>
    </div>
  );
}
