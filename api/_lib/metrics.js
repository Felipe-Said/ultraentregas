import { getSupabase } from './supabase.js';

function getMetadataValue(metadata, key, fallback = '') {
  const value = metadata?.[key];
  return typeof value === 'string' ? value.trim() : fallback;
}

export function buildEventDescription(eventName, metadata = {}) {
  switch (eventName) {
    case 'PageView':
      return getMetadataValue(metadata, 'path', 'PageView');
    case 'Add_To_Cart':
      return `${getMetadataValue(metadata, 'product', 'Produto')} • ${getMetadataValue(metadata, 'price', '')}`.trim();
    case 'Checkout_Click':
      return `${Array.isArray(metadata.items) ? metadata.items.length : 0} item(ns) • ${getMetadataValue(metadata, 'total', '')}`.trim();
    case 'CEP_Filled':
      return `${getMetadataValue(metadata, 'cep', 'CEP informado')} • ${getMetadataValue(metadata, 'source', 'manual')}`.trim();
    case 'Purchase':
      return getMetadataValue(metadata, 'description', 'Venda confirmada');
    default:
      return getMetadataValue(metadata, 'description', eventName);
  }
}

export async function trackMetricEvent({ sessionId, eventName, metadata = {} }) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('metrics_events')
    .insert({
      user_id: sessionId || null,
      event_name: eventName,
      event_desc: buildEventDescription(eventName, metadata),
      metadata
    });

  if (error) {
    throw error;
  }
}

async function getEventCount(eventName) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('metrics_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', eventName);

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function getMetricsSummary() {
  const supabase = getSupabase();
  const [views, leads, cepFills, totalSales] = await Promise.all([
    getEventCount('PageView'),
    getEventCount('Checkout_Click'),
    getEventCount('CEP_Filled'),
    getEventCount('Purchase')
  ]);

  const { data: logs, error } = await supabase
    .from('metrics_events')
    .select('created_at, event_name, event_desc, user_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return {
    views,
    whatsappClicks: leads,
    cepFills,
    totalSales,
    logs: (logs || []).map((log) => ({
      time: new Date(log.created_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      event: log.event_name,
      desc: log.event_desc,
      user: log.user_id || 'anon'
    }))
  };
}
