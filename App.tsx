import React, { useState, useEffect, useRef } from 'react';
import { Problem, User, Quota, Round, Topic, ProblemStatus, Comment } from './types';
import { Button } from './components/Button';
import { ProblemCard } from './components/ProblemCard';
import { MathText } from './components/MathText';
import { api } from './api';
import { motion, AnimatePresence, Variants } from 'framer-motion';
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
  ChevronRight,
  User as UserIcon,
  Image as ImageIcon,
  LayoutList,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BarChart2,
  FolderOpen,
  Maximize2,
  Minimize2,
  Copy,
  Tag,
  ListChecks,
  Hourglass,
  History,
  Menu,
  Activity,
  Grid
} from 'lucide-react';

// --- STAGGER ANIMATIONS ---
const containerVar: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05
    }
  }
};

const itemVar: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring", stiffness: 400, damping: 30 } 
  }
};

// --- CONSTELLATION ANIMATION COMPONENT ---
const Constellation: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mouse, setMouse] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            setMouse({ x: e.clientX, y: e.clientY });
        };
        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const nodes: {x: number, y: number, vx: number, vy: number}[] = [];
        const NODE_COUNT = 40;
        
        for(let i=0; i<NODE_COUNT; i++) {
            nodes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.3, // Slow drift
                vy: (Math.random() - 0.5) * 0.3
            });
        }

        const animate = () => {
            ctx.clearRect(0, 0, width, height);
            
            // Draw Connections
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)'; // Indigo faint
            ctx.lineWidth = 1;

            for(let i=0; i<NODE_COUNT; i++) {
                const n1 = nodes[i];
                // Move
                n1.x += n1.vx;
                n1.y += n1.vy;
                
                // Parallax influence from mouse
                const dx = mouse.x - width/2;
                const dy = mouse.y - height/2;
                n1.x += dx * 0.0001;
                n1.y += dy * 0.0001;

                // Bounce
                if(n1.x < 0 || n1.x > width) n1.vx *= -1;
                if(n1.y < 0 || n1.y > height) n1.vy *= -1;

                // Draw Node
                ctx.beginPath();
                ctx.arc(n1.x, n1.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(79, 70, 229, 0.5)';
                ctx.fill();

                // Connect
                for(let j=i+1; j<NODE_COUNT; j++) {
                    const n2 = nodes[j];
                    const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
                    if(dist < 200) {
                        ctx.beginPath();
                        ctx.moveTo(n1.x, n1.y);
                        ctx.lineTo(n2.x, n2.y);
                        ctx.globalAlpha = 1 - dist / 200;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                }
            }
            requestAnimationFrame(animate);
        };
        const animId = requestAnimationFrame(animate);
        
        const handleResize = () => {
             width = canvas.width = window.innerWidth;
             height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
        };
    }, [mouse]);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
      active
        ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-200'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
    }`}
  >
    <div className={active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}>{icon}</div>
    <span className="flex-1 text-left">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
        {badge}
      </span>
    )}
  </button>
);

const TOPICS: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

const AOPS_SCALE_INFO = (
    <div className="text-xs text-slate-500 space-y-1.5 mt-2 bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono">
        <p className="font-bold text-slate-800 text-xs uppercase mb-2">Complexity Matrix</p>
        <p>1.0 - 2.0: Routine / School Level</p>
        <p>2.5 - 3.5: AMC 10 Early / MATHCOUNTS</p>
        <p>4.0 - 5.5: AIME Early / AMC 12 Mid</p>
        <p>6.0 - 7.5: AIME Late / USAJMO Qual</p>
        <p>8.0 - 9.5: Olympiad Standard</p>
    </div>
);

export default function App() {
  // --- Global State ---
  const [users, setUsers] = useState<User[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeQuotaId, setActiveQuotaId] = useState<string>('q1');

  // --- Session State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'pool' | 'submit' | 'admin' | 'composer' | 'waitlist'>('dashboard');
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
  const [editingProblemVersion, setEditingProblemVersion] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [solution, setSolution] = useState('');
  const [answerKey, setAnswerKey] = useState('');
  const [difficulty, setDifficulty] = useState<string>('3.0');
  const [showRatingScale, setShowRatingScale] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false); 
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  
  // Bulk Import State
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [parsedProblems, setParsedProblems] = useState<any[]>([]);
  
  // Admin Editing State
  const [editingQuotaId, setEditingQuotaId] = useState<string | null>(null);
  const [editQuotaForm, setEditQuotaForm] = useState<Partial<Quota>>({});
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState<Partial<User> & { password?: string }>({});

  
  // Admin Create New User State
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'writer' | 'director'>('writer');
  
  // Round Create New State
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundTag, setNewRoundTag] = useState('');
  const [newRoundDesc, setNewRoundDesc] = useState('');

  // Pool View State (Sorting/Filtering)
  const [poolSort, setPoolSort] = useState<'highest' | 'lowest' | 'hardest' | 'easiest' | 'newest'>('highest');
  const [poolFilterTopic, setPoolFilterTopic] = useState<string>('All');
  const [poolFilterStatus, setPoolFilterStatus] = useState<string>('All');
  const [poolFilterQuota, setPoolFilterQuota] = useState<string>('All');
  const [poolFilterDiffMin, setPoolFilterDiffMin] = useState<number>(0);
  const [poolFilterDiffMax, setPoolFilterDiffMax] = useState<number>(10);
  const [poolIds, setPoolIds] = useState<string[]>([]);

  // Composer State
  const [composerSelectedRoundId, setComposerSelectedRoundId] = useState<string | null>(null);
  const [composerSourceQuota, setComposerSourceQuota] = useState<string>('All');
  const [composerFilterTopic, setComposerFilterTopic] = useState<string>('All');
  const [composerMinDiff, setComposerMinDiff] = useState<number>(0);
  const [composerMaxDiff, setComposerMaxDiff] = useState<number>(50);
  const [composerSort, setComposerSort] = useState<'votes' | 'difficulty' | 'newest'>('votes');
  const [composerSearchText, setComposerSearchText] = useState('');
  const [composerExpandedMap, setComposerExpandedMap] = useState<Record<string, boolean>>({});
  
  // Composer New Round UI / Editing Round
  const [isCreatingRound, setIsCreatingRound] = useState(false);
  const [isEditingRound, setIsEditingRound] = useState(false);
  const [editRoundForm, setEditRoundForm] = useState<Partial<Round>>({});

  // Drag State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRoundName, setExportRoundName] = useState('');
  const [exportContestName, setExportContestName] = useState('Washington Math Tournament');
  const [exportDate, setExportDate] = useState('Oct 11th, 2025');


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
            console.log("Session invalid or expired");
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
          const [u, p, q, r] = await Promise.all([
              api.getUsers(),
              api.getProblems(),
              api.getQuotas(),
              api.getRounds()
          ]);
          setUsers(u);
          setProblems(p);
          setQuotas(q);
          setRounds(r);
          
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
      let filtered = [...problems].filter(p => p.status === 'approved' || p.status === 'accepted');

      if (poolFilterQuota !== 'All') {
          filtered = filtered.filter(p => p.quotaId === poolFilterQuota);
      }
      if (poolFilterTopic !== 'All') {
          filtered = filtered.filter(p => p.topics && p.topics.includes(poolFilterTopic as Topic));
      }
      if (poolFilterStatus !== 'All') {
          filtered = filtered.filter(p => {
             const s = p.status || 'pending';
             return s === poolFilterStatus;
          });
      }
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
  
  useEffect(() => {
      if (view === 'composer') {
          setComposerSourceQuota('All');
          setComposerSelectedRoundId(null);
      }
  }, [view]);

  const getActiveQuota = () => quotas.find(q => q.id === activeQuotaId) || quotas[0] || { id: 'default', target: 5, voteTarget: 3, name: 'Default', instructions: '', dueDate: null };
  const getFormatDate = (ts: number | null) => ts ? new Date(ts).toLocaleDateString() : 'None';

  const handleLogin = async () => {
    try {
        setLoginError('');
        const { user } = await api.login(selectedLoginId, loginPassword);
        setCurrentUser(user);
        if (user.role === 'guest') {
            setView('submit');
        } else {
            setView('dashboard');
        }
        setLoginPassword('');
        setSelectedLoginId('');
    } catch (e) {
        setLoginError('Authentication Failed');
    }
  };

  const handleGuestLogin = async () => {
    try {
        setLoginError('');
        const { user } = await api.guestLogin();
        setCurrentUser(user);
        setView('submit');
    } catch (e) {
        setLoginError('Guest access denied.');
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setView('dashboard');
    setTitle('');
    setStatement('');
  };

  const addRound = async () => {
    if (!newRoundName.trim()) return;
    try {
        const newRound = await api.createRound({
          name: newRoundName.trim(),
          tag: newRoundTag.trim() || undefined,
          description: newRoundDesc.trim() || 'No description.',
        });
        setRounds([newRound, ...rounds]); 
        setNewRoundName('');
        setNewRoundTag('');
        setNewRoundDesc('');
        setComposerSelectedRoundId(newRound.id);
        setIsCreatingRound(false);
    } catch(e) {
        console.error("Failed to create round", e);
    }
  };

  const editRound = async () => {
      if (!composerSelectedRoundId || !editRoundForm.name) return;
      try {
          await api.updateRound({
              id: composerSelectedRoundId,
              name: editRoundForm.name,
              tag: editRoundForm.tag || '',
              description: editRoundForm.description || ''
          });
          refreshData();
          setIsEditingRound(false);
      } catch (e) { console.error(e); }
  };

  const deleteRound = async () => {
      if (!composerSelectedRoundId) return;
      if (!window.confirm("Delete this round? Problems will be unassigned.")) return;
      try {
          await api.deleteRound(composerSelectedRoundId);
          setComposerSelectedRoundId(null);
          refreshData();
      } catch (e) { console.error(e); }
  };

  const startEditQuota = (q: Quota) => { setEditingQuotaId(q.id); setEditQuotaForm(q); };
  const cancelEditQuota = () => { setEditingQuotaId(null); setEditQuotaForm({}); };

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
          role: newUserRole,
          submittedCount: 0,
          votingPower: newUserRole === 'director' ? 5 : 1,
          customTargets: {}
        });
        setUsers([...users, newUser]);
        setNewUserName('');
        setNewUserPassword('');
        setNewUserRole('writer');
    } catch(e) { console.error(e); }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Are you sure? This deletes their submitted problems too.")) return;
    try { await api.deleteUser(id); await refreshData(); } catch(e) { alert("Delete failed."); }
  }

  const startEditUser = (user: User) => { setEditingUserId(user.id); setEditUserForm({ ...user, password: '' }); };

  const saveUser = async (userId: string) => {
    if (!editUserForm.name?.trim()) return;
    try {
      const currentTargets = users.find(u => u.id === userId)?.customTargets || {};
      await api.updateUser({ 
          id: userId, 
          name: editUserForm.name,
          votingPower: editUserForm.votingPower,
          password: editUserForm.password,
          customTargets: editUserForm.customTargets || currentTargets,
          role: editUserForm.role
      });
      await refreshData();
      setEditingUserId(null);
    } catch (e) { alert("Update failed."); }
  };

  const updateUserTarget = (userId: string, target: number) => {
     const existingTargets = editUserForm.customTargets || users.find(u => u.id === userId)?.customTargets || {};
     setEditUserForm({
         ...editUserForm,
         customTargets: { ...existingTargets, [activeQuotaId]: target }
     });
  }

  const handleResetVotes = async () => {
    if (!window.confirm("WARNING: Reset ALL votes? Cannot be undone.")) return;
    try { await api.resetVotes(); await refreshData(); } catch(e) { alert("Reset failed."); }
  };

  const resetForm = () => {
    setTitle('');
    setStatement('');
    setSolution('');
    setAnswerKey('');
    setDifficulty('3.0');
    setSelectedTopics([]);
    setImageData(null);
    setIsVerified(false);
    setEditingProblemId(null);
    setEditingProblemVersion(0);
    setSubmissionError(null);
  };

  const handleStartEdit = (prob: Problem) => {
      setEditingProblemId(prob.id);
      setEditingProblemVersion(prob.version);
      setTitle(prob.title);
      setStatement(prob.statement);
      setSolution(prob.solution || '');
      setAnswerKey(prob.answerKey || '');
      setDifficulty(prob.difficulty.toString());
      setSelectedTopics(prob.topics || []);
      setImageData(prob.imageData || null);
      setIsVerified(true);
      setView('submit');
  };

  const handleTopicToggle = (topic: Topic) => {
      if (selectedTopics.includes(topic)) {
          setSelectedTopics(selectedTopics.filter(t => t !== topic));
      } else {
          setSelectedTopics([...selectedTopics, topic]);
      }
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
    if (selectedTopics.length === 0) { setSubmissionError("Topic required."); return; }
    setSubmissionError(null);
    setIsSubmitting(true);
    try {
      const payload = {
          title, statement, solution, answerKey, difficulty: parseFloat(difficulty), topics: selectedTopics,
          quotaId: activeQuotaId, imageData: imageData || undefined, version: editingProblemVersion
      };
      if (editingProblemId) { await api.updateProblem(editingProblemId, payload); } 
      else { await api.submitProblem({ ...payload, authorId: currentUser.id, authorName: currentUser.name }); }
      
      if (currentUser.role === 'guest') { alert("Submitted for review."); resetForm(); } 
      else { await refreshData(); resetForm(); setView('dashboard'); }
    } catch (e: any) { setSubmissionError(e.message); } 
    finally { setIsSubmitting(false); }
  };

  const handleBulkParse = async () => {
      if (!bulkText) return;
      try {
          const parsed = await api.parseBulkLatex(bulkText, selectedTopics, parseFloat(difficulty));
          setParsedProblems(parsed);
      } catch (e) { alert("Parsing failed."); }
  };

  const handleBulkCommit = async () => {
      setIsSubmitting(true);
      let successCount = 0;
      for (const p of parsedProblems) {
          try {
              await api.submitProblem({ ...p, quotaId: activeQuotaId, authorId: currentUser?.id, authorName: currentUser?.name });
              successCount++;
          } catch(e) {}
      }
      setIsSubmitting(false);
      alert(`Imported ${successCount} problems.`);
      setBulkText('');
      setParsedProblems([]);
      setShowBulkImport(false);
      refreshData();
      setView('dashboard');
  };

  const handleToggleVote = async (problemId: string) => {
    if (!currentUser || currentUser.role === 'guest') return;
    const oldProblems = [...problems];
    const updatedProblems = problems.map(p => {
       if (p.id === problemId) {
          const hasVoted = p.votedBy?.includes(currentUser.id);
          if (hasVoted) {
             return { ...p, score: (p.score || 0) - currentUser.votingPower, votedBy: (p.votedBy || []).filter(id => id !== currentUser.id) };
          } else {
             return { ...p, score: (p.score || 0) + currentUser.votingPower, votedBy: [...(p.votedBy || []), currentUser.id] };
          }
       }
       return p;
    });
    setProblems(updatedProblems);
    try { await api.toggleVote(problemId); } catch (e) { setProblems(oldProblems); }
  };

  const handleStatusChange = async (problemId: string, status: ProblemStatus) => {
     try {
        await api.updateProblemStatus(problemId, status);
        const updated = problems.map(p => p.id === problemId ? { ...p, status } : p);
        setProblems(updated);
     } catch(e) { console.error(e); }
  };
  
  const handleComposerUpdate = async (problemId: string, updates: Partial<Problem>) => {
      const updatedProblems = problems.map(p => p.id === problemId ? { ...p, ...updates } : p);
      setProblems(updatedProblems);
      try { await api.updateProblem(problemId, updates); } 
      catch(e) { refreshData(); }
  };

  const handleAddToRound = async (problem: Problem, targetIndex?: number) => {
      if (!composerSelectedRoundId) return;
      const accepted = problems.filter(p => p.roundIds && p.roundIds.includes(composerSelectedRoundId) && p.status === 'accepted').sort((a,b) => a.orderIndex - b.orderIndex);
      if (problem.roundIds?.includes(composerSelectedRoundId)) return;

      const newOrder = [...accepted];
      if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= newOrder.length) {
          newOrder.splice(targetIndex, 0, problem);
      } else { newOrder.push(problem); }
      
      const orderMap = new Map();
      newOrder.forEach((p, idx) => orderMap.set(p.id, idx));

      const updatedProblems = problems.map(p => {
          if (p.id === problem.id) {
               const newRoundIds = [...(p.roundIds || []), composerSelectedRoundId];
               return { ...p, status: 'accepted', roundIds: newRoundIds, orderIndex: orderMap.get(p.id) } as Problem;
          }
          if (orderMap.has(p.id)) return { ...p, orderIndex: orderMap.get(p.id) };
          return p;
      });
      setProblems(updatedProblems);
      try {
         await api.updateProblem(problem.id, { roundId: composerSelectedRoundId, status: 'accepted' });
         await api.reorderRound(newOrder.map(p => p.id), composerSelectedRoundId);
      } catch(e) { refreshData(); }
  };

  const handleRemoveFromRound = async (problem: Problem) => {
      if (!composerSelectedRoundId) return;
      const updatedProblems = problems.map(p => {
          if (p.id === problem.id) {
             const newRoundIds = (p.roundIds || []).filter(rid => rid !== composerSelectedRoundId);
             const newStatus = newRoundIds.length === 0 ? 'approved' : 'accepted';
             return { ...p, status: newStatus, roundIds: newRoundIds } as Problem;
          }
          return p;
      });
      setProblems(updatedProblems);
      try { await api.removeFromRound(problem.id, composerSelectedRoundId); } catch(e) { refreshData(); }
  };

  const handleDragStart = (e: React.DragEvent, problemId: string, source: 'candidate' | 'accepted', index?: number) => {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = '1';
      requestAnimationFrame(() => setDraggingId(problemId));
      e.dataTransfer.setData('problemId', problemId);
      e.dataTransfer.setData('source', source);
      if (typeof index === 'number') e.dataTransfer.setData('index', index.toString());
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => { setDraggingId(null); setDragOverIndex(null); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  
  const handleDragOverItem = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation(); 
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const newIndex = e.clientY < midY ? index : index + 1;
      if (newIndex !== dragOverIndex) setDragOverIndex(newIndex);
  };

  const handleContainerDragOver = (e: React.DragEvent, listLength: number) => {
      e.preventDefault();
      if (e.target === e.currentTarget) setDragOverIndex(listLength);
  };

  const handleDropOnRound = async (e: React.DragEvent) => {
      e.preventDefault();
      const problemId = e.dataTransfer.getData('problemId');
      const source = e.dataTransfer.getData('source');
      const sourceIndexStr = e.dataTransfer.getData('index');
      if (!composerSelectedRoundId) return;

      let targetIndex = dragOverIndex;
      if (targetIndex === null) {
          const accepted = problems.filter(p => p.roundIds?.includes(composerSelectedRoundId) && p.status === 'accepted');
          targetIndex = accepted.length;
      }
      setDraggingId(null);
      setDragOverIndex(null);

      if (source === 'candidate') {
          const problem = problems.find(p => p.id === problemId);
          if (problem) handleAddToRound(problem, targetIndex); 
      } 
      else if (source === 'accepted') {
          const sourceIndex = parseInt(sourceIndexStr);
          if (isNaN(sourceIndex)) return;
          if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return;

          const accepted = problems.filter(p => p.roundIds?.includes(composerSelectedRoundId) && p.status === 'accepted').sort((a,b) => a.orderIndex - b.orderIndex);
          const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

          const newOrder = [...accepted];
          const [movedItem] = newOrder.splice(sourceIndex, 1);
          newOrder.splice(adjustedTarget, 0, movedItem);
          
          const orderMap = new Map();
          newOrder.forEach((p, idx) => orderMap.set(p.id, idx));

          const updatedProblems = problems.map(p => {
              if (orderMap.has(p.id)) return { ...p, orderIndex: orderMap.get(p.id) };
              return p;
          });
          setProblems(updatedProblems);
          try { await api.reorderRound(newOrder.map(p => p.id), composerSelectedRoundId); } catch(e) { refreshData(); }
      }
  };

  const handleDropOnCandidates = async (e: React.DragEvent) => {
      e.preventDefault();
      const problemId = e.dataTransfer.getData('problemId');
      const source = e.dataTransfer.getData('source');
      setDraggingId(null);
      setDragOverIndex(null);
      if (source === 'accepted') {
          const problem = problems.find(p => p.id === problemId);
          if (problem) handleRemoveFromRound(problem);
      }
  };

  const openExportModal = () => {
      const currentRound = rounds.find(r => r.id === composerSelectedRoundId);
      if (currentRound) setExportRoundName(currentRound.name);
      setShowExportModal(true);
  };

  const handleExportLatex = () => {
      const targetRoundId = composerSelectedRoundId;
      if (!targetRoundId) return;

      const activeProblems = problems.filter(p => p.roundIds?.includes(targetRoundId) && p.status === 'accepted').sort((a,b) => a.orderIndex - b.orderIndex);

      let tex = `\\documentclass[12pt]{extarticle}
