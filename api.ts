import { Problem, User, Quota, Round, ProblemStatus, Topic, Comment } from './types';

// --- CONFIGURATION ---
const USE_MOCK_BACKEND = false;

// Determine if we are in local development (Vite default port 5173)
// If on localhost:5173, assume backend is on port 3000.
// Otherwise (production/render), use relative path '' so requests go to the same origin.
const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '5173';
const API_BASE_URL = isLocalDev ? 'http://localhost:3000' : '';

// --- INTERFACE ---

export const api = {
  // Auth
  login: async (loginIdOrEmail: string, password?: string): Promise<{ user: User, token?: string }> => {
    if (USE_MOCK_BACKEND) return mockApi.login(loginIdOrEmail, password);
    
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginIdOrEmail, password })
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
    }
    return data;
  },

  guestLogin: async (): Promise<{ user: User, token?: string }> => {
    if (USE_MOCK_BACKEND) throw new Error("Guest login not mocked");
    
    const res = await fetch(`${API_BASE_URL}/auth/guest-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Guest login failed');
    const data = await res.json();
    if (data.accessToken) {
        localStorage.setItem('token', data.accessToken);
    }
    return data;
  },

  getMe: async (): Promise<User> => {
      if (USE_MOCK_BACKEND) {
          const id = localStorage.getItem('mock_user_id');
          if (!id) throw new Error('No session');
          const users = await mockApi.getUsers();
          const user = users.find(u => u.id === id);
          if (user) return user;
          throw new Error('Session invalid');
      }
      const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Session invalid');
      return res.json();
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('mock_user_id');
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    if (USE_MOCK_BACKEND) return mockApi.getUsers();
    
    const res = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (user: Partial<User>): Promise<User> => {
    if (USE_MOCK_BACKEND) return mockApi.addUser(user);

    // Re-using auth register endpoint for creating users via Admin panel
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
          name: user.name,
          email: `${user.name?.toLowerCase().replace(/\s/g, '')}@probfair.org`, // Auto-gen email for login ID
          password: user.password,
          role: user.role || 'writer'
      })
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },

  updateUser: async (user: Partial<User> & { id: string }): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.updateUser(user);

    const res = await fetch(`${API_BASE_URL}/api/users/${user.id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!res.ok) throw new Error('Update failed');
  },

  deleteUser: async (id: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.deleteUser(id);
    
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Delete failed');
  },

  // Problems
  getProblems: async (): Promise<Problem[]> => {
    if (USE_MOCK_BACKEND) return mockApi.getProblems();
    
    const res = await fetch(`${API_BASE_URL}/api/problems`, {
        headers: getAuthHeader() 
    });
    if (!res.ok) throw new Error('Failed to fetch problems');
    return res.json();
  },

  submitProblem: async (problem: Partial<Problem>): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.submitProblem(problem);

    const res = await fetch(`${API_BASE_URL}/api/problems`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(problem)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.rejectionReason || 'Submission failed');
    }
  },

  updateProblem: async (problemId: string, problem: Partial<Problem>): Promise<void> => {
    if (USE_MOCK_BACKEND) return; // Not implemented for mock
    
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(problem)
    });
    if (!res.ok) {
        if (res.status === 409) {
            throw new Error('CONFLICT: This problem has been edited by someone else. Please refresh and try again.');
        }
        throw new Error('Update problem failed');
    }
  },
  
  updateProblemStatus: async (problemId: string, status: ProblemStatus): Promise<void> => {
    if (USE_MOCK_BACKEND) return; 

    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/status`, {
      method: 'PATCH',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Status update failed');
  },

  // New: Reorder Round
  reorderRound: async (problemIds: string[]): Promise<void> => {
    if (USE_MOCK_BACKEND) return; 

    const res = await fetch(`${API_BASE_URL}/api/rounds/reorder`, {
      method: 'POST',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ problems: problemIds })
    });
    if (!res.ok) throw new Error('Reorder failed');
  },

  toggleVote: async (problemId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.toggleVote(problemId);

    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/vote`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Vote failed');
  },

  resetVotes: async (): Promise<void> => {
    if (USE_MOCK_BACKEND) return; 
    
    const res = await fetch(`${API_BASE_URL}/api/admin/reset-votes`, {
      method: 'POST',
      headers: getAuthHeader()
    });
    if (!res.ok) throw new Error('Reset failed');
  },
  
  // New: Bulk Parsing
  parseBulkLatex: async (text: string, defaultTopics: Topic[], defaultDifficulty: number): Promise<any[]> => {
      const res = await fetch(`${API_BASE_URL}/api/problems/bulk-parse`, {
          method: 'POST',
          headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, defaultTopics, defaultDifficulty })
      });
      if (!res.ok) throw new Error("Parsing failed");
      const data = await res.json();
      return data.problems;
  },

  // Comments
  getComments: async (problemId: string): Promise<Comment[]> => {
    if (USE_MOCK_BACKEND) return [];
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/comments`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
  },

  postComment: async (problemId: string, text: string): Promise<Comment> => {
    if (USE_MOCK_BACKEND) throw new Error("Mock not impl");
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/comments`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Post failed');
    return res.json();
  },

  // Quotas
  getQuotas: async (): Promise<Quota[]> => {
    if (USE_MOCK_BACKEND) return mockApi.getQuotas();
    const res = await fetch(`${API_BASE_URL}/api/quotas`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch rounds');
    return res.json();
  },

  createQuota: async (quota: Partial<Quota>): Promise<Quota> => {
      if (USE_MOCK_BACKEND) return mockApi.addQuota(quota);
      
      const res = await fetch(`${API_BASE_URL}/api/quotas`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(quota)
      });
      if (!res.ok) throw new Error('Failed to create quota');
      return res.json();
  },
  
  updateQuota: async (quota: Quota): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.updateQuota(quota);

    const res = await fetch(`${API_BASE_URL}/api/quotas/${quota.id}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(quota)
    });
    if (!res.ok) throw new Error('Update failed');
  },

  // Rounds
  getRounds: async (): Promise<Round[]> => {
    if (USE_MOCK_BACKEND) return [];
    const res = await fetch(`${API_BASE_URL}/api/rounds`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error("Failed to fetch rounds");
    return res.json();
  },

  createRound: async (round: Partial<Round>): Promise<Round> => {
    if (USE_MOCK_BACKEND) return {} as Round;
    const res = await fetch(`${API_BASE_URL}/api/rounds`, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(round)
    });
    if (!res.ok) throw new Error("Failed to create round");
    return res.json();
  },

  // Helpers
  _updateMockUser: (user: User) => { if(USE_MOCK_BACKEND) mockApi.updateUser(user) },
  _addMockQuota: (quota: Quota) => { if(USE_MOCK_BACKEND) mockApi.addQuota(quota) },
  _addMockUser: (user: User) => { if(USE_MOCK_BACKEND) mockApi.addUser(user) },
};

// --- HELPER: Auth Header ---
function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// --- MOCK IMPLEMENTATION (LOCAL STORAGE) ---
const DEFAULT_USERS: User[] = [];
const DEFAULT_QUOTAS: Quota[] = [];
const mockApi = {
  login: async (loginIdOrEmail: string, password?: string) => ({ user: {} as User }),
  getUsers: async () => [] as User[],
  updateUser: (user: Partial<User> & { id: string }) => {},
  deleteUser: (id: string) => {},
  addUser: (user: Partial<User> | User) => ({} as User),
  getProblems: async () => [] as Problem[],
  submitProblem: async (problem: Partial<Problem>) => {},
  toggleVote: async (problemId: string) => {},
  getQuotas: async () => [] as Quota[],
  updateQuota: (quota: Quota) => {},
  addQuota: (quota: Partial<Quota> | Quota) => ({} as Quota)
};