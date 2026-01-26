import { Problem, User, Quota, ProblemStatus } from './types';

// --- CONFIGURATION ---
const API_BASE_URL = 'http://localhost:3000';

// --- INTERFACE ---

export const api = {
  // Auth
  login: async (loginIdOrEmail: string, password?: string): Promise<{ user: User, token?: string }> => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginIdOrEmail, password })
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    if (data.accessToken) localStorage.setItem('token', data.accessToken);
    return data;
  },

  guestLogin: async (): Promise<{ user: User, token?: string }> => {
    const res = await fetch(`${API_BASE_URL}/auth/guest-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('Guest login failed');
    const data = await res.json();
    if (data.accessToken) localStorage.setItem('token', data.accessToken);
    return data;
  },

  getMe: async (): Promise<User> => {
      const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Session invalid');
      return res.json();
  },

  logout: () => {
    localStorage.removeItem('token');
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (user: Partial<User>): Promise<User> => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
          name: user.name,
          email: `${user.name?.toLowerCase().replace(/\s/g, '')}@probfair.org`,
          password: user.password,
          role: user.role || 'writer'
      })
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },

  updateUser: async (user: Partial<User> & { id: string }): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Update failed');
  },

  deleteUser: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, { method: 'DELETE', headers: getAuthHeader() });
    if (!res.ok) throw new Error('Delete failed');
  },

  // Problems
  getProblems: async (): Promise<Problem[]> => {
    const res = await fetch(`${API_BASE_URL}/api/problems`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch problems');
    return res.json();
  },

  submitProblem: async (problem: Partial<Problem>): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/problems`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(problem)
    });
    if (!res.ok) throw new Error('Submission failed');
  },

  updateProblem: async (problemId: string, problem: Partial<Problem>): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(problem)
    });
    if (!res.ok) throw new Error('Update problem failed');
  },
  
  updateProblemStatus: async (problemId: string, status: ProblemStatus): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/status`, {
      method: 'PATCH',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Status update failed');
  },
  
  toggleVote: async (problemId: string): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/vote`, { method: 'POST', headers: getAuthHeader() });
    if (!res.ok) throw new Error('Vote failed');
  },

  resetVotes: async (): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/admin/reset-votes`, { method: 'POST', headers: getAuthHeader() });
    if (!res.ok) throw new Error('Reset failed');
  },

  // Quotas
  getQuotas: async (): Promise<Quota[]> => {
    const res = await fetch(`${API_BASE_URL}/api/quotas`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch rounds');
    return res.json();
  },

  createQuota: async (quota: Partial<Quota>): Promise<Quota> => {
      const res = await fetch(`${API_BASE_URL}/api/quotas`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(quota)
      });
      if (!res.ok) throw new Error('Failed to create round');
      return res.json();
  },
  
  updateQuota: async (quota: Quota): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/quotas/${quota.id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(quota)
    });
    if (!res.ok) throw new Error('Update failed');
  },
};

// --- HELPER: Auth Header ---
function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}