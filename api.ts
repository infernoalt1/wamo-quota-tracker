import { Problem, User, Quota, ProblemStatus } from './types';

// --- CONFIGURATION ---
// Auto-detect if running in a preview environment where backend might not be reachable
const isPreviewEnv = window.location.hostname.includes('googleusercontent') || window.location.hostname.includes('webcontainer') || window.location.hostname.includes('localhost');

// For the purpose of this demo request, we default to MOCK if we can't hit the backend, 
// or strictly true here to ensure you can test the "Fake Admin" immediately.
const USE_MOCK_BACKEND = true;

const API_BASE_URL = 'http://localhost:3000';

// --- MOCK DATA ---
let MOCK_USERS: User[] = [
  { id: 'u1', name: 'Director (You)', password: '', role: 'admin', submittedCount: 2, voteCount: 5, votingPower: 5, customTargets: {} },
  { id: 'u2', name: 'Alice Director', password: '', role: 'director', submittedCount: 5, voteCount: 3, votingPower: 5, customTargets: {} },
  { id: 'u3', name: 'Bob Writer', password: '', role: 'writer', submittedCount: 1, voteCount: 0, votingPower: 1, customTargets: {} },
  { id: 'u4', name: 'Charlie Writer', password: '', role: 'writer', submittedCount: 4, voteCount: 2, votingPower: 1, customTargets: {} },
];

let MOCK_QUOTAS: Quota[] = [
  { id: 'q1', name: 'Algebra Round', target: 5, voteTarget: 3, instructions: 'Focus on inequalities.', dueDate: Date.now() + 86400000 * 7 },
  { id: 'q2', name: 'Geometry Round', target: 5, voteTarget: 3, instructions: 'Euclidean geometry only.', dueDate: null },
];

let MOCK_PROBLEMS: Problem[] = [
  { id: 'p1', authorId: 'u2', authorName: 'Alice Director', quotaId: 'q1', title: 'Quadratic Inequality', statement: 'Find all real $x$ such that $x^2 - 4x + 3 < 0$.', difficulty: 2.5, topics: ['Algebra'], createdAt: Date.now() - 100000, score: 5, votedBy: ['u1'], status: 'accepted' },
  { id: 'p2', authorId: 'u3', authorName: 'Bob Writer', quotaId: 'q1', title: 'Complex Roots', statement: 'If $z^3 = 1$, find the sum of...', difficulty: 4.0, topics: ['Algebra', 'Number Theory'], createdAt: Date.now() - 50000, score: 1, votedBy: [], status: 'pending' },
  { id: 'p3', authorId: 'u4', authorName: 'Charlie Writer', quotaId: 'q1', title: 'Triangle Area', statement: 'Given a triangle with sides 3, 4, 5...', difficulty: 1.0, topics: ['Geometry'], createdAt: Date.now() - 200000, score: 2, votedBy: ['u2', 'u4'], status: 'pending' },
];

// --- INTERFACE ---

