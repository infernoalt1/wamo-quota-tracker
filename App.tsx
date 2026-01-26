import React, { useState, useEffect } from 'react';
import { Problem, User, Quota, Topic, ProblemStatus } from './types';
import { Button } from './components/Button';
import { ProblemCard } from './components/ProblemCard';
import { MathText } from './components/MathText';
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
  BadgeCheck,
  Pencil,
  Save,
  X,
  Trash2,
  Lock,
  Clock,
  RotateCcw,
  Info,
  Filter,
  ArrowUpDown,
  Search,
  ExternalLink,
  AlertCircle,
  Layers,
  Zap,
  Download,
  CheckCircle,
  Crown,
  ThumbsUp,
  ChevronRight
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
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active
        ? 'bg-indigo-50 text-indigo-700 font-bold'
        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
    }`}
  >
    <div className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</div>
    {label}
  </button>
);

const TOPICS: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

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

  // --- Form State (Submit/Edit) ---
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [difficulty, setDifficulty] = useState<string>('3.0');
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [isVerified, setIsVerified] = useState(false); 
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Admin Editing State
  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null);
  const [editQuotaForm, setEditQuotaForm] = useState<Partial<Quota>>({});
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<Partial<User> & { password?: string }>({});

  
  // Admin Create New User State
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'writer' | 'director'>('writer');
  
  // Quota Create New State
  const [newQuotaName, setNewQuotaName] = useState('');
  const [newQuotaTarget, setNewQuotaTarget] = useState(5);
  const [newVoteTarget, setNewVoteTarget] = useState(3);
  const [newQuotaInstr, setNewQuotaInstr] = useState('');

  // Pool View State (Sorting/Filtering)
  const [poolSort, setPoolSort] = useState<'highest' | 'lowest' | 'hardest' | 'easiest' | 'newest'>('highest');
  const [poolFilterTopic, setPoolFilterTopic] = useState<string>('All');
  const [poolFilterStatus, setPoolFilterStatus] = useState<string>('All');
  const [poolFilterDiffMin, setPoolFilterDiffMin] = useState<number>(0);
  const [poolFilterDiffMax, setPoolFilterDiffMax] = useState<number>(10);
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

  // Update Users submitted & voted count locally based on ACTIVE QUOTA
  // This logic runs client side to keep UI snappy
  useEffect(() => {
    if (problems.length >= 0 && users.length > 0) {
      const activeProblems = problems.filter(p => p.quotaId === activeQuotaId);
      
      const updatedUsers = users.map(u => ({
        ...u,
        submittedCount: activeProblems.filter(p => p.authorId === u.id).length,
        voteCount: activeProblems.filter(p => p.votedBy?.includes(u.id)).length
      }));
      
      const isDifferent = JSON.stringify(updatedUsers.map(u => ({s: u.submittedCount, v: u.voteCount}))) !== JSON.stringify(users.map(u => ({s: u.submittedCount, v: u.voteCount})));
      if (isDifferent) {
         setUsers(updatedUsers);
      }
    }
  }, [problems, activeQuotaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Pool Sorting & Filtering
  useEffect(() => {
    if (view === 'pool') {
      let filtered = [...problems];

      // Filter by Topic
      if (poolFilterTopic !== 'All') {
          filtered = filtered.filter(p => p.topics && p.topics.includes(poolFilterTopic as Topic));
      }

      // Filter by Status
      if (poolFilterStatus !== 'All') {
          filtered = filtered.filter(p => {
             const s = p.status || 'pending';
             return s === poolFilterStatus;
          });
      }

      // Filter by Difficulty
      filtered = filtered.filter(p => {
          const d = p.difficulty || 0;
          return d >= poolFilterDiffMin && d <= poolFilterDiffMax;
      });

      // Sort
      filtered.sort((a, b) => {
          const scoreA = a.score || 0;
          const scoreB = b.score || 0;
          const diffA = a.difficulty || 0;
          const diffB = b.difficulty || 0;

          switch(poolSort) {
              case 'highest': return scoreB - scoreA;
              case 'lowest': return scoreA - scoreB;
              case 'hardest': return diffB - diffA;
              case 'easiest': return diffA - diffB;
              case 'newest': return b.createdAt - a.createdAt;
              default: return 0;
          }
      });

      setPoolIds(filtered.map(p => p.id));
    }
  }, [view, problems.length, poolSort, poolFilterTopic, poolFilterStatus, poolFilterDiffMin, poolFilterDiffMax]); 

  // --- Helpers ---
  const getActiveQuota = () => quotas.find(q => q.id === activeQuotaId) || quotas[0] || { id: 'default', target: 5, voteTarget: 3, name: 'Default', instructions: '', dueDate: null };
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
          voteTarget: newVoteTarget,
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
        voteTarget: editQuotaForm.voteTarget || 3,
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
          role: newUserRole,
          submittedCount: 0,
          votingPower: newUserRole === 'director' ? 5 : 1, // Auto-set higher power for directors 
          customTargets: {}
        });
        setUsers([...users, newUser]);
        setNewUserName('');
        setNewUserPassword('');
        setNewUserRole('writer');
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
        alert("Action failed. You may not have permission to delete this user.");
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
          customTargets: editUserForm.customTargets || currentTargets,
          role: editUserForm.role // Allows admin to promote/demote if backend supports
      });
      await refreshData();
      setEditingUserId(null);
    } catch (e) {
      console.error("Failed to update user");
      alert("Update failed. Directors cannot change passwords.");
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

  const handleResetVotes = async () => {
    if (!window.confirm("WARNING: This will remove ALL votes from the database and set all problem scores to zero. This action cannot be undone. Are you sure?")) return;
    try {
        await api.resetVotes();
        await refreshData();
        alert("All votes have been reset.");
    } catch(e) {
        console.error("Failed to reset votes");
        alert("Reset failed.");
    }
  };

  // -- Submission & Editing --
  
  const resetForm = () => {
    setTitle('');
    setStatement('');
    setDifficulty('3.0');
    setSelectedTopics([]);
    setIsVerified(false);
    setEditingProblemId(null);
    setSubmissionError(null);
    setAiAnalysis(null);
  };

  const handleStartEdit = (prob: Problem) => {
      setEditingProblemId(prob.id);
      setTitle(prob.title);
      setStatement(prob.statement);
      setDifficulty(prob.difficulty.toString());
      setSelectedTopics(prob.topics || []);
      setIsVerified(true); // Auto-verify on edit since it's already there
      setView('submit');
  };

  const handleTopicToggle = (topic: Topic) => {
      if (selectedTopics.includes(topic)) {
          setSelectedTopics(selectedTopics.filter(t => t !== topic));
      } else {
          setSelectedTopics([...selectedTopics, topic]);
      }
  };

  const handleAiAnalyze = async () => {
     if (!statement) return;
     setIsAnalyzing(true);
     setAiAnalysis(null);
     try {
       const result = await api.analyzeProblem({
         title: title || 'Untitled',
         statement,
         difficulty: parseFloat(difficulty)
       });
       setAiAnalysis(result);
     } catch(e) {
       console.error(e);
       setAiAnalysis("Could not reach AI service. Please try again.");
     } finally {
       setIsAnalyzing(false);
     }
  };

  const handleSubmit = async () => {
    if (!currentUser || !title || !statement || !isVerified) return;
    if (selectedTopics.length === 0) {
        setSubmissionError("Please select at least one topic.");
        return;
    }
    
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      const payload = {
          title,
          statement,
          difficulty: parseFloat(difficulty),
          topics: selectedTopics,
          quotaId: activeQuotaId
      };

      if (editingProblemId) {
          await api.updateProblem(editingProblemId, payload);
      } else {
          await api.submitProblem({
              ...payload,
              authorId: currentUser.id,
              authorName: currentUser.name,
          });
      }
      
      await refreshData();
      resetForm();
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
    } catch (e) {
        setProblems(oldProblems);
        console.error("Vote failed");
    }
  };

  const handleStatusChange = async (problemId: string, status: ProblemStatus) => {
     try {
        await api.updateProblemStatus(problemId, status);
        // Optimistic update
        const updated = problems.map(p => p.id === problemId ? { ...p, status } : p);
        setProblems(updated);
     } catch(e) {
        console.error("Failed to update status");
     }
  };

  const handleExportLatex = () => {
      // Very basic LaTeX export
      const activeProblems = problems.filter(p => p.quotaId === activeQuotaId);
      let tex = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{enumitem}

\\title{${activeQuota.name}}
\\date{\\today}

\\begin{document}
\\maketitle

\\section*{Problems}
\\begin{enumerate}
`;

      activeProblems.forEach(p => {
         tex += `  \\item \\textbf{${p.title}} (Diff: ${p.difficulty})
         
         ${p.statement}
         
         \\vspace{0.5cm}
`;
      });

      tex += `\\end{enumerate}
\\end{document}`;

      const blob = new Blob([tex], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeQuota.name.replace(/\s+/g, '_')}.tex`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  // --- Component Logic ---

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-8 border border-white/50 backdrop-blur-sm">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg transform rotate-3">
              <BookOpen size={32} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center tracking-tight">WAMO Tracker</h1>
          <p className="text-gray-500 mb-8 text-center text-sm">Middle School Math Contest Portal</p>
          
          {!selectedLoginId ? (
            <div className="space-y-3">
               <div className="flex items-center justify-between px-1">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select User</p>
                 {usersError && (
                     <button onClick={initApp} className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                        <RotateCcw className="w-3 h-3" /> Retry
                     </button>
                 )}
               </div>
               
               <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {usersLoading && users.length === 0 && <div className="text-sm text-gray-400 italic p-4 text-center">Loading users...</div>}
                  
                  {usersError && users.length === 0 && (
                      <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          <div>
                            <p className="font-semibold">Connection Error</p>
                            <p className="text-xs mt-1 text-red-500 opacity-90">Backend server is unreachable.</p>
                          </div>
                      </div>
                  )}

                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedLoginId(user.id)}
                      className="w-full p-3.5 bg-gray-50 hover:bg-white hover:shadow-md border border-transparent hover:border-indigo-100 rounded-xl text-left transition-all duration-200 group flex items-center justify-between"
                    >
                      <span className="font-semibold text-gray-700 group-hover:text-indigo-700">{user.name}</span>
                      <div className="flex gap-2">
                        {user.role === 'admin' && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm">Admin</span>}
                        {user.role === 'director' && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shadow-sm">Director</span>}
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
                      </div>
                    </button>
                  ))}
               </div>
            </div>
          ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {users.find(u => u.id === selectedLoginId)?.name.charAt(0)}
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 font-semibold uppercase">Signing in as</p>
                        <p className="text-sm font-bold text-gray-900 leading-none mt-0.5">{users.find(u => u.id === selectedLoginId)?.name}</p>
                    </div>
                </div>
                <button onClick={() => { setSelectedLoginId(''); setLoginPassword(''); setLoginError(''); }} className="text-xs text-gray-400 hover:text-gray-600 font-medium">Change</button>
              </div>
              
              <div>
                <input 
                  type="password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-gray-400"
                  autoFocus
                />
                {loginError && <p className="text-red-500 text-xs mt-2 flex items-center gap-1 font-medium"><ShieldAlert className="w-3 h-3"/> {loginError}</p>}
              </div>
              
              <Button onClick={handleLogin} className="w-full py-3 text-lg shadow-indigo-200">Sign In</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeQuota = getActiveQuota();
  // Get override or default
  const submissionTarget = currentUser.customTargets?.[activeQuotaId] || activeQuota.target;
  // Vote target is currently global per quota
  const voteTarget = activeQuota.voteTarget || 3;

  // Count only for active quota
  const submissionCount = problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length;
  // Count votes
  const userVoteCount = problems.filter(p => p.quotaId === activeQuotaId && p.votedBy?.includes(currentUser.id)).length;

  const subPercent = Math.min((submissionCount / submissionTarget) * 100, 100);
  const votePercent = Math.min((userVoteCount / voteTarget) * 100, 100);
  
  const isDirector = currentUser.role === 'admin' || currentUser.role === 'director';

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
        <div className="p-6 border-b border-slate-50">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                <BookOpen className="w-4 h-4" strokeWidth={3} />
            </div>
            WAMO Tracker
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
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
            onClick={() => { resetForm(); setView('submit'); }} 
          />
          <NavItem 
            icon={<Layers className="w-5 h-5" />} 
            label="Problem Pool" 
            active={view === 'pool'} 
            onClick={() => setView('pool')} 
          />
          {isDirector && (
            <>
              <div className="mt-8 mb-2 px-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Administration</p>
              </div>
              <NavItem 
                icon={<Settings className="w-5 h-5" />} 
                label="Director Panel" 
                active={view === 'admin'} 
                onClick={() => setView('admin')} 
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${currentUser.role === 'admin' ? 'bg-purple-600' : currentUser.role === 'director' ? 'bg-indigo-600' : 'bg-slate-500'}`}>
                {currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                    {currentUser.role}
                    <span className="text-slate-300">•</span>
                    Power: {currentUser.votingPower}
                </p>
                </div>
              </div>
              <Button variant="ghost" onClick={handleLogout} className="w-full text-xs h-8 justify-center text-slate-500 hover:text-red-600 hover:bg-white shadow-sm border border-transparent hover:border-slate-200">
                Log Out
              </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar">
        
        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
          <div className="max-w-5xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hello, {currentUser.name.split(' ')[0]}</h1>
                <p className="text-slate-500 mt-1">Here is the current round status.</p>
              </div>
            </header>

            {/* Active Round Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <BookOpen size={120} />
                </div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                   <div>
                      <div className="flex items-center gap-2 mb-2">
                         <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">Active Round</span>
                         {activeQuota.dueDate && (
                           <span className="px-2 py-1 rounded bg-orange-50 text-orange-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                               <Clock className="w-3 h-3"/> {getFormatDate(activeQuota.dueDate)}
                           </span>
                         )}
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900">{activeQuota.name}</h2>
                   </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-600 text-sm relative z-10">
                   <strong className="text-slate-900 font-semibold block mb-1">Director's Note:</strong> {activeQuota.instructions}
                </div>
            </div>

            {/* Progress Cards Grid */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Writing Progress */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-indigo-500" /> Writing Quota
                            </h3>
                            {submissionCount >= submissionTarget ? 
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Done</span> : 
                                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{submissionCount} / {submissionTarget}</span>
                            }
                        </div>
                        <div className="text-3xl font-black text-slate-900 mt-2">
                            {Math.round(subPercent)}%
                        </div>
                    </div>
                    
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden relative z-10">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${submissionCount >= submissionTarget ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                            style={{ width: `${subPercent}%` }}
                        ></div>
                    </div>

                    {/* Decorative bg */}
                    <div className="absolute -bottom-4 -right-4 text-indigo-50 opacity-50 group-hover:scale-110 transition-transform duration-500">
                        <Pencil size={100} />
                    </div>
                </div>

                {/* Voting Progress */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-48 relative overflow-hidden group hover:border-teal-200 transition-colors">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <ThumbsUp className="w-4 h-4 text-teal-500" /> Voting Quota
                            </h3>
                            {userVoteCount >= voteTarget ? 
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Done</span> : 
                                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-2 py-1 rounded-full">{userVoteCount} / {voteTarget}</span>
                            }
                        </div>
                        <div className="text-3xl font-black text-slate-900 mt-2">
                            {Math.round(votePercent)}%
                        </div>
                    </div>
                    
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden relative z-10">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${userVoteCount >= voteTarget ? 'bg-emerald-500' : 'bg-teal-500'}`} 
                            style={{ width: `${votePercent}%` }}
                        ></div>
                    </div>

                    {/* Decorative bg */}
                    <div className="absolute -bottom-4 -right-4 text-teal-50 opacity-50 group-hover:scale-110 transition-transform duration-500">
                        <ThumbsUp size={100} />
                    </div>
                </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Your Submissions</h3>
                <Button variant="ghost" onClick={() => { resetForm(); setView('submit'); }} className="text-sm">
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
                        currentUserRole={currentUser.role}
                        onUpvote={handleToggleVote}
                        onEdit={handleStartEdit}
                        onStatusChange={handleStatusChange}
                        votingPower={currentUser.votingPower}
                    />
                  ))}
                </div>
              ) : (
                  <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                      <p className="text-slate-400 italic">No submissions for this round yet.</p>
                      <Button variant="secondary" onClick={() => { resetForm(); setView('submit'); }} className="mt-4 mx-auto">Start Writing</Button>
                  </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: SUBMIT / EDIT */}
        {view === 'submit' && (
          <div className="max-w-3xl mx-auto">
            <header className="mb-8">
              <Button variant="ghost" onClick={() => setView('dashboard')} className="mb-4 pl-0 hover:bg-transparent text-slate-500 hover:text-slate-900">
                 ← Back to Dashboard
              </Button>
              <h1 className="text-3xl font-bold text-slate-900">
                  {editingProblemId ? 'Edit Problem' : 'New Submission'}
              </h1>
              <p className="text-slate-500">Contributing to: <span className="font-bold text-indigo-600">{activeQuota.name}</span></p>
            </header>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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

                {/* Topics & Difficulty */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Difficulty Rating</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                step="0.1"
                                min="0"
                                max="50"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-black"
                            />
                        </div>
                        <a 
                            href="https://artofproblemsolving.com/wiki/index.php/AoPS_Wiki:Competition_ratings" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline mt-2 flex items-center gap-1"
                        >
                            <ExternalLink className="w-3 h-3" /> AoPS Rating Guide (Tenths place only)
                        </a>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Topics (Select at least 1)</label>
                        <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            {TOPICS.map(t => (
                                <label key={t} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                                    <input 
                                        type="checkbox"
                                        checked={selectedTopics.includes(t)}
                                        onChange={() => handleTopicToggle(t)}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm text-slate-700">{t}</span>
                                </label>
                            ))}
                        </div>
                    </div>
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
                    placeholder="Let $ABC$ be a triangle where..."
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-serif text-black text-base leading-relaxed mb-4"
                  />
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Live Preview (LaTeX supported: $...$ or $$...$$)</span>
                       <Button size="sm" variant="secondary" onClick={handleAiAnalyze} isLoading={isAnalyzing} className="text-xs py-1 h-7">
                          ✨ Analyze with AI
                       </Button>
                     </div>
                     <MathText 
                         text={statement || 'Type above to preview...'} 
                         className="font-serif text-slate-800 text-base leading-relaxed whitespace-pre-wrap min-h-[40px]" 
                     />
                     
                     {/* AI Feedback Box */}
                     {aiAnalysis && (
                         <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm text-indigo-900 relative animate-in fade-in zoom-in-95">
                             <h5 className="font-bold flex items-center gap-2 mb-1"><Zap className="w-4 h-4 text-indigo-600" /> AI Feedback</h5>
                             <p className="whitespace-pre-wrap">{aiAnalysis}</p>
                             <button onClick={() => setAiAnalysis(null)} className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-700"><X className="w-4 h-4" /></button>
                         </div>
                     )}
                  </div>
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
                  {editingProblemId ? 'Update Problem' : 'Submit Problem'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: POOL (BLIND REVIEW) */}
        {view === 'pool' && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
               <div>
                  <h1 className="text-3xl font-bold text-slate-900">Problem Pool</h1>
                  <p className="text-slate-500 mt-2">
                    {problems.length} problems submitted • <span className="text-indigo-600 font-semibold">Blind Review Active</span>
                  </p>
               </div>
            </header>
            
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center flex-wrap">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-semibold">
                    <Filter className="w-4 h-4" /> Filters:
                </div>
                
                {/* Topic Filter */}
                <select 
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={poolFilterTopic}
                    onChange={(e) => setPoolFilterTopic(e.target.value)}
                >
                    <option value="All">All Topics</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Status Filter */}
                <select 
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={poolFilterStatus}
                    onChange={(e) => setPoolFilterStatus(e.target.value)}
                >
                    <option value="All">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="accepted">Accepted</option>
                </select>

                {/* Difficulty Filter */}
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 uppercase">Diff</span>
                    <input 
                        type="number" 
                        className="w-12 bg-transparent text-sm text-center outline-none border-b border-transparent focus:border-indigo-500"
                        value={poolFilterDiffMin}
                        onChange={e => setPoolFilterDiffMin(Number(e.target.value))}
                        placeholder="Min"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                        type="number" 
                        className="w-12 bg-transparent text-sm text-center outline-none border-b border-transparent focus:border-indigo-500"
                        value={poolFilterDiffMax}
                        onChange={e => setPoolFilterDiffMax(Number(e.target.value))}
                        placeholder="Max"
                    />
                </div>

                <div className="flex-1"></div>

                {/* Sorting */}
                <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4 text-slate-400" />
                    <select 
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={poolSort}
                        onChange={(e) => setPoolSort(e.target.value as any)}
                    >
                        <option value="highest">Votes: High to Low</option>
                        <option value="lowest">Votes: Low to High</option>
                        <option value="hardest">Difficulty: Hardest First</option>
                        <option value="easiest">Difficulty: Easiest First</option>
                        <option value="newest">Newest First</option>
                    </select>
                </div>
            </div>

            <div className="grid gap-6">
              {poolIds.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-3xl border border-slate-200 shadow-sm">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search className="w-10 h-10 text-slate-300" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-900">No problems found</h2>
                   <p className="text-slate-500 mt-2">Try adjusting your filters.</p>
                </div>
              ) : (
                // Use poolIds to render in filtered/sorted order
                poolIds.map(id => {
                  const p = problems.find(prob => prob.id === id);
                  if (!p) return null;
                  return (
                    <ProblemCard 
                      key={p.id} 
                      problem={p} 
                      showAuthor={p.authorId === currentUser.id} // ONLY show if it is MY problem. Admin sees blind.
                      currentUserId={currentUser.id}
                      currentUserRole={currentUser.role}
                      onUpvote={handleToggleVote}
                      onEdit={handleStartEdit}
                      onStatusChange={handleStatusChange}
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
             <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Contest Administration</h1>
                <div className="flex gap-2">
                  <Button onClick={handleExportLatex} size="sm" variant="secondary" className="gap-2">
                      <Download className="w-4 h-4" /> Export TeX
                  </Button>
                  {/* DANGER: Reset Votes Button (Admin Only) */}
                  {currentUser.role === 'admin' && (
                     <Button onClick={handleResetVotes} size="sm" variant="danger" className="gap-2">
                         <ShieldAlert className="w-4 h-4" /> Reset All Votes
                     </Button>
                  )}
                </div>
             </div>
             
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
                                    <div className="flex flex-col gap-1 w-24">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Prob Qty</label>
                                        <input 
                                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-black text-sm" 
                                        type="number"
                                        value={editQuotaForm.target} 
                                        onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 w-24">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Vote Qty</label>
                                        <input 
                                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-black text-sm" 
                                        type="number"
                                        value={editQuotaForm.voteTarget} 
                                        onChange={e => setEditQuotaForm({...editQuotaForm, voteTarget: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Due Date</label>
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
                                         <span>Write: {q.target}</span>
                                         <span>•</span>
                                         <span>Vote: {q.voteTarget || 3}</span>
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
                      <UserPlus className="w-5 h-5 text-indigo-600" /> Add New User
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
                      
                      <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                          <button 
                             onClick={() => setNewUserRole('writer')} 
                             className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${newUserRole === 'writer' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             Writer
                          </button>
                          <button 
                             onClick={() => setNewUserRole('director')} 
                             className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${newUserRole === 'director' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             Director
                          </button>
                      </div>

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
                        <TrendingUp className="w-5 h-5 text-indigo-600" /> User Management
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Configuring for Active Round: {activeQuota.name}</p>
                  </div>
               </div>
               <table className="w-full text-left">
                 <thead className="bg-white border-b border-slate-200">
                   <tr>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">User</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Password</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Role & Power</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Write Override</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Progress (Write/Vote)</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {users.map(u => {
                     const uTarget = u.customTargets?.[activeQuotaId] || activeQuota.target;
                     const uVoteTarget = activeQuota.voteTarget || 3;
                     const uCount = u.submittedCount || 0;
                     const uVoteCount = u.voteCount || 0;
                     
                     // Permission check
                     const canEditThisUser = currentUser.role === 'admin' || (currentUser.role === 'director' && u.role !== 'admin');
                     const canDeleteThisUser = canEditThisUser && u.role !== 'director';

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
                                    {currentUser.role === 'admin' && (
                                       <select 
                                         className="mt-1 w-full text-xs border border-indigo-200 rounded p-1 bg-white"
                                         value={editUserForm.role}
                                         onChange={e => setEditUserForm({...editUserForm, role: e.target.value as any})}
                                       >
                                           <option value="writer">Writer</option>
                                           <option value="director">Director</option>
                                           <option value="admin">Admin</option>
                                       </select>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {currentUser.role === 'admin' ? (
                                        <div className="flex items-center gap-1">
                                            <Lock className="w-3 h-3 text-slate-400"/>
                                            <input 
                                                className="w-24 px-2 py-1 border border-indigo-200 rounded text-sm text-black" 
                                                placeholder="Reset Pass"
                                                value={editUserForm.password}
                                                onChange={e => setEditUserForm({...editUserForm, password: e.target.value})}
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic flex items-center gap-1">
                                            <Lock className="w-3 h-3"/> Locked
                                        </span>
                                    )}
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
                           {u.role === 'admin' && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 rounded uppercase flex items-center gap-1"><Crown className="w-3 h-3"/> Admin</span>}
                           {u.role === 'director' && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 rounded uppercase">Director</span>}
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
                                <span className="font-bold text-slate-700">
                                    {uTarget}
                                </span>
                             </div>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col gap-2 min-w-[120px]">
                              {/* Writing Progress */}
                              <div className="flex items-center gap-2 text-xs">
                                <Pencil className="w-3 h-3 text-indigo-400" />
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                    className={`h-full rounded-full ${uCount >= uTarget ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${Math.min((uCount / uTarget) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <span className={`font-mono font-bold ${uCount >= uTarget ? 'text-emerald-600' : 'text-slate-500'}`}>{uCount}/{uTarget}</span>
                              </div>
                              {/* Voting Progress */}
                              <div className="flex items-center gap-2 text-xs">
                                <ThumbsUp className="w-3 h-3 text-teal-400" />
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                    className={`h-full rounded-full ${uVoteCount >= uVoteTarget ? 'bg-emerald-500' : 'bg-teal-500'}`} 
                                    style={{ width: `${Math.min((uVoteCount / uVoteTarget) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <span className={`font-mono font-bold ${uVoteCount >= uVoteTarget ? 'text-emerald-600' : 'text-slate-500'}`}>{uVoteCount}/{uVoteTarget}</span>
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canEditThisUser && (
                                    <button onClick={() => startEditUser(u)} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors" title="Edit User">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}
                                {canDeleteThisUser && (
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