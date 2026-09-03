// Fila offline pro chat do motorista.
// Sem internet, a mensagem aparece na tela na hora (com aviso de "não enviada ainda")
// e fica guardada no celular até a conexão voltar, quando é reenviada sozinha.
import { supabase } from '../supabase';

const QUEUE_KEY = 'prc-chat-queue';

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueChatMessage(tempId, driverId, message) {
  const queue = readQueue();
  queue.push({ tempId, driverId, message, created_at: new Date().toISOString() });
  writeQueue(queue);
}

export function pendingChatCount(driverId) {
  return readQueue().filter((m) => m.driverId === driverId).length;
}

export function pendingChatMessages(driverId) {
  return readQueue().filter((m) => m.driverId === driverId);
}

// Tenta enviar tudo que está na fila desse motorista. Pra cada uma que
// conseguir mandar, chama onSent(tempId, linhaSalva) pra quem chamou
// trocar a "pendente" pela mensagem de verdade na tela.
export async function flushChatQueue(driverId, onSent) {
  if (!navigator.onLine) return;
  const queue = readQueue();
  const mine = queue.filter((m) => m.driverId === driverId);
  if (mine.length === 0) return;

  const remaining = queue.filter((m) => m.driverId !== driverId);

  for (const item of mine) {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ driver_id: item.driverId, sender_type: 'driver', message: item.message })
      .select()
      .single();

    if (error) {
      remaining.push(item);
    } else {
      onSent?.(item.tempId, data);
    }
  }

  writeQueue(remaining);
}
