import { getSupabase } from './supabase.js';

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';
const SAO_PAULO_OFFSET = '-03:00';
const ACTIVE_WINDOW_MINUTES = 2;
const LOG_LIMIT = 20;

function getMetadataValue(metadata, key, fallback = '') {
  const value = metadata?.[key];

  if (typeof value === 'string') {
    return value.trim() || fallback;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return fallback;
}

function isValidDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getSaoPauloTodayDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getSelectedDayRange(dateString) {
  const selectedDate = isValidDateString(dateString) ? dateString : getSaoPauloTodayDate();

  return {
    selectedDate,
    startIso: new Date(`${selectedDate}T00:00:00.000${SAO_PAULO_OFFSET}`).toISOString(),
    endIso: new Date(`${selectedDate}T23:59:59.999${SAO_PAULO_OFFSET}`).toISOString()
  };
}

function getPathFromMetadata(metadata = {}) {
  return getMetadataValue(metadata, 'path', getMetadataValue(metadata, 'pathname', '/'));
}

function isCheckoutPath(path = '') {
  return /^\/checkout(\.html)?/i.test(path);
}

export function buildEventDescription(eventName, metadata = {}) {
  switch (eventName) {
    case 'PageView':
      return getMetadataValue(metadata, 'path', 'PageView');
    case 'Heartbeat':
      return `Presenca em ${getPathFromMetadata(metadata)}`;
    case 'Add_To_Cart':
      return `${getMetadataValue(metadata, 'product', 'Produto')} • ${getMetadataValue(metadata, 'price', '')}`.trim();
    case 'Checkout_Click':
      return `${Array.isArray(metadata.items) ? metadata.items.length : 0} item(ns) • ${getMetadataValue(metadata, 'total', '')}`.trim();
    case 'CEP_Filled':
      return `${getMetadataValue(metadata, 'cep', 'CEP informado')} • ${getMetadataValue(metadata, 'source', 'manual')}`.trim();
    case 'Order_Generated':
      return getMetadataValue(metadata, 'description', 'Pedido gerado e aguardando pagamento');
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

async function getDailyEventCount(eventName, startIso, endIso) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('metrics_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', eventName)
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (error) {
    throw error;
  }

  return count || 0;
}

async function getPendingGeneratedOrdersCount(startIso, endIso) {
  const supabase = getSupabase();
  const { data: generatedOrders, error: generatedError } = await supabase
    .from('metrics_events')
    .select('user_id')
    .eq('event_name', 'Order_Generated')
    .gte('created_at', startIso)
    .lte('created_at', endIso);

  if (generatedError) {
    throw generatedError;
  }

  const generatedIds = [...new Set((generatedOrders || []).map((item) => item.user_id).filter(Boolean))];

  if (generatedIds.length === 0) {
    return 0;
  }

  const { data: paidOrders, error: paidError } = await supabase
    .from('metrics_events')
    .select('user_id')
    .eq('event_name', 'Purchase')
    .in('user_id', generatedIds);

  if (paidError) {
    throw paidError;
  }

  const paidIds = new Set((paidOrders || []).map((item) => item.user_id).filter(Boolean));

  return generatedIds.filter((id) => !paidIds.has(id)).length;
}

async function getActiveSessionsSummary() {
  const supabase = getSupabase();
  const cutoffIso = new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('metrics_events')
    .select('created_at, event_name, user_id, metadata')
    .in('event_name', ['PageView', 'Heartbeat'])
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: false })
    .limit(1500);

  if (error) {
    throw error;
  }

  const latestBySession = new Map();

  for (const event of data || []) {
    if (!event.user_id) {
      continue;
    }

    if (latestBySession.has(event.user_id)) {
      continue;
    }

    latestBySession.set(event.user_id, {
      path: getPathFromMetadata(event.metadata)
    });
  }

  let activeCheckoutVisitors = 0;

  for (const session of latestBySession.values()) {
    if (isCheckoutPath(session.path)) {
      activeCheckoutVisitors += 1;
    }
  }

  return {
    activeVisitors: latestBySession.size,
    activeCheckoutVisitors
  };
}

async function getLatestLogs() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('metrics_events')
    .select('created_at, event_name, event_desc, user_id')
    .not('event_name', 'eq', 'Heartbeat')
    .order('created_at', { ascending: false })
    .limit(LOG_LIMIT);

  if (error) {
    throw error;
  }

  return (data || []).map((log) => ({
    time: new Date(log.created_at).toLocaleString('pt-BR', {
      timeZone: SAO_PAULO_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }),
    event: log.event_name,
    desc: log.event_desc,
    user: log.user_id || 'anon'
  }));
}

export async function getMetricsSummary(dateString) {
  const { selectedDate, startIso, endIso } = getSelectedDayRange(dateString);
  const [activeSummary, paidSales, generatedOrders, logs] = await Promise.all([
    getActiveSessionsSummary(),
    getDailyEventCount('Purchase', startIso, endIso),
    getPendingGeneratedOrdersCount(startIso, endIso),
    getLatestLogs()
  ]);

  return {
    selectedDate,
    activeWindowMinutes: ACTIVE_WINDOW_MINUTES,
    activeVisitors: activeSummary.activeVisitors,
    activeCheckoutVisitors: activeSummary.activeCheckoutVisitors,
    paidSales,
    generatedOrders,
    logs
  };
}
