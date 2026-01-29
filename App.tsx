import React, { useState, useEffect, useRef } from 'react';
import { Problem, User, Quota, Round, Topic, ProblemStatus, Comment } from './types';
import { Button } from './components/Button';
import { ProblemCard } from './components/ProblemCard';
import { MathText } from './components/MathText';
import { api } from './api';
import { motion, AnimatePresence } from 'framer-motion';
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
  Grid
} from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick, badge }) => (
  <motion.button
    whileHover={{ x: 4 }}
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
      active
        ? 'text-white'
        : 'text-zinc-500 hover:text-white'
    }`}
  >
    {active && (
      <motion.div 
        layoutId="activeNav"
        className="absolute inset-0 bg-white/5 border-l-2 border-indigo-500 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
    )}
    <div className={`relative z-10 ${active ? 'text-indigo-400' : 'text-zinc-600 group-hover:text-zinc-300'}`}>{icon}</div>
    <span className="relative z-10 flex-1 text-left font-medium text-sm tracking-wide">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className="relative z-10 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center shadow-[0_0_10px_rgba(79,70,229,0.5)]">
        {badge}
      </span>
    )}
  </motion.button>
);

const TOPICS: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

const AOPS_SCALE_INFO = (
    <div className="text-xs text-zinc-400 space-y-2 mt-2 bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-md">
        <p className="font-bold text-zinc-200 uppercase tracking-widest border-b border-white/5 pb-2">AoPS Competition Ratings Scale</p>
        <div className="grid grid-cols-1 gap-1">
            <p><span className="text-indigo-400 font-bold">1.0</span> Beginner (MOEMS, AMC 8 1-10)</p>
            <p><span className="text-indigo-400 font-bold">2.0</span> Motivated Beginner (AMC 8 21-25)</p>
            <p><span className="text-indigo-400 font-bold">3.0</span> Early Intermediate (AIME 1-6)</p>
            <p><span className="text-indigo-400 font-bold">4.0</span> Intermediate (AMC 12 21-25)</p>
            <p><span className="text-indigo-400 font-bold">5.0</span> Simple Proofs (USAJMO 1/4)</p>
            <p><span className="text-indigo-400 font-bold">6.0</span> Intro Olympiad (USAJMO 2/5)</p>
            <p><span className="text-indigo-400 font-bold">7.0</span> Tough Olympiad (USAMO 1/2)</p>
            <p><span className="text-indigo-400 font-bold">8.0</span> High Olympiad (USAMO 2/5)</p>
            <p><span className="text-indigo-400 font-bold">9.0</span> Expert (USAMO 3/6)</p>
            <p><span className="text-indigo-400 font-bold">10.</span> World Class</p>
        </div>
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
  const [composerScrollTop, setComposerScrollTop] = useState(0); // Track scroll
  
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
            
            // If guest, only show submit view
            if (me.role === 'guest') {
                setView('submit');
            } else {
                // Set active quota if saved
                const savedQ = localStorage.getItem('probfair_active_quota_id');
                if (savedQ) {
                   setActiveQuotaId(savedQ);
                   setPoolFilterQuota(savedQ);
                }
            }
        } catch(e) {
            // Token invalid
            console.log("Session invalid or expired");
            localStorage.removeItem('token');
        }
    }
  };

  // --- Data Sync ---
  const refreshData = async () => {
      // Guests don't sync heavy data
      if (currentUser?.role === 'guest') {
          try {
             const q = await api.getQuotas();
             setQuotas(q);
             // Always default to active
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
          
          // Ensure active quota ID is valid
          if (q.length > 0 && !q.find(i => i.id === activeQuotaId)) {
             setActiveQuotaId(q[0].id);
             // Also update the filter if it was set to the invalid ID
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

  // Update Users submitted & voted count locally based on ACTIVE QUOTA
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
  }, [problems, activeQuotaId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Pool Sorting & Filtering
  useEffect(() => {
    if (view === 'pool') {
      // In the "Pool", we only show Approved problems, or Accepted. We hide Pending (Waitlist).
      let filtered = [...problems].filter(p => p.status === 'approved' || p.status === 'accepted');

      // Filter by Quota
      if (poolFilterQuota !== 'All') {
          filtered = filtered.filter(p => p.quotaId === poolFilterQuota);
      }

      // Filter by Topic
      if (poolFilterTopic !== 'All') {
          filtered = filtered.filter(p => p.topics && p.topics.includes(poolFilterTopic as Topic));
      }

      // Filter by Status (Within allowed pool types)
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
  }, [view, problems.length, poolSort, poolFilterTopic, poolFilterStatus, poolFilterDiffMin, poolFilterDiffMax, poolFilterQuota]); 
  
  // Set Composer default filter when opening view
  useEffect(() => {
      if (view === 'composer') {
          setComposerSourceQuota('All'); // Default to showing all potential candidates
          setComposerSelectedRoundId(null); // Force selection screen
      }
  }, [view]);

  // --- Helpers ---
  const getActiveQuota = () => quotas.find(q => q.id === activeQuotaId) || quotas[0] || { id: 'default', target: 5, voteTarget: 3, name: 'Default', instructions: '', dueDate: null };
  const getFormatDate = (ts: number | null) => ts ? new Date(ts).toLocaleDateString() : 'No Deadline';

  // --- Actions ---

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

  // -- Round Management --

  const addRound = async () => {
    if (!newRoundName.trim()) return;
    try {
        const newRound = await api.createRound({
          name: newRoundName.trim(),
          tag: newRoundTag.trim() || undefined,
          description: newRoundDesc.trim() || 'No description.',
        });
        setRounds([newRound, ...rounds]); // Add to top
        setNewRoundName('');
        setNewRoundTag('');
        setNewRoundDesc('');
        
        // Switch to this round immediately
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
          refreshData(); // Updates the rounds list
          setIsEditingRound(false);
      } catch (e) {
          console.error("Edit round failed", e);
      }
  };

  const deleteRound = async () => {
      if (!composerSelectedRoundId) return;
      if (!window.confirm("Are you sure you want to delete this round? Problems will be unassigned, not deleted.")) return;
      try {
          await api.deleteRound(composerSelectedRoundId);
          setComposerSelectedRoundId(null);
          refreshData();
      } catch (e) {
          console.error("Delete round failed", e);
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
      console.error("Failed to update quota");
    }
  };

  const switchQuota = (id: string) => {
    setActiveQuotaId(id);
    setPoolFilterQuota(id); // Auto-filter pool to the new active quota for convenience
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit check on client for UX
          alert("File is too large. Please use an image under 2MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageData(reader.result as string);
      };
      reader.readAsDataURL(file);
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
          solution,
          answerKey,
          difficulty: parseFloat(difficulty),
          topics: selectedTopics,
          quotaId: activeQuotaId,
          imageData: imageData || undefined,
          version: editingProblemVersion // Pass version for check
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
      
      // If guest, do not refresh data or change view heavily
      if (currentUser.role === 'guest') {
          alert("Thank you! Your problem has been submitted for review.");
          resetForm();
      } else {
          await refreshData();
          resetForm();
          setView('dashboard');
      }
    } catch (e: any) {
      setSubmissionError(e.message || "System error during validation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // -- Bulk Import --
  const handleBulkParse = async () => {
      if (!bulkText) return;
      try {
          const parsed = await api.parseBulkLatex(bulkText, selectedTopics, parseFloat(difficulty));
          setParsedProblems(parsed);
      } catch (e) {
          alert("Parsing failed. Please check format.");
      }
  };

  const handleBulkCommit = async () => {
      setIsSubmitting(true);
      let successCount = 0;
      for (const p of parsedProblems) {
          try {
              await api.submitProblem({
                  ...p,
                  quotaId: activeQuotaId,
                  authorId: currentUser?.id,
                  authorName: currentUser?.name
              });
              successCount++;
          } catch(e) { console.error(e); }
      }
      setIsSubmitting(false);
      alert(`Imported ${successCount} problems successfully.`);
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
        const updated = problems.map(p => p.id === problemId ? { ...p, status } : p);
        setProblems(updated);
     } catch(e) {
        console.error("Failed to update status");
     }
  };
  
  // Inline Update in Composer
  const handleComposerUpdate = async (problemId: string, updates: Partial<Problem>) => {
      // Optimistic
      const updatedProblems = problems.map(p => p.id === problemId ? { ...p, ...updates } : p);
      setProblems(updatedProblems);
      try {
          // Merge updates with existing data for the API call to ensure robust update
          await api.updateProblem(problemId, updates);
      } catch(e) {
          console.error("Composer update failed");
          refreshData(); // Revert
      }
  };

  // Composer Actions
  const handleAddToRound = async (problem: Problem, targetIndex?: number) => {
      if (!composerSelectedRoundId) return;
      
      // Get current problems in that round
      const accepted = problems
        .filter(p => p.roundIds && p.roundIds.includes(composerSelectedRoundId) && p.status === 'accepted')
        .sort((a,b) => a.orderIndex - b.orderIndex);
      
      // If already added, do nothing (unless moving, which is handled in drag)
      if (problem.roundIds?.includes(composerSelectedRoundId)) return;

      const newOrder = [...accepted];
      
      // Insert at target index or end
      if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= newOrder.length) {
          newOrder.splice(targetIndex, 0, problem);
      } else {
          newOrder.push(problem);
      }
      
      // Create Map for fast update
      const orderMap = new Map();
      newOrder.forEach((p, idx) => orderMap.set(p.id, idx));

      // Optimistic update
      const updatedProblems = problems.map(p => {
          if (p.id === problem.id) {
               const newRoundIds = [...(p.roundIds || []), composerSelectedRoundId];
               // We set status 'accepted' if in any round
               return { ...p, status: 'accepted', roundIds: newRoundIds, orderIndex: orderMap.get(p.id) } as Problem;
          }
          if (orderMap.has(p.id)) {
              return { ...p, orderIndex: orderMap.get(p.id) };
          }
          return p;
      });
      setProblems(updatedProblems);
      
      try {
         // Update problem round assignment (add to round)
         await api.updateProblem(problem.id, { roundId: composerSelectedRoundId, status: 'accepted' });
         
         // Fix order
         await api.reorderRound(newOrder.map(p => p.id), composerSelectedRoundId);
      } catch(e) {
          refreshData();
      }
  };

  const handleRemoveFromRound = async (problem: Problem) => {
      if (!composerSelectedRoundId) return;

      // Removes current roundId from list
      const updatedProblems = problems.map(p => {
          if (p.id === problem.id) {
             const newRoundIds = (p.roundIds || []).filter(rid => rid !== composerSelectedRoundId);
             // If no rounds left, it goes back to 'approved' (pool)
             const newStatus = newRoundIds.length === 0 ? 'approved' : 'accepted';
             return { ...p, status: newStatus, roundIds: newRoundIds } as Problem;
          }
          return p;
      });
      setProblems(updatedProblems);

      try {
          await api.removeFromRound(problem.id, composerSelectedRoundId);
      } catch(e) {
          refreshData();
      }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, problemId: string, source: 'candidate' | 'accepted', index?: number) => {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = '1';
      
      requestAnimationFrame(() => {
        setDraggingId(problemId);
      });

      e.dataTransfer.setData('problemId', problemId);
      e.dataTransfer.setData('source', source);
      if (typeof index === 'number') e.dataTransfer.setData('index', index.toString());
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
      setDraggingId(null);
      setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDragOverItem = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation(); // Stop bubbling to container
      
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const newIndex = e.clientY < midY ? index : index + 1;
      
      if (newIndex !== dragOverIndex) {
          setDragOverIndex(newIndex);
      }
  };

  // Container handler to allow dropping in empty space
  const handleContainerDragOver = (e: React.DragEvent, listLength: number) => {
      e.preventDefault();
      // Only set to end if we are strictly hovering the container background, not bubbling from children
      if (e.target === e.currentTarget) {
          setDragOverIndex(listLength);
      }
  };

  // Handle Drop on the "Official Round" List (Accepts Candidates & Reorders Accepted)
  const handleDropOnRound = async (e: React.DragEvent) => {
      e.preventDefault();
      const problemId = e.dataTransfer.getData('problemId');
      const source = e.dataTransfer.getData('source');
      const sourceIndexStr = e.dataTransfer.getData('index');
      
      if (!composerSelectedRoundId) return;

      let targetIndex = dragOverIndex;
      // Default to end if null (dropped on container background)
      if (targetIndex === null) {
          // Fallback to getting from the filtered accepted list length
          const accepted = problems.filter(p => p.roundIds?.includes(composerSelectedRoundId) && p.status === 'accepted');
          targetIndex = accepted.length;
      }
      
      // Clear drag state
      setDraggingId(null);
      setDragOverIndex(null);

      // Case 1: Dragging from Candidate -> Accepted
      if (source === 'candidate') {
          const problem = problems.find(p => p.id === problemId);
          if (problem) {
              handleAddToRound(problem, targetIndex); 
          }
      } 
      // Case 2: Reordering within Accepted
      else if (source === 'accepted') {
          const sourceIndex = parseInt(sourceIndexStr);
          if (isNaN(sourceIndex)) return;
          
          // Optimization: No op if same position
          if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) return;

          const accepted = problems
            .filter(p => p.roundIds?.includes(composerSelectedRoundId) && p.status === 'accepted')
            .sort((a,b) => a.orderIndex - b.orderIndex);
          
          // Adjusted Target Logic:
          const adjustedTarget = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

          const newOrder = [...accepted];
          const [movedItem] = newOrder.splice(sourceIndex, 1);
          newOrder.splice(adjustedTarget, 0, movedItem);
          
          // Create Map for fast optimistic update
          const orderMap = new Map();
          newOrder.forEach((p, idx) => orderMap.set(p.id, idx));

          const updatedProblems = problems.map(p => {
              if (orderMap.has(p.id)) {
                  return { ...p, orderIndex: orderMap.get(p.id) };
              }
              return p;
          });
          setProblems(updatedProblems);
          
          try {
              await api.reorderRound(newOrder.map(p => p.id), composerSelectedRoundId);
          } catch(e) {
              refreshData();
          }
      }
  };

  // Handle Drop on the "Candidates" List (Removes from Round)
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
      if (currentRound) {
          setExportRoundName(currentRound.name);
      }
      setShowExportModal(true);
  };

  const handleExportLatex = () => {
      // WAMT LaTeX Export
      const targetRoundId = composerSelectedRoundId;
      if (!targetRoundId) return;

      const activeProblems = problems
        .filter(p => p.roundIds?.includes(targetRoundId) && p.status === 'accepted')
        .sort((a,b) => a.orderIndex - b.orderIndex);

      let tex = `\\documentclass[12pt]{extarticle}