export const api = {
  // Auth
  login: async (loginIdOrEmail: string, password?: string): Promise<{ user: User, token?: string }> => {
    if (USE_MOCK_BACKEND) return mockApi.login(loginIdOrEmail);
    
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
    if (USE_MOCK_BACKEND) {
         const guest = { id: 'guest', name: 'Guest', password: '', role: 'guest' as const, submittedCount: 0, voteCount: 0, votingPower: 0, customTargets: {} };
         return { user: guest, token: 'mock-guest-token' };
    }
    
    const res = await fetch(`${API_BASE_URL}/auth/guest-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error('Guest login failed');
    const data = await res.json();
    if (data.accessToken) localStorage.setItem('token', data.accessToken);
    return data;
  },

  getMe: async (): Promise<User> => {
      if (USE_MOCK_BACKEND) {
          const id = localStorage.getItem('mock_user_id');
          if (!id) throw new Error('No session');
          const user = MOCK_USERS.find(u => u.id === id);
          if (user) return user;
          // Fallback for guest in mock
          if (id === 'guest') return { id: 'guest', name: 'Guest', password: '', role: 'guest', submittedCount: 0, voteCount: 0, votingPower: 0, customTargets: {} };
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
    if (USE_MOCK_BACKEND) return [...MOCK_USERS];
    const res = await fetch(`${API_BASE_URL}/api/users`, { headers: getAuthHeader() });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  createUser: async (user: Partial<User>): Promise<User> => {
    if (USE_MOCK_BACKEND) return mockApi.addUser(user);
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
    const res = await fetch(`${API_BASE_URL}/api/users/${id}`, { method: 'DELETE', headers: getAuthHeader() });
    if (!res.ok) throw new Error('Delete failed');
  },

  // Problems
  getProblems: async (): Promise<Problem[]> => {
    if (USE_MOCK_BACKEND) return [...MOCK_PROBLEMS];
    const res = await fetch(`${API_BASE_URL}/api/problems`, { headers: getAuthHeader() });
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
    if (!res.ok) throw new Error('Submission failed');
  },

  updateProblem: async (problemId: string, problem: Partial<Problem>): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.updateProblem(problemId, problem);
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}`, {
      method: 'PUT',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(problem)
    });
    if (!res.ok) throw new Error('Update problem failed');
  },
  
  updateProblemStatus: async (problemId: string, status: ProblemStatus): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.updateStatus(problemId, status);
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/status`, {
      method: 'PATCH',
      headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Status update failed');
  },
  
  toggleVote: async (problemId: string): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.toggleVote(problemId);
    const res = await fetch(`${API_BASE_URL}/api/problems/${problemId}/vote`, { method: 'POST', headers: getAuthHeader() });
    if (!res.ok) throw new Error('Vote failed');
  },

  resetVotes: async (): Promise<void> => {
    if (USE_MOCK_BACKEND) return mockApi.resetVotes();
    const res = await fetch(`${API_BASE_URL}/api/admin/reset-votes`, { method: 'POST', headers: getAuthHeader() });
    if (!res.ok) throw new Error('Reset failed');
  },

  // Quotas
  getQuotas: async (): Promise<Quota[]> => {
    if (USE_MOCK_BACKEND) return [...MOCK_QUOTAS];
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
      if (!res.ok) throw new Error('Failed to create round');
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
};

// --- HELPER: Auth Header ---
function getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// --- MOCK IMPLEMENTATION ---
const mockApi = {
  login: async (loginId: string) => {
      const user = MOCK_USERS.find(u => u.id === loginId);
      if (!user) throw new Error('User not found');
      localStorage.setItem('mock_user_id', user.id);
      return { user, token: 'mock-token' };
  },
  getUsers: async () => MOCK_USERS,
  updateUser: (user: Partial<User> & { id: string }) => {
      // Logic from server.js mirrored here
      const currentUser = MOCK_USERS.find(u => u.id === localStorage.getItem('mock_user_id'));
      const targetUser = MOCK_USERS.find(u => u.id === user.id);
      
      if (currentUser?.role === 'director' && targetUser?.role === 'admin') {
          throw new Error("Directors cannot modify Admins");
      }
      
      MOCK_USERS = MOCK_USERS.map(u => u.id === user.id ? { ...u, ...user } : u);
  },
  deleteUser: (id: string) => {
      const currentUser = MOCK_USERS.find(u => u.id === localStorage.getItem('mock_user_id'));
      const targetUser = MOCK_USERS.find(u => u.id === id);

      if (currentUser?.role === 'director' && (targetUser?.role === 'admin' || targetUser?.role === 'director')) {
          throw new Error("Directors cannot delete Admins or Directors");
      }

      MOCK_USERS = MOCK_USERS.filter(u => u.id !== id);
      MOCK_PROBLEMS = MOCK_PROBLEMS.filter(p => p.authorId !== id);
  },
  addUser: (user: Partial<User>) => {
      const currentUser = MOCK_USERS.find(u => u.id === localStorage.getItem('mock_user_id'));
      
      let safeRole = user.role;
      if (currentUser?.role === 'director') {
          safeRole = 'writer';
      }

      const newUser = { ...user, role: safeRole, id: `u${Date.now()}`, submittedCount: 0, voteCount: 0 } as User;
      MOCK_USERS.push(newUser);
      return newUser;
  },
  getProblems: async () => MOCK_PROBLEMS,
  submitProblem: async (problem: Partial<Problem>) => {
      const newP = { ...problem, id: `p${Date.now()}`, score: 0, status: 'pending', createdAt: Date.now(), votedBy: [] } as Problem;
      MOCK_PROBLEMS.push(newP);
  },
  updateProblem: (id: string, updates: Partial<Problem>) => {
      MOCK_PROBLEMS = MOCK_PROBLEMS.map(p => p.id === id ? { ...p, ...updates } : p);
  },
  updateStatus: (id: string, status: ProblemStatus) => {
      MOCK_PROBLEMS = MOCK_PROBLEMS.map(p => p.id === id ? { ...p, status } : p);
  },
  toggleVote: async (problemId: string) => {
      const userId = localStorage.getItem('mock_user_id') || 'u1';
      const user = MOCK_USERS.find(u => u.id === userId);
      if (!user) return;
      
      const prob = MOCK_PROBLEMS.find(p => p.id === problemId);
      if (!prob) return;

      if (prob.votedBy?.includes(userId)) {
          prob.votedBy = prob.votedBy.filter(id => id !== userId);
          prob.score -= user.votingPower;
      } else {
          prob.votedBy = [...(prob.votedBy || []), userId];
          prob.score += user.votingPower;
      }
  },
  resetVotes: () => {
      MOCK_PROBLEMS.forEach(p => { p.score = 0; p.votedBy = []; });
  },
  getQuotas: async () => MOCK_QUOTAS,
  updateQuota: (quota: Quota) => {
      MOCK_QUOTAS = MOCK_QUOTAS.map(q => q.id === quota.id ? quota : q);
  },
  addQuota: (quota: Partial<Quota>) => {
      const newQ = { ...quota, id: `q${Date.now()}` } as Quota;
      MOCK_QUOTAS.push(newQ);
      return newQ;
  }
};