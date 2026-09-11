
export const LS_PREFIX = 'isns:';
export async function storeGet(key, fb) {
  try {
    const r = localStorage.getItem(LS_PREFIX + key);
    return r != null ? JSON.parse(r) : fb;
  } catch {
    return fb;
  }
}
export async function storeSet(key, val) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}
export async function storeDelete(key) {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {}
}

/* ─── Supabase Cloud Sync (preserved exactly) ─── */

const ISNS_CLOUD_ID = 2;
let _sb = null, _sbReady = false, _lastSave = 0;
export function initCloud() {
  if (_sbReady || !window.supabase) return null;
  try {
    _sb = window.supabase.createClient('https://duikfskqbacackelieux.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1aWtmc2txYmFjYWNrZWxpZXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTA0ODIsImV4cCI6MjA3OTE4NjQ4Mn0.IST84GYs9-5eOGmx485XPqDAwfp0Jdw5MHAjzUYTUUA');
    _sbReady = true;
  } catch {
    _sb = null;
  }
  return _sb;
}
export async function cloudLoad() {
  const c = initCloud();
  if (!c) return null;
  try {
    const {
      data,
      error
    } = await c.from('app_state').select('data').eq('id', ISNS_CLOUD_ID).single();
    if (!error && data?.data) return data.data;
  } catch {}
  return null;
}
export async function cloudSave(snap) {
  const c = initCloud();
  if (!c) return false;
  _lastSave = Date.now();
  try {
    const {
      error
    } = await c.from('app_state').upsert({
      id: ISNS_CLOUD_ID,
      data: snap,
      updated_at: new Date().toISOString()
    });
    return !error;
  } catch {
    return false;
  }
}

/* ─── packing engine (100% preserved) ─── */