\\usepackage{float}
\\usepackage{lipsum}
\\usepackage{extsizes}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{longtable}
\\usepackage{array}
\\usepackage{amssymb}
\\usepackage[a4paper, total={6.5in, 10in}]{geometry}
\\pagenumbering{gobble}
\\usepackage{tikz}
\\usepackage{asymptote}
\\usetikzlibrary{angles,quotes} 

% Table settings
\\setlength{\\arrayrulewidth}{0.5mm}
\\renewcommand{\\arraystretch}{1.75}
\\hbadness=99999

\\begin{document}
% Logo and titles
\\begin{minipage}{0.3\\textwidth}
\\begin{figure}[H]
\\end{figure}
\\end{minipage}
\\begin{minipage}{0.6\\textwidth}
{\\small ${exportContestName} - ${exportDate}}\\hfill\\\\~\\\\
\\begin{Huge}
    ${exportRoundName}
\\end{Huge}  
\\end{minipage}\\\\~\\\\

% Problems
\\begin{longtable}{>{\\raggedleft\\let\\newline\\\\\\arraybackslash\\hspace{0pt}}p{2em}|p{32em}}
`;
      activeProblems.forEach((p, idx) => {
          const cleanStatement = p.statement.trim(); 
          tex += `    \\Large${idx + 1} & ${cleanStatement}`;
          if (p.answerKey) tex += `\n    %${p.answerKey}`;
          tex += `\n    \\\\\\hline\n`;
      });
      tex += `\\end{longtable}\n\\end{document}`;

      navigator.clipboard.writeText(tex).then(() => {
          alert("Copied WAMT TeX template!");
          setShowExportModal(false);
      }).catch(err => { console.error(err); alert("Failed to copy"); });
  };

  const toggleExpandAll = (expand: boolean) => {
      const newMap = { ...composerExpandedMap };
      problems.forEach(p => { newMap[p.id] = expand; });
      setComposerExpandedMap(newMap);
  };
  
  const ComposerItem = ({ problem, isAccepted, index, onDragStart, onDragOverItem, onDragEnd, expanded, onToggleExpand }: { problem: Problem, isAccepted: boolean, index?: number, onDragStart?: any, onDragOverItem?: any, onDragEnd: any, expanded: boolean, onToggleExpand: () => void }) => {
      const [editMode, setEditMode] = useState(false);
      const [localStatement, setLocalStatement] = useState(problem.statement);
      const [localSolution, setLocalSolution] = useState(problem.solution || '');
      const [localAnswer, setLocalAnswer] = useState(problem.answerKey || '');
      const isDragging = draggingId === problem.id;

      const saveEdit = () => {
          const updates: any = {};
          if (localStatement !== problem.statement) updates.statement = localStatement;
          if (isAccepted) {
              if (localSolution !== problem.solution) updates.solution = localSolution;
              if (localAnswer !== problem.answerKey) updates.answerKey = localAnswer;
          }
          if (Object.keys(updates).length > 0) handleComposerUpdate(problem.id, updates);
          setEditMode(false);
      };

      return (
        <motion.div 
          layout
          draggable={!editMode}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(e) => { if (isAccepted && !isDragging) onDragOverItem && onDragOverItem(e, index); }}
          className={`bg-white rounded-lg transition-all duration-200 shadow-sm border text-sm ${
              isDragging ? 'opacity-40 ring-2 ring-indigo-200 border-indigo-400' : ''
          } ${
              isAccepted ? 'border-indigo-100 hover:border-indigo-200 cursor-move' : 'border-slate-200 hover:border-slate-300 cursor-grab active:cursor-grabbing'
          }`}
        >
            <div className="p-2.5 flex items-start gap-3">
                <div className={`mt-1.5 ${isAccepted ? 'text-indigo-500' : 'text-slate-300'}`}>
                   <GripVertical className="w-4 h-4" />
                </div>
                {isAccepted && <div className="font-mono font-bold text-indigo-600 text-xs mt-1.5 w-4 text-center">{index! + 1}</div>}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !editMode && onToggleExpand()}>
                    <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-slate-800 text-sm leading-snug hover:text-indigo-600 transition-colors line-clamp-1">
                            <MathText text={problem.title} />
                        </h4>
                        <span className="ml-2 text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                            {problem.difficulty}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                        <span className="truncate max-w-[120px]">{problem.topics.join(', ')}</span>
                        {problem.score > 0 && <span className="flex items-center gap-0.5 text-indigo-600 font-bold"><ThumbsUp className="w-3 h-3"/> {problem.score}</span>}
                        {problem.commentCount ? <span className="flex items-center gap-0.5 text-slate-400"><MessageSquare className="w-3 h-3"/> {problem.commentCount}</span> : null}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <button 
                       onClick={() => isAccepted ? handleRemoveFromRound(problem) : handleAddToRound(problem)}
                       className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${isAccepted ? 'hover:bg-red-50 text-slate-400 hover:text-red-500' : 'hover:bg-indigo-50 text-slate-400 hover:text-indigo-600'}`}
                    >
                        {isAccepted ? <X className="w-3.5 h-3.5"/> : <ArrowRight className="w-3.5 h-3.5"/>}
                    </button>
                    <button onClick={onToggleExpand} className="text-slate-400 hover:text-slate-600">
                        {expanded ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                    </button>
                </div>
            </div>
            <AnimatePresence>
            {(expanded || editMode) && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-slate-100 p-3 bg-slate-50/50">
                    {editMode ? (
                        <div className="space-y-2 mb-2">
                            <textarea className="w-full p-2 bg-white border border-indigo-200 rounded text-xs font-mono h-24 focus:ring-1 focus:ring-indigo-500 outline-none" value={localStatement} onChange={e => setLocalStatement(e.target.value)}/>
                            {isAccepted && (
                                <div className="grid grid-cols-2 gap-2">
                                    <textarea className="w-full p-2 bg-white border border-indigo-200 rounded text-xs font-mono h-16 focus:ring-1 focus:ring-indigo-500 outline-none" value={localSolution} onChange={e => setLocalSolution(e.target.value)} placeholder="Solution"/>
                                    <input className="w-full p-2 bg-white border border-indigo-200 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none" value={localAnswer} onChange={e => setLocalAnswer(e.target.value)} placeholder="Answer"/>
                                </div>
                            )}
                            <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => { setEditMode(false); }}>Cancel</Button><Button size="sm" onClick={saveEdit}>Save</Button></div>
                        </div>
                    ) : (
                        <div className="relative group/latex">
                            <MathText text={problem.statement} className="text-slate-700 whitespace-pre-wrap font-serif mb-2 text-xs leading-relaxed" />
                            {isAccepted && <button onClick={() => { setEditMode(true); setLocalStatement(problem.statement); setLocalSolution(problem.solution || ''); setLocalAnswer(problem.answerKey || ''); }} className="absolute top-0 right-0 p-1 opacity-0 group-hover/latex:opacity-100 hover:text-indigo-600"><Pencil className="w-3 h-3" /></button>}
                        </div>
                    )}
                    {problem.imageData && <img src={problem.imageData} className="max-h-24 object-contain border border-slate-200 rounded bg-white mb-2" />}
                    {!editMode && (
                        <div className="flex gap-4 text-[10px]">
                             <div className="flex-1 text-slate-500"><span className="font-bold text-slate-400 uppercase mr-1">Sol:</span> <MathText text={problem.solution || '-'} className="inline" /></div>
                             <div className="font-mono font-bold text-slate-700"><span className="font-bold text-slate-400 font-sans uppercase mr-1">Ans:</span> {problem.answerKey || '-'}</div>
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </motion.div>
      );
  };
  
  const composerListRef = useRef<HTMLDivElement>(null);
  const activeQuota = getActiveQuota();
  const submissionTarget = currentUser?.customTargets?.[activeQuotaId] || activeQuota.target;
  const voteTarget = activeQuota.voteTarget || 3;
  const submissionCount = problems.filter(p => p.authorId === currentUser?.id && p.quotaId === activeQuotaId).length;
  const userVoteCount = problems.filter(p => p.quotaId === activeQuotaId && p.votedBy?.includes(currentUser?.id || '')).length;
  const subPercent = Math.min((submissionCount / submissionTarget) * 100, 100);
  const votePercent = Math.min((userVoteCount / voteTarget) * 100, 100);
  const isDirector = currentUser?.role === 'admin' || currentUser?.role === 'director';
  const isGuest = currentUser?.role === 'guest';
  const composerSelectedRound = rounds.find(r => r.id === composerSelectedRoundId);
  const composerAccepted = problems.filter(p => p.roundIds && p.roundIds.includes(composerSelectedRoundId || '') && p.status === 'accepted').sort((a,b) => a.orderIndex - b.orderIndex);
  const composerCandidates = problems.filter(p => {
        if (p.roundIds && p.roundIds.includes(composerSelectedRoundId || '')) return false;
        if (p.status === 'accepted' && p.roundIds && p.roundIds.length > 0 && composerSelectedRound?.tag) {
             const assignedRounds = rounds.filter(r => p.roundIds?.includes(r.id));
             if (assignedRounds.some(r => r.tag !== composerSelectedRound?.tag)) return false;
        }
        if (p.status === 'pending') return false; 
        if (composerSourceQuota !== 'All' && p.quotaId !== composerSourceQuota) return false;
        if (composerFilterTopic !== 'All' && !p.topics.includes(composerFilterTopic as Topic)) return false;
        if (p.difficulty < composerMinDiff || p.difficulty > composerMaxDiff) return false;
        if (composerSearchText) {
            const lower = composerSearchText.toLowerCase();
            if (!p.title.toLowerCase().includes(lower) && !p.statement.toLowerCase().includes(lower)) return false;
        }
        return true;
    }).sort((a, b) => {
        if (composerSort === 'votes') return b.score - a.score;
        if (composerSort === 'difficulty') return b.difficulty - a.difficulty;
        if (composerSort === 'newest') return b.createdAt - a.createdAt;
        return 0;
    });
  const composerAvgDiff = composerAccepted.length > 0 ? (composerAccepted.reduce((acc, p) => acc + p.difficulty, 0) / composerAccepted.length).toFixed(1) : '0.0';
  const composerTopicCounts: Record<string, number> = {};
  TOPICS.forEach(t => composerTopicCounts[t] = 0);
  composerAccepted.forEach(p => p.topics.forEach(t => { if(composerTopicCounts[t] !== undefined) composerTopicCounts[t]++ }));
  const pendingCount = problems.filter(p => p.status === 'pending').length;

  if (!currentUser) {
    return (
      <div className="min-h-screen flex relative overflow-hidden bg-slate-50 font-sans">
        <Constellation />
        {/* Left Panel: Brand & Visuals */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative z-10 text-slate-800">
           <div>
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full border border-slate-200 shadow-sm mb-6">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                  <span className="text-xs font-bold tracking-wider uppercase">System Operational</span>
              </div>
              <h1 className="text-7xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-slate-600">
                 WAMO<br/><span className="text-4xl font-light">Contest Architect</span>
              </h1>
              <p className="max-w-md text-lg text-slate-500 leading-relaxed font-medium">
                  A high-performance platform for collaborative problem setting, blind review, and contest assembly.
              </p>
           </div>
           <div className="text-xs font-mono text-slate-400">
              v2.4.0 • Authorized Personnel Only
           </div>
        </div>

        {/* Right Panel: Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-20">
            <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ type: "spring", stiffness: 400, damping: 30 }}
               className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-2xl shadow-indigo-200/50 p-10"
            >
               {!selectedLoginId ? (
                 <div className="space-y-6">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Select Identity</h2>
                        {usersError && <button onClick={initApp} className="text-xs text-indigo-600 hover:underline">Retry</button>}
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                        {usersLoading && <div className="text-center py-4 text-xs text-slate-400 font-mono">Loading directory...</div>}
                        {users.map(user => (
                            <button
                               key={user.id}
                               onClick={() => setSelectedLoginId(user.id)}
                               className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group text-left"
                            >
                                <span className="font-semibold text-slate-700 group-hover:text-slate-900">{user.name}</span>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" onClick={handleGuestLogin} className="w-full">Guest Access</Button>
                 </div>
               ) : (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="flex items-center justify-between">
                         <button onClick={() => { setSelectedLoginId(''); setLoginPassword(''); }} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 font-bold uppercase tracking-wider">
                             <ArrowRight className="w-3 h-3 rotate-180" /> Back
                         </button>
                    </div>
                    <div className="text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-200 text-xl font-bold text-slate-700">
                            {users.find(u => u.id === selectedLoginId)?.name.charAt(0)}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{users.find(u => u.id === selectedLoginId)?.name}</h3>
                        <p className="text-sm text-slate-500">Enter secure access code</p>
                    </div>
                    
                    <div className="space-y-4">
                        <input 
                            type="password"
                            autoFocus
                            className="w-full text-center text-2xl tracking-[0.5em] py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 text-slate-800"
                            placeholder="••••"
                            value={loginPassword}
                            onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        />
                        {loginError && <p className="text-center text-xs font-bold text-red-500 bg-red-50 py-2 rounded border border-red-100">{loginError}</p>}
                        <Button onClick={handleLogin} className="w-full py-3 shadow-lg shadow-indigo-200">Verify Identity</Button>
                    </div>
                 </motion.div>
               )}
            </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row font-sans selection:bg-indigo-100 selection:text-indigo-900 text-sm">
      
      {/* Dense Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg tracking-tight">
             <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white">
                 <Grid className="w-3.5 h-3.5" />
             </div>
             WAMO
          </div>
        </div>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {!isGuest && (
              <NavItem icon={<LayoutDashboard className="w-4 h-4"/>} label="Overview" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          )}
          <NavItem icon={<PlusCircle className="w-4 h-4"/>} label={isGuest ? "Propose" : "Write Problem"} active={view === 'submit'} onClick={() => { resetForm(); setView('submit'); }} />
          {!isGuest && (
            <NavItem icon={<Layers className="w-4 h-4"/>} label="Pool" active={view === 'pool'} onClick={() => setView('pool')} />
          )}

          {isDirector && !isGuest && (
            <>
              <div className="mt-6 mb-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Director</div>
              <NavItem icon={<ListChecks className="w-4 h-4"/>} label="Waitlist" active={view === 'waitlist'} onClick={() => setView('waitlist')} badge={pendingCount} />
              <NavItem icon={<LayoutList className="w-4 h-4"/>} label="Composer" active={view === 'composer'} onClick={() => setView('composer')} />
              <NavItem icon={<Settings className="w-4 h-4"/>} label="Admin" active={view === 'admin'} onClick={() => setView('admin')} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
           <div className="flex items-center gap-3 mb-3">
               <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white shadow-sm ${currentUser.role === 'admin' ? 'bg-purple-600' : currentUser.role === 'director' ? 'bg-indigo-600' : currentUser.role === 'guest' ? 'bg-amber-500' : 'bg-slate-600'}`}>
                   {currentUser.name.charAt(0)}
               </div>
               <div className="flex-1 min-w-0">
                   <p className="font-bold text-slate-800 truncate text-xs">{currentUser.name}</p>
                   <p className="text-[10px] text-slate-500 capitalize">{currentUser.role} {currentUser.role !== 'guest' && `• Lvl ${currentUser.votingPower}`}</p>
               </div>
           </div>
           <Button variant="secondary" size="sm" onClick={handleLogout} className="w-full h-8 text-xs">Sign Out</Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-[1400px] mx-auto">
        
        {/* DASHBOARD VIEW - REDESIGNED AS TECHNICAL CARDS */}
        {view === 'dashboard' && !isGuest && (
          <motion.div variants={containerVar} initial="hidden" animate="show" className="space-y-6">
            <header className="flex justify-between items-end pb-4 border-b border-slate-200">
               <div>
                   <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mission Control</h1>
                   <p className="text-slate-500 text-xs mt-1">Operational Overview for {currentUser.name}</p>
               </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Active Quota Spec Sheet */}
                <motion.div variants={itemVar} className="md:col-span-8 bg-white border border-slate-200 rounded-lg p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6 relative z-10">
                        <div>
                             <div className="flex items-center gap-2 mb-2">
                                 <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Cycle</span>
                             </div>
                             <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{activeQuota.name}</h2>
                        </div>
                        {activeQuota.dueDate && (
                            <div className="text-right">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Deadline</span>
                                <span className="text-sm font-mono font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded">{getFormatDate(activeQuota.dueDate)}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-md p-4 text-slate-600 text-sm leading-relaxed relative z-10">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-2">Directive</span>
                        {activeQuota.instructions}
                    </div>
                </motion.div>

                {/* Stat Cards */}
                <div className="md:col-span-4 space-y-4">
                     {/* Writing Stat */}
                     <motion.div variants={itemVar} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between h-[140px]">
                         <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Pencil className="w-3 h-3"/> Writing</span>
                             <span className="text-xs font-mono font-bold text-slate-600">{submissionCount} / {submissionTarget}</span>
                         </div>
                         <div className="mt-4">
                             <div className="flex items-end gap-1 mb-2">
                                 <span className="text-4xl font-bold text-slate-900">{Math.round(subPercent)}</span>
                                 <span className="text-lg text-slate-400 mb-1">%</span>
                             </div>
                             <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${subPercent}%` }} className={`h-full ${submissionCount >= submissionTarget ? 'bg-emerald-500' : 'bg-indigo-600'}`}/>
                             </div>
                         </div>
                     </motion.div>

                     {/* Voting Stat */}
                     <motion.div variants={itemVar} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col justify-between h-[140px]">
                         <div className="flex justify-between items-center">
                             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><ThumbsUp className="w-3 h-3"/> Voting</span>
                             <span className="text-xs font-mono font-bold text-slate-600">{userVoteCount} / {voteTarget}</span>
                         </div>
                         <div className="mt-4">
                             <div className="flex items-end gap-1 mb-2">
                                 <span className="text-4xl font-bold text-slate-900">{Math.round(votePercent)}</span>
                                 <span className="text-lg text-slate-400 mb-1">%</span>
                             </div>
                             <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                 <motion.div initial={{ width: 0 }} animate={{ width: `${votePercent}%` }} className={`h-full ${userVoteCount >= voteTarget ? 'bg-emerald-500' : 'bg-violet-600'}`}/>
                             </div>
                         </div>
                     </motion.div>
                </div>
            </div>

            <motion.div variants={itemVar}>
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-800">Your Contributions</h3>
                  <Button variant="secondary" size="sm" onClick={() => { resetForm(); setView('submit'); }}>+ New Problem</Button>
              </div>
              <div className="grid gap-4">
                 {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).map(p => (
                      <ProblemCard 
                        key={p.id} 
                        problem={p} 
                        roundName={rounds.find(r => p.roundIds?.includes(r.id))?.name}
                        showAuthor={true} 
                        currentUserId={currentUser.id}
                        currentUserRole={currentUser.role}
                        onUpvote={handleToggleVote}
                        onEdit={handleStartEdit}
                        onStatusChange={handleStatusChange}
                        votingPower={currentUser.votingPower}
                      />
                 ))}
                 {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length === 0 && (
                     <div className="p-12 text-center border border-slate-200 border-dashed rounded-lg bg-slate-50">
                         <p className="text-slate-400 text-sm">No submissions found in this cycle.</p>
                     </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* POOL VIEW - TECHNICAL LIST */}
        {view === 'pool' && !isGuest && (
            <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-6">
                 <div className="flex justify-between items-end border-b border-slate-200 pb-4">
                     <div>
                         <h1 className="text-2xl font-bold text-slate-900">Problem Pool</h1>
                         <div className="flex items-center gap-2 mt-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                             <span className="text-xs text-slate-500 font-medium">Blind Review Protocol Active</span>
                         </div>
                     </div>
                     <div className="flex gap-2">
                        <select className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white outline-none focus:border-indigo-500" value={poolSort} onChange={(e) => setPoolSort(e.target.value as any)}>
                            <option value="highest">Sort: Highest Score</option>
                            <option value="lowest">Sort: Lowest Score</option>
                            <option value="hardest">Sort: Hardest</option>
                            <option value="newest">Sort: Newest</option>
                        </select>
                        <select className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white outline-none focus:border-indigo-500" value={poolFilterTopic} onChange={(e) => setPoolFilterTopic(e.target.value)}>
                            <option value="All">All Topics</option>
                            {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                     </div>
                 </div>

                 <div className="space-y-4">
                     {poolIds.map(id => {
                        const p = problems.find(prob => prob.id === id);
                        if (!p) return null;
                        return (
                            <motion.div variants={itemVar} key={p.id}>
                                <ProblemCard 
                                    problem={p} 
                                    roundName={rounds.find(r => p.roundIds?.includes(r.id))?.name}
                                    showAuthor={p.authorId === currentUser.id} 
                                    currentUserId={currentUser.id}
                                    currentUserRole={currentUser.role}
                                    onUpvote={handleToggleVote}
                                    onEdit={handleStartEdit}
                                    onStatusChange={handleStatusChange}
                                    votingPower={currentUser.votingPower}
                                />
                            </motion.div>
                        )
                     })}
                 </div>
            </motion.div>
        )}

        {/* SUBMIT VIEW */}
        {view === 'submit' && (
            <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">{editingProblemId ? 'Edit Problem' : 'New Submission'}</h1>
                    {!editingProblemId && !isGuest && (
                        <Button size="sm" variant="secondary" onClick={() => setShowBulkImport(true)}>Bulk Import</Button>
                    )}
                </div>

                {showBulkImport ? (
                    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-800">LaTeX Bulk Import</h3>
                            <button onClick={() => setShowBulkImport(false)}><X className="w-4 h-4 text-slate-400"/></button>
                        </div>
                        {parsedProblems.length === 0 ? (
                            <>
                                <textarea className="w-full h-64 p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none mb-4" placeholder="Paste LaTeX content..." value={bulkText} onChange={e => setBulkText(e.target.value)} />
                                <div className="flex justify-end gap-2">
                                    <Button onClick={handleBulkParse} disabled={!bulkText}>Parse</Button>
                                </div>
                            </>
                        ) : (
                            <div>
                                <div className="mb-4 p-3 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">Found {parsedProblems.length} problems ready to import.</div>
                                <div className="max-h-60 overflow-y-auto mb-4 border border-slate-200 rounded-lg">
                                    {parsedProblems.map((p, i) => (
                                        <div key={i} className="p-3 border-b border-slate-100 text-xs last:border-0">
                                            {p.statement.substring(0, 100)}...
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" onClick={() => setParsedProblems([])}>Reset</Button>
                                    <Button onClick={handleBulkCommit} isLoading={isSubmitting}>Import All</Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Title</label>
                        <input className="w-full p-3 bg-white border border-slate-200 rounded-lg text-lg font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm" placeholder="Problem Title" value={title} onChange={e => setTitle(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Difficulty</label>
                            <input type="number" step="0.5" className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" value={difficulty} onChange={e => setDifficulty(e.target.value)} />
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Topics</label>
                            <div className="flex flex-wrap gap-2">
                                {TOPICS.map(t => (
                                    <button key={t} onClick={() => handleTopicToggle(t)} className={`px-3 py-1.5 text-xs font-bold rounded border transition-all ${selectedTopics.includes(t) ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                         </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Statement (LaTeX)</label>
                        <textarea className="w-full h-32 p-4 bg-white border border-slate-200 rounded-lg text-sm font-serif outline-none focus:border-indigo-500 shadow-sm" value={statement} onChange={e => setStatement(e.target.value)} placeholder="Let $x$ be..." />
                    </div>

                    {/* Image Upload */}
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-600">
                             <ImageIcon className="w-4 h-4" /> Upload Image
                             <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                        {imageData && <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Image Attached</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Solution</label>
                            <textarea className="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-indigo-500" value={solution} onChange={e => setSolution(e.target.value)} placeholder="Proof..." />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Answer Key</label>
                            <input className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm font-mono outline-none focus:border-indigo-500" value={answerKey} onChange={e => setAnswerKey(e.target.value)} placeholder="42" />
                        </div>
                    </div>
                    
                    {/* Preview */}
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Preview</span>
                        <MathText text={statement || 'Type to preview...'} className="text-base text-slate-800 font-serif" />
                        {imageData && <img src={imageData} className="mt-4 max-h-40 border border-slate-200" />}
                    </div>

                    <label className="flex items-center gap-3 p-4 border border-indigo-100 bg-indigo-50/50 rounded-lg cursor-pointer">
                        <input type="checkbox" checked={isVerified} onChange={e => setIsVerified(e.target.checked)} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                        <span className="text-xs font-bold text-indigo-900">I certify this problem is accurate and original.</span>
                    </label>

                    {submissionError && <div className="text-red-600 text-xs font-bold">{submissionError}</div>}

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        {!isGuest && <Button variant="ghost" onClick={() => setView('dashboard')}>Cancel</Button>}
                        <Button onClick={handleSubmit} disabled={!isVerified || isSubmitting} isLoading={isSubmitting}>Submit Problem</Button>
                    </div>
                </div>
                )}
            </motion.div>
        )}

        {/* ADMIN VIEW */}
        {view === 'admin' && isDirector && !isGuest && (
            <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                    <h1 className="text-2xl font-bold text-slate-900">Administration</h1>
                    {currentUser.role === 'admin' && (
                        <Button size="sm" variant="danger" onClick={handleResetVotes}>Reset All Votes</Button>
                    )}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                     {/* Users */}
                     <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                         <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-700">User Directory</div>
                         <div className="p-4 border-b border-slate-100 flex gap-2">
                             <input className="flex-1 p-2 border border-slate-200 rounded text-xs" placeholder="Name" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                             <input className="w-24 p-2 border border-slate-200 rounded text-xs" placeholder="Pass" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                             <Button size="sm" onClick={addUser}>Add</Button>
                         </div>
                         <div className="max-h-80 overflow-y-auto custom-scrollbar">
                             <table className="w-full text-xs text-left">
                                 <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                                     <tr><th className="p-3">User</th><th className="p-3">Role</th><th className="p-3">Power</th><th className="p-3">Action</th></tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                     {users.map(u => (
                                         <tr key={u.id}>
                                             <td className="p-3 font-semibold text-slate-700">{u.name}</td>
                                             <td className="p-3 capitalize text-slate-500">{u.role}</td>
                                             <td className="p-3 font-mono">{u.votingPower}</td>
                                             <td className="p-3 flex gap-2">
                                                 <button onClick={() => startEditUser(u)} className="text-indigo-600 hover:underline">Edit</button>
                                                 <button onClick={() => deleteUser(u.id)} className="text-red-600 hover:underline">Del</button>
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                     </div>

                     {/* Quotas */}
                     <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                         <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-700">Cycles & Quotas</div>
                         <div className="p-4 space-y-3">
                             {quotas.map(q => (
                                 <div key={q.id} className="border border-slate-200 rounded p-3 text-xs flex justify-between items-center hover:bg-slate-50">
                                     {editingQuotaId === q.id ? (
                                         <div className="flex gap-2 w-full">
                                             <input className="flex-1 border p-1 rounded" value={editQuotaForm.name} onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})}/>
                                             <input className="w-12 border p-1 rounded" type="number" value={editQuotaForm.target} onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})}/>
                                             <button onClick={saveQuota} className="text-emerald-600 font-bold">Save</button>
                                         </div>
                                     ) : (
                                         <>
                                            <div>
                                                <div className="font-bold text-slate-800">{q.name}</div>
                                                <div className="text-slate-500">Target: {q.target} • Vote: {q.voteTarget}</div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => startEditQuota(q)} className="text-slate-400 hover:text-indigo-600"><Pencil className="w-3 h-3"/></button>
                                                {activeQuotaId !== q.id && <button onClick={() => switchQuota(q.id)} className="text-indigo-600 font-bold px-2 py-0.5 border border-indigo-200 rounded bg-indigo-50">Active</button>}
                                            </div>
                                         </>
                                     )}
                                 </div>
                             ))}
                         </div>
                     </div>
                </div>
                
                {editingUserId && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-96 space-y-4">
                            <h3 className="font-bold">Edit User: {users.find(u => u.id === editingUserId)?.name}</h3>
                            <input className="w-full p-2 border rounded" placeholder="Name" value={editUserForm.name} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} />
                            <input className="w-full p-2 border rounded" placeholder="New Password" value={editUserForm.password} onChange={e => setEditUserForm({...editUserForm, password: e.target.value})} />
                            <input className="w-full p-2 border rounded" type="number" placeholder="Power" value={editUserForm.votingPower} onChange={e => setEditUserForm({...editUserForm, votingPower: parseInt(e.target.value)})} />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>Cancel</Button>
                                <Button size="sm" onClick={() => saveUser(editingUserId)}>Save</Button>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        )}

        {/* COMPOSER VIEW */}
        {view === 'composer' && isDirector && !isGuest && (
            <div className="h-[calc(100vh-6rem)] flex flex-col">
                {!composerSelectedRoundId ? (
                    <div className="max-w-4xl mx-auto w-full pt-10">
                        <div className="text-center mb-10">
                            <h1 className="text-3xl font-bold text-slate-900">Round Composer</h1>
                            <p className="text-slate-500">Select a round context to begin assembly.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6">
                            <button onClick={() => setIsCreatingRound(true)} className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-4">
                                <PlusCircle className="w-8 h-8"/>
                                <span className="font-bold">New Round</span>
                            </button>
                            {rounds.map(r => (
                                <button key={r.id} onClick={() => setComposerSelectedRoundId(r.id)} className="bg-white border border-slate-200 rounded-xl p-6 text-left hover:shadow-md transition-all hover:border-indigo-200 group">
                                    <div className="flex justify-between items-start mb-4">
                                        <FolderOpen className="w-6 h-6 text-slate-400 group-hover:text-indigo-500"/>
                                        {r.tag && <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 uppercase">{r.tag}</span>}
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-800 mb-1">{r.name}</h3>
                                    <p className="text-xs text-slate-500 line-clamp-2">{r.description || 'No description'}</p>
                                </button>
                            ))}
                        </div>
                        {isCreatingRound && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur">
                                <div className="bg-white border border-slate-200 shadow-2xl rounded-xl p-8 w-[400px] space-y-4">
                                    <h3 className="font-bold text-lg">Create Round</h3>
                                    <input className="w-full p-2 border rounded" placeholder="Name" value={newRoundName} onChange={e => setNewRoundName(e.target.value)} autoFocus />
                                    <input className="w-full p-2 border rounded" placeholder="Tag (Optional)" value={newRoundTag} onChange={e => setNewRoundTag(e.target.value)} />
                                    <textarea className="w-full p-2 border rounded" placeholder="Description" value={newRoundDesc} onChange={e => setNewRoundDesc(e.target.value)} />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" onClick={() => setIsCreatingRound(false)}>Cancel</Button>
                                        <Button onClick={addRound}>Create</Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <header className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 shrink-0">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setComposerSelectedRoundId(null)} className="p-2 hover:bg-slate-100 rounded-lg"><RotateCcw className="w-4 h-4 text-slate-500"/></button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-xl text-slate-900">{composerSelectedRound?.name}</h2>
                                        {composerSelectedRound?.tag && <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{composerSelectedRound.tag}</span>}
                                    </div>
                                    <p className="text-xs text-slate-500">{composerSelectedRound?.description}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => { setIsEditingRound(true); setEditRoundForm(composerSelectedRound || {}); }}>Edit Round</Button>
                                <Button size="sm" variant="secondary" onClick={openExportModal}><Download className="w-4 h-4 mr-2"/> Export</Button>
                            </div>
                        </header>
                        
                        {/* Two Columns */}
                        <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                             {/* Source List */}
                             <div className="col-span-4 flex flex-col bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                 <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                                     <div className="relative">
                                         <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400"/>
                                         <input className="w-full pl-7 p-1.5 text-xs border border-slate-200 rounded bg-white outline-none" placeholder="Search..." value={composerSearchText} onChange={e => setComposerSearchText(e.target.value)} />
                                     </div>
                                     <div className="flex gap-2">
                                         <select className="flex-1 text-[10px] border p-1 rounded bg-white" value={composerFilterTopic} onChange={e => setComposerFilterTopic(e.target.value)}><option value="All">All Topics</option>{TOPICS.map(t=><option key={t} value={t}>{t}</option>)}</select>
                                         <select className="flex-1 text-[10px] border p-1 rounded bg-white" value={composerSourceQuota} onChange={e => setComposerSourceQuota(e.target.value)}><option value="All">All Cycles</option>{quotas.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}</select>
                                     </div>
                                     <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                                         <span>Candidates ({composerCandidates.length})</span>
                                         <span>Diff: {composerMinDiff}-{composerMaxDiff}</span>
                                     </div>
                                 </div>
                                 <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50" onDragOver={handleDragOver} onDrop={handleDropOnCandidates}>
                                     {composerCandidates.map(p => (
                                         <ComposerItem 
                                            key={p.id} problem={p} isAccepted={false} 
                                            onDragStart={(e: any) => handleDragStart(e, p.id, 'candidate')} 
                                            onDragEnd={handleDragEnd}
                                            expanded={composerExpandedMap[p.id] ?? true} 
                                            onToggleExpand={() => setComposerExpandedMap(prev => ({...prev, [p.id]: !(prev[p.id] ?? true)}))}
                                         />
                                     ))}
                                 </div>
                             </div>

                             {/* Target List */}
                             <div className="col-span-8 flex flex-col bg-white border border-indigo-200 rounded-lg shadow-sm overflow-hidden relative">
                                 <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                                     <div className="font-bold text-sm text-indigo-900 flex items-center gap-2"><CheckCircle className="w-4 h-4"/> Official Order ({composerAccepted.length})</div>
                                     <div className="flex gap-4 text-[10px] font-mono text-indigo-700">
                                         <span>Avg Diff: {composerAvgDiff}</span>
                                         <span className="opacity-50">|</span>
                                         {Object.entries(composerTopicCounts).map(([t,c]) => <span key={t} className={c===0?'opacity-30':''}>{t.substring(0,3)}:{c}</span>)}
                                     </div>
                                 </div>
                                 <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-slate-50/30" onDragOver={(e) => handleContainerDragOver(e, composerAccepted.length)} onDrop={handleDropOnRound} ref={composerListRef}>
                                     {composerAccepted.length === 0 && <div className="text-center py-20 text-slate-400 text-xs italic">Drag problems here to build the round.</div>}
                                     {composerAccepted.map((p, idx) => (
                                         <React.Fragment key={p.id}>
                                             {dragOverIndex === idx && <div className="h-1 bg-indigo-400 rounded-full my-1"/>}
                                             <ComposerItem 
                                                problem={p} isAccepted={true} index={idx}
                                                onDragStart={(e: any) => handleDragStart(e, p.id, 'accepted', idx)}
                                                onDragOverItem={handleDragOverItem} onDragEnd={handleDragEnd}
                                                expanded={composerExpandedMap[p.id] ?? true}
                                                onToggleExpand={() => setComposerExpandedMap(prev => ({...prev, [p.id]: !(prev[p.id] ?? true)}))}
                                             />
                                         </React.Fragment>
                                     ))}
                                     {dragOverIndex === composerAccepted.length && <div className="h-1 bg-indigo-400 rounded-full my-1"/>}
                                 </div>
                             </div>
                        </div>
                    </div>
                )}

                {/* Modals for Editing/Exporting would go here similarly structured */}
                {isEditingRound && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-96 space-y-4">
                            <h3 className="font-bold">Edit Round</h3>
                            <input className="w-full p-2 border rounded" value={editRoundForm.name} onChange={e => setEditRoundForm({...editRoundForm, name: e.target.value})}/>
                            <input className="w-full p-2 border rounded" value={editRoundForm.tag} onChange={e => setEditRoundForm({...editRoundForm, tag: e.target.value})} placeholder="Tag"/>
                            <textarea className="w-full p-2 border rounded" value={editRoundForm.description} onChange={e => setEditRoundForm({...editRoundForm, description: e.target.value})}/>
                            <div className="flex justify-between">
                                <button onClick={deleteRound} className="text-red-500 text-xs hover:underline">Delete Round</button>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditingRound(false)}>Cancel</Button>
                                    <Button size="sm" onClick={editRound}>Save</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {showExportModal && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
                        <div className="bg-white p-8 rounded-lg shadow-xl w-[500px] space-y-6">
                            <h2 className="text-xl font-bold">Export Configuration</h2>
                            <div className="space-y-4">
                                <div><label className="text-xs font-bold text-slate-400">Contest Name</label><input className="w-full p-2 border rounded" value={exportContestName} onChange={e => setExportContestName(e.target.value)}/></div>
                                <div><label className="text-xs font-bold text-slate-400">Round Name</label><input className="w-full p-2 border rounded" value={exportRoundName} onChange={e => setExportRoundName(e.target.value)}/></div>
                                <div><label className="text-xs font-bold text-slate-400">Date</label><input className="w-full p-2 border rounded" value={exportDate} onChange={e => setExportDate(e.target.value)}/></div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setShowExportModal(false)}>Cancel</Button>
                                <Button onClick={handleExportLatex}>Copy TeX to Clipboard</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
        
        {/* WAITLIST VIEW */}
        {view === 'waitlist' && isDirector && !isGuest && (
            <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-4xl mx-auto">
                 <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                     <Hourglass className="w-6 h-6 text-orange-500"/> Waitlist Review
                     <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{pendingCount} Pending</span>
                 </h1>
                 {pendingCount === 0 ? (
                     <div className="p-12 text-center bg-white border border-slate-200 rounded-lg">
                         <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4"/>
                         <h3 className="font-bold text-slate-800">All Clear</h3>
                         <p className="text-slate-500 text-sm">No problems pending approval.</p>
                     </div>
                 ) : (
                     <div className="space-y-4">
                         {problems.filter(p => p.status === 'pending').map(p => (
                             <div key={p.id} className="bg-white border-l-4 border-l-orange-400 border border-slate-200 p-6 rounded-r-lg shadow-sm">
                                 <div className="flex justify-between items-start mb-4">
                                     <div>
                                         <h3 className="font-bold text-lg text-slate-900">{p.title}</h3>
                                         <div className="text-xs text-slate-500 mt-1 flex gap-2">
                                             <span className="font-mono bg-slate-100 px-1 rounded">ID: {p.authorId.substring(0,6)}</span>
                                             <span>•</span>
                                             <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                                         </div>
                                     </div>
                                     <div className="flex gap-2">
                                         <Button size="sm" variant="secondary" onClick={() => handleStatusChange(p.id, 'approved')} className="text-emerald-600 border-emerald-200 bg-emerald-50">Approve</Button>
                                         <Button size="sm" variant="ghost" onClick={() => handleStartEdit(p)}>Edit</Button>
                                     </div>
                                 </div>
                                 <div className="bg-slate-50 p-4 rounded border border-slate-100 text-sm font-serif">
                                     <MathText text={p.statement}/>
                                 </div>
                                 <div className="mt-4 flex gap-2">
                                     {p.topics.map(t => <span key={t} className="text-[10px] font-bold border px-2 py-1 rounded uppercase tracking-wider">{t}</span>)}
                                     <span className="text-[10px] font-bold border px-2 py-1 rounded uppercase tracking-wider bg-slate-100">Diff: {p.difficulty}</span>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
            </motion.div>
        )}
        
        </div>
      </main>
    </div>
  );
}