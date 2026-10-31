// Persistent device ID for "one account per phone".
// A random ID is created once and stored in 3 places (localStorage, cookie,
// IndexedDB) so clearing only one of them does not reset it.
// NOTE: a browser/PWA cannot read the real Android ID. If you later wrap the app
// with Capacitor, return the real Android ID from getDeviceId() instead.

const KEY = 'nexa_device_id';

function readLocal(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function writeLocal(v: string) {
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
}
function readCookie(): string | null {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + KEY + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}
function writeCookie(v: string) {
  try {
    document.cookie = `${KEY}=${encodeURIComponent(v)}; max-age=315360000; path=/; SameSite=Lax; Secure`;
  } catch { /* ignore */ }
}
function idbOpen(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('nexa_device', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function readIdb(): Promise<string | null> {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const r = db.transaction('kv').objectStore('kv').get(KEY);
      r.onsuccess = () => resolve((r.result as string) || null);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function writeIdb(v: string) {
  const db = await idbOpen();
  if (!db) return;
  try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, KEY); } catch { /* ignore */ }
}

function newId(): string {
  try {
    if (crypto && 'randomUUID' in crypto) return 'web-' + crypto.randomUUID();
  } catch { /* ignore */ }
  return 'web-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export async function getDeviceId(): Promise<string> {
  const id = readLocal() || readCookie() || (await readIdb()) || newId();
  writeLocal(id);
  writeCookie(id);
  await writeIdb(id);
  return id;
}

export function getDeviceModel(): string {
  try {
    const ua = navigator.userAgent || '';
    const m = ua.match(/Android[^;]*;\s*([^)]+?)\s*(?:Build|\))/);
    return (m && m[1]) || (/iPhone|iPad/.test(ua) ? 'iPhone/iPad' : 'Web Browser');
  } catch { return 'Web Browser'; }
}
