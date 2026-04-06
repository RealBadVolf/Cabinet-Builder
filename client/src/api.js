const BASE = '/api';

function getToken() {
  return localStorage.getItem('cabinet_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('cabinet_token', token);
  else localStorage.removeItem('cabinet_token');
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('cabinet_user')); }
  catch { return null; }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem('cabinet_user', JSON.stringify(user));
  else localStorage.removeItem('cabinet_user');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    setToken(null);
    setStoredUser(null);
    window.dispatchEvent(new Event('auth:expired'));
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) return res.json();
  return res;
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export async function login(loginStr, password) {
  const data = await request('/auth/login', {
    method: 'POST', body: JSON.stringify({ login: loginStr, password })
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data.user;
}

export async function register(email, username, password, firstName, lastName) {
  const data = await request('/auth/register', {
    method: 'POST', body: JSON.stringify({ email, username, password, firstName, lastName })
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data.user;
}

export function logout() {
  setToken(null);
  setStoredUser(null);
}

export async function getMe() {
  return request('/auth/me');
}

// ─── Jobs ────────────────────────────────────────────────────────────────────
export async function listJobs() { return request('/jobs'); }
export async function getJob(id) { return request(`/jobs/${id}`); }
export async function createJob(data) {
  return request('/jobs', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateJob(id, data) {
  return request(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteJob(id) {
  return request(`/jobs/${id}`, { method: 'DELETE' });
}

// ─── Cabinets ────────────────────────────────────────────────────────────────
export async function listCabinets(jobId) { return request(`/cabinets/job/${jobId}`); }
export async function getCabinet(id) { return request(`/cabinets/${id}`); }
export async function createCabinet(jobId, data) {
  return request(`/cabinets/job/${jobId}`, { method: 'POST', body: JSON.stringify(data) });
}
export async function updateCabinet(id, data) {
  return request(`/cabinets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}
export async function deleteCabinet(id) {
  return request(`/cabinets/${id}`, { method: 'DELETE' });
}
export async function duplicateCabinet(id, cabinetCode) {
  return request(`/cabinets/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ cabinetCode }) });
}

// ─── Export ──────────────────────────────────────────────────────────────────
export async function exportCutlist(cabinetId) {
  const res = await request(`/export/cabinet/${cabinetId}/cutlist`);
  return res.text ? await res.text() : res;
}

// Single cabinet DXF by thickness
export function cabinetDxfUrl(cabinetId, thickness) {
  let url = `${BASE}/export/cabinet/${cabinetId}/dxf?token=${getToken()}`;
  if (thickness) url += `&thickness=${thickness}`;
  return url;
}

// Job-level DXF: one, several, or all cabinets
export function jobDxfUrl(jobId, thickness, cabinetIds) {
  let url = `${BASE}/export/job/${jobId}/dxf?token=${getToken()}`;
  if (thickness) url += `&thickness=${thickness}`;
  if (cabinetIds && cabinetIds.length > 0) url += `&cabinets=${cabinetIds.join(',')}`;
  return url;
}

// Get available thicknesses for a cabinet
export async function cabinetDxfInfo(cabinetId) {
  return request(`/export/cabinet/${cabinetId}/dxf-info`);
}

// Get available thicknesses across cabinets in a job
export async function jobDxfInfo(jobId, cabinetIds) {
  let url = `/export/job/${jobId}/dxf-info`;
  if (cabinetIds && cabinetIds.length > 0) url += `?cabinets=${cabinetIds.join(',')}`;
  return request(url);
}

// Keep old name for backward compat
export function exportDxfUrl(cabinetId) {
  return cabinetDxfUrl(cabinetId);
}

// ─── Public ──────────────────────────────────────────────────────────────────
export async function getDoorStyles() { return request('/door-styles'); }
export async function getMaterials() { return request('/materials'); }

// ─── Admin ───────────────────────────────────────────────────────────────────
export async function listUsers() { return request('/auth/users'); }
export async function updateUserRole(id, role) {
  return request(`/auth/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
}
export async function toggleUserActive(id, active) {
  return request(`/auth/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ active }) });
}
