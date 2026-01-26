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
  CheckCircle,
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
  Layers,
  Zap,
  Download,
  Crown,
  ThumbsUp,
  User as UserIcon,
  Image as ImageIcon,
  Badge,
  Eye,
  EyeOff
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
        ? 'bg-indigo-50 text-indigo-700 font-semibold'
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
  const [difficulty, setDifficulty] = useState<string>(''); // Empty by default
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false); 
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  
  // Admin Editing State
  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null);
  const [editQuotaForm, setEditQuotaForm] = useState<Partial<Quota>>({});
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<Partial<User> & { password?: string }>({});
  const [showPasswords, setShowPasswords] = useState(false);

  
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
  const [poolSort, setPoolSort] = useState<'highest_vote' | 'lowest_vote' | 'hardest' | 'easiest' | 'newest'>('highest_vote');
  const [poolFilterTopic, setPoolFilterTopic] = useState<string>('All');
  const [poolFilterStatus, setPoolFilterStatus] = useState<string>('All');
  const [poolFilterQuota, setPoolFilterQuota] = useState<string>('All');
  const [poolFilterDiffMin, setPoolFilterDiffMin] = useState<number>(0);
  const [poolFilterDiffMax, setPoolFilterDiffMax] = useState<number>(10);
  const [poolIds, setPoolIds] = useState<string[]>([]);

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
      if (isDifferent) setUsers(updatedUsers);
    }
  }, [problems, activeQuotaId]);

  useEffect(() => {
    if (view === 'pool') {
      let filtered = [...problems];
      if (poolFilterQuota !== 'All') filtered = filtered.filter(p => p.quotaId === poolFilterQuota);
      if (poolFilterTopic !== 'All') filtered = filtered.filter(p => p.topics && p.topics.includes(poolFilterTopic as Topic));
      if (poolFilterStatus !== 'All') filtered = filtered.filter(p => p.status === poolFilterStatus);
      filtered = filtered.filter(p => p.difficulty >= poolFilterDiffMin && p.difficulty <= poolFilterDiffMax);

      filtered.sort((a, b) => {
          const scoreA = a.score || 0;
          const scoreB = b.score || 0;
          switch(poolSort) {
              case 'highest_vote': return scoreB - scoreA;
              case 'lowest_vote': return scoreA - scoreB;
              case 'hardest': return b.difficulty - a.difficulty;
              case 'easiest': return a.difficulty - b.difficulty;
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

  // Actions... 
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
    if (!editingQuotaId) return;
    try {
      await api.updateQuota({ ...editQuotaForm, id: editingQuotaId } as Quota);
      await refreshData();
      setEditingQuotaId(null);
    } catch (e) { console.error(e); }
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
          role: currentUser?.role === 'director' ? 'writer' : newUserRole, // Director forced to create writers
          submittedCount: 0,
          votingPower: (currentUser?.role === 'director' ? 'writer' : newUserRole) === 'director' ? 5 : 1,
          customTargets: {}
        });
        setUsers([...users, newUser]);
        setNewUserName(''); setNewUserPassword('');
    } catch(e) { console.error(e); }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try { await api.deleteUser(id); await refreshData(); } catch(e) { alert("Failed"); }
  }

  const startEditUser = (user: User) => { setEditingUserId(user.id); setEditUserForm({ ...user, password: user.password || '' }); };
  const saveUser = async (userId: string) => {
    if (!editUserForm.name?.trim()) return;
    try {
      await api.updateUser({ ...editUserForm, id: userId });
      await refreshData();
      setEditingUserId(null);
    } catch (e) { alert("Failed"); }
  };

  const updateUserTarget = (userId: string, target: number) => {
     const existingTargets = editUserForm.customTargets || users.find(u => u.id === userId)?.customTargets || {};
     setEditUserForm({ ...editUserForm, customTargets: { ...existingTargets, [activeQuotaId]: target } });
  }

  const handleResetVotes = async () => {
    if (!window.confirm("WARNING: This resets ALL votes. Confirm?")) return;
    try { await api.resetVotes(); await refreshData(); alert("Votes reset."); } catch(e) { alert("Failed."); }
  };

  const resetForm = () => {
    setTitle(''); setStatement(''); setDifficulty(''); setSelectedTopics([]); setImageData(null); setIsVerified(false);
    setEditingProblemId(null); setSubmissionError(null);
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
      if (file.size > 2 * 1024 * 1024) { alert("File too large (>2MB)."); return; }
      const reader = new FileReader();
      reader.onloadend = () => setImageData(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!currentUser || !title || !statement || !isVerified) return;
    if (selectedTopics.length === 0) { setSubmissionError("Select a topic."); return; }
    
    // Parse difficulty or default to 0
    const diffNum = difficulty === '' ? 0 : parseFloat(difficulty);
    
    setSubmissionError(null); setIsSubmitting(true);
    try {
      const payload = { title, statement, difficulty: diffNum, topics: selectedTopics, quotaId: activeQuotaId, imageData: imageData || undefined };
      if (editingProblemId) await api.updateProblem(editingProblemId, payload);
      else await api.submitProblem({ ...payload, authorId: currentUser.id, authorName: currentUser.name });
      
      if (currentUser.role === 'guest') { alert("Proposed successfully!"); resetForm(); }
      else { await refreshData(); resetForm(); setView('dashboard'); }
    } catch (e: any) { setSubmissionError(e.message || "Error."); } finally { setIsSubmitting(false); }
  };

  const handleToggleVote = async (problemId: string) => {
    if (!currentUser || currentUser.role === 'guest') return;
    const oldProblems = [...problems];
    setProblems(prev => prev.map(p => {
       if (p.id !== problemId) return p;
       const hasVoted = p.votedBy?.includes(currentUser.id);
       return { ...p, score: (p.score || 0) + (hasVoted ? -currentUser.votingPower : currentUser.votingPower), votedBy: hasVoted ? p.votedBy?.filter(id => id !== currentUser.id) : [...(p.votedBy || []), currentUser.id] };
    }));
    try { await api.toggleVote(problemId); } catch (e) { setProblems(oldProblems); }
  };

  const handleStatusChange = async (problemId: string, status: ProblemStatus) => {
     try { await api.updateProblemStatus(problemId, status); setProblems(prev => prev.map(p => p.id === problemId ? { ...p, status } : p)); } catch(e) {}
  };

  const handleExportLatex = () => {
      const activeProblems = problems.filter(p => p.quotaId === activeQuotaId);
      const tex = `\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\n\\section*{${activeQuota.name}}\n\\begin{enumerate}\n${activeProblems.map(p => `\\item ${p.title} \n\n ${p.statement}`).join('\n\n')}\n\\end{enumerate}\n\\end{document}`;
      const blob = new Blob([tex], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'contest.tex'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-xl shadow-lg border border-slate-100 p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white mx-auto mb-3 shadow-md">
              <BookOpen size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">WAMO Tracker</h1>
            <p className="text-slate-500 text-sm">Contest Management</p>
          </div>
          
          {!selectedLoginId ? (
            <div className="space-y-3">
               <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wide px-1">
                 <span>Select User</span>
                 {usersError && <button onClick={initApp} className="text-indigo-600 hover:underline">Retry</button>}
               </div>
               <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
                  {users.map(user => (
                    <button key={user.id} onClick={() => setSelectedLoginId(user.id)} className="w-full p-2.5 hover:bg-slate-50 rounded-lg text-left text-sm flex items-center justify-between group transition-colors">
                      <span className="font-medium text-slate-700 group-hover:text-indigo-700">{user.name}</span>
                    </button>
                  ))}
               </div>
               <div className="pt-2 border-t border-slate-100">
                  <Button variant="secondary" onClick={handleGuestLogin} className="w-full text-sm py-2">Continue as Guest</Button>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {users.find(u => u.id === selectedLoginId)?.name.charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-slate-800">{users.find(u => u.id === selectedLoginId)?.name}</span>
                </div>
                <button onClick={() => { setSelectedLoginId(''); setLoginPassword(''); }} className="text-xs text-slate-400 hover:text-slate-600">Change</button>
              </div>
              <input 
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white"
                autoFocus
              />
              {loginError && <p className="text-red-500 text-xs">{loginError}</p>}
              <Button onClick={handleLogin} className="w-full py-2">Sign In</Button>
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
  const isDirector = currentUser.role === 'admin' || currentUser.role === 'director';
  const isGuest = currentUser.role === 'guest';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 text-sm">
      {/* Sidebar */}
      <aside className="w-full md:w-60 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-20">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white">
                <BookOpen className="w-3.5 h-3.5" strokeWidth={3} />
            </div>
            <h2 className="text-base font-bold tracking-tight">WAMO Tracker</h2>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {!isGuest && <NavItem icon={<LayoutDashboard className="w-4 h-4"/>} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />}
          <NavItem icon={<PlusCircle className="w-4 h-4"/>} label={isGuest ? "Propose Problem" : "Write Problem"} active={view === 'submit'} onClick={() => { resetForm(); setView('submit'); }} />
          {!isGuest && <NavItem icon={<Layers className="w-4 h-4"/>} label="Problem Pool" active={view === 'pool'} onClick={() => setView('pool')} />}
          {isDirector && !isGuest && (
            <>
              <div className="pt-4 pb-1 px-3 text-[10px] font-bold text-slate-400 uppercase">Admin</div>
              <NavItem icon={<Settings className="w-4 h-4"/>} label="Settings" active={view === 'admin'} onClick={() => setView('admin')} />
            </>
          )}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs ${isGuest ? 'bg-amber-500' : 'bg-slate-700'}`}>
                {isGuest ? <UserIcon className="w-4 h-4" /> : currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0">
                <p className="font-semibold truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full text-xs justify-start h-8 px-2">Log Out</Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {/* DASHBOARD */}
        {view === 'dashboard' && !isGuest && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Hello, {currentUser.name.split(' ')[0]}</h1>
            </header>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                         <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">Active Round</span>
                         {activeQuota.dueDate && <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-[10px] font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3"/> {getFormatDate(activeQuota.dueDate)}</span>}
                      </div>
                      <h2 className="text-xl font-bold">{activeQuota.name}</h2>
                   </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-slate-600 text-xs leading-relaxed border border-slate-100">
                   <strong>Note:</strong> {activeQuota.instructions}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {/* Stats */}
                {[
                    { label: 'Writing Quota', icon: Pencil, current: submissionCount, target: submissionTarget, color: 'indigo' },
                    { label: 'Voting Quota', icon: ThumbsUp, current: userVoteCount, target: voteTarget, color: 'teal' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-${stat.color}-50 text-${stat.color}-600`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <p className="text-slate-500 font-medium text-xs uppercase tracking-wide">{stat.label}</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-slate-900">{stat.current}</span>
                                <span className="text-slate-400">/ {stat.target}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                                <div className={`h-full rounded-full bg-${stat.color}-500`} style={{ width: `${Math.min((stat.current / stat.target) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">Your Submissions</h3>
                <Button variant="ghost" onClick={() => { resetForm(); setView('submit'); }} className="text-xs h-8">
                  <PlusCircle className="w-3.5 h-3.5" /> Add Problem
                </Button>
              </div>
              
              <div className="grid gap-3">
                  {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).map(p => (
                    <ProblemCard 
                        key={p.id} problem={p} showAuthor={true} currentUserId={currentUser.id} currentUserRole={currentUser.role}
                        onUpvote={handleToggleVote} onEdit={handleStartEdit} onStatusChange={handleStatusChange} votingPower={currentUser.votingPower}
                    />
                  ))}
                  {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length === 0 && (
                      <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200 border-dashed">No submissions yet.</div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* SUBMIT / EDIT */}
        {view === 'submit' && (
          <div className="max-w-3xl mx-auto">
            <header className="mb-6 flex items-center justify-between">
              <div>
                  <h1 className="text-xl font-bold text-slate-900">{editingProblemId ? 'Edit Problem' : isGuest ? 'Propose Problem' : 'New Problem'}</h1>
                  <p className="text-slate-500 text-xs mt-1">
                      {isGuest ? "Guest Proposal Mode" : `For: ${activeQuota.name}`}
                  </p>
              </div>
              {!isGuest && <Button variant="ghost" onClick={() => setView('dashboard')} className="text-xs">Cancel</Button>}
            </header>
            
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" placeholder="Problem Title" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Difficulty</label>
                        <input type="number" step="0.1" min="0" max="50" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} placeholder="0.0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 bg-white" />
                        <a href="https://artofproblemsolving.com/wiki/index.php/AoPS_Wiki:Competition_ratings" target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 hover:underline mt-1 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3"/> AoPS Difficulty Ratings
                        </a>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Topics</label>
                        <div className="flex flex-wrap gap-2">
                            {TOPICS.map(t => (
                                <button key={t} onClick={() => handleTopicToggle(t)} className={`px-2 py-1 rounded text-xs border ${selectedTopics.includes(t) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Statement (LaTeX supported)</label>
                  <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={6} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-serif text-slate-900 bg-white" placeholder="Let $x$ be..." />
                  
                  <div className="mt-3 flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-medium text-slate-600 transition-colors">
                          <ImageIcon className="w-4 h-4" /> {imageData ? "Change Image" : "Add Image"}
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      {imageData && (
                          <div className="relative group">
                              <img src={imageData} alt="Preview" className="h-10 w-auto rounded border border-slate-200" />
                              <button onClick={() => setImageData(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                          </div>
                      )}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                     <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Preview</p>
                     <MathText text={statement || '...'} className="font-serif text-sm text-slate-800" />
                </div>

                <div className="flex items-center gap-2 py-2 cursor-pointer" onClick={() => setIsVerified(!isVerified)}>
                   <div className={`w-4 h-4 rounded border flex items-center justify-center ${isVerified ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                      {isVerified && <CheckCircle className="w-3 h-3 text-white" />}
                   </div>
                   <span className="text-xs font-medium text-slate-700 select-none">
                       {isGuest ? "I confirm this is my original work." : "I have verified this problem."}
                   </span>
                </div>

                {submissionError && <div className="text-red-600 text-xs bg-red-50 p-2 rounded border border-red-100">{submissionError}</div>}
                
                <div className="flex justify-end pt-4 border-t border-slate-100">
                    <Button onClick={handleSubmit} disabled={!title || !statement || !isVerified} isLoading={isSubmitting}>
                        {editingProblemId ? 'Update' : 'Submit'}
                    </Button>
                </div>
            </div>
          </div>
        )}

        {/* POOL */}
        {view === 'pool' && !isGuest && (
          <div className="max-w-5xl mx-auto">
            <header className="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-4">
               <div>
                  <h1 className="text-2xl font-bold text-slate-900">Problem Pool</h1>
                  <p className="text-slate-500 text-xs mt-1">Blind review enabled</p>
               </div>
               <div className="flex gap-2 flex-wrap">
                   <select className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-900" value={poolFilterQuota} onChange={e => setPoolFilterQuota(e.target.value)}>
                       <option value="All">All Quotas</option>
                       {quotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                   </select>
                   <select className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-900" value={poolFilterStatus} onChange={e => setPoolFilterStatus(e.target.value)}>
                       <option value="All">All Statuses</option>
                       <option value="pending">Pending Only</option>
                       <option value="accepted">Accepted Only</option>
                   </select>
                   <select className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-900" value={poolFilterTopic} onChange={e => setPoolFilterTopic(e.target.value)}>
                       <option value="All">All Topics</option>
                       {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                   <select className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-900" value={poolSort} onChange={e => setPoolSort(e.target.value as any)}>
                       <option value="highest_vote">Votes: High to Low</option>
                       <option value="lowest_vote">Votes: Low to High</option>
                       <option value="hardest">Diff: Hard to Easy</option>
                       <option value="easiest">Diff: Easy to Hard</option>
                       <option value="newest">Newest First</option>
                   </select>
               </div>
            </header>
            
            <div className="grid gap-3">
              {poolIds.length === 0 ? <div className="text-center py-12 text-slate-400">No problems found.</div> : 
                poolIds.map(id => {
                  const p = problems.find(prob => prob.id === id);
                  if (!p) return null;
                  return (
                    <ProblemCard 
                      key={p.id} problem={p} showAuthor={p.authorId === currentUser.id} currentUserId={currentUser.id} currentUserRole={currentUser.role}
                      onUpvote={handleToggleVote} onEdit={handleStartEdit} onStatusChange={handleStatusChange} votingPower={currentUser.votingPower}
                    />
                  );
                })
              }
            </div>
          </div>
        )}

        {/* ADMIN */}
        {view === 'admin' && isDirector && !isGuest && (
          <div className="max-w-6xl mx-auto space-y-6">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
                <div className="flex gap-2">
                  <Button onClick={handleExportLatex} size="sm" variant="secondary" className="text-xs">TeX Export</Button>
                  {currentUser.role === 'admin' && <Button onClick={handleResetVotes} size="sm" variant="danger" className="text-xs">Reset Votes</Button>}
                </div>
             </div>
             
             <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Layers className="w-4 h-4"/> Rounds</h3>
                   <div className="space-y-3">
                      {quotas.map(q => (
                         <div key={q.id} className={`p-3 rounded-lg border text-sm ${activeQuotaId === q.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 bg-slate-50'}`}>
                            {editingQuotaId === q.id ? (
                               <div className="space-y-3">
                                  <input className="w-full px-2 py-1 border rounded bg-white font-bold text-slate-900" value={editQuotaForm.name} onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})} placeholder="Round Name" />
                                  <div className="flex gap-2">
                                      <div className="flex-1">
                                          <label className="text-[10px] text-slate-400 uppercase font-bold">Write Target</label>
                                          <input className="w-full px-2 py-1 border rounded bg-white text-slate-900" type="number" value={editQuotaForm.target} onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})} />
                                      </div>
                                      <div className="flex-1">
                                          <label className="text-[10px] text-slate-400 uppercase font-bold">Vote Target</label>
                                          <input className="w-full px-2 py-1 border rounded bg-white text-slate-900" type="number" value={editQuotaForm.voteTarget} onChange={e => setEditQuotaForm({...editQuotaForm, voteTarget: parseInt(e.target.value)})} />
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-slate-400 uppercase font-bold">Instructions</label>
                                      <input className="w-full px-2 py-1 border rounded bg-white text-slate-900" value={editQuotaForm.instructions} onChange={e => setEditQuotaForm({...editQuotaForm, instructions: e.target.value})} />
                                  </div>
                                  <div className="flex justify-end gap-2 pt-1">
                                      <button onClick={saveQuota} className="text-green-600 font-bold px-2 text-xs border border-green-200 rounded hover:bg-green-50">Save</button>
                                      <button onClick={cancelEditQuota} className="text-slate-400 text-xs px-2">Cancel</button>
                                  </div>
                               </div>
                            ) : (
                               <div className="flex justify-between items-start">
                                  <div>
                                     <div className="font-bold">{q.name}</div>
                                     <div className="text-xs text-slate-500 mt-1">Write: {q.target} • Vote: {q.voteTarget || 3}</div>
                                     <div className="text-xs text-slate-400 italic mt-0.5">{q.instructions || "No instructions."}</div>
                                  </div>
                                  <div className="flex gap-2">
                                     <button onClick={() => startEditQuota(q)} className="text-slate-400 hover:text-indigo-600"><Pencil className="w-3.5 h-3.5" /></button>
                                     {activeQuotaId !== q.id && <button onClick={() => switchQuota(q.id)} className="text-xs bg-white border px-2 py-0.5 rounded shadow-sm hover:bg-slate-50">Activate</button>}
                                  </div>
                               </div>
                            )}
                         </div>
                      ))}
                   </div>
                   <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                       <input type="text" placeholder="New Round Name" value={newQuotaName} onChange={e => setNewQuotaName(e.target.value)} className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none bg-white text-slate-900" />
                       <Button onClick={addQuota} size="sm">Add</Button>
                   </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4"/> Add User</h3>
                   <div className="space-y-3">
                      <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="Full Name" className="w-full px-3 py-2 border rounded-lg text-sm outline-none bg-white text-slate-900" />
                      <input type="text" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2 border rounded-lg text-sm outline-none bg-white text-slate-900" />
                      {currentUser?.role === 'admin' ? (
                          <div className="flex gap-2 text-xs">
                              <button onClick={() => setNewUserRole('writer')} className={`flex-1 py-1.5 rounded border ${newUserRole === 'writer' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'border-slate-200'}`}>Writer</button>
                              <button onClick={() => setNewUserRole('director')} className={`flex-1 py-1.5 rounded border ${newUserRole === 'director' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'border-slate-200'}`}>Director</button>
                          </div>
                      ) : (
                          <div className="text-xs text-slate-500 italic text-center py-1 bg-slate-50 rounded">
                              New accounts are created as Writers.
                          </div>
                      )}
                      <Button onClick={addUser} className="w-full" disabled={!newUserName || !newUserPassword}>Create Account</Button>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-xs font-bold uppercase text-slate-500">Users</h3>
                    <button onClick={() => setShowPasswords(!showPasswords)} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                        {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {showPasswords ? 'Hide Passwords' : 'Show Passwords'}
                    </button>
                </div>
               <table className="w-full text-left text-sm">
                 <thead className="bg-white border-b border-slate-200 text-xs uppercase text-slate-500">
                   <tr>
                     <th className="px-4 py-3 font-semibold min-w-[150px]">User</th>
                     <th className="px-4 py-3 font-semibold w-32">Password</th>
                     <th className="px-4 py-3 font-semibold w-28">Role</th>
                     <th className="px-4 py-3 font-semibold w-20 text-center">Power</th>
                     <th className="px-4 py-3 font-semibold w-32">Write</th>
                     <th className="px-4 py-3 font-semibold w-32">Vote</th>
                     <th className="px-4 py-3 font-semibold w-20"></th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                   {users.map(u => {
                     const isEditing = editingUserId === u.id;
                     const isTargetAdmin = u.role === 'admin';
                     const canEdit = currentUser.role === 'admin' || (currentUser.role === 'director' && !isTargetAdmin);
                     const canDelete = currentUser.role === 'admin' || (currentUser.role === 'director' && u.role === 'writer'); // Directors can only delete writers

                     const uTarget = u.customTargets?.[activeQuotaId] || activeQuota.target;
                     const vTarget = activeQuota.voteTarget || 3;
                     const uCount = u.submittedCount || 0;
                     const vCount = u.voteCount || 0;
                     
                     if (isEditing) {
                         return (
                            <tr key={u.id} className="bg-slate-50">
                                <td className="px-4 py-2"><input className="w-full border rounded px-1 bg-white text-slate-900" value={editUserForm.name} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} /></td>
                                <td className="px-4 py-2"><input className="w-full border rounded px-1 bg-white text-slate-900" value={editUserForm.password} placeholder="Reset" onChange={e => setEditUserForm({...editUserForm, password: e.target.value})} disabled={currentUser.role === 'director'} title={currentUser.role === 'director' ? "Directors cannot change passwords" : ""} /></td>
                                <td className="px-4 py-2">
                                    {currentUser.role === 'admin' ? (
                                        <select className="w-full border rounded px-1 text-xs py-1 bg-white text-slate-900" value={editUserForm.role} onChange={e => setEditUserForm({...editUserForm, role: e.target.value as any})}>
                                            <option value="writer">Writer</option>
                                            <option value="director">Director</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    ) : <span className="text-xs text-slate-400 capitalize">{u.role}</span>}
                                </td>
                                <td className="px-4 py-2"><input type="number" className="w-full border rounded px-1 text-center bg-white text-slate-900" value={editUserForm.votingPower} onChange={e => setEditUserForm({...editUserForm, votingPower: parseInt(e.target.value)})} /></td>
                                <td className="px-4 py-2">
                                   <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-slate-400">T:</span>
                                      <input type="number" className="w-full border rounded px-1 bg-white text-slate-900" value={editUserForm.customTargets?.[activeQuotaId] || activeQuota.target} onChange={e => updateUserTarget(u.id, parseInt(e.target.value))} />
                                   </div>
                                </td>
                                <td className="px-4 py-2 text-xs text-slate-400 italic">Global</td>
                                <td className="px-4 py-2 flex gap-2 justify-end">
                                    <button onClick={() => saveUser(u.id)} className="text-green-600 hover:bg-green-100 p-1 rounded"><Save className="w-4 h-4"/></button>
                                    <button onClick={() => setEditingUserId(null)} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><X className="w-4 h-4"/></button>
                                </td>
                            </tr>
                         )
                     }
                     return (
                       <tr key={u.id} className="group hover:bg-slate-50 transition-colors">
                         <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                         <td className="px-4 py-3 font-mono text-xs text-slate-400">
                            {showPasswords ? (u.password || '') : '••••••'}
                         </td>
                         <td className="px-4 py-3">
                             {u.role === 'admin' && <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"><Crown className="w-3 h-3"/> Admin</span>}
                             {u.role === 'director' && <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"><Badge className="w-3 h-3"/> Director</span>}
                             {u.role === 'writer' && <span className="text-slate-400 text-xs capitalize">Writer</span>}
                         </td>
                         <td className="px-4 py-3 text-center text-slate-600">{u.votingPower}</td>
                         <td className="px-4 py-3">
                           <div className="flex flex-col gap-1 w-full">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
                                    <div className={`h-full rounded-full ${uCount >= uTarget ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((uCount / uTarget) * 100, 100)}%` }}></div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">{uCount}/{uTarget}</span>
                           </div>
                         </td>
                         <td className="px-4 py-3">
                           <div className="flex flex-col gap-1 w-full">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
                                    <div className={`h-full rounded-full ${vCount >= vTarget ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${Math.min((vCount / vTarget) * 100, 100)}%` }}></div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">{vCount}/{vTarget}</span>
                           </div>
                         </td>
                         <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                {canEdit && <button onClick={() => startEditUser(u)} className="text-slate-400 hover:text-indigo-600 p-1"><Pencil className="w-3.5 h-3.5" /></button>}
                                {canDelete && u.role !== 'admin' && <button onClick={() => deleteUser(u.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>}
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