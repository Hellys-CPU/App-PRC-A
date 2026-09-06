import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';

const LAST_SEEN_KEY = 'prc_chat_last_seen';

// Barramento de evento simples (fora do React) pra sincronizar o contador
// entre instâncias diferentes do hook — necessário porque o AdminNav é
// remontado a cada troca de página.
const chatEvents = new EventTarget();

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // navegador bloqueou áudio sem interação do usuário — sem problema, só não toca
  }
}

export function useChatNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenRef = useRef(localStorage.getItem(LAST_SEEN_KEY) || new Date().toISOString());

  useEffect(() => {
    checkUnread();

    const onRead = () => setUnreadCount(0);
    chatEvents.addEventListener('read', onRead);

    const channel = supabase
      .channel('global_chat_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        if (payload.new.sender_type === 'driver') {
          setUnreadCount((c) => c + 1);
          if (!window.location.pathname.startsWith('/chat')) {
            playBeep();
          }
        }
      })
      .subscribe();

    return () => {
      chatEvents.removeEventListener('read', onRead);
      supabase.removeChannel(channel);
    };
  }, []);

  async function checkUnread() {
    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_type', 'driver')
      .gt('created_at', lastSeenRef.current);
    setUnreadCount(count || 0);
  }

  function markAsRead() {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, now);
    lastSeenRef.current = now;
    chatEvents.dispatchEvent(new Event('read'));
  }

  return { unreadCount, markAsRead };
}
