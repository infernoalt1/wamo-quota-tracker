import React, { useState, useEffect } from 'react';
import { Problem, User, Quota } from './types';
import { Button } from './components/Button';
import { ProblemCard } from './components/ProblemCard';
import { api } from './api';
import { 
  PlusCircle, 
  LayoutDashboard, 
  BookOpen, 
  LogOut, 
  Settings,
  UserPlus,
  TrendingUp,
  Target,
  ShieldAlert,
  CheckCircle,
  FileText,
  AlertCircle,
  Zap,
  Layers,
  Info,
  BadgeCheck,
  Pencil,
  Save,
  X,
  Trash2,
  Lock,
  Calendar,
  Clock,
  RotateCcw
} from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
      active
        ? 'bg-white border-indigo-600 text-indigo-700 font-bold shadow-md'
        : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
    }`}
  >
    <div className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</div>
    {label}
  </button>
);

export default function App() {
  // --- Global State ---
  const [users, setUsers] = useState<User[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [activeQuotaId, setActiveQuotaId] = useState<string>('q1');

  // --- Session State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'pool' | 'submit' | 'admin'>('dashboard');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Login State
  const [selectedLoginId, setSelectedLoginId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState(false);

  // --- Form State ---
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [isVerified, setIsVerified] = useState(false); 
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  
  // Admin Editing State
  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null);
  const [editQuotaForm, setEditQuotaForm] = useState<Partial<Quota>>({});
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<Partial<User> & { password?: string }>({});

  
  // Admin Create New User State
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  
  // Quota Create New State
  const [newQuotaName, setNewQuotaName] = useState('');
  const [newQuotaTarget, setNewQuotaTarget] = useState(5);
  const [newQuotaInstr, setNewQuotaInstr] = useState('');

  // Pool View State (for stable sorting)
  const [poolIds, setPoolIds] = useState<string[]>([]);

  // --- Initial Load ---
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    // 1. Load users for login screen
    try {
        setUsersLoading(true);
        setUsersError(false);
        const u = await api.getUsers();
        setUsers(u);
    } catch (e) {
        console.error("Failed to load users for login list");
        setUsersError(true);
    } finally {
        setUsersLoading(false);
    }

    // 2. Try to restore session if token exists
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const me = await api.getMe();
            setCurrentUser(me);
            
            // Set active quota if saved
            const savedQ = localStorage.getItem('probfair_active_quota_id');
            if (savedQ) setActiveQuotaId(savedQ);

        } catch(e) {
            // Token invalid
            console.log("Session invalid or expired");
            localStorage.removeItem('token');
        }
    }
  };

  // --- Data Sync ---
  const refreshData = async () => {
      setIsLoadingData(true);
      try {
          const [u, p, q] = await Promise.all([
              api.getUsers(),
              api.getProblems(),
              api.getQuotas()
          ]);
          setUsers(u);
          setProblems(p);
          setQuotas(q);
          
          // Ensure active quota ID is valid
          if (q.length > 0 && !q.find(i => i.id === activeQuotaId)) {
             setActiveQuotaId(q[0].id);
          }
      } catch (e) {
          console.error("Failed to refresh data", e);
      } finally {
          setIsLoadingData(false);
      }
  };

  useEffect(() => {
    if (currentUser) {
        refreshData();
    }
  }, [currentUser]);

  // Update Users submitted count locally based on ACTIVE QUOTA
  // This logic runs client side to keep UI snappy
  useEffect(() => {
    if (problems.length >= 0 && users.length > 0) {
      const updatedUsers = users.map(u => ({
        ...u,
        submittedCount: problems.filter(p => p.authorId === u.id && p.quotaId === activeQuotaId).length
      }));
      
      const isDifferent = JSON.stringify(updatedUsers.map(u => u.submittedCount)) !== JSON.stringify(users.map(u => u.submittedCount));
      if (isDifferent) {
         setUsers(updatedUsers);
         // When using real backend we don't need _updateMockUser, local state update is enough for display
      }
    }
  }, [problems, activeQuotaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Pool Sorting
  useEffect(() => {
    if (view === 'pool') {
      const sorted = [...problems].sort((a, b) => (b.score || 0) - (a.score || 0));
      setPoolIds(sorted.map(p => p.id));
    }
  }, [view, problems.length]); 

  // --- Helpers ---
  const getActiveQuota = () => quotas.find(q => q.id === activeQuotaId) || quotas[0] || { id: 'default', target: 5, name: 'Default', instructions: '', dueDate: null };
  const getFormatDate = (ts: number | null) => ts ? new Date(ts).toLocaleDateString() : 'No Deadline';

  // --- Actions ---

  const handleLogin = async () => {
    try {
        setLoginError('');
        const { user } = await api.login(selectedLoginId, loginPassword);
        setCurrentUser(user);
        setView('dashboard');
        setLoginPassword('');
        setSelectedLoginId('');
    } catch (e) {
        setLoginError('Incorrect password or user');
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setView('dashboard');
    setTitle('');
    setStatement('');
  };

  // -- Quota Management --

  const addQuota = async () => {
    if (!newQuotaName.trim()) return;
    try {
        const newQuota = await api.createQuota({
          name: newQuotaName.trim(),
          target: newQuotaTarget,
          instructions: newQuotaInstr.trim() || 'No specific instructions.',
          dueDate: null
        });
        setQuotas([...quotas, newQuota]);
        setNewQuotaName('');
    } catch(e) {
        console.error("Failed to create round", e);
    }
  };

  const startEditQuota = (q: Quota) => {
    setEditingQuotaId(q.id);
    setEditQuotaForm(q);
  };

  const cancelEditQuota = () => {
    setEditingQuotaId(null);
    setEditQuotaForm({});
  };

  const saveQuota = async () => {
    if (!editingQuotaId || !editQuotaForm.name) return;
    try {
      await api.updateQuota({
        id: editingQuotaId,
        name: editQuotaForm.name || '',
        target: editQuotaForm.target || 5,
        instructions: editQuotaForm.instructions || '',
        dueDate: editQuotaForm.dueDate || null
      });
      await refreshData();
      setEditingQuotaId(null);
    } catch (e) {
      console.error("Failed to update round");
    }
  };

  const switchQuota = (id: string) => {
    setActiveQuotaId(id);
    localStorage.setItem('probfair_active_quota_id', id);
  };

  // -- User Management --

  const addUser = async () => {
    if (!newUserName.trim() || !newUserPassword.trim()) return;
    try {
        const newUser = await api.createUser({
          name: newUserName.trim(),
          password: newUserPassword.trim(),
          role: 'writer',
          submittedCount: 0,
          votingPower: 1, 
          customTargets: {}
        });
        setUsers([...users, newUser]);
        setNewUserName('');
        setNewUserPassword('');
    } catch(e) {
        console.error("Failed to create user", e);
    }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Are you sure? This deletes their submitted problems too.")) return;
    try {
        await api.deleteUser(id);
        await refreshData();
    } catch(e) {
        console.error("Delete failed");
    }
  }

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditUserForm({ ...user, password: '' });
  };

  const saveUser = async (userId: string) => {
    if (!editUserForm.name?.trim()) return;
    try {
      // Handle custom target for Active Quota
      // We read it from the editing form state or keep existing
      const currentTargets = users.find(u => u.id === userId)?.customTargets || {};
      
      await api.updateUser({ 
          id: userId, 
          name: editUserForm.name,
          votingPower: editUserForm.votingPower,
          password: editUserForm.password, // Only updates if not empty string
          customTargets: editUserForm.customTargets || currentTargets
      });
      await refreshData();
      setEditingUserId(null);
    } catch (e) {
      console.error("Failed to update user");
    }
  };

  const updateUserTarget = (userId: string, target: number) => {
     // This updates the local form state if editing
     const existingTargets = editUserForm.customTargets || users.find(u => u.id === userId)?.customTargets || {};
     setEditUserForm({
         ...editUserForm,
         customTargets: {
             ...existingTargets,
             [activeQuotaId]: target
         }
     });
  }

  // -- Submission --

  const handleSubmit = async () => {
    if (!currentUser || !title || !statement || !isVerified) return;
    
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      await api.submitProblem({
          authorId: currentUser.id,
          authorName: currentUser.name,
          title,
          statement,
          quotaId: activeQuotaId
      });
      
      await refreshData();
      
      setTitle('');
      setStatement('');
      setIsVerified(false);
      setView('dashboard');
    } catch (e: any) {
      setSubmissionError(e.message || "System error during validation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVote = async (problemId: string) => {
    if (!currentUser) return;
    
    const oldProblems = [...problems];
    const updatedProblems = problems.map(p => {
       if (p.id === problemId) {
          const hasVoted = p.votedBy?.includes(currentUser.id);
          if (hasVoted) {
             return {
                ...p,
                score: (p.score || 0) - currentUser.votingPower,
                votedBy: (p.votedBy || []).filter(id => id !== currentUser.id)
             };
          } else {
             return {
                ...p,
                score: (p.score || 0) + currentUser.votingPower,
                votedBy: [...(p.votedBy || []), currentUser.id]
             };
          }
       }
       return p;
    });
    setProblems(updatedProblems);
    
    try {
        await api.toggleVote(problemId);
        // Ensure local state matches eventual consistency or refetch
    } catch (e) {
        setProblems(oldProblems);
        console.error("Vote failed");
    }
  };

  // --- Component Logic ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-8 border border-slate-200">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg transform -rotate-3">
              <BookOpen size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">WAMO Quota Tracker</h1>
          <p className="text-gray-500 mb-6 text-center text-sm">Secure Math Contest Portal</p>
          
          {!selectedLoginId ? (
            <div className="space-y-2">
               <div className="flex items-center justify-between mb-2">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select User</p>
                 {usersError && (
                     <button onClick={initApp} className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                        <RotateCcw className="w-3 h-3" /> Retry
                     </button>
                 )}
               </div>
               
               <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {usersLoading && users.length === 0 && <p className="text-sm text-gray-400 italic p-2">Loading users...</p>}
                  
                  {usersError && users.length === 0 && (
                      <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <p className="font-semibold">Unable to load users</p>
                            <p className="text-xs mt-1 text-red-500">Is the backend server running?</p>
                          </div>
                      </div>
                  )}

                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedLoginId(user.id)}
                      className="w-full p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-left transition-all duration-200 group flex items-center justify-between"
                    >
                      <span className="font-medium text-gray-700 group-hover:text-indigo-700">{user.name}</span>
                      {user.role === 'admin' && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">Director</span>}
                    </button>
                  ))}
               </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  Login as <span className="text-indigo-600 font-bold">{users.find(u => u.id === selectedLoginId)?.name}</span>
                </p>
                <button onClick={() => { setSelectedLoginId(''); setLoginPassword(''); setLoginError(''); }} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
              </div>
              
              <div>
                <input 
                  type="password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
                {loginError && <p className="text-red-500 text-xs mt-2 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> {loginError}</p>}
              </div>
              
              <Button onClick={handleLogin} className="w-full">Sign In</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeQuota = getActiveQuota();
  // Get override or default
  const userTarget = currentUser.customTargets?.[activeQuotaId] || activeQuota.target;
  // Count only for active quota
  const userProblemCount = problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length;
  const progressPercent = Math.min((userProblemCount / userTarget) * 100, 100);
  const isDirector = currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-20 shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-600" /> WAMO Quota Tracker
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard className="w-5 h-5" />} 
            label="Dashboard" 
            active={view === 'dashboard'} 
            onClick={() => setView('dashboard')} 
          />
          <NavItem 
            icon={<PlusCircle className="w-5 h-5" />} 
            label="Write Problem" 
            active={view === 'submit'} 
            onClick={() => setView('submit')} 
          />
          <NavItem 
            icon={<BookOpen className="w-5 h-5" />} 
            label="Problem Pool" 
            active={view === 'pool'} 
            onClick={() => setView('pool')} 
          />
          {isDirector && (
            <>
              <div className="pt-4 pb-2 px-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Director Controls</p>
              </div>
              <NavItem 
                icon={<Settings className="w-5 h-5" />} 
                label="Contest Admin" 
                active={view === 'admin'} 
                onClick={() => setView('admin')} 
              />
            </>
          )}
        </nav>

        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-white border border-slate-100 shadow-sm">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${isDirector ? 'bg-purple-600' : 'bg-indigo-600'}`}>
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
              <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                 {currentUser.role}
                 <span className="text-indigo-300">•</span>
                 Power: {currentUser.votingPower}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full text-xs justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar">
        
        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Hello, {currentUser.name.split(' ')[0]} 👋</h1>
                <p className="text-slate-500 mt-1">Here is the current round status.</p>
              </div>
            </header>

            {/* Active Round Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1 block">Active Round</span>
                      <h2 className="text-2xl font-bold text-slate-900">{activeQuota.name}</h2>
                   </div>
                   <div className="text-right">
                       <div className="bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold shadow-sm">
                          Quota: {userTarget}
                       </div>
                       {activeQuota.dueDate && (
                           <p className="text-xs text-red-500 font-semibold mt-1 flex items-center justify-end gap-1">
                               <Clock className="w-3 h-3"/> Due: {getFormatDate(activeQuota.dueDate)}
                           </p>
                       )}
                   </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-slate-600 text-sm">
                   <strong className="text-slate-900">Instructions:</strong> {activeQuota.instructions}
                </div>
            </div>

            {/* Progress Card */}
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Your Contribution</h3>
                    <p className="text-sm text-slate-500">For {activeQuota.name}</p>
                  </div>
                  <span className="text-2xl font-bold text-indigo-600">{userProblemCount} <span className="text-gray-400 text-lg font-normal">/ {userTarget}</span></span>
                </div>
                
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-4">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${progressPercent >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-indigo-500 to-purple-600'}`} 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Your Submissions</h3>
                <Button variant="ghost" onClick={() => setView('submit')} className="text-sm">
                  <PlusCircle className="w-4 h-4" /> Add Problem
                </Button>
              </div>
              
              {isLoadingData && <p className="text-sm text-gray-400 mb-4">Refreshing data...</p>}

              {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length > 0 ? (
                <div className="grid gap-6">
                  {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).map(p => (
                    <ProblemCard 
                        key={p.id} 
                        problem={p} 
                        showAuthor={true} 
                        currentUserId={currentUser.id}
                        onUpvote={handleToggleVote}
                        votingPower={currentUser.votingPower}
                    />
                  ))}
                </div>
              ) : (
                  <p className="text-slate-400 italic">No submissions for this round yet.</p>
              )}
            </div>
          </div>
        )}

        {/* VIEW: SUBMIT */}
        {view === 'submit' && (
          <div className="max-w-3xl mx-auto">
            <header className="mb-8">
              <Button variant="ghost" onClick={() => setView('dashboard')} className="mb-4 pl-0 hover:bg-transparent text-slate-500 hover:text-slate-900">
                 ← Back to Dashboard
              </Button>
              <h1 className="text-3xl font-bold text-slate-900">New Submission</h1>
              <p className="text-slate-500">Contributing to: <span className="font-bold text-indigo-600">{activeQuota.name}</span></p>
            </header>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="px-8 pt-6 pb-2">
                 <div className="bg-white border border-blue-200 p-4 rounded-xl flex gap-3 items-start">
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-800">Round Instructions</h4>
                      <p className="text-sm text-blue-700 mt-1">{activeQuota.instructions}</p>
                    </div>
                 </div>
               </div>

              <div className="p-8 space-y-8">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Problem Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. The Three Triangles"
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-black placeholder:text-slate-400"
                  />
                </div>

                {/* Statement */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Problem Statement
                  </label>
                  <textarea 
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    rows={8}
                    placeholder="Let ABC be a triangle where..."
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-serif text-black text-base leading-relaxed"
                  />
                  <p className="mt-2 text-xs text-slate-400 text-right">Markdown supported (basic)</p>
                </div>

                {/* Anti-Cheat Pledge */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-start gap-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setIsVerified(!isVerified)}>
                   <div className={`mt-0.5 w-5 h-5 rounded border border-slate-400 flex items-center justify-center shrink-0 ${isVerified ? 'bg-indigo-600 border-indigo-600' : 'bg-white'}`}>
                      {isVerified && <BadgeCheck className="w-4 h-4 text-white" />}
                   </div>
                   <div className="select-none">
                      <label className="font-bold text-slate-900 text-sm cursor-pointer">I certify that this is a valid problem.</label>
                      <p className="text-xs text-slate-500 mt-1">To prevent quota spam, all submissions are monitored.</p>
                   </div>
                </div>

                {/* Error Message */}
                {submissionError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-700 text-sm">Submission Rejected</h4>
                      <p className="text-red-600 text-sm mt-1">{submissionError}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-white border-t border-slate-200 flex justify-end gap-3 items-center">
                <Button variant="ghost" onClick={() => setView('dashboard')}>Cancel</Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!title || !statement || !isVerified}
                  isLoading={isSubmitting}
                >
                  Submit Problem
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: POOL (BLIND REVIEW) */}
        {view === 'pool' && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-8 flex justify-between items-center">
               <div>
                  <h1 className="text-3xl font-bold text-slate-900">Problem Pool</h1>
                  <p className="text-slate-500 mt-2">
                    {problems.length} problems submitted • <span className="text-indigo-600 font-semibold">Blind Review Active</span>
                  </p>
               </div>
            </header>

            <div className="grid gap-6">
              {problems.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <BookOpen className="w-10 h-10 text-slate-300" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-900">The pool is empty</h2>
                   <p className="text-slate-500 mt-2">Be the first to submit a problem!</p>
                </div>
              ) : (
                // Use poolIds to render in frozen order, but find the live problem object
                poolIds.map(id => {
                  const p = problems.find(prob => prob.id === id);
                  if (!p) return null;
                  return (
                    <ProblemCard 
                      key={p.id} 
                      problem={p} 
                      showAuthor={p.authorId === currentUser.id} // ONLY show if it is MY problem. Admin sees blind.
                      currentUserId={currentUser.id}
                      onUpvote={handleToggleVote}
                      votingPower={currentUser.votingPower}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW: ADMIN PANEL */}
        {view === 'admin' && isDirector && (
          <div className="max-w-5xl mx-auto">
             <h1 className="text-3xl font-bold text-slate-900 mb-8">Contest Administration</h1>
             
             <div className="grid md:grid-cols-2 gap-8 mb-8">
                {/* Quota Management */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                   <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" /> Quota / Rounds
                   </h3>
                   
                   <div className="flex-1 space-y-3 mb-6">
                      {quotas.map(q => (
                         <div key={q.id} className={`p-4 rounded-xl border flex flex-col gap-2 ${activeQuotaId === q.id ? 'bg-white border-indigo-500 shadow-md' : 'bg-white border-slate-200'}`}>
                            {editingQuotaId === q.id ? (
                               <div className="space-y-2">
                                  <input 
                                    className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-black text-sm" 
                                    value={editQuotaForm.name} 
                                    onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})}
                                    placeholder="Name"
                                  />
                                  <div className="flex gap-2">
                                    <input 
                                      className="w-20 px-2 py-1 border border-slate-300 rounded bg-white text-black text-sm" 
                                      type="number"
                                      value={editQuotaForm.target} 
                                      onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})}
                                      placeholder="Qty"
                                    />
                                    <div className="flex-1">
                                        <input 
                                          type="date"
                                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-black text-sm" 
                                          value={editQuotaForm.dueDate ? new Date(editQuotaForm.dueDate).toISOString().split('T')[0] : ''}
                                          onChange={e => setEditQuotaForm({...editQuotaForm, dueDate: e.target.valueAsNumber})}
                                        />
                                    </div>
                                  </div>
                                  <input 
                                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-black text-sm" 
                                      value={editQuotaForm.instructions} 
                                      onChange={e => setEditQuotaForm({...editQuotaForm, instructions: e.target.value})}
                                      placeholder="Instructions"
                                  />
                                  <div className="flex justify-end gap-2 mt-2">
                                     <button onClick={cancelEditQuota} className="p-1 text-red-500 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                     <button onClick={saveQuota} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                                  </div>
                               </div>
                            ) : (
                               <div className="flex justify-between items-center">
                                  <div>
                                     <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900">{q.name}</span>
                                        {activeQuotaId === q.id && <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Active</span>}
                                     </div>
                                     <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                         <span>Target: {q.target}</span>
                                         <span>•</span>
                                         <span className={q.dueDate ? 'text-indigo-600' : 'text-slate-400'}>
                                             {getFormatDate(q.dueDate)}
                                         </span>
                                     </div>
                                  </div>
                                  <div className="flex gap-1">
                                     <button onClick={() => startEditQuota(q)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                                        <Pencil className="w-4 h-4" />
                                     </button>
                                     {activeQuotaId !== q.id && (
                                        <Button size="sm" variant="secondary" onClick={() => switchQuota(q.id)} className="text-xs h-8 px-3">Activate</Button>
                                     )}
                                  </div>
                               </div>
                            )}
                         </div>
                      ))}
                   </div>

                   <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Create New Round</p>
                      <div className="space-y-3">
                         <div className="flex gap-2">
                           <input 
                              type="text" 
                              placeholder="Round Name" 
                              value={newQuotaName} 
                              onChange={e => setNewQuotaName(e.target.value)}
                              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                           />
                         </div>
                         <Button onClick={addQuota} disabled={!newQuotaName.trim()} className="w-full">Create Round</Button>
                      </div>
                   </div>
                </div>

                {/* Add User */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-indigo-600" /> Add New Writer
                   </h3>
                   <div className="space-y-4">
                      <input 
                        type="text" 
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input 
                        type="text" 
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <div className="flex justify-end pt-2">
                         <Button onClick={addUser} disabled={!newUserName.trim() || !newUserPassword.trim()}>
                           Create Account
                         </Button>
                      </div>
                   </div>
                </div>
             </div>

             {/* Writer Progress & Voting Power Table */}
             <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-indigo-600" /> Writer Management
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Configuring for Active Round: {activeQuota.name}</p>
                  </div>
               </div>
               <table className="w-full text-left">
                 <thead className="bg-white border-b border-slate-200">
                   <tr>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Writer</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Password</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Role & Power</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Active Target</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Progress</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {users.map(u => {
                     const uTarget = u.customTargets?.[activeQuotaId] || activeQuota.target;
                     // Important: use the updated count from the useEffect hook
                     const uCount = u.submittedCount || 0;
                     const isMet = uCount >= uTarget;
                     
                     if (editingUserId === u.id) {
                         // EDIT MODE ROW
                         return (
                            <tr key={u.id} className="bg-white shadow-inner">
                                <td className="px-6 py-4">
                                    <input 
                                        className="w-full px-2 py-1 border border-indigo-200 rounded text-sm text-black" 
                                        value={editUserForm.name} 
                                        onChange={e => setEditUserForm({...editUserForm, name: e.target.value})}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-slate-400"/>
                                        <input 
                                            className="w-24 px-2 py-1 border border-indigo-200 rounded text-sm text-black" 
                                            placeholder="Reset Pass"
                                            value={editUserForm.password}
                                            onChange={e => setEditUserForm({...editUserForm, password: e.target.value})}
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                     <div className="flex items-center gap-1">
                                        <Zap className="w-3 h-3 text-amber-500"/>
                                        <input 
                                            type="number"
                                            className="w-12 px-1 py-1 border border-indigo-200 rounded text-sm text-black text-center"
                                            value={editUserForm.votingPower}
                                            onChange={e => setEditUserForm({...editUserForm, votingPower: parseInt(e.target.value) || 0})}
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1">
                                        <Target className="w-3 h-3 text-indigo-500"/>
                                        <input 
                                            type="number"
                                            className="w-12 px-1 py-1 border border-indigo-200 rounded text-sm text-black text-center"
                                            value={editUserForm.customTargets?.[activeQuotaId] || activeQuota.target}
                                            onChange={e => updateUserTarget(u.id, parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400">
                                    Saving...
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => saveUser(u.id)} className="p-1 text-green-600 bg-white border border-green-200 rounded hover:bg-green-50"><Save className="w-4 h-4"/></button>
                                        <button onClick={() => setEditingUserId(null)} className="p-1 text-slate-500 bg-white border border-slate-200 rounded hover:bg-slate-50"><X className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                         )
                     }

                     return (
                       <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                         <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                           {u.name}
                           {u.role === 'admin' && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 rounded uppercase">Dir</span>}
                         </td>
                         <td className="px-6 py-4 text-sm font-mono text-black">
                            {u.password || '********'}
                         </td>
                         <td className="px-6 py-4 text-sm">
                           <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-500" />
                              <span className="font-bold text-slate-700">{u.votingPower}</span>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-sm">
                             <div className="flex items-center gap-1">
                                <span className={`font-bold ${u.customTargets?.[activeQuotaId] ? 'text-indigo-600' : 'text-slate-500'}`}>
                                    {uTarget}
                                </span>
                             </div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold w-12 text-black">{uCount} / {uTarget}</span>
                                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                    className={`h-full rounded-full ${isMet ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${Math.min((uCount / uTarget) * 100, 100)}%` }}
                                    ></div>
                                </div>
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditUser(u)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors" title="Edit User">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                {u.role !== 'admin' && (
                                    <button onClick={() => deleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors" title="Delete User">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
}