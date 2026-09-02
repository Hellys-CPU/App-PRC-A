// Fila offline simples pra pings de localização.
// Se não tiver conexão na hora, o ping fica guardado no localStorage do celular
// e é reenviado sozinho assim que a internet voltar — sem perder o dado.
import { supabase } from '../supabase';

const QUEUE_KEY = 'prc-ping-queue';

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

export function queuePing(ping) {
  const queue = readQueue();
  queue.push({ ...ping, queued_at: new Date().toISOString() });
  writeQueue(queue);
}

export async function sendOrQueuePing(ping) {
  if (!navigator.onLine) {
    queuePing(ping);
    return;
  }
  const { error } = await supabase.from('location_pings').insert(ping);
  if (error) {
    // Falhou por outro motivo (rede instável, timeout) — guarda pra tentar de novo depois.
    queuePing(ping);
  }
}

export async function flushPingQueue() {
  if (!navigator.onLine) return;
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining = [];
  for (const ping of queue) {
    const { queued_at, ...payload } = ping;
    const { error } = await supabase.from('location_pings').insert(payload);
    if (error) remaining.push(ping);
  }
  writeQueue(remaining);
}

export function pendingPingCount() {
  return readQueue().length;
}
