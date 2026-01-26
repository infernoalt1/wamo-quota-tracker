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
  ChevronRight,
  User as UserIcon,
  Image as ImageIcon,
  LayoutList,
  ArrowRight,
  ArrowUp,
  ArrowDown
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
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
      active
        ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
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
  const [view, setView] = useState<'dashboard' | 'pool' | 'submit' | 'admin' | 'composer'>('dashboard');
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
  const [imageData, setImageData] = useState<string | null>(null);
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
  const [poolFilterQuota, setPoolFilterQuota] = useState<string>('All');
  const [poolFilterDiffMin, setPoolFilterDiffMin] = useState<number>(0);
  const [poolFilterDiffMax, setPoolFilterDiffMax] = useState<number>(10);
  const [poolIds, setPoolIds] = useState<string[]>([]);

  // Composer State
  const [composerFilterTopic, setComposerFilterTopic] = useState<string>('All');

  // --- Initial Load ---
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
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

    const token = localStorage.getItem('token');
    if (token) {
        try {
            const me = await api.getMe();
            setCurrentUser(me);
            if (me.role === 'guest') {
                setView('submit');
            } else {
                const savedQ = localStorage.getItem('probfair_active_quota_id');
                if (savedQ) {
                   setActiveQuotaId(savedQ);
                   setPoolFilterQuota(savedQ);
                }
            }
        } catch(e) {
            localStorage.removeItem('token');
        }
    }
  };

  const refreshData = async () => {
      if (currentUser?.role === 'guest') {
          try {
             const q = await api.getQuotas();
             setQuotas(q);
             if (q.length > 0 && !q.find(i => i.id === activeQuotaId)) {
                setActiveQuotaId(q[0].id);
             }
          } catch(e) {}
          return;
      }

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
          
          if (q.length > 0 && !q.find(i => i.id === activeQuotaId)) {
             setActiveQuotaId(q[0].id);
             if (poolFilterQuota === activeQuotaId) setPoolFilterQuota(q[0].id);
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

  useEffect(() => {
    if (currentUser?.role === 'guest') return;

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
  }, [problems, activeQuotaId]); 

  useEffect(() => {
    if (view === 'pool') {
      let filtered = [...problems];
      if (poolFilterQuota !== 'All') filtered = filtered.filter(p => p.quotaId === poolFilterQuota);
      if (poolFilterTopic !== 'All') filtered = filtered.filter(p => p.topics && p.topics.includes(poolFilterTopic as Topic));
      if (poolFilterStatus !== 'All') filtered = filtered.filter(p => {
             const s = p.status || 'pending';
             return s === poolFilterStatus;
      });
      filtered = filtered.filter(p => {
          const d = p.difficulty || 0;
          return d >= poolFilterDiffMin && d <= poolFilterDiffMax;
      });
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
  }, [view, problems.length, poolSort, poolFilterTopic, poolFilterStatus, poolFilterDiffMin, poolFilterDiffMax, poolFilterQuota]); 

  const getActiveQuota = () => quotas.find(q => q.id === activeQuotaId) || quotas[0] || { id: 'default', target: 5, voteTarget: 3, name: 'Default', instructions: '', dueDate: null };
  const getFormatDate = (ts: number | null) => ts ? new Date(ts).toLocaleDateString() : 'No Deadline';

  const handleLogin = async () => {
    try {
        setLoginError('');
        const { user } = await api.login(selectedLoginId, loginPassword);
        setCurrentUser(user);
        setView(user.role === 'guest' ? 'submit' : 'dashboard');
        setLoginPassword('');
        setSelectedLoginId('');
    } catch (e) {
        setLoginError('Incorrect password or user');
    }
  };

  const handleGuestLogin = async () => {
    try {
        setLoginError('');
        const { user } = await api.guestLogin();
        setCurrentUser(user);
        setView('submit');
    } catch (e) {
        setLoginError('Guest login failed.');
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setView('dashboard');
    setTitle('');
    setStatement('');
  };

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
    } catch(e) { console.error(e); }
  };

  const startEditQuota = (q: Quota) => { setEditingQuotaId(q.id); setEditQuotaForm(q); };
  const cancelEditQuota = () => { setEditingQuotaId(null); setEditQuotaForm({}); };

  const saveQuota = async () => {
    if (!editingQuotaId || !editQuotaForm.name) return;
    try {
      await api.updateQuota({ ...editQuotaForm, id: editingQuotaId } as Quota);
      await refreshData();
      setEditingQuotaId(null);
    } catch (e) { console.error("Failed"); }
  };

  const switchQuota = (id: string) => {
    setActiveQuotaId(id);
    setPoolFilterQuota(id);
    localStorage.setItem('probfair_active_quota_id', id);
  };

  const addUser = async () => {
    if (!newUserName.trim() || !newUserPassword.trim()) return;
    try {
        const newUser = await api.createUser({
          name: newUserName.trim(),
          password: newUserPassword.trim(),
          role: newUserRole,
          submittedCount: 0,
          votingPower: newUserRole === 'director' ? 5 : 1,
          customTargets: {}
        });
        setUsers([...users, newUser]);
        setNewUserName(''); setNewUserPassword(''); setNewUserRole('writer');
    } catch(e) { console.error(e); }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try { await api.deleteUser(id); await refreshData(); } catch(e) { alert("Action failed."); }
  }

  const startEditUser = (user: User) => { setEditingUserId(user.id); setEditUserForm({ ...user, password: '' }); };

  const saveUser = async (userId: string) => {
    if (!editUserForm.name?.trim()) return;
    try {
      const currentTargets = users.find(u => u.id === userId)?.customTargets || {};
      await api.updateUser({ 
          ...editUserForm, id: userId, 
          customTargets: editUserForm.customTargets || currentTargets,
      });
      await refreshData();
      setEditingUserId(null);
    } catch (e) { alert("Update failed."); }
  };

  const updateUserTarget = (userId: string, target: number) => {
     const existingTargets = editUserForm.customTargets || users.find(u => u.id === userId)?.customTargets || {};
     setEditUserForm({ ...editUserForm, customTargets: { ...existingTargets, [activeQuotaId]: target } });
  }

  const handleResetVotes = async () => {
    if (!window.confirm("WARNING: This will remove ALL votes. Are you sure?")) return;
    try { await api.resetVotes(); await refreshData(); alert("Votes reset."); } catch(e) { alert("Failed."); }
  };

  const resetForm = () => {
    setTitle(''); setStatement(''); setDifficulty('3.0'); setSelectedTopics([]); setImageData(null);
    setIsVerified(false); setEditingProblemId(null); setSubmissionError(null);
  };

  const handleStartEdit = (prob: Problem) => {
      setEditingProblemId(prob.id); setTitle(prob.title); setStatement(prob.statement); setDifficulty(prob.difficulty.toString());
      setSelectedTopics(prob.topics || []); setImageData(prob.imageData || null); setIsVerified(true); setView('submit');
  };

  const handleTopicToggle = (topic: Topic) => {
      setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { alert("File > 2MB"); return; }
      const reader = new FileReader();
      reader.onloadend = () => setImageData(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser || !title || !statement || !isVerified) return;
    if (selectedTopics.length === 0) { setSubmissionError("Select a topic."); return; }
    
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      const payload = { title, statement, difficulty: parseFloat(difficulty), topics: selectedTopics, quotaId: activeQuotaId, imageData: imageData || undefined };
      if (editingProblemId) await api.updateProblem(editingProblemId, payload);
      else await api.submitProblem({ ...payload, authorId: currentUser.id, authorName: currentUser.name });
      
      if (currentUser.role === 'guest') { alert("Proposed!"); resetForm(); }
      else { await refreshData(); resetForm(); setView('dashboard'); }
    } catch (e: any) { setSubmissionError(e.message || "Error."); } finally { setIsSubmitting(false); }
  };

  const handleToggleVote = async (problemId: string) => {
    if (!currentUser || currentUser.role === 'guest') return;
    const oldProblems = [...problems];
    setProblems(prev => prev.map(p => {
       if (p.id === problemId) {
          const hasVoted = p.votedBy?.includes(currentUser.id);
          return {
             ...p,
             score: (p.score || 0) + (hasVoted ? -currentUser.votingPower : currentUser.votingPower),
             votedBy: hasVoted ? (p.votedBy || []).filter(id => id !== currentUser.id) : [...(p.votedBy || []), currentUser.id]
          };
       }
       return p;
    }));
    try { await api.toggleVote(problemId); } catch (e) { setProblems(oldProblems); }
  };

  const handleStatusChange = async (problemId: string, status: ProblemStatus) => {
     try { await api.updateProblemStatus(problemId, status); setProblems(prev => prev.map(p => p.id === problemId ? { ...p, status } : p)); } catch(e) {}
  };

  const handleAddToRound = async (problem: Problem) => {
      const accepted = problems.filter(p => p.quotaId === activeQuotaId && p.status === 'accepted');
      setProblems(prev => prev.map(p => p.id === problem.id ? { ...p, status: 'accepted', orderIndex: accepted.length } as Problem : p));
      try { await api.reorderRound([...accepted.map(p => p.id), problem.id]); } catch(e) { refreshData(); }
  };

  const handleRemoveFromRound = async (problem: Problem) => {
      setProblems(prev => prev.map(p => p.id === problem.id ? { ...p, status: 'shortlisted' } as Problem : p));
      try { await api.updateProblemStatus(problem.id, 'shortlisted'); } catch(e) { refreshData(); }
  };

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
      const accepted = problems.filter(p => p.quotaId === activeQuotaId && p.status === 'accepted').sort((a,b) => a.orderIndex - b.orderIndex);
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === accepted.length - 1)) return;
      const swapIdx = direction === 'up' ? index - 1 : index + 1;
      [accepted[index], accepted[swapIdx]] = [accepted[swapIdx], accepted[index]];

      const newOrderIds = accepted.map(p => p.id);
      setProblems(prev => prev.map(p => {
         const newIdx = newOrderIds.indexOf(p.id);
         return newIdx !== -1 ? { ...p, orderIndex: newIdx } : p;
      }));
      try { await api.reorderRound(newOrderIds); } catch(e) { refreshData(); }
  };

  const handleExportLatex = () => {
      const activeProblems = problems.filter(p => p.quotaId === activeQuotaId && p.status === 'accepted').sort((a,b) => a.orderIndex - b.orderIndex);
      let tex = `\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{enumerate}\n${activeProblems.map(p => `\\item ${p.title} (${p.difficulty})\n\n${p.statement}`).join('\n\n')}\n\\end{enumerate}`;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([tex], { type: 'text/plain' })); a.download = 'contest.tex'; a.click();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-sm">
        <div className="bg-white max-w-xs w-full rounded-xl shadow-lg p-6 border border-slate-100">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md">
              <BookOpen size={24} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1 text-center">WAMO Tracker</h1>
          <p className="text-slate-500 mb-6 text-center text-xs">Math Contest Portal</p>
          
          {!selectedLoginId ? (
            <div className="space-y-3">
               <div className="flex items-center justify-between px-1">
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select User</p>
               </div>
               
               <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedLoginId(user.id)}
                      className="w-full p-2.5 hover:bg-slate-50 rounded-lg text-left transition-colors group flex items-center justify-between border border-transparent hover:border-slate-100"
                    >
                      <span className="font-medium text-slate-700 group-hover:text-indigo-700 text-sm">{user.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400" />
                    </button>
                  ))}
               </div>

               <div className="pt-3 border-t border-slate-100">
                  <Button variant="secondary" onClick={handleGuestLogin} className="w-full text-xs py-2">
                    Guest Mode
                  </Button>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {users.find(u => u.id === selectedLoginId)?.name.charAt(0)}
                    </div>
                    <p className="text-sm font-bold text-slate-900">{users.find(u => u.id === selectedLoginId)?.name}</p>
                </div>
                <button onClick={() => { setSelectedLoginId(''); setLoginPassword(''); }} className="text-xs text-slate-400 hover:text-slate-600">Change</button>
              </div>
              <input 
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <Button onClick={handleLogin} className="w-full">Sign In</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeQuota = getActiveQuota();
  const submissionTarget = currentUser.customTargets?.[activeQuotaId] || activeQuota.target;
  const voteTarget = activeQuota.voteTarget || 3;
  const submissionCount = problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length;
  const userVoteCount = problems.filter(p => p.quotaId === activeQuotaId && p.votedBy?.includes(currentUser.id)).length;
  const subPercent = Math.min((submissionCount / submissionTarget) * 100, 100);
  const votePercent = Math.min((userVoteCount / voteTarget) * 100, 100);
  const isDirector = currentUser.role === 'admin' || currentUser.role === 'director';
  const isGuest = currentUser.role === 'guest';
  const composerAccepted = problems.filter(p => p.quotaId === activeQuotaId && p.status === 'accepted').sort((a,b) => a.orderIndex - b.orderIndex);
  const composerCandidates = problems.filter(p => p.quotaId === activeQuotaId && (p.status === 'shortlisted' || p.status === 'pending') && (composerFilterTopic === 'All' || p.topics.includes(composerFilterTopic as Topic))).sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row font-sans text-slate-900 text-sm">
      <aside className="w-full md:w-60 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-20">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white">
                <BookOpen className="w-3.5 h-3.5" strokeWidth={3} />
            </div>
            <h2 className="text-base font-bold tracking-tight">WAMO Tracker</h2>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {!isGuest && <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />}
          <NavItem icon={<PlusCircle className="w-4 h-4" />} label={isGuest ? "Propose Problem" : "Write Problem"} active={view === 'submit'} onClick={() => { resetForm(); setView('submit'); }} />
          {!isGuest && <NavItem icon={<Layers className="w-4 h-4" />} label="Problem Pool" active={view === 'pool'} onClick={() => setView('pool')} />}
          {isDirector && !isGuest && (
            <>
              <div className="mt-4 mb-1 px-3"><p className="text-[10px] font-bold text-slate-400 uppercase">Admin</p></div>
              <NavItem icon={<LayoutList className="w-4 h-4" />} label="Composer" active={view === 'composer'} onClick={() => setView('composer')} />
              <NavItem icon={<Settings className="w-4 h-4" />} label="Settings" active={view === 'admin'} onClick={() => setView('admin')} />
            </>
          )}
        </nav>
        <div className="p-3 border-t border-slate-100">
           <div className="flex items-center gap-2 px-2 mb-2">
             <div className="w-7 h-7 bg-slate-100 rounded flex items-center justify-center text-xs font-bold text-slate-600">
                 {isGuest ? <UserIcon className="w-3.5 h-3.5"/> : currentUser.name.charAt(0)}
             </div>
             <div className="min-w-0">
                 <p className="font-semibold truncate text-xs">{currentUser.name}</p>
                 <p className="text-[10px] text-slate-400 capitalize">{currentUser.role}</p>
             </div>
           </div>
           <Button variant="ghost" onClick={handleLogout} className="w-full text-xs h-7 justify-start px-2">Log Out</Button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
        {view === 'dashboard' && !isGuest && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header>
              <h1 className="text-2xl font-bold text-slate-900">Hello, {currentUser.name.split(' ')[0]}</h1>
            </header>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                         <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">Active Round</span>
                         {activeQuota.dueDate && <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-[10px] font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> {getFormatDate(activeQuota.dueDate)}</span>}
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">{activeQuota.name}</h2>
                   </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-slate-600 text-xs leading-relaxed">
                   <strong>Note:</strong> {activeQuota.instructions}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm"><Pencil className="w-4 h-4 text-indigo-500" /> Writing</h3>
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{submissionCount} / {submissionTarget}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden relative z-10 mt-2">
                        <div className={`h-full rounded-full ${subPercent >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${subPercent}%` }}></div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden">
                    <div className="flex justify-between items-start relative z-10">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm"><ThumbsUp className="w-4 h-4 text-teal-500" /> Voting</h3>
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{userVoteCount} / {voteTarget}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden relative z-10 mt-2">
                        <div className={`h-full rounded-full ${votePercent >= 100 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${votePercent}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Your Submissions</h3>
                <Button variant="ghost" onClick={() => { resetForm(); setView('submit'); }} className="text-xs h-8"><PlusCircle className="w-3.5 h-3.5" /> Add Problem</Button>
              </div>
              <div className="grid gap-4">
                  {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).map(p => (
                    <ProblemCard key={p.id} problem={p} showAuthor={true} currentUserId={currentUser.id} currentUserRole={currentUser.role} onUpvote={handleToggleVote} onEdit={handleStartEdit} onStatusChange={handleStatusChange} votingPower={currentUser.votingPower} />
                  ))}
                  {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length === 0 && <div className="text-center py-8 text-slate-400 italic bg-white rounded-xl border border-slate-200 border-dashed text-xs">No submissions yet.</div>}
              </div>
            </div>
          </div>
        )}

        {view === 'composer' && isDirector && !isGuest && (
          <div className="max-w-6xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
            <header className="flex justify-between items-center mb-4 shrink-0">
               <div><h1 className="text-xl font-bold text-slate-900">Composer</h1></div>
               <Button onClick={handleExportLatex} size="sm" variant="secondary" className="text-xs gap-1"><Download className="w-3 h-3" /> Export TeX</Button>
            </header>
            <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                        <h2 className="font-bold text-slate-700 text-xs flex items-center gap-1"><LayoutList className="w-3.5 h-3.5"/> Candidates ({composerCandidates.length})</h2>
                        <select className="px-1 py-0.5 text-[10px] border rounded bg-white" value={composerFilterTopic} onChange={e => setComposerFilterTopic(e.target.value)}>
                            <option value="All">All Topics</option>
                            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                       {composerCandidates.map(p => (
                           <div key={p.id} className="bg-white border border-slate-200 rounded-lg p-2.5 hover:border-indigo-300 transition-all flex gap-2 items-center">
                               <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-start">
                                       <h4 className="font-bold text-slate-900 truncate text-xs">{p.title}</h4>
                                       <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-1 rounded">{p.difficulty}</span>
                                   </div>
                                   <div className="text-[10px] text-slate-500 flex gap-1 mt-0.5"><span>{p.topics[0]}</span><span>•</span><span>Score: {p.score}</span></div>
                               </div>
                               <button onClick={() => handleAddToRound(p)} className="w-6 h-6 flex items-center justify-center bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded border border-slate-100"><ArrowRight className="w-3 h-3"/></button>
                           </div>
                       ))}
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-indigo-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-3 border-b border-indigo-100 bg-indigo-50/50 flex justify-between items-center">
                        <h2 className="font-bold text-indigo-900 text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> Selected ({composerAccepted.length})</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {composerAccepted.map((p, idx) => (
                            <div key={p.id} className="bg-white border border-indigo-100 rounded-lg p-2.5 flex items-center gap-2 shadow-sm">
                                <div className="font-mono font-bold text-indigo-300 text-xs w-4 text-center">{idx + 1}</div>
                                <div className="flex-1 min-w-0"><h4 className="font-bold text-slate-900 truncate text-xs">{p.title}</h4></div>
                                <div className="flex flex-col gap-0.5">
                                    <button onClick={() => handleReorder(idx, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded disabled:opacity-30"><ArrowUp className="w-3 h-3"/></button>
                                    <button onClick={() => handleReorder(idx, 'down')} disabled={idx === composerAccepted.length - 1} className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded disabled:opacity-30"><ArrowDown className="w-3 h-3"/></button>
                                </div>
                                <button onClick={() => handleRemoveFromRound(p)} className="w-6 h-6 flex items-center justify-center hover:bg-red-50 text-slate-300 hover:text-red-500 rounded"><X className="w-3 h-3"/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {view === 'submit' && (
          <div className="max-w-3xl mx-auto">
            <header className="mb-6">
              {!isGuest && <Button variant="ghost" onClick={() => setView('dashboard')} className="mb-2 pl-0 text-xs">← Back</Button>}
              <h1 className="text-xl font-bold text-slate-900">{editingProblemId ? 'Edit' : isGuest ? 'Propose Problem' : 'New Problem'}</h1>
              {isGuest && <div className="mt-2 bg-amber-50 text-amber-900 p-2 rounded border border-amber-200 text-xs">Guest Mode: Proposal only.</div>}
            </header>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-indigo-500" placeholder="Problem Title" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Difficulty</label>
                        <input type="number" step="0.1" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm focus:border-indigo-500" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Topics</label>
                        <div className="flex flex-wrap gap-2">
                            {TOPICS.map(t => (
                                <button key={t} onClick={() => handleTopicToggle(t)} className={`px-2 py-1 rounded text-[10px] font-medium border ${selectedTopics.includes(t) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{t}</button>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Statement</label>
                  <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={6} className="w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 outline-none text-sm font-serif mb-2 focus:border-indigo-500" placeholder="Let $x$ be..." />
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 hover:text-indigo-600">
                          <ImageIcon className="w-4 h-4"/> <span>{imageData ? "Change Image" : "Upload Image"}</span>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      {imageData && <button onClick={() => setImageData(null)} className="text-red-500 text-xs hover:underline">Remove</button>}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                     <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Preview</span>
                     <MathText text={statement || '...'} className="font-serif text-slate-800 text-sm whitespace-pre-wrap" />
                     {imageData && <img src={imageData} className="mt-2 max-h-40 rounded border border-slate-200" alt="Preview" />}
                </div>
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsVerified(!isVerified)}>
                   <div className={`w-4 h-4 rounded border flex items-center justify-center ${isVerified ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                      {isVerified && <BadgeCheck className="w-3 h-3 text-white" />}
                   </div>
                   <span className="text-xs font-medium text-slate-700 select-none">
                       {isGuest ? "I agree to usage rights." : "I verified this problem."}
                   </span>
                </div>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button onClick={handleSubmit} disabled={!title || !statement || !isVerified} isLoading={isSubmitting}>{editingProblemId ? 'Update' : 'Submit'}</Button>
                </div>
            </div>
          </div>
        )}

        {view === 'pool' && !isGuest && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-6 flex justify-between items-center">
               <h1 className="text-2xl font-bold text-slate-900">Problem Pool</h1>
            </header>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-4 flex gap-3 items-center flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase"><Filter className="w-3.5 h-3.5" /> Filters</div>
                <select className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" value={poolFilterQuota} onChange={(e) => setPoolFilterQuota(e.target.value)}>
                    <option value="All">All Rounds</option>
                    {quotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
                <select className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" value={poolFilterTopic} onChange={(e) => setPoolFilterTopic(e.target.value)}>
                    <option value="All">All Topics</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex-1"></div>
                <select className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" value={poolSort} onChange={(e) => setPoolSort(e.target.value as any)}>
                    <option value="highest">Highest Votes</option>
                    <option value="newest">Newest</option>
                </select>
            </div>
            <div className="grid gap-4">
              {poolIds.length === 0 ? <div className="text-center py-12 text-slate-400 text-xs">No problems found.</div> : 
                poolIds.map(id => {
                  const p = problems.find(prob => prob.id === id);
                  if (!p) return null;
                  return <ProblemCard key={p.id} problem={p} showAuthor={p.authorId === currentUser.id} currentUserId={currentUser.id} currentUserRole={currentUser.role} onUpvote={handleToggleVote} onEdit={handleStartEdit} onStatusChange={handleStatusChange} votingPower={currentUser.votingPower} />;
                })
              }
            </div>
          </div>
        )}

        {view === 'admin' && isDirector && !isGuest && (
          <div className="max-w-6xl mx-auto">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
                <div className="flex gap-2">
                  <Button onClick={handleExportLatex} size="sm" variant="secondary">Export</Button>
                  {currentUser.role === 'admin' && <Button onClick={handleResetVotes} size="sm" variant="danger">Reset Votes</Button>}
                </div>
             </div>
             
             <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                   <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><Layers className="w-4 h-4" /> Rounds</h3>
                   <div className="flex-1 space-y-3 mb-4">
                      {quotas.map(q => (
                         <div key={q.id} className={`p-3 rounded-lg border text-xs ${activeQuotaId === q.id ? 'bg-white border-indigo-500 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                            {editingQuotaId === q.id ? (
                               <div className="space-y-2">
                                  <input className="w-full px-2 py-1 border rounded bg-white" value={editQuotaForm.name} onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})} placeholder="Name" />
                                  <div className="flex gap-2">
                                      <input className="w-16 px-2 py-1 border rounded bg-white" type="number" value={editQuotaForm.target} onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})} placeholder="Target" />
                                      <input className="w-16 px-2 py-1 border rounded bg-white" type="number" value={editQuotaForm.voteTarget} onChange={e => setEditQuotaForm({...editQuotaForm, voteTarget: parseInt(e.target.value)})} placeholder="Vote" />
                                  </div>
                                  <div className="flex justify-end gap-1"><button onClick={saveQuota} className="text-green-600 font-bold">Save</button><button onClick={cancelEditQuota} className="text-red-500">Cancel</button></div>
                               </div>
                            ) : (
                               <div className="flex justify-between items-center">
                                  <div>
                                     <div className="flex items-center gap-2"><span className="font-bold text-slate-900">{q.name}</span>{activeQuotaId === q.id && <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase">Active</span>}</div>
                                     <div className="text-[10px] text-slate-500 mt-1">T: {q.target} • V: {q.voteTarget || 3}</div>
                                  </div>
                                  <div className="flex gap-1">
                                     <button onClick={() => startEditQuota(q)} className="p-1 text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                                     {activeQuotaId !== q.id && <Button size="sm" variant="secondary" onClick={() => switchQuota(q.id)} className="h-6 text-[10px] px-2 py-0">Use</Button>}
                                  </div>
                               </div>
                            )}
                         </div>
                      ))}
                   </div>
                   <div className="pt-3 border-t border-slate-100 space-y-2">
                       <input type="text" placeholder="New Round" value={newQuotaName} onChange={e => setNewQuotaName(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-xs" />
                       <Button onClick={addQuota} disabled={!newQuotaName.trim()} size="sm" className="w-full">Create</Button>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2 text-sm"><UserPlus className="w-4 h-4" /> Add User</h3>
                   <div className="space-y-3">
                      <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Full Name" className="w-full px-3 py-2 border rounded-lg text-xs" />
                      <input type="text" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2 border rounded-lg text-xs" />
                      <div className="flex gap-2 text-xs">
                          <button onClick={() => setNewUserRole('writer')} className={`flex-1 py-1.5 rounded border ${newUserRole === 'writer' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'text-slate-500'}`}>Writer</button>
                          <button onClick={() => setNewUserRole('director')} className={`flex-1 py-1.5 rounded border ${newUserRole === 'director' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'text-slate-500'}`}>Director</button>
                      </div>
                      <Button onClick={addUser} disabled={!newUserName.trim()} size="sm" className="w-full">Create</Button>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <table className="w-full text-left text-xs">
                 <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                   <tr>
                     <th className="px-4 py-3 font-semibold">User</th>
                     <th className="px-4 py-3 font-semibold">Pass</th>
                     <th className="px-4 py-3 font-semibold">Power</th>
                     <th className="px-4 py-3 font-semibold">Override</th>
                     <th className="px-4 py-3 font-semibold">Progress</th>
                     <th className="px-4 py-3 font-semibold"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {users.map(u => {
                     const uTarget = u.customTargets?.[activeQuotaId] || activeQuota.target;
                     const uCount = u.submittedCount || 0;
                     if (editingUserId === u.id) {
                         return (
                            <tr key={u.id} className="bg-slate-50">
                                <td className="px-4 py-2"><input className="w-full border rounded px-1" value={editUserForm.name} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} /></td>
                                <td className="px-4 py-2"><input className="w-full border rounded px-1" placeholder="Reset" value={editUserForm.password} onChange={e => setEditUserForm({...editUserForm, password: e.target.value})} /></td>
                                <td className="px-4 py-2"><input className="w-10 border rounded px-1 text-center" value={editUserForm.votingPower} onChange={e => setEditUserForm({...editUserForm, votingPower: parseInt(e.target.value)})} /></td>
                                <td className="px-4 py-2"><input className="w-10 border rounded px-1 text-center" value={editUserForm.customTargets?.[activeQuotaId] || activeQuota.target} onChange={e => updateUserTarget(u.id, parseInt(e.target.value))} /></td>
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2 flex gap-2"><button onClick={() => saveUser(u.id)} className="text-green-600"><Save className="w-3 h-3"/></button><button onClick={() => setEditingUserId(null)} className="text-slate-400"><X className="w-3 h-3"/></button></td>
                            </tr>
                         )
                     }
                     return (
                       <tr key={u.id} className="hover:bg-slate-50">
                         <td className="px-4 py-3 font-medium text-slate-800">{u.name} <span className="text-slate-400 text-[9px] uppercase ml-1">{u.role}</span></td>
                         <td className="px-4 py-3 font-mono text-slate-400">•••</td>
                         <td className="px-4 py-3">{u.votingPower}</td>
                         <td className="px-4 py-3 text-slate-500">{uTarget}</td>
                         <td className="px-4 py-3"><div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${uCount >= uTarget ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((uCount / uTarget) * 100, 100)}%` }}></div></div></td>
                         <td className="px-4 py-3 flex gap-2 justify-end">
                            <button onClick={() => startEditUser(u)} className="text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                            {u.role !== 'admin' && <button onClick={() => deleteUser(u.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
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