\\usepackage{float}
\\usepackage{lipsum}
\\usepackage{extsizes}
\\usepackage{graphicx} % Required for inserting images
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
          // Only add comments for answer key if it exists
          if (p.answerKey) {
             tex += `\n    %${p.answerKey}`;
          }
          tex += `\n    \\\\\\hline\n`;
      });

tex += `\\end{longtable}

\\end{document}`;

      navigator.clipboard.writeText(tex).then(() => {
          alert("Copied WAMT TeX template to clipboard!");
          setShowExportModal(false);
      }).catch(err => {
          console.error("Failed to copy", err);
          alert("Failed to copy to clipboard");
      });
  };

  const toggleExpandAll = (expand: boolean) => {
      const newMap = { ...composerExpandedMap };
      problems.forEach(p => {
          newMap[p.id] = expand;
      });
      setComposerExpandedMap(newMap);
  };

  // --- Component Logic ---
  
  // Helper for Composer Item
  const ComposerItem = ({ problem, isAccepted, index, onDragStart, onDragOverItem, onDragEnd, expanded, onToggleExpand }: { problem: Problem, isAccepted: boolean, index?: number, onDragStart?: any, onDragOverItem?: any, onDragEnd: any, expanded: boolean, onToggleExpand: () => void }) => {
      const [editMode, setEditMode] = useState(false);
      const [localStatement, setLocalStatement] = useState(problem.statement);
      const [localSolution, setLocalSolution] = useState(problem.solution || '');
      const [localAnswer, setLocalAnswer] = useState(problem.answerKey || '');
      
      const isDragging = draggingId === problem.id;

      const saveEdit = () => {
          const updates: any = {};
          if (localStatement !== problem.statement) updates.statement = localStatement;
          // Only update solution/answer if accepted (official round order)
          if (isAccepted) {
              if (localSolution !== problem.solution) updates.solution = localSolution;
              if (localAnswer !== problem.answerKey) updates.answerKey = localAnswer;
          }

          if (Object.keys(updates).length > 0) {
              handleComposerUpdate(problem.id, updates);
          }
          setEditMode(false);
      };

      return (
        <div 
          draggable={!editMode}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(e) => {
              // Pass drag over event up for calculation if accepted item
              if (isAccepted && !isDragging) {
                  onDragOverItem && onDragOverItem(e, index);
              }
          }}
          className={`bg-white/[0.03] backdrop-blur-md border rounded-xl transition-all duration-200 shadow-sm ${
              isDragging ? 'opacity-40 ring-2 ring-indigo-500/50 border-indigo-500/50 bg-indigo-500/10' : ''
          } ${
              isAccepted ? 'border-indigo-500/20 hover:border-indigo-500/40 cursor-move' : 'border-white/5 hover:border-white/20 cursor-grab active:cursor-grabbing'
          }`}
        >
            <div className="p-3 flex items-start gap-3">
                {isAccepted ? (
                   <div className="text-zinc-600 mt-2 cursor-move flex items-center justify-center h-full">
                      <GripVertical className="w-4 h-4" />
                   </div>
                ) : (
                   <div className="text-zinc-700 mt-2">
                      <GripVertical className="w-4 h-4 opacity-50" />
                   </div>
                )}
                
                {isAccepted && (
                    <div className="font-mono font-bold text-indigo-400 text-sm mt-1 w-5 text-center">{index! + 1}.</div>
                )}
                
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !editMode && onToggleExpand()}>
                    <div className="flex justify-between items-start">
                        <h4 className="font-bold text-zinc-100 text-sm leading-tight hover:text-indigo-400 transition-colors">
                            <MathText text={problem.title} />
                        </h4>
                        <span className="ml-2 text-[10px] font-bold bg-white/5 border border-white/5 text-zinc-400 px-1.5 py-0.5 rounded whitespace-nowrap">
                            Diff: {problem.difficulty}
                        </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-2 items-center">
                        <span className="truncate max-w-[150px]">{problem.topics.join(', ')}</span>
                        {problem.score > 0 && (
                            <span className="flex items-center gap-0.5 text-indigo-400 font-bold bg-indigo-500/10 px-1 rounded">
                                <ThumbsUp className="w-3 h-3"/> {problem.score}
                            </span>
                        )}
                        <span className="flex items-center gap-0.5 text-zinc-600">
                             <MessageSquare className="w-3 h-3" /> {problem.commentCount}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <button 
                       onClick={() => isAccepted ? handleRemoveFromRound(problem) : handleAddToRound(problem)}
                       className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                           isAccepted 
                           ? 'hover:bg-red-500/20 text-zinc-500 hover:text-red-400' 
                           : 'hover:bg-indigo-500/20 text-zinc-500 hover:text-indigo-400 bg-white/5'
                       }`}
                       title={isAccepted ? "Remove from Round" : "Add to Round"}
                    >
                        {isAccepted ? <X className="w-4 h-4"/> : <ArrowRight className="w-4 h-4"/>}
                    </button>
                    <button onClick={onToggleExpand} className="text-zinc-600 hover:text-zinc-400">
                        {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                    </button>
                </div>
            </div>

            {(expanded || editMode) && (
                <div className="border-t border-white/5 p-3 bg-black/20 text-sm animate-in slide-in-from-top-1">
                    {editMode ? (
                        <div className="space-y-3 mb-2">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Statement</label>
                                <textarea 
                                    className="w-full p-2 bg-black/40 border border-indigo-500/30 rounded-lg text-sm font-mono h-32 focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-300"
                                    value={localStatement}
                                    onChange={e => setLocalStatement(e.target.value)}
                                />
                            </div>
                            {isAccepted && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Solution</label>
                                        <textarea 
                                            className="w-full p-2 bg-black/40 border border-indigo-500/30 rounded-lg text-sm font-mono h-24 focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-300"
                                            value={localSolution}
                                            onChange={e => setLocalSolution(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1">Answer</label>
                                        <input 
                                            className="w-full p-2 bg-black/40 border border-indigo-500/30 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-300"
                                            value={localAnswer}
                                            onChange={e => setLocalAnswer(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 mt-2">
                                <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setLocalStatement(problem.statement); setLocalSolution(problem.solution || ''); setLocalAnswer(problem.answerKey || ''); }}>Cancel</Button>
                                <Button size="sm" onClick={saveEdit}>Save</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative group/latex">
                            <MathText text={problem.statement} className="text-zinc-300 whitespace-pre-wrap font-serif mb-3" />
                            {isAccepted && (
                                <button 
                                    onClick={() => { setEditMode(true); setLocalStatement(problem.statement); setLocalSolution(problem.solution || ''); setLocalAnswer(problem.answerKey || ''); }}
                                    className="absolute top-0 right-0 p-1 bg-black/50 border border-white/10 rounded shadow-sm opacity-0 group-hover/latex:opacity-100 transition-opacity text-zinc-400 hover:text-indigo-400"
                                    title="Edit Content"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}
                    
                    {problem.imageData && (
                        <img src={problem.imageData} alt="Problem attachment" className="max-h-48 w-auto mb-3 object-contain border border-white/10 rounded bg-black/50" />
                    )}
                    
                    {!editMode && (
                        <div className="grid grid-cols-2 gap-3">
                             <div className="bg-white/5 p-2 rounded border border-white/5">
                                 <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Solution Outline</span>
                                 <div className="max-h-32 overflow-y-auto custom-scrollbar text-zinc-400">
                                    <MathText text={problem.solution || 'None'} className="text-xs" />
                                 </div>
                             </div>
                             <div className="bg-white/5 p-2 rounded border border-white/5 h-fit">
                                 <span className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Answer</span>
                                 <div className="font-mono font-bold text-zinc-200">{problem.answerKey || '-'}</div>
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      );
  };

  const WaitlistProblemCard = ({ p }: { p: Problem }) => {
      const [isExpanded, setIsExpanded] = useState(false);
      const [formData, setFormData] = useState({
          title: p.title,
          statement: p.statement,
          solution: p.solution || '',
          answerKey: p.answerKey || '',
          difficulty: p.difficulty,
          topics: p.topics || []
      });
      const [isSaving, setIsSaving] = useState(false);

      const hasChanges = JSON.stringify(formData) !== JSON.stringify({
          title: p.title,
          statement: p.statement,
          solution: p.solution || '',
          answerKey: p.answerKey || '',
          difficulty: p.difficulty,
          topics: p.topics || []
      });

      const handleSave = async () => {
          setIsSaving(true);
          try {
              await api.updateProblem(p.id, {
                  title: formData.title,
                  statement: formData.statement,
                  solution: formData.solution,
                  answerKey: formData.answerKey,
                  difficulty: formData.difficulty,
                  topics: formData.topics
              });
              await refreshData();
          } catch(e) {
              console.error(e);
              alert("Failed to save");
          } finally {
              setIsSaving(false);
          }
      };
      
      const approve = async () => {
          // Send current form data with status update to ensure edits are saved on approve
          await api.updateProblem(p.id, { 
              ...formData, 
              status: 'approved' 
          });
          await refreshData();
      };

      const toggleTopic = (t: Topic) => {
          if (formData.topics.includes(t)) {
              setFormData({...formData, topics: formData.topics.filter(top => top !== t)});
          } else {
              setFormData({...formData, topics: [...formData.topics, t]});
          }
      };

      return (
          <div className={`bg-white/[0.03] border-l-4 ${hasChanges ? 'border-l-indigo-500' : 'border-l-amber-500/50'} border-y border-r border-white/10 rounded-xl p-6 shadow-lg flex flex-col gap-4 transition-all backdrop-blur-sm`}>
              {/* Header Line */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex-1 w-full">
                      <input 
                          className="font-bold text-zinc-100 text-lg w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-500 outline-none transition-colors"
                          value={formData.title}
                          onChange={e => setFormData({...formData, title: e.target.value})}
                      />
                      <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                          <span>Author Hidden (ID: {p.authorId.substring(0,6)}...)</span>
                          <span>•</span>
                          <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                  </div>
                  <div className="flex items-center gap-3 bg-black/20 p-2 rounded-lg border border-white/5 self-end md:self-auto">
                       <div className="flex flex-col items-center">
                           <span className="text-[10px] font-bold text-zinc-500 uppercase">Diff</span>
                           <input 
                              type="number" 
                              step="0.5"
                              className="w-12 text-sm p-1 border border-white/10 rounded bg-white/5 text-center font-bold text-zinc-200" 
                              value={formData.difficulty} 
                              onChange={e => setFormData({...formData, difficulty: Number(e.target.value)})} 
                           />
                       </div>
                       <Button size="sm" onClick={approve} className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/30 h-9 text-xs px-4 shadow-none">
                           Approve
                       </Button>
                       <button onClick={() => setIsExpanded(!isExpanded)} className="text-zinc-500 hover:text-zinc-300 p-1">
                           {isExpanded ? <ChevronUp className="w-5 h-5"/> : <ChevronDown className="w-5 h-5"/>}
                       </button>
                  </div>
              </div>

              {/* Expanded Edit Area */}
              {isExpanded && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 pt-2 border-t border-white/5">
                      <div className="grid md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Statement (LaTeX)</label>
                              <textarea 
                                  className="w-full h-32 p-3 bg-black/30 border border-white/10 rounded-xl text-sm font-serif focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-300"
                                  value={formData.statement}
                                  onChange={e => setFormData({...formData, statement: e.target.value})}
                              />
                          </div>
                          <div className="space-y-4">
                              <div>
                                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Solution Outline</label>
                                  <textarea 
                                      className="w-full h-20 p-3 bg-black/30 border border-white/10 rounded-xl text-sm font-serif focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-300"
                                      value={formData.solution}
                                      onChange={e => setFormData({...formData, solution: e.target.value})}
                                      placeholder="No solution provided."
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Answer Key</label>
                                  <input 
                                      className="w-full p-2 bg-black/30 border border-white/10 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-300"
                                      value={formData.answerKey}
                                      onChange={e => setFormData({...formData, answerKey: e.target.value})}
                                      placeholder="No answer provided."
                                  />
                              </div>
                          </div>
                      </div>
                      
                      {/* Topics */}
                      <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Topics</label>
                          <div className="flex flex-wrap gap-2">
                              {TOPICS.map(t => (
                                  <button
                                      key={t}
                                      onClick={() => toggleTopic(t)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${formData.topics.includes(t) ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-white/5 text-zinc-500 border-white/10 hover:border-white/20'}`}
                                  >
                                      {t}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {hasChanges && (
                          <div className="flex justify-end">
                              <Button size="sm" onClick={handleSave} isLoading={isSaving} className="bg-indigo-600 hover:bg-indigo-500">Save Changes</Button>
                          </div>
                      )}
                  </div>
              )}
              
              {/* Preview Snippet (Collapsed) */}
              {!isExpanded && (
                  <div className="bg-black/20 p-3 rounded-lg border border-white/5 text-sm font-serif text-zinc-400">
                      <MathText text={formData.statement} className="line-clamp-2"/>
                  </div>
              )}
          </div>
      );
  };
  
  // Composer Scroll Fix
  const composerListRef = useRef<HTMLDivElement>(null);
  
  // Save scroll position before updates if needed
  useEffect(() => {
      if (composerListRef.current) {
          // If we had a saved scroll top and the data refreshed, restore it? 
          // Actually, React preserves scroll on simple updates. 
          // The issue described is likely due to full re-mounts.
          // By ensuring keys are stable (p.id), we mitigate most issues.
          // But let's restore if we have a tracking state.
          // However, if we simply don't unmount the list container, it stays.
      }
  }, [problems]); // Naive check

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#020202] text-zinc-200 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-900/10 rounded-full blur-[120px]" />

        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/[0.03] backdrop-blur-xl max-w-sm w-full rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] p-8 border border-white/10 relative z-10"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-[0_0_25px_rgba(79,70,229,0.4)] transform rotate-3">
              <BookOpen size={32} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 text-center tracking-tight">WAMO Tracker</h1>
          <p className="text-zinc-500 mb-10 text-center text-sm font-medium tracking-wide">SECURE ACCESS PORTAL</p>
          
          {!selectedLoginId ? (
            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                 <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Select Identity</p>
                 {usersError && (
                     <button onClick={initApp} className="text-[10px] text-indigo-400 flex items-center gap-1 hover:underline">
                        <RotateCcw className="w-3 h-3" /> Retry
                     </button>
                 )}
               </div>
               
               <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {usersLoading && users.length === 0 && <div className="text-sm text-zinc-600 italic p-4 text-center">Decrypting users...</div>}
                  
                  {users.map(user => (
                    <motion.button
                      whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.05)" }}
                      key={user.id}
                      onClick={() => setSelectedLoginId(user.id)}
                      className="w-full p-3 bg-white/[0.02] border border-white/5 rounded-xl text-left transition-all duration-200 group flex items-center justify-between"
                    >
                      <span className="font-semibold text-zinc-300 group-hover:text-white">{user.name}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-indigo-400" />
                    </motion.button>
                  ))}
               </div>

               <div className="pt-4 border-t border-white/5">
                  <Button variant="secondary" onClick={handleGuestLogin} className="w-full text-sm py-3">
                    Continue as Guest
                  </Button>
               </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm border border-indigo-500/30">
                        {users.find(u => u.id === selectedLoginId)?.name.charAt(0)}
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Signing in as</p>
                        <p className="text-sm font-bold text-white leading-none mt-1">{users.find(u => u.id === selectedLoginId)?.name}</p>
                    </div>
                </div>
                <button onClick={() => { setSelectedLoginId(''); setLoginPassword(''); setLoginError(''); }} className="text-xs text-zinc-500 hover:text-white font-medium">Change</button>
              </div>
              
              <div>
                <input 
                  type="password"
                  placeholder="Enter access code"
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-5 py-3.5 border border-white/10 rounded-xl bg-black/40 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all placeholder:text-zinc-600"
                  autoFocus
                />
                {loginError && <p className="text-red-400 text-xs mt-2 flex items-center gap-1 font-medium"><ShieldAlert className="w-3 h-3"/> {loginError}</p>}
              </div>
              
              <Button onClick={handleLogin} className="w-full py-3.5 text-lg shadow-[0_0_20px_rgba(79,70,229,0.3)]">Authenticate</Button>
            </div>
          )}
        </motion.div>
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
  // Count votes (Strictly for active quota)
  const userVoteCount = problems.filter(p => p.quotaId === activeQuotaId && p.votedBy?.includes(currentUser.id)).length;

  const subPercent = Math.min((submissionCount / submissionTarget) * 100, 100);
  const votePercent = Math.min((userVoteCount / voteTarget) * 100, 100);
  
  const isDirector = currentUser.role === 'admin' || currentUser.role === 'director';
  const isGuest = currentUser.role === 'guest';

  // --- Composer Data ---
  // Using composerSelectedRoundId instead of activeQuotaId
  const composerSelectedRound = rounds.find(r => r.id === composerSelectedRoundId);
  const composerSelectedRoundTag = composerSelectedRound?.tag;
  
  // Problems assigned to the round (using roundIds array for many-to-many)
  const composerAccepted = problems
    .filter(p => p.roundIds && p.roundIds.includes(composerSelectedRoundId || '') && p.status === 'accepted')
    .sort((a,b) => a.orderIndex - b.orderIndex);
  
  // Problems NOT assigned to this round, filtered by source quota and search
  const composerCandidates = problems
    .filter(p => {
        // Exclude problems already in THIS round
        if (p.roundIds && p.roundIds.includes(composerSelectedRoundId || '')) return false;
        
        // Exclude problems already in ANY round, UNLESS that round shares the same TAG
        if (p.status === 'accepted' && p.roundIds && p.roundIds.length > 0) {
             // Find rounds this problem is in
             const assignedRounds = rounds.filter(r => p.roundIds?.includes(r.id));
             // If any assigned round has a DIFFERENT tag (or no tag) than current round, exclude it.
             // i.e. "Fall 2024 Div A" can share with "Fall 2024 Div B" (Same Tag), 
             // but not with "Spring 2025" (Different Tag).
             // If current round has NO tag, it can't share with anyone.
             if (!composerSelectedRoundTag) return false; 
             
             // Check for incompatibility
             const hasIncompatibleRound = assignedRounds.some(r => r.tag !== composerSelectedRoundTag);
             if (hasIncompatibleRound) return false;
        }

        // Must be in pool (approved) or accepted (shared round)
        if (p.status === 'pending') return false; // Hide waitlist problems
        
        // Source Filter (Quota)
        if (composerSourceQuota !== 'All' && p.quotaId !== composerSourceQuota) return false;
        
        // Topic Filter
        if (composerFilterTopic !== 'All' && !p.topics.includes(composerFilterTopic as Topic)) return false;
        
        // Diff Filter
        if (p.difficulty < composerMinDiff || p.difficulty > composerMaxDiff) return false;
        
        // Search Text Filter
        if (composerSearchText) {
            const lowerSearch = composerSearchText.toLowerCase();
            const inTitle = p.title.toLowerCase().includes(lowerSearch);
            const inStatement = p.statement.toLowerCase().includes(lowerSearch);
            if (!inTitle && !inStatement) return false;
        }

        return true;
    })
    .sort((a, b) => {
        if (composerSort === 'votes') return b.score - a.score;
        if (composerSort === 'difficulty') return b.difficulty - a.difficulty;
        if (composerSort === 'newest') return b.createdAt - a.createdAt;
        return 0;
    });

  // Composer Stats
  const composerAvgDiff = composerAccepted.length > 0 
      ? (composerAccepted.reduce((acc, p) => acc + p.difficulty, 0) / composerAccepted.length).toFixed(1) 
      : '0.0';
  
  const composerTopicCounts: Record<string, number> = {};
  TOPICS.forEach(t => composerTopicCounts[t] = 0);
  composerAccepted.forEach(p => {
      p.topics.forEach(t => { if(composerTopicCounts[t] !== undefined) composerTopicCounts[t]++ });
  });
  
  // Pending Count for Director
  const pendingCount = problems.filter(p => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#020202] text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden flex flex-col md:flex-row">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-black/50 border-r border-white/5 backdrop-blur-xl flex flex-col sticky top-0 md:h-screen z-20 shadow-[0_0_50px_-10px_rgba(0,0,0,1)]">
        <div className="p-8 border-b border-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-3 tracking-tight">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]">
                <BookOpen className="w-5 h-5" strokeWidth={3} />
            </div>
            WAMO
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {!isGuest && (
              <NavItem 
                icon={<LayoutDashboard className="w-5 h-5" />} 
                label="Dashboard" 
                active={view === 'dashboard'} 
                onClick={() => setView('dashboard')} 
              />
          )}
          
          <NavItem 
            icon={<PlusCircle className="w-5 h-5" />} 
            label={isGuest ? "Propose Problem" : "Write Problem"} 
            active={view === 'submit'} 
            onClick={() => { resetForm(); setView('submit'); }} 
          />
          
          {!isGuest && (
            <NavItem 
                icon={<Layers className="w-5 h-5" />} 
                label="Problem Pool" 
                active={view === 'pool'} 
                onClick={() => setView('pool')} 
            />
          )}

          {isDirector && !isGuest && (
            <>
              <div className="mt-8 mb-2 px-4">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Administration</p>
              </div>
              <NavItem 
                icon={<ListChecks className="w-5 h-5" />} 
                label="Waitlist" 
                active={view === 'waitlist'} 
                onClick={() => setView('waitlist')}
                badge={pendingCount}
              />
              <NavItem 
                icon={<LayoutList className="w-5 h-5" />} 
                label="Round Composer" 
                active={view === 'composer'} 
                onClick={() => setView('composer')} 
              />
              <NavItem 
                icon={<Settings className="w-5 h-5" />} 
                label="Director Panel" 
                active={view === 'admin'} 
                onClick={() => setView('admin')} 
              />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-white/[0.03] rounded-2xl p-4 border border-white/5 backdrop-blur-md mb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${currentUser.role === 'admin' ? 'bg-purple-600' : currentUser.role === 'director' ? 'bg-indigo-600' : currentUser.role === 'guest' ? 'bg-amber-600' : 'bg-zinc-600'}`}>
                {isGuest ? <UserIcon className="w-5 h-5" /> : currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentUser.name}</p>
                <p className="text-[10px] text-zinc-500 capitalize flex items-center gap-1 font-medium tracking-wide">
                    {currentUser.role}
                    {!isGuest && <><span className="text-zinc-600">•</span> Power: {currentUser.votingPower}</>}
                </p>
                </div>
              </div>
              <Button variant="ghost" onClick={handleLogout} className="w-full text-xs h-8 justify-center text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-900/30 hover:bg-red-900/10">
                <LogOut className="w-3 h-3 mr-2" /> Log Out
              </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar relative">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-900/10 to-transparent pointer-events-none" />
        
        {/* VIEW: WAITLIST */}
        {view === 'waitlist' && isDirector && !isGuest && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto relative z-10">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
                            <Hourglass className="w-6 h-6"/>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Problem Waitlist</h1>
                            <p className="text-zinc-500 text-sm mt-1">Review, edit, and approve pending submissions.</p>
                        </div>
                    </div>
                    <span className="bg-white/5 text-zinc-400 px-4 py-1.5 rounded-full text-xs font-bold border border-white/5">{pendingCount} Pending</span>
                </div>
                
                {pendingCount > 0 ? (
                    <div className="flex flex-col gap-6">
                        {problems.filter(p => p.status === 'pending').map(p => (
                            <WaitlistProblemCard key={p.id} p={p} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-3xl p-16 text-center text-zinc-500 flex flex-col items-center backdrop-blur-sm">
                        <CheckCircle className="w-16 h-16 mb-4 text-zinc-700" />
                        <h3 className="font-bold text-xl text-zinc-300">All caught up!</h3>
                        <p className="text-zinc-600 mt-2">No problems currently waiting for approval.</p>
                    </div>
                )}
            </motion.div>
        )}

        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && !isGuest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-10 relative z-10">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-5xl font-extrabold text-white tracking-tighter">Hello, <span className="text-indigo-500">{currentUser.name.split(' ')[0]}</span>.</h1>
                <p className="text-lg text-zinc-500 mt-2 font-medium">Here is the current round status.</p>
              </div>
            </header>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Active Quota Info (Large Hero Tile) */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:col-span-3 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden p-10 relative group"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none transform translate-x-10 -translate-y-4 group-hover:scale-105 transition-transform duration-700">
                        <BookOpen size={200} />
                    </div>
                    <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(99,102,241,0.2)]">Active Quota</span>
                            {activeQuota.dueDate && (
                            <span className="px-3 py-1 rounded-md bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <Clock className="w-3 h-3"/> {getFormatDate(activeQuota.dueDate)}
                            </span>
                            )}
                        </div>
                        <h2 className="text-4xl font-bold text-white tracking-tight">{activeQuota.name}</h2>
                    </div>
                    </div>
                    
                    <div className="bg-black/40 p-6 rounded-2xl border border-white/5 text-zinc-400 text-sm relative z-10 leading-relaxed max-w-2xl">
                    <strong className="text-zinc-200 font-bold block mb-2 text-xs uppercase tracking-wider">Director's Note</strong> {activeQuota.instructions}
                    </div>
                </motion.div>

                {/* Progress Card: Writing */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/[0.03] backdrop-blur-md p-8 rounded-3xl border border-white/10 flex flex-col justify-between h-64 relative overflow-hidden group hover:border-indigo-500/30 transition-colors"
                >
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="font-bold text-zinc-300 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <Pencil className="w-4 h-4 text-indigo-400" /> Writing Quota
                            </h3>
                            {submissionCount >= submissionTarget ? 
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Done</span> : 
                                <span className="bg-white/5 border border-white/5 text-zinc-500 text-[10px] font-bold px-2 py-1 rounded-full">{submissionCount} / {submissionTarget}</span>
                            }
                        </div>
                        <div className="text-6xl font-black text-white mt-2 tracking-tighter">
                            {Math.round(subPercent)}<span className="text-3xl text-zinc-600 font-bold ml-1">%</span>
                        </div>
                    </div>
                    
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden relative z-10">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${submissionCount >= submissionTarget ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-indigo-500 shadow-[0_0_10px_#6366f1]'}`} 
                            style={{ width: `${subPercent}%` }}
                        ></div>
                    </div>

                    <div className="absolute -bottom-6 -right-6 text-indigo-500/5 opacity-100 group-hover:scale-110 transition-transform duration-500">
                        <Pencil size={120} />
                    </div>
                </motion.div>

                {/* Progress Card: Voting */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/[0.03] backdrop-blur-md p-8 rounded-3xl border border-white/10 flex flex-col justify-between h-64 relative overflow-hidden group hover:border-teal-500/30 transition-colors"
                >
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="font-bold text-zinc-300 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <ThumbsUp className="w-4 h-4 text-teal-400" /> Voting Quota
                            </h3>
                            {userVoteCount >= voteTarget ? 
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Done</span> : 
                                <span className="bg-white/5 border border-white/5 text-zinc-500 text-[10px] font-bold px-2 py-1 rounded-full">{userVoteCount} / {voteTarget}</span>
                            }
                        </div>
                        <div className="text-6xl font-black text-white mt-2 tracking-tighter">
                            {Math.round(votePercent)}<span className="text-3xl text-zinc-600 font-bold ml-1">%</span>
                        </div>
                    </div>
                    
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden relative z-10">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${userVoteCount >= voteTarget ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-teal-500 shadow-[0_0_10px_#14b8a6]'}`} 
                            style={{ width: `${votePercent}%` }}
                        ></div>
                    </div>

                    <div className="absolute -bottom-6 -right-6 text-teal-500/5 opacity-100 group-hover:scale-100 transition-transform duration-500">
                        <ThumbsUp size={120} />
                    </div>
                </motion.div>
                
                {/* Submission List (Full Width Tile) */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="md:col-span-3 mt-4"
                >
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-bold text-white tracking-tight">Your Submissions</h3>
                        <Button variant="ghost" onClick={() => { resetForm(); setView('submit'); }} className="text-sm">
                        <PlusCircle className="w-4 h-4" /> Add Problem
                        </Button>
                    </div>
                    
                    {isLoadingData && <p className="text-sm text-zinc-500 mb-4 animate-pulse">Synchronizing database...</p>}

                    {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length > 0 ? (
                        <div className="grid gap-6">
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
                                defaultExpanded={false}
                            />
                        ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-white/10 border-dashed backdrop-blur-sm">
                            <p className="text-zinc-500 italic text-lg">No submissions for this round yet.</p>
                            <Button variant="secondary" onClick={() => { resetForm(); setView('submit'); }} className="mt-6 mx-auto">Start Writing</Button>
                        </div>
                    )}
                </motion.div>

            </div>
          </motion.div>
        )}

        {/* VIEW: ROUND COMPOSER */}
        {view === 'composer' && isDirector && !isGuest && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-[1600px] mx-auto h-[calc(100vh-6rem)] flex flex-col relative z-10">
              
              {!composerSelectedRoundId ? (
                // --- COMPOSER: LANDING / SELECTION ---
                <div className="max-w-5xl mx-auto w-full mt-10">
                    <header className="mb-12 text-center">
                        <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tighter">Round Composer</h1>
                        <p className="text-zinc-500 text-lg">Select a round to edit or create a new one.</p>
                    </header>
                    
                    {isCreatingRound ? (
                        <div className="bg-white/[0.03] backdrop-blur-xl p-10 rounded-3xl border border-white/10 shadow-2xl max-w-xl mx-auto animate-in slide-in-from-bottom-4">
                           <h3 className="font-bold text-white mb-8 text-2xl">Create New Round</h3>
                           <div className="space-y-5">
                               <input 
                                  type="text" 
                                  placeholder="Round Name (e.g. Fall 2024 Final)" 
                                  value={newRoundName} 
                                  onChange={e => setNewRoundName(e.target.value)}
                                  className="w-full px-5 py-3 border border-white/10 rounded-xl text-base bg-black/40 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                  autoFocus
                               />
                               <div className="flex gap-2 items-center">
                                   <Tag className="w-5 h-5 text-zinc-500" />
                                   <input 
                                      type="text" 
                                      placeholder="Round Tag (e.g. 'Fall2024' - allows shared problems)" 
                                      value={newRoundTag} 
                                      onChange={e => setNewRoundTag(e.target.value)}
                                      className="flex-1 px-5 py-3 border border-white/10 rounded-xl text-sm bg-black/40 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                   />
                               </div>
                               <textarea
                                   placeholder="Description..."
                                   value={newRoundDesc}
                                   onChange={e => setNewRoundDesc(e.target.value)}
                                   className="w-full px-5 py-3 border border-white/10 rounded-xl text-sm h-32 resize-none bg-black/40 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                               />
                               <div className="flex gap-3 pt-4">
                                  <Button variant="ghost" onClick={() => setIsCreatingRound(false)} className="flex-1">Cancel</Button>
                                  <Button onClick={addRound} disabled={!newRoundName.trim()} className="flex-1">Create & Edit</Button>
                                </div>
                           </div>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <motion.div 
                               whileHover={{ scale: 1.02 }}
                               onClick={() => setIsCreatingRound(true)}
                               className="bg-indigo-500/5 border-2 border-dashed border-indigo-500/20 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 min-h-[200px] cursor-pointer hover:bg-indigo-500/10 transition-colors text-indigo-400 group"
                            >
                                <div className="p-4 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                                   <PlusCircle className="w-10 h-10" />
                                </div>
                                <span className="font-bold text-lg tracking-wide">Create New Round</span>
                            </motion.div>
                            
                            {rounds.map(r => {
                                const rProbCount = r.problemCount !== undefined 
                                   ? r.problemCount 
                                   : problems.filter(p => p.roundIds && p.roundIds.includes(r.id)).length;
                                return (
                                    <motion.div 
                                        whileHover={{ scale: 1.02 }}
                                        key={r.id}
                                        onClick={() => setComposerSelectedRoundId(r.id)}
                                        className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-3xl p-8 hover:border-indigo-500/30 hover:bg-white/[0.05] transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors border border-white/5 group-hover:border-indigo-500">
                                                <FolderOpen className="w-6 h-6" />
                                            </div>
                                            {r.tag && <span className="text-[10px] font-bold bg-white/5 border border-white/5 px-2 py-0.5 rounded text-zinc-400 uppercase tracking-wider">{r.tag}</span>}
                                        </div>
                                        <h3 className="font-bold text-white text-xl mb-2 tracking-tight">{r.name}</h3>
                                        <p className="text-sm text-zinc-500 mb-6 line-clamp-2 min-h-[40px] leading-relaxed">{r.description || 'No description.'}</p>
                                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                            <LayoutList className="w-3 h-3" /> {rProbCount} Problems
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
              ) : (
                // --- COMPOSER: EDITING VIEW ---
                <>
                <header className="flex justify-between items-center mb-6 shrink-0 bg-white/[0.03] backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg">
                   <div className="flex items-center gap-4 flex-1">
                      <Button variant="ghost" onClick={() => setComposerSelectedRoundId(null)} className="h-10 w-10 p-0 rounded-full border border-white/10 shrink-0">
                          <RotateCcw className="w-4 h-4" />
                      </Button>
                      
                      {isEditingRound ? (
                          <div className="flex-1 flex gap-2">
                              <input 
                                className="px-3 py-1 bg-black/40 border border-indigo-500/50 rounded-lg font-bold text-lg text-white" 
                                value={editRoundForm.name} 
                                onChange={e => setEditRoundForm({...editRoundForm, name: e.target.value})} 
                                placeholder="Round Name"
                              />
                              <input 
                                className="w-32 px-3 py-1 bg-black/40 border border-indigo-500/50 rounded-lg text-sm text-zinc-300" 
                                value={editRoundForm.tag} 
                                onChange={e => setEditRoundForm({...editRoundForm, tag: e.target.value})} 
                                placeholder="Tag"
                              />
                              <input 
                                className="flex-1 px-3 py-1 bg-black/40 border border-indigo-500/50 rounded-lg text-sm text-zinc-300" 
                                value={editRoundForm.description} 
                                onChange={e => setEditRoundForm({...editRoundForm, description: e.target.value})} 
                                placeholder="Description"
                              />
                              <Button size="sm" onClick={editRound}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setIsEditingRound(false)}>Cancel</Button>
                          </div>
                      ) : (
                          <div className="flex-1 min-w-0 group/header relative">
                              <div className="flex items-center gap-3">
                                  <h1 className="text-2xl font-bold text-white truncate tracking-tight">{composerSelectedRound?.name}</h1>
                                  {composerSelectedRound?.tag && <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded uppercase border border-indigo-500/30">{composerSelectedRound.tag}</span>}
                              </div>
                              <p className="text-zinc-500 text-xs mt-0.5 truncate">{composerSelectedRound?.description || 'No description'}</p>
                              
                              <div className="absolute right-0 top-1 opacity-0 group-hover/header:opacity-100 transition-opacity flex gap-2 bg-black/80 pl-4 rounded-l-lg backdrop-blur-sm">
                                  <button onClick={() => { setIsEditingRound(true); setEditRoundForm(composerSelectedRound || {}); }} className="text-zinc-400 hover:text-indigo-400 p-1"><Pencil className="w-4 h-4" /></button>
                                  <button onClick={deleteRound} className="text-zinc-400 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                              </div>
                          </div>
                      )}
                   </div>
                   <div className="flex gap-3 ml-4">
                      <Button onClick={openExportModal} size="sm" variant="secondary" className="gap-2">
                          <Download className="w-4 h-4" /> Export TeX
                      </Button>
                   </div>
                </header>

                {showExportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
                        <div className="bg-[#0A0A0A] rounded-3xl shadow-2xl border border-white/10 p-8 w-full max-w-lg space-y-6">
                            <h2 className="text-xl font-bold text-white">Export Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Contest Name</label>
                                    <input 
                                        className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                        value={exportContestName}
                                        onChange={e => setExportContestName(e.target.value)}
                                        placeholder="e.g. Washington Math Tournament"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Round Name</label>
                                        <input 
                                            className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                            value={exportRoundName}
                                            onChange={e => setExportRoundName(e.target.value)}
                                            placeholder="e.g. Speed Round 5th/6th"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Date</label>
                                        <input 
                                            className="w-full p-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                            value={exportDate}
                                            onChange={e => setExportDate(e.target.value)}
                                            placeholder="e.g. Oct 11th, 2025"
                                        />
                                    </div>
                                </div>
                                <div>
                                     <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Format</label>
                                     <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 font-bold text-sm flex items-center gap-2">
                                         <CheckCircle className="w-4 h-4" /> WAMT Template (Clipboard Copy)
                                     </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="ghost" onClick={() => setShowExportModal(false)}>Cancel</Button>
                                <Button onClick={handleExportLatex} className="gap-2">
                                    <Copy className="w-4 h-4" /> Copy TeX
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
    
                <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                    {/* LEFT: CANDIDATE POOL */}
                    <div 
                        onDragOver={handleDragOver}
                        onDrop={handleDropOnCandidates}
                        className="col-span-5 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 shadow-lg flex flex-col overflow-hidden transition-colors hover:bg-white/[0.04]"
                    >
                        <div className="p-4 border-b border-white/10 bg-black/20 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold text-zinc-300 flex items-center gap-2">
                                   <LayoutList className="w-4 h-4"/> Candidates
                                </h2>
                                <span className="text-xs font-bold bg-white/10 text-zinc-300 px-2 py-1 rounded-full">{composerCandidates.length}</span>
                            </div>
                            
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                                <input 
                                    type="text"
                                    placeholder="Search problems..."
                                    className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-300 placeholder:text-zinc-600"
                                    value={composerSearchText}
                                    onChange={e => setComposerSearchText(e.target.value)}
                                />
                            </div>

                            {/* Filters Grid */}
                            <div className="grid grid-cols-2 gap-2">
                                 <select className="px-2 py-1.5 text-xs border border-white/10 rounded-lg bg-black/40 text-zinc-400 outline-none" value={composerSourceQuota} onChange={e => setComposerSourceQuota(e.target.value)}>
                                    <option value="All">All Sources</option>
                                    {quotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                 </select>
                                 <select className="px-2 py-1.5 text-xs border border-white/10 rounded-lg bg-black/40 text-zinc-400 outline-none" value={composerFilterTopic} onChange={e => setComposerFilterTopic(e.target.value)}>
                                    <option value="All">All Topics</option>
                                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                                 </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Diff</span>
                                <input type="number" className="w-12 text-xs p-1 border border-white/10 rounded bg-black/40 text-zinc-300" value={composerMinDiff} onChange={e => setComposerMinDiff(Number(e.target.value))} />
                                <span className="text-zinc-600">-</span>
                                <input type="number" className="w-12 text-xs p-1 border border-white/10 rounded bg-black/40 text-zinc-300" value={composerMaxDiff} onChange={e => setComposerMaxDiff(Number(e.target.value))} />
                                <div className="flex-1"></div>
                                <select className="px-2 py-1.5 text-xs border border-white/10 rounded-lg bg-black/40 text-zinc-400 outline-none" value={composerSort} onChange={e => setComposerSort(e.target.value as any)}>
                                    <option value="votes">Sort: Votes</option>
                                    <option value="difficulty">Sort: Difficulty</option>
                                    <option value="newest">Sort: Newest</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/10">
                            {composerCandidates.length === 0 ? (
                               <div className="text-center py-10 text-zinc-600 italic text-sm">No matching problems found.<br/>Check filters or Waitlist.</div>
                            ) : (
                               composerCandidates.map(p => (
                                   <ComposerItem 
                                      key={p.id} 
                                      problem={p} 
                                      isAccepted={false} 
                                      onDragStart={(e: any) => handleDragStart(e, p.id, 'candidate')}
                                      onDragEnd={handleDragEnd}
                                      expanded={composerExpandedMap[p.id] ?? true}
                                      onToggleExpand={() => setComposerExpandedMap(prev => ({...prev, [p.id]: !(prev[p.id] ?? true)}))}
                                   />
                               ))
                            )}
                        </div>
                    </div>
    
                    {/* RIGHT: FINAL ROUND (Drag and Drop Area) */}
                    <div 
                        onDragOver={(e) => handleContainerDragOver(e, composerAccepted.length)}
                        onDrop={(e: any) => handleDropOnRound(e)}
                        className="col-span-7 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-indigo-500/20 shadow-lg flex flex-col overflow-hidden relative transition-colors hover:bg-indigo-500/[0.02]"
                    >
                        <div className="p-4 border-b border-indigo-500/20 bg-indigo-500/5 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-indigo-300 flex items-center gap-2">
                                       <CheckCircle className="w-4 h-4"/> Official Round Order
                                    </h2>
                                    <span className="text-xs font-bold bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full border border-indigo-500/30">
                                        {composerAccepted.length} Problems
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => toggleExpandAll(false)} className="p-1.5 text-zinc-500 hover:text-indigo-400 hover:bg-white/5 rounded transition-colors" title="Collapse All">
                                        <Minimize2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => toggleExpandAll(true)} className="p-1.5 text-zinc-500 hover:text-indigo-400 hover:bg-white/5 rounded transition-colors" title="Expand All">
                                        <Maximize2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {/* Stats Bar */}
                            <div className="flex gap-4 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                                <span>Avg Diff: {composerAvgDiff}</span>
                                <span className="text-zinc-700">|</span>
                                {Object.entries(composerTopicCounts).map(([t, c]) => (
                                    <span key={t} className={c === 0 ? 'text-zinc-700' : 'text-zinc-400'}>{t.substring(0,3)}: {c}</span>
                                ))}
                            </div>
                        </div>
                        
                        <div 
                            className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/10"
                            ref={composerListRef}
                        >
                             {composerAccepted.length === 0 ? (
                                <div className="text-center py-20 pointer-events-none">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 mb-3">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <p className="text-zinc-500 italic text-sm">The round is empty.<br/>Drag problems from the left to add.</p>
                                </div>
                             ) : (
                                composerAccepted.map((p, idx) => (
                                    <React.Fragment key={p.id}>
                                        {dragOverIndex === idx && (
                                            <div className="h-1 bg-indigo-500 rounded-full my-1 shadow-[0_0_10px_#6366f1]" />
                                        )}
                                        <ComposerItem 
                                            problem={p} 
                                            isAccepted={true} 
                                            index={idx}
                                            onDragStart={(e: any) => handleDragStart(e, p.id, 'accepted', idx)}
                                            onDragOverItem={handleDragOverItem}
                                            onDragEnd={handleDragEnd}
                                            expanded={composerExpandedMap[p.id] ?? true}
                                            onToggleExpand={() => setComposerExpandedMap(prev => ({...prev, [p.id]: !(prev[p.id] ?? true)}))}
                                        />
                                    </React.Fragment>
                                ))
                             )}
                             {/* Indicator at bottom if hovering end */}
                             {dragOverIndex === composerAccepted.length && (
                                 <div className="h-1 bg-indigo-500 rounded-full my-1 shadow-[0_0_10px_#6366f1]" />
                             )}
                        </div>
                    </div>
                </div>
                </>
              )}
            </motion.div>
        )}

        {/* VIEW: SUBMIT / EDIT / BULK */}
        {view === 'submit' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto relative z-10">
            <header className="mb-10 flex justify-between items-start">
               <div>
                  {!isGuest && (
                      <Button variant="ghost" onClick={() => setView('dashboard')} className="mb-6 pl-0 hover:bg-transparent text-zinc-500 hover:text-white">
                        ← Back to Dashboard
                      </Button>
                  )}
                  <h1 className="text-4xl font-extrabold text-white tracking-tighter">
                      {editingProblemId ? 'Edit Problem' : isGuest ? 'Propose a Problem' : 'New Submission'}
                  </h1>
               </div>
               {!editingProblemId && !isGuest && (
                   <Button variant="secondary" onClick={() => setShowBulkImport(true)} className="flex items-center gap-2">
                       <FileText className="w-4 h-4"/> Bulk Import
                   </Button>
               )}
            </header>

            {/* Bulk Import Modal */}
            {showBulkImport ? (
               <div className="bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 shadow-lg p-8 space-y-6">
                   <div className="flex justify-between items-center">
                       <h2 className="text-xl font-bold text-white">Bulk Import from LaTeX</h2>
                       <button onClick={() => setShowBulkImport(false)} className="text-zinc-500 hover:text-white"><X className="w-6 h-6"/></button>
                   </div>
                   
                   {parsedProblems.length === 0 ? (
                       <>
                           <textarea
                               value={bulkText}
                               onChange={e => setBulkText(e.target.value)}
                               placeholder={`Paste LaTeX here. Format example:\n\n\\begin{problem}\nProblem text...\n\\end{problem}\n\n\\begin{solution}\nSolution text...\n\\end{solution}\n\n\\answer{42}`}
                               className="w-full h-64 p-4 border border-white/10 rounded-xl font-mono text-sm bg-black/40 text-zinc-300 focus:ring-2 focus:ring-indigo-500/50 outline-none"
                           />
                           <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Default Topic</label>
                                    <select 
                                        className="w-full p-2 border border-white/10 rounded-lg text-sm bg-black/40 text-zinc-300"
                                        onChange={e => setSelectedTopics([e.target.value as Topic])}
                                    >
                                        {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Default Difficulty</label>
                                    <input 
                                        type="number" 
                                        value={difficulty} 
                                        onChange={e => setDifficulty(e.target.value)}
                                        className="w-full p-2 border border-white/10 rounded-lg text-sm bg-black/40 text-zinc-300"
                                    />
                                </div>
                           </div>
                           <div className="flex justify-end gap-3">
                               <Button variant="ghost" onClick={() => setShowBulkImport(false)}>Cancel</Button>
                               <Button onClick={handleBulkParse} disabled={!bulkText}>Parse LaTeX</Button>
                           </div>
                       </>
                   ) : (
                       <div className="space-y-4">
                           <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-indigo-300 text-sm">
                               <strong>Found {parsedProblems.length} problems!</strong> Review them below before importing.
                           </div>
                           <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar border border-white/10 rounded-xl p-2 bg-black/20">
                               {parsedProblems.map((p, idx) => (
                                   <div key={idx} className="bg-white/5 p-3 rounded-lg text-xs text-zinc-300">
                                       <strong className="text-white">{idx + 1}.</strong> {p.statement.substring(0, 100)}...
                                       <div className="mt-1 text-zinc-500">Ans: {p.answerKey || 'None'}</div>
                                   </div>
                               ))}
                           </div>
                           <div className="flex justify-end gap-3">
                               <Button variant="ghost" onClick={() => setParsedProblems([])}>Back</Button>
                               <Button onClick={handleBulkCommit} isLoading={isSubmitting}>Import All</Button>
                           </div>
                       </div>
                   )}
               </div>
            ) : (
            <div className="bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 shadow-lg overflow-hidden">
              <div className="p-10 space-y-10">
                {/* Title */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Problem Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. The Three Triangles"
                    className="w-full px-5 py-4 bg-black/40 rounded-2xl border border-white/10 focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all text-white placeholder:text-zinc-600 text-lg"
                  />
                </div>

                {/* Topics & Difficulty */}
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Difficulty Rating</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                step="0.1"
                                min="0"
                                max="10"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full px-5 py-4 bg-black/40 rounded-2xl border border-white/10 focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all text-white text-lg"
                            />
                        </div>
                        <button onClick={() => setShowRatingScale(!showRatingScale)} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
                            <Info className="w-3 h-3" /> View Rating Scale
                        </button>
                        {showRatingScale && AOPS_SCALE_INFO}
                    </div>
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Topics</label>
                        <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/10">
                            {TOPICS.map(t => (
                                <label key={t} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors">
                                    <input 
                                        type="checkbox"
                                        checked={selectedTopics.includes(t)}
                                        onChange={() => handleTopicToggle(t)}
                                        className="w-5 h-5 accent-indigo-500 rounded focus:ring-indigo-500 bg-black border-white/20"
                                    />
                                    <span className="text-base text-zinc-300 font-medium">{t}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Statement */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    Problem Statement
                  </label>
                  <textarea 
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    rows={6}
                    placeholder="Let $ABC$ be a triangle where..."
                    className="w-full px-5 py-4 bg-black/40 rounded-2xl border border-white/10 focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all font-serif text-white text-lg leading-relaxed mb-4"
                  />
                  
                  {/* Image Upload */}
                  <div className="flex items-center gap-4 bg-black/30 p-4 rounded-2xl border border-white/10 border-dashed">
                      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 text-zinc-500 shrink-0">
                          <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                          <label className="block text-sm font-bold text-zinc-300 cursor-pointer hover:text-indigo-400 transition-colors">
                              <span>Upload Image (Optional)</span>
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </label>
                          <p className="text-xs text-zinc-500">PNG, JPG up to 2MB</p>
                      </div>
                      {imageData && (
                          <div className="relative w-16 h-16 bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                              <img src={imageData} alt="Preview" className="w-full h-full object-cover" />
                              <button onClick={() => setImageData(null)} className="absolute inset-0 bg-black/50 text-white opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <X className="w-4 h-4" />
                              </button>
                          </div>
                      )}
                  </div>
                </div>

                {/* Solution & Answer */}
                <div className="grid md:grid-cols-2 gap-8">
                     <div className="space-y-3">
                         <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Solution Outline (LaTeX)</label>
                         <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={4} className="w-full px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus:ring-2 focus:ring-indigo-500/50 outline-none font-serif text-zinc-300" placeholder="Proof or derivation..."/>
                     </div>
                     <div className="space-y-3">
                         <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Answer Key (Short)</label>
                         <input type="text" value={answerKey} onChange={e => setAnswerKey(e.target.value)} className="w-full px-4 py-3 bg-black/40 rounded-xl border border-white/10 focus:ring-2 focus:ring-indigo-500/50 outline-none text-white font-mono" placeholder="e.g. 42"/>
                     </div>
                </div>

                {/* Preview */}
                  <div className="bg-black/20 border border-white/10 rounded-2xl p-6 mt-4">
                     <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">Live Preview</span>
                     <MathText 
                         text={statement || 'Type above to preview...'} 
                         className="font-serif text-zinc-200 text-lg leading-relaxed whitespace-pre-wrap min-h-[40px]" 
                     />
                     {imageData && (
                        <div className="mt-4 rounded-xl overflow-hidden border border-white/10">
                            <img src={imageData} alt="Preview" className="max-h-96 w-auto mx-auto object-contain" />
                            <div className="bg-white/5 text-xs text-center text-zinc-500 py-1 border-t border-white/5 flex items-center justify-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Attachment
                            </div>
                        </div>
                     )}
                  </div>

                {/* Verification / Disclaimer */}
                <div className="bg-indigo-500/10 rounded-2xl p-6 border border-indigo-500/20 flex items-start gap-4 cursor-pointer hover:bg-indigo-500/20 transition-colors" onClick={() => setIsVerified(!isVerified)}>
                   <div className={`mt-0.5 w-6 h-6 rounded-md border border-indigo-500/50 flex items-center justify-center shrink-0 transition-colors ${isVerified ? 'bg-indigo-600 border-indigo-600' : 'bg-transparent'}`}>
                      {isVerified && <BadgeCheck className="w-4 h-4 text-white" />}
                   </div>
                   <div className="select-none">
                      <label className="font-bold text-indigo-300 text-base cursor-pointer">
                          {isGuest ? "Usage Rights Agreement" : "I certify that this is a valid problem."}
                      </label>
                      <p className="text-sm text-indigo-200/60 mt-1 leading-relaxed">
                          {isGuest 
                            ? "By submitting, I allow WAMO to use, edit, and distribute this problem in any official capacity. I confirm this is original work and agree not to share or distribute this problem elsewhere."
                            : "To prevent quota spam, all submissions are monitored for quality and relevance."
                          }
                      </p>
                   </div>
                </div>

                {/* Error Message */}
                {submissionError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-400 text-sm">Submission Rejected</h4>
                      <p className="text-red-300/80 text-sm mt-1">{submissionError}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-black/20 border-t border-white/5 flex justify-end gap-4 items-center">
                {!isGuest && <Button variant="ghost" onClick={() => setView('dashboard')}>Cancel</Button>}
                <Button 
                  onClick={handleSubmit} 
                  disabled={!title || !statement || !isVerified}
                  isLoading={isSubmitting}
                  size="lg"
                  className="px-8 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                >
                  {editingProblemId ? 'Update Problem' : 'Submit Problem'}
                </Button>
              </div>
            </div>
            )}
          </motion.div>
        )}

        {/* VIEW: POOL (BLIND REVIEW) */}
        {view === 'pool' && !isGuest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto relative z-10">
            <header className="mb-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
               <div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tighter">Problem Pool</h1>
                  <p className="text-zinc-500 mt-2 font-medium">
                    {problems.filter(p => p.status === 'approved').length} approved problems • <span className="text-indigo-400 font-semibold drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]">Blind Review Active</span>
                  </p>
               </div>
            </header>
            
            {/* Filters Bar (Glass Toolbar) */}
            <div className="bg-white/[0.03] backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg mb-8 flex flex-col md:flex-row gap-5 items-center flex-wrap">
                <div className="flex items-center gap-2 text-sm text-zinc-500 font-bold uppercase tracking-wider">
                    <Filter className="w-4 h-4" /> Filters
                </div>

                {/* Quota Filter */}
                <select 
                    className="px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-zinc-300 focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium"
                    value={poolFilterQuota}
                    onChange={(e) => setPoolFilterQuota(e.target.value)}
                >
                    <option value="All">All Rounds</option>
                    {quotas.map(q => (
                        <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                </select>
                
                {/* Topic Filter */}
                <select 
                    className="px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-zinc-300 focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium"
                    value={poolFilterTopic}
                    onChange={(e) => setPoolFilterTopic(e.target.value)}
                >
                    <option value="All">All Topics</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Status Filter */}
                <select 
                    className="px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-zinc-300 focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium"
                    value={poolFilterStatus}
                    onChange={(e) => setPoolFilterStatus(e.target.value)}
                >
                    <option value="All">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="accepted">Accepted in Round</option>
                </select>

                {/* Difficulty Filter */}
                <div className="flex items-center gap-2 bg-black/40 px-4 py-2.5 rounded-xl border border-white/10">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Diff</span>
                    <input 
                        type="number" 
                        className="w-12 bg-transparent text-sm text-center outline-none border-b border-white/10 focus:border-indigo-500 font-bold text-zinc-300"
                        value={poolFilterDiffMin}
                        onChange={e => setPoolFilterDiffMin(Number(e.target.value))}
                        placeholder="Min"
                    />
                    <span className="text-zinc-500">-</span>
                    <input 
                        type="number" 
                        className="w-12 bg-transparent text-sm text-center outline-none border-b border-white/10 focus:border-indigo-500 font-bold text-zinc-300"
                        value={poolFilterDiffMax}
                        onChange={e => setPoolFilterDiffMax(Number(e.target.value))}
                        placeholder="Max"
                    />
                </div>

                <div className="flex-1"></div>

                {/* Sorting */}
                <div className="flex items-center gap-3">
                    <ArrowUpDown className="w-4 h-4 text-zinc-500" />
                    <select 
                        className="px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-zinc-300 focus:ring-2 focus:ring-indigo-500/50 outline-none font-medium"
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
                <div className="text-center py-24 bg-white/[0.02] rounded-3xl border border-white/10 backdrop-blur-sm">
                   <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search className="w-10 h-10 text-zinc-600" />
                   </div>
                   <h2 className="text-xl font-bold text-zinc-300">No problems found</h2>
                   <p className="text-zinc-500 mt-2">Try adjusting your filters.</p>
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
                      roundName={rounds.find(r => p.roundIds?.includes(r.id))?.name}
                      showAuthor={p.authorId === currentUser.id} // ONLY show if it is MY problem. Admin sees blind.
                      currentUserId={currentUser.id}
                      currentUserRole={currentUser.role}
                      onUpvote={handleToggleVote}
                      onEdit={handleStartEdit}
                      onStatusChange={handleStatusChange}
                      votingPower={currentUser.votingPower}
                      defaultExpanded={false}
                    />
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW: ADMIN PANEL */}
        {view === 'admin' && isDirector && !isGuest && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto relative z-10">
             <div className="flex justify-between items-center mb-10">
                <h1 className="text-3xl font-bold text-white tracking-tight">Director Administration</h1>
                <div className="flex gap-3">
                  <Button onClick={openExportModal} size="sm" variant="secondary" className="gap-2">
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
             
             {/* DIRECTOR PANEL (Tab Content) */}
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Quota Management */}
                    <div className="bg-white/[0.03] backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-lg flex flex-col">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-lg">
                        <Layers className="w-5 h-5 text-indigo-400" /> Quota / Rounds
                    </h3>
                    
                    <div className="flex-1 space-y-4 mb-8">
                        {quotas.map(q => (
                            <div key={q.id} className={`p-5 rounded-2xl border flex flex-col gap-2 transition-all ${activeQuotaId === q.id ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-black/20 border-white/5'}`}>
                                {editingQuotaId === q.id ? (
                                <div className="space-y-3">
                                    <input 
                                        className="w-full px-3 py-2 border border-white/10 rounded-lg bg-black/40 text-white text-sm" 
                                        value={editQuotaForm.name} 
                                        onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})}
                                        placeholder="Name"
                                    />
                                    <div className="flex gap-3">
                                        <div className="flex flex-col gap-1 w-24">
                                            <label className="text-[10px] uppercase font-bold text-zinc-500">Prob Qty</label>
                                            <input 
                                            className="w-full px-3 py-2 border border-white/10 rounded-lg bg-black/40 text-white text-sm" 
                                            type="number"
                                            value={editQuotaForm.target} 
                                            onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1 w-24">
                                            <label className="text-[10px] uppercase font-bold text-zinc-500">Vote Qty</label>
                                            <input 
                                            className="w-full px-3 py-2 border border-white/10 rounded-lg bg-black/40 text-white text-sm" 
                                            type="number"
                                            value={editQuotaForm.voteTarget} 
                                            onChange={e => setEditQuotaForm({...editQuotaForm, voteTarget: parseInt(e.target.value)})}
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-zinc-500">Due Date</label>
                                            <input 
                                            type="date"
                                            className="w-full px-3 py-2 border border-white/10 rounded-lg bg-black/40 text-white text-sm" 
                                            value={editQuotaForm.dueDate ? new Date(editQuotaForm.dueDate).toISOString().split('T')[0] : ''}
                                            onChange={e => setEditQuotaForm({...editQuotaForm, dueDate: e.target.valueAsNumber})}
                                            />
                                        </div>
                                    </div>
                                    <input 
                                        className="w-full px-3 py-2 border border-white/10 rounded-lg bg-black/40 text-white text-sm" 
                                        value={editQuotaForm.instructions} 
                                        onChange={e => setEditQuotaForm({...editQuotaForm, instructions: e.target.value})}
                                        placeholder="Instructions"
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button onClick={cancelEditQuota} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"><X className="w-4 h-4" /></button>
                                        <button onClick={saveQuota} className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg"><Save className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                ) : (
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-zinc-200 text-lg">{q.name}</span>
                                            {activeQuotaId === q.id && <span className="text-[10px] bg-indigo-500 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-[0_0_10px_#6366f1]">Active</span>}
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-2 flex gap-3 font-medium">
                                            <span>Target: {q.target}</span>
                                            <span>•</span>
                                            <span>Vote: {q.voteTarget || 3}</span>
                                            <span>•</span>
                                            <span className={q.dueDate ? 'text-indigo-400' : 'text-zinc-600'}>
                                                {getFormatDate(q.dueDate)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEditQuota(q)} className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors">
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
                    </div>

                    {/* Add User */}
                    <div className="bg-white/[0.03] backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-lg">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2 text-lg">
                        <UserPlus className="w-5 h-5 text-indigo-400" /> Add New User
                    </h3>
                    <div className="space-y-5">
                        <input 
                            type="text" 
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            placeholder="Full Name"
                            className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/40 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                        />
                        <input 
                            type="text" 
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full px-4 py-3 border border-white/10 rounded-xl bg-black/40 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                        />
                        
                        <div className="flex gap-2 p-1.5 bg-black/20 rounded-xl border border-white/5">
                            <button 
                                onClick={() => setNewUserRole('writer')} 
                                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${newUserRole === 'writer' ? 'bg-white/10 shadow-sm text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Writer
                            </button>
                            <button 
                                onClick={() => setNewUserRole('director')} 
                                className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${newUserRole === 'director' ? 'bg-white/10 shadow-sm text-indigo-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                Director
                            </button>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={addUser} disabled={!newUserName.trim() || !newUserPassword.trim()} className="w-full shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                            Create Account
                            </Button>
                        </div>
                    </div>
                    </div>
                </div>

                {/* Writer Progress & Voting Power Table */}
                <div className="bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 shadow-lg overflow-hidden">
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div>
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-400" /> User Management
                        </h3>
                        <p className="text-xs text-zinc-500 mt-1">Configuring for Active Round: {activeQuota.name}</p>
                    </div>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                        <th className="px-6 py-4 font-semibold text-zinc-400 text-sm uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 font-semibold text-zinc-400 text-sm uppercase tracking-wider">Password</th>
                        <th className="px-6 py-4 font-semibold text-zinc-400 text-sm uppercase tracking-wider">Role & Power</th>
                        <th className="px-6 py-4 font-semibold text-zinc-400 text-sm uppercase tracking-wider">Write Override</th>
                        <th className="px-6 py-4 font-semibold text-zinc-400 text-sm uppercase tracking-wider">Progress</th>
                        <th className="px-6 py-4 font-semibold text-zinc-400 text-sm uppercase tracking-wider">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
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
                                <tr key={u.id} className="bg-white/5">
                                    <td className="px-6 py-4">
                                        <input 
                                            className="w-full px-2 py-1 border border-white/10 rounded text-sm bg-black/40 text-white" 
                                            value={editUserForm.name} 
                                            onChange={e => setEditUserForm({...editUserForm, name: e.target.value})}
                                        />
                                        {currentUser.role === 'admin' && (
                                        <select 
                                            className="mt-2 w-full text-xs border border-white/10 rounded p-1 bg-black/40 text-zinc-300"
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
                                                <Lock className="w-3 h-3 text-zinc-500"/>
                                                <input 
                                                    className="w-24 px-2 py-1 border border-white/10 rounded text-sm bg-black/40 text-white" 
                                                    placeholder="Reset Pass"
                                                    value={editUserForm.password}
                                                    onChange={e => setEditUserForm({...editUserForm, password: e.target.value})}
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-xs text-zinc-500 italic flex items-center gap-1">
                                                <Lock className="w-3 h-3"/> Locked
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1">
                                            <Zap className="w-3 h-3 text-amber-500"/>
                                            <input 
                                                type="number"
                                                className="w-16 px-2 py-1 border border-white/10 rounded text-sm bg-black/40 text-white text-center font-bold"
                                                value={editUserForm.votingPower}
                                                onChange={e => setEditUserForm({...editUserForm, votingPower: parseInt(e.target.value) || 0})}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1">
                                            <Target className="w-3 h-3 text-indigo-400"/>
                                            <input 
                                                type="number"
                                                className="w-16 px-2 py-1 border border-white/10 rounded text-sm bg-black/40 text-white text-center font-bold"
                                                value={editUserForm.customTargets?.[activeQuotaId] || activeQuota.target}
                                                onChange={e => updateUserTarget(u.id, parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-zinc-500">
                                        Saving...
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button onClick={() => saveUser(u.id)} className="p-1.5 text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20"><Save className="w-4 h-4"/></button>
                                            <button onClick={() => setEditingUserId(null)} className="p-1.5 text-zinc-400 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10"><X className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        }

                        return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-6 py-5 font-bold text-zinc-200 flex items-center gap-2">
                            {u.name}
                            {u.role === 'admin' && <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><Crown className="w-3 h-3"/> Admin</span>}
                            {u.role === 'director' && <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Director</span>}
                            </td>
                            <td className="px-6 py-5 text-sm font-mono text-zinc-600">
                                {u.password || '********'}
                            </td>
                            <td className="px-6 py-5 text-sm">
                            <div className="flex items-center gap-1 text-zinc-300">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <span className="font-bold">{u.votingPower}</span>
                            </div>
                            </td>
                            <td className="px-6 py-5 text-sm">
                                <div className="flex items-center gap-1">
                                    <span className="font-bold text-zinc-300 bg-white/5 border border-white/5 px-2 py-1 rounded-md min-w-[30px] text-center">
                                        {uTarget}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                            <div className="flex flex-col gap-3 min-w-[140px]">
                                {/* Writing Progress */}
                                <div className="flex items-center gap-3 text-xs">
                                    <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                        className={`h-full rounded-full ${uCount >= uTarget ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                        style={{ width: `${Math.min((uCount / uTarget) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className={`font-mono font-bold ${uCount >= uTarget ? 'text-emerald-400' : 'text-zinc-500'}`}>{uCount}/{uTarget}</span>
                                </div>
                                {/* Voting Progress */}
                                <div className="flex items-center gap-3 text-xs">
                                    <ThumbsUp className="w-3.5 h-3.5 text-teal-400" />
                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div 
                                        className={`h-full rounded-full ${uVoteCount >= uVoteTarget ? 'bg-emerald-500' : 'bg-teal-500'}`} 
                                        style={{ width: `${Math.min((uVoteCount / uVoteTarget) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                    <span className={`font-mono font-bold ${uVoteCount >= uVoteTarget ? 'text-emerald-400' : 'text-zinc-500'}`}>{uVoteCount}/{uVoteTarget}</span>
                                </div>
                            </div>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEditThisUser && (
                                        <button onClick={() => startEditUser(u)} className="text-indigo-400 hover:bg-indigo-500/10 p-2 rounded-lg transition-colors" title="Edit User">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )}
                                    {canDeleteThisUser && (
                                        <button onClick={() => deleteUser(u.id)} className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors" title="Delete User">
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
          </motion.div>
        )}
      </main>
    </div>
  );
}