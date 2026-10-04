const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  users: (token) => request('/users', { headers: { Authorization: `Bearer ${token}` } }),
  messages: (token, id) => request(`/messages/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
  notifications: (token) => request('/notifications', {
    headers: { Authorization: `Bearer ${token}` }
  })
};
