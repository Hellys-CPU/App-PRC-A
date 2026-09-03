import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import Brand from '../components/Brand.jsx';
import { queueChatMessage, flushChatQueue, pendingChatMessages } from '../lib/chatQueue.js';

export default function DriverChat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [driverId, setDriverId] = useState(null);
  const bottomRef = useRef(null);
  const navigate = useNavigate();

  // Junta as mensagens já confirmadas no banco com as que ainda estão
  // pendentes na fila offline (essas ficam marcadas como "não enviada").
  function mergeWithPending(confirmed, id) {
    const pending = pendingChatMessages(id).map((p) => ({
      id: p.tempId,
      tempId: p.tempId,
      message: p.message,
      sender_type: 'driver',
      created_at: p.created_at,
      pending: true,
    }));
    return [...confirmed, ...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  useEffect(() => {
    let id;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      id = userData?.user?.id;
      setDriverId(id);
      if (!id) return;

      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('driver_id', id)
        .order('created_at', { ascending: true });
      setMessages(mergeWithPending(data || [], id));

      const channel = supabase
        .channel(`chat_driver_${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `driver_id=eq.${id}` }, (payload) => {
          setMessages((prev) => {
            // Evita duplicar se essa mensagem já apareceu na tela (ex: foi ela mesma
            // que acabamos de mandar e já tinha sido trocada de "pendente" pra real).
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        })
        .subscribe();

      async function tryFlush() {
        await flushChatQueue(id, (tempId, savedRow) => {
          setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...savedRow, pending: false } : m)));
        });
      }
      tryFlush();
      const flushInterval = setInterval(tryFlush, 20 * 1000);
      window.addEventListener('online', tryFlush);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(flushInterval);
        window.removeEventListener('online', tryFlush);
      };
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !driverId) return;
    setText('');

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: tempId,
      tempId,
      message: trimmed,
      sender_type: 'driver',
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    if (!navigator.onLine) {
      queueChatMessage(tempId, driverId, trimmed);
      return;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ driver_id: driverId, sender_type: 'driver', message: trimmed })
      .select()
      .single();

    if (error) {
      queueChatMessage(tempId, driverId, trimmed);
      return;
    }

    setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...data, pending: false } : m)));
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
          <div key={m.id} className={`chat-bubble ${m.sender_type === 'driver' ? 'chat-bubble-admin' : 'chat-bubble-driver'}${m.pending ? ' chat-pending' : ''}`}>
            {m.message}
            <span className="chat-bubble-time">
              {m.pending ? '🕓 Enviando quando tiver internet...' : new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
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
