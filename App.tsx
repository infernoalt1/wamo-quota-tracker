import React, { useState, useEffect } from 'react';
import { Problem, User, Quota, Topic, ProblemStatus, Comment } from './types';
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
  Info,
  Filter,
  ArrowUpDown,
  Search,
  AlertCircle,
  Layers,
  Zap,
  Download,
  CheckCircle,
  Crown,
  ThumbsUp,
  User as UserIcon,
  Image as ImageIcon,
  LayoutList,
  ArrowRight,
  GripVertical,
  ChevronDown,
  ChevronUp,
  MessageSquare
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
        ? 'bg-indigo-50 text-indigo-700 font-bold shadow-sm'
        : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-medium'
    }`}
  >
    <div className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</div>
    {label}
  </button>
);

const TOPICS: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

const AOPS_SCALE_INFO = (
    <div className="text-xs text-slate-500 space-y-2 mt-2 bg-slate-100 p-3 rounded-xl border border-slate-200">
        <p className="font-bold text-slate-700">AoPS Competition Ratings Scale (Estimate)</p>
        <p>1: Beginner/School Level (MOEMS, AMC 8 1-10)</p>
        <p>1.5: Strong Beginner (AMC 8 11-20, Harder AMC 10 1-10)</p>
        <p>2: Motivated Beginner (AMC 8 21-25, AMC 10 11-15, MATHCOUNTS Chapter)</p>
        <p>2.5: Advanced Beginner (AMC 10 16-20, AIME 1-3)</p>
        <p>3: Early Intermediate (MATHCOUNTS National, AMC 10 21-25, AIME 1-6)</p>
        <p>4: Intermediate (AMC 12 21-25, AIME 4-10)</p>
        <p>5: Difficult AIME (11-13), Simple Proofs (USAJMO 1/4)</p>
        <p>6: High AIME (14-15), Intro Olympiad (USAJMO 2/5, Easy USAMO)</p>
        <p>7: Tough Olympiad (Hard USAJMO, Easy/Med USAMO 1/2/4/5)</p>
        <p>8: High Olympiad (Med/Hard USAMO 2/5)</p>
        <p>9: Expert (USAMO 3/6)</p>
        <p>9.5-10: World Class / Historically Hard</p>
    </div>
);

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
  const [composerSourceQuota, setComposerSourceQuota] = useState<string>('All');
  const [composerFilterTopic, setComposerFilterTopic] = useState<string>('All');
  const [composerMinDiff, setComposerMinDiff] = useState<number>(0);
  const [composerMaxDiff, setComposerMaxDiff] = useState<number>(50);
  const [composerSort, setComposerSort] = useState<'votes' | 'difficulty' | 'newest'>('votes');
  const [composerSelectedRound, setComposerSelectedRound] = useState<string | null>(null);
  
  // Composer DnD State
  const [draggedProblemId, setDraggedProblemId] = useState<string | null>(null);


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
             // Also update the filter if it was set to the invalid ID
             if (poolFilterQuota === activeQuotaId) setPoolFilterQuota(q[0].id);
          }
          // Set initial composer round
          if (!composerSelectedRound && q.length > 0) {
              setComposerSelectedRound(q[0].id);
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
      let filtered = [...problems];

      // Filter by Quota
      if (poolFilterQuota !== 'All') {
          filtered = filtered.filter(p => p.quotaId === poolFilterQuota);
      }

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
  }, [view, problems.length, poolSort, poolFilterTopic, poolFilterStatus, poolFilterDiffMin, poolFilterDiffMax, poolFilterQuota]); 
  
  // Set Composer default filter when opening view
  useEffect(() => {
      if (view === 'composer' && activeQuotaId) {
          setComposerSourceQuota('All'); // Default to seeing everything to drag from
          if (!composerSelectedRound) setComposerSelectedRound(activeQuotaId);
      }
  }, [view, activeQuotaId]);

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
          await api.updateProblem(problemId, updates);
      } catch(e) {
          console.error("Composer update failed");
          refreshData(); // Revert
      }
  };

  // Composer Actions
  const handleAddToRound = async (problemId: string) => {
      if (!composerSelectedRound) return;
      const problem = problems.find(p => p.id === problemId);
      if (!problem) return;

      // Add to end of accepted list of SELECTED round
      const accepted = problems.filter(p => p.quotaId === composerSelectedRound && p.status === 'accepted');
      
      // We must change problem's quotaId to the target round if different, and status to accepted
      const updatedProblems = problems.map(p => {
          if (p.id === problemId) {
              return { ...p, status: 'accepted', orderIndex: accepted.length, quotaId: composerSelectedRound } as Problem;
          }
          return p;
      });
      setProblems(updatedProblems);
      
      const newRoundIds = [...accepted.map(p => p.id), problemId];
      try {
          // First update problem quota/status
          await api.updateProblem(problemId, { quotaId: composerSelectedRound });
          await api.updateProblemStatus(problemId, 'accepted');
          // Then reorder
          await api.reorderRound(newRoundIds);
      } catch(e) {
          console.error("Add to round failed");
          refreshData(); // Revert on error
      }
  };

  const handleRemoveFromRound = async (problemId: string) => {
      // Sets back to pending
      const updatedProblems = problems.map(p => {
          if (p.id === problemId) return { ...p, status: 'pending' } as Problem;
          return p;
      });
      setProblems(updatedProblems);

      try {
          await api.updateProblemStatus(problemId, 'pending');
      } catch(e) {
          refreshData();
      }
  };

  // Drag and Drop Logic
  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedProblemId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id); // Required for Firefox
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleContainerDrop = (e: React.DragEvent, target: 'round' | 'pool') => {
      e.preventDefault();
      const id = draggedProblemId;
      if (!id) return;
      
      const problem = problems.find(p => p.id === id);
      if (!problem) return;

      if (target === 'round') {
          // If problem is not already accepted in THIS round, add it
          if (problem.quotaId !== composerSelectedRound || problem.status !== 'accepted') {
              handleAddToRound(id);
          }
      } else {
          // If problem IS accepted in THIS round, remove it
          if (problem.quotaId === composerSelectedRound && problem.status === 'accepted') {
              handleRemoveFromRound(id);
          }
      }
      setDraggedProblemId(null);
  };

  // Item reordering drop
  const handleItemDrop = async (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      e.stopPropagation(); // Don't bubble to container
      const id = draggedProblemId;
      if (!id || !composerSelectedRound) return;
      
      // If adding new item to specific index
      const problem = problems.find(p => p.id === id);
      if (!problem) return;

      const accepted = problems
        .filter(p => p.quotaId === composerSelectedRound && p.status === 'accepted')
        .sort((a,b) => a.orderIndex - b.orderIndex);
        
      // If draggable is not in list (adding from candidates)
      if (problem.quotaId !== composerSelectedRound || problem.status !== 'accepted') {
          // Optimistic add at index
          // Not trivial to mix "Add" and "Insert at Index" atomically without backend support
          // For simplicity: Add to round (end), then move locally.
          // Or just trigger add, user reorders later.
          // Better: just add to round for now.
          handleAddToRound(id); 
          return;
      }

      // Reordering existing
      const currentIndex = accepted.findIndex(p => p.id === id);
      if (currentIndex === -1) return; // Should not happen

      const newOrder = [...accepted];
      const [movedItem] = newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, movedItem);
      
      // Update local state indices
      const newOrderIds = newOrder.map(p => p.id);
      
      const updatedProblems = problems.map(p => {
          if (p.quotaId === composerSelectedRound && p.status === 'accepted') {
              const idx = newOrderIds.indexOf(p.id);
              if (idx !== -1) return { ...p, orderIndex: idx };
          }
          return p;
      });
      setProblems(updatedProblems);
      setDraggedProblemId(null);

      try {
          await api.reorderRound(newOrderIds);
      } catch(e) {
          refreshData();
      }
  };

  const handleExportLatex = () => {
      if (!composerSelectedRound) return;
      const round = quotas.find(q => q.id === composerSelectedRound);
      if (!round) return;

      const activeProblems = problems
        .filter(p => p.quotaId === composerSelectedRound && p.status === 'accepted')
        .sort((a,b) => a.orderIndex - b.orderIndex);

      let tex = `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{enumitem}

\\title{${round.name}}
\\date{\\today}

\\begin{document}
\\maketitle

\\section*{Contest Problems}
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
      a.download = `${round.name.replace(/\s+/g, '_')}.tex`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

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
  const composerAccepted = problems
    .filter(p => p.quotaId === composerSelectedRound && p.status === 'accepted')
    .sort((a,b) => a.orderIndex - b.orderIndex);
  
  const composerCandidates = problems
    .filter(p => {
        // Exclude problems currently in the selected round
        if (p.quotaId === composerSelectedRound && p.status === 'accepted') return false;
        
        // Source Filter
        if (composerSourceQuota !== 'All' && p.quotaId !== composerSourceQuota) return false;
        // Topic Filter
        if (composerFilterTopic !== 'All' && !p.topics.includes(composerFilterTopic as Topic)) return false;
        // Diff Filter
        if (p.difficulty < composerMinDiff || p.difficulty > composerMaxDiff) return false;
        
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

  // Helper for Composer Item
  const ComposerItem = ({ problem, isAccepted, index }: { problem: Problem, isAccepted: boolean, index?: number }) => {
      const [expanded, setExpanded] = useState(false);
      const [editMode, setEditMode] = useState(false);
      const [localStatement, setLocalStatement] = useState(problem.statement);

      const saveEdit = () => {
          if (localStatement !== problem.statement) {
              handleComposerUpdate(problem.id, { statement: localStatement });
          }
          setEditMode(false);
      };
      
      const isAcceptedElsewhere = !isAccepted && problem.status === 'accepted';
      const quotaName = quotas.find(q => q.id === problem.quotaId)?.name;

      return (
        <div 
          className={`bg-white border rounded-xl transition-all duration-200 shadow-sm ${
              isAccepted ? 'border-indigo-100 hover:border-indigo-300' : isAcceptedElsewhere ? 'border-amber-100 bg-amber-50/10' : 'border-slate-200 hover:border-slate-300'
          } ${draggedProblemId === problem.id ? 'opacity-50 scale-95' : 'opacity-100'}`}
          draggable
          onDragStart={(e) => handleDragStart(e, problem.id)}
          onDragOver={isAccepted ? handleDragOver : undefined} // Allow dropping ON items only in round list
          onDrop={isAccepted && index !== undefined ? (e) => handleItemDrop(e, index) : undefined}
        >
            <div className="p-3 flex items-start gap-3">
                {isAccepted && (
                    <div className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500">
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}
                {isAccepted && (
                    <div className="font-mono font-bold text-indigo-400 text-sm mt-1 w-5">{index! + 1}.</div>
                )}
                
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !editMode && setExpanded(!expanded)}>
                    <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900 text-sm leading-tight hover:text-indigo-600 transition-colors">
                            <MathText text={problem.title} />
                        </h4>
                        <div className="flex flex-col items-end gap-1">
                            <span className="ml-2 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                                Diff: {problem.difficulty}
                            </span>
                            {isAcceptedElsewhere && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap">
                                    in {quotaName}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-2 items-center">
                        <span className="truncate max-w-[150px]">{problem.topics.join(', ')}</span>
                        {problem.score > 0 && (
                            <span className="flex items-center gap-0.5 text-indigo-600 font-bold bg-indigo-50 px-1 rounded">
                                <ThumbsUp className="w-3 h-3"/> {problem.score}
                            </span>
                        )}
                        <span className="flex items-center gap-0.5 text-slate-400">
                             <MessageSquare className="w-3 h-3" /> {problem.commentCount}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <button 
                       onClick={() => isAccepted ? handleRemoveFromRound(problem.id) : handleAddToRound(problem.id)}
                       className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                           isAccepted 
                           ? 'hover:bg-red-50 text-slate-300 hover:text-red-500' 
                           : 'hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 bg-slate-50'
                       }`}
                       title={isAccepted ? "Remove from Round" : "Add to Round"}
                    >
                        {isAccepted ? <X className="w-4 h-4"/> : <ArrowRight className="w-4 h-4"/>}
                    </button>
                    <button onClick={() => setExpanded(!expanded)} className="text-slate-300 hover:text-slate-500">
                        {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                    </button>
                </div>
            </div>

            {(expanded || editMode) && (
                <div className="border-t border-slate-100 p-3 bg-slate-50/50 text-sm animate-in slide-in-from-top-1">
                    {editMode ? (
                        <div className="mb-3">
                            <textarea 
                                className="w-full p-2 border border-indigo-300 rounded-lg text-sm font-mono h-32 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={localStatement}
                                onChange={e => setLocalStatement(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setLocalStatement(problem.statement); }}>Cancel</Button>
                                <Button size="sm" onClick={saveEdit}>Save</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative group/latex">
                            <MathText text={problem.statement} className="text-slate-700 whitespace-pre-wrap font-serif mb-3" />
                            {isAccepted && (
                                <button 
                                    onClick={() => { setEditMode(true); setLocalStatement(problem.statement); }}
                                    className="absolute top-0 right-0 p-1 bg-white border border-slate-200 rounded shadow-sm opacity-0 group-hover/latex:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                                    title="Edit LaTeX"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}
                    
                    {problem.imageData && (
                        <img src={problem.imageData} alt="Problem attachment" className="max-h-48 w-auto mb-3 object-contain border border-slate-200 rounded bg-white" />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                         <div className="bg-white p-2 rounded border border-slate-200">
                             <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Solution Outline</span>
                             <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                <MathText text={problem.solution || 'None'} className="text-xs" />
                             </div>
                         </div>
                         <div className="bg-white p-2 rounded border border-slate-200 h-fit">
                             <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Answer</span>
                             <div className="font-mono font-bold text-slate-800">{problem.answerKey || '-'}</div>
                         </div>
                    </div>
                </div>
            )}
        </div>
      );
  };

  // ... (Login/Guest Screens same as before, skipping for brevity but logic implies they are rendered above) ...
  if (!currentUser) {
    // ... Login UI Code ...
    // Using previous code block logic for brevity, just assume standard login is returned here if !currentUser
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
        {/* Same login UI as previous version */}
        <div className="bg-white max-w-sm w-full rounded-2xl shadow-xl p-8 border border-white/50 backdrop-blur-sm">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg transform rotate-3">
              <BookOpen size={32} strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center tracking-tight">WAMO Tracker</h1>
          <p className="text-gray-500 mb-8 text-center text-sm">Middle School Math Contest Portal</p>
          
          {!selectedLoginId ? (
            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                 <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select User</p>
                 {usersError && (
                     <button onClick={initApp} className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                        <RotateCcw className="w-3 h-3" /> Retry
                     </button>
                 )}
               </div>
               
               <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {usersLoading && users.length === 0 && <div className="text-sm text-gray-400 italic p-4 text-center">Loading users...</div>}
                  
                  {users.map(user => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedLoginId(user.id)}
                      className="w-full p-3 bg-gray-50 hover:bg-white hover:shadow-md border border-transparent hover:border-indigo-100 rounded-xl text-left transition-all duration-200 group flex items-center justify-between"
                    >
                      <span className="font-semibold text-gray-700 group-hover:text-indigo-700">{user.name}</span>
                    </button>
                  ))}
               </div>

               <div className="pt-2 border-t border-slate-100">
                  <Button variant="secondary" onClick={handleGuestLogin} className="w-full text-sm py-2.5">
                    Continue as Guest
                  </Button>
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

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col md:flex-row font-sans text-slate-900">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]">
        <div className="p-8 border-b border-slate-50">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 tracking-tight">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-indigo-200 shadow-lg">
                <BookOpen className="w-5 h-5" strokeWidth={3} />
            </div>
            WAMO Tracker
          </h2>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
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
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administration</p>
              </div>
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

        <div className="p-6 border-t border-slate-50">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-2">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${currentUser.role === 'admin' ? 'bg-purple-600' : currentUser.role === 'director' ? 'bg-indigo-600' : currentUser.role === 'guest' ? 'bg-amber-500' : 'bg-slate-500'}`}>
                {isGuest ? <UserIcon className="w-5 h-5" /> : currentUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                    {currentUser.role}
                    {!isGuest && <><span className="text-slate-300">•</span> Power: {currentUser.votingPower}</>}
                </p>
                </div>
              </div>
              <Button variant="ghost" onClick={handleLogout} className="w-full text-xs h-9 justify-center text-slate-500 hover:text-red-600 hover:bg-white shadow-sm border border-transparent hover:border-slate-200">
                Log Out
              </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto custom-scrollbar">
        
        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && !isGuest && (
          <div className="max-w-6xl mx-auto space-y-10">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Hello, {currentUser.name.split(' ')[0]}</h1>
                <p className="text-lg text-slate-500 mt-2">Here is the current round status.</p>
              </div>
            </header>

            {/* Active Round Info */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 relative">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-10 -translate-y-4">
                    <BookOpen size={200} />
                </div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                   <div>
                      <div className="flex items-center gap-2 mb-3">
                         <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wider">Active Round</span>
                         {activeQuota.dueDate && (
                           <span className="px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                               <Clock className="w-3 h-3"/> {getFormatDate(activeQuota.dueDate)}
                           </span>
                         )}
                      </div>
                      <h2 className="text-3xl font-bold text-slate-900">{activeQuota.name}</h2>
                   </div>
                </div>
                
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-slate-600 text-sm relative z-10 leading-relaxed">
                   <strong className="text-slate-900 font-semibold block mb-1 text-base">Director's Note</strong> {activeQuota.instructions}
                </div>
            </div>

            {/* Progress Cards Grid */}
            <div className="grid md:grid-cols-2 gap-8">
                {/* Writing Progress */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-56 relative overflow-hidden group hover:border-indigo-200 transition-colors">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                                <Pencil className="w-5 h-5 text-indigo-500" /> Writing Quota
                            </h3>
                            {submissionCount >= submissionTarget ? 
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Done</span> : 
                                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full">{submissionCount} / {submissionTarget}</span>
                            }
                        </div>
                        <div className="text-5xl font-black text-slate-900 mt-2 tracking-tighter">
                            {Math.round(subPercent)}<span className="text-3xl text-slate-400 font-bold ml-1">%</span>
                        </div>
                    </div>
                    
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden relative z-10">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${submissionCount >= submissionTarget ? 'bg-emerald-500' : 'bg-indigo-600'}`} 
                            style={{ width: `${subPercent}%` }}
                        ></div>
                    </div>

                    {/* Decorative bg */}
                    <div className="absolute -bottom-6 -right-6 text-indigo-50 opacity-60 group-hover:scale-110 transition-transform duration-500">
                        <Pencil size={140} />
                    </div>
                </div>

                {/* Voting Progress */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-56 relative overflow-hidden group hover:border-teal-200 transition-colors">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2 text-lg">
                                <ThumbsUp className="w-5 h-5 text-teal-500" /> Voting Quota
                            </h3>
                            {userVoteCount >= voteTarget ? 
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Done</span> : 
                                <span className="bg-slate-100 text-slate-500 text-xs font-bold px-3 py-1 rounded-full">{userVoteCount} / {voteTarget}</span>
                            }
                        </div>
                        <div className="text-5xl font-black text-slate-900 mt-2 tracking-tighter">
                            {Math.round(votePercent)}<span className="text-3xl text-slate-400 font-bold ml-1">%</span>
                        </div>
                    </div>
                    
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden relative z-10">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ease-out ${userVoteCount >= voteTarget ? 'bg-emerald-500' : 'bg-teal-500'}`} 
                            style={{ width: `${votePercent}%` }}
                        ></div>
                    </div>

                    {/* Decorative bg */}
                    <div className="absolute -bottom-6 -right-6 text-teal-50 opacity-60 group-hover:scale-100 transition-transform duration-500">
                        <ThumbsUp size={140} />
                    </div>
                </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-slate-900">Your Submissions</h3>
                <Button variant="ghost" onClick={() => { resetForm(); setView('submit'); }} className="text-sm">
                  <PlusCircle className="w-4 h-4" /> Add Problem
                </Button>
              </div>
              
              {isLoadingData && <p className="text-sm text-gray-400 mb-4">Refreshing data...</p>}

              {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length > 0 ? (
                <div className="grid gap-8">
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
                        acceptedInQuotaName={quotas.find(q => q.id === p.quotaId)?.name}
                    />
                  ))}
                </div>
              ) : (
                  <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
                      <p className="text-slate-400 italic text-lg">No submissions for this round yet.</p>
                      <Button variant="secondary" onClick={() => { resetForm(); setView('submit'); }} className="mt-6 mx-auto">Start Writing</Button>
                  </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: ROUND COMPOSER */}
        {view === 'composer' && isDirector && !isGuest && (
          <div className="max-w-[1600px] mx-auto h-[calc(100vh-6rem)] flex flex-col">
            <header className="flex justify-between items-center mb-6 shrink-0">
               <div>
                  <h1 className="text-3xl font-bold text-slate-900">Round Composer</h1>
                  <div className="flex items-center gap-3 mt-2">
                      <p className="text-slate-500">Editing:</p>
                      <select 
                        className="font-bold text-indigo-600 bg-white border border-slate-300 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        value={composerSelectedRound || ''}
                        onChange={e => setComposerSelectedRound(e.target.value)}
                      >
                          {quotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                      </select>
                  </div>
               </div>
               <div className="flex gap-3">
                  <Button onClick={handleExportLatex} size="sm" variant="secondary" className="gap-2">
                      <Download className="w-4 h-4" /> Export TeX
                  </Button>
               </div>
            </header>

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
                {/* LEFT: CANDIDATE POOL */}
                <div 
                    className="col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleContainerDrop(e, 'pool')}
                >
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-slate-700 flex items-center gap-2">
                               <LayoutList className="w-4 h-4"/> Candidates
                            </h2>
                            <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{composerCandidates.length}</span>
                        </div>
                        
                        {/* Filters Grid */}
                        <div className="grid grid-cols-2 gap-2">
                             <select className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white" value={composerSourceQuota} onChange={e => setComposerSourceQuota(e.target.value)}>
                                <option value="All">All Sources</option>
                                {quotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                             </select>
                             <select className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white" value={composerFilterTopic} onChange={e => setComposerFilterTopic(e.target.value)}>
                                <option value="All">All Topics</option>
                                {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                             </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Diff</span>
                            <input type="number" className="w-12 text-xs p-1 border rounded" value={composerMinDiff} onChange={e => setComposerMinDiff(Number(e.target.value))} />
                            <span className="text-slate-300">-</span>
                            <input type="number" className="w-12 text-xs p-1 border rounded" value={composerMaxDiff} onChange={e => setComposerMaxDiff(Number(e.target.value))} />
                            <div className="flex-1"></div>
                            <select className="px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white" value={composerSort} onChange={e => setComposerSort(e.target.value as any)}>
                                <option value="votes">Sort: Votes</option>
                                <option value="difficulty">Sort: Difficulty</option>
                                <option value="newest">Sort: Newest</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
                        {composerCandidates.length === 0 ? (
                           <div className="text-center py-10 text-slate-400 italic text-sm">No matching problems found.</div>
                        ) : (
                           composerCandidates.map(p => (
                               <ComposerItem key={p.id} problem={p} isAccepted={false} />
                           ))
                        )}
                    </div>
                </div>

                {/* RIGHT: FINAL ROUND */}
                <div 
                    className="col-span-7 bg-white rounded-3xl border border-indigo-200 shadow-md flex flex-col overflow-hidden relative"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleContainerDrop(e, 'round')}
                >
                    <div className="p-4 border-b border-indigo-100 bg-indigo-50/50 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-indigo-900 flex items-center gap-2">
                               <CheckCircle className="w-4 h-4"/> Official Round Order
                            </h2>
                            <span className="text-xs font-bold bg-white text-indigo-600 px-2 py-1 rounded-full border border-indigo-100">
                                {composerAccepted.length} Problems
                            </span>
                        </div>
                        {/* Stats Bar */}
                        <div className="flex gap-4 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                            <span>Avg Diff: {composerAvgDiff}</span>
                            <span className="text-slate-300">|</span>
                            {Object.entries(composerTopicCounts).map(([t, c]) => (
                                <span key={t} className={c === 0 ? 'text-slate-300' : 'text-slate-600'}>{t.substring(0,3)}: {c}</span>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-slate-50/30">
                         {composerAccepted.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-300 mb-3">
                                    <Layers className="w-6 h-6" />
                                </div>
                                <p className="text-slate-400 italic text-sm">The round is empty.<br/>Add problems from the left.</p>
                            </div>
                         ) : (
                            composerAccepted.map((p, idx) => (
                                <ComposerItem key={p.id} problem={p} isAccepted={true} index={idx} />
                            ))
                         )}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* VIEW: SUBMIT / EDIT / BULK */}
        {view === 'submit' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-10 space-y-10">
                {/* Title */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Problem Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. The Three Triangles"
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-black placeholder:text-slate-400 text-lg"
                  />
                </div>

                {/* Topics & Difficulty */}
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Difficulty Rating</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                step="0.1"
                                min="0"
                                max="10"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-black text-lg"
                            />
                        </div>
                        <button onClick={() => setShowRatingScale(!showRatingScale)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                            <Info className="w-3 h-3" /> View Rating Scale
                        </button>
                        {showRatingScale && AOPS_SCALE_INFO}
                    </div>
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Topics</label>
                        <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                            {TOPICS.map(t => (
                                <label key={t} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                                    <input 
                                        type="checkbox"
                                        checked={selectedTopics.includes(t)}
                                        onChange={() => handleTopicToggle(t)}
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                                    />
                                    <span className="text-base text-slate-700 font-medium">{t}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Statement */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Problem Statement
                  </label>
                  <textarea 
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    rows={6}
                    placeholder="Let $ABC$ be a triangle where..."
                    className="w-full px-5 py-4 bg-slate-50 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all font-serif text-black text-lg leading-relaxed mb-4"
                  />
                  
                  {/* Image Upload */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 border-dashed">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-slate-200 text-slate-400 shrink-0">
                          <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                          <label className="block text-sm font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors">
                              <span>Upload Image (Optional)</span>
                              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                          </label>
                          <p className="text-xs text-slate-400">PNG, JPG up to 2MB</p>
                      </div>
                      {imageData && (
                          <div className="relative w-16 h-16 bg-white rounded-lg border border-slate-200 overflow-hidden">
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
                         <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Solution Outline (LaTeX)</label>
                         <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={4} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-serif" placeholder="Proof or derivation..."/>
                     </div>
                     <div className="space-y-3">
                         <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Answer Key (Short)</label>
                         <input type="text" value={answerKey} onChange={e => setAnswerKey(e.target.value)} className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 42"/>
                     </div>
                </div>

                {/* Preview */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mt-4">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Live Preview</span>
                     <MathText 
                         text={statement || 'Type above to preview...'} 
                         className="font-serif text-slate-800 text-lg leading-relaxed whitespace-pre-wrap min-h-[40px]" 
                     />
                     {imageData && (
                        <div className="mt-4 rounded-xl overflow-hidden border border-slate-200">
                            <img src={imageData} alt="Preview" className="max-h-96 w-auto mx-auto object-contain" />
                            <div className="bg-slate-50 text-xs text-center text-slate-400 py-1 border-t border-slate-100 flex items-center justify-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Attachment
                            </div>
                        </div>
                     )}
                  </div>

                {/* Verification / Disclaimer */}
                <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100 flex items-start gap-4 cursor-pointer hover:bg-indigo-50 transition-colors" onClick={() => setIsVerified(!isVerified)}>
                   <div className={`mt-0.5 w-6 h-6 rounded-md border border-indigo-300 flex items-center justify-center shrink-0 transition-colors ${isVerified ? 'bg-indigo-600 border-indigo-600' : 'bg-white'}`}>
                      {isVerified && <BadgeCheck className="w-4 h-4 text-white" />}
                   </div>
                   <div className="select-none">
                      <label className="font-bold text-indigo-900 text-base cursor-pointer">
                          {isGuest ? "Usage Rights Agreement" : "I certify that this is a valid problem."}
                      </label>
                      <p className="text-sm text-indigo-700/80 mt-1 leading-relaxed">
                          {isGuest 
                            ? "By submitting, I allow WAMO to use, edit, and distribute this problem in any official capacity. I confirm this is original work and agree not to share or distribute this problem elsewhere."
                            : "To prevent quota spam, all submissions are monitored for quality and relevance."
                          }
                      </p>
                   </div>
                </div>

                {/* Error Message */}
                {submissionError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-700 text-sm">Submission Rejected</h4>
                      <p className="text-red-600 text-sm mt-1">{submissionError}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-8 bg-slate-50 border-t border-slate-200 flex justify-end gap-4 items-center">
                {!isGuest && <Button variant="ghost" onClick={() => setView('dashboard')}>Cancel</Button>}
                <Button 
                  onClick={handleSubmit} 
                  disabled={!title || !statement || !isVerified}
                  isLoading={isSubmitting}
                  size="lg"
                  className="px-8 shadow-indigo-200"
                >
                  {editingProblemId ? 'Update Problem' : 'Submit Problem'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: POOL (BLIND REVIEW) */}
        {view === 'pool' && !isGuest && (
          <div className="max-w-6xl mx-auto">
            <header className="mb-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
               <div>
                  <h1 className="text-3xl font-bold text-slate-900">Problem Pool</h1>
                  <p className="text-slate-500 mt-2">
                    {problems.length} problems submitted • <span className="text-indigo-600 font-semibold">Blind Review Active</span>
                  </p>
               </div>
            </header>
            
            {/* Filters Bar */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-5 items-center flex-wrap">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-bold uppercase tracking-wider">
                    <Filter className="w-4 h-4" /> Filters
                </div>

                {/* Quota Filter */}
                <select 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
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
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={poolFilterTopic}
                    onChange={(e) => setPoolFilterTopic(e.target.value)}
                >
                    <option value="All">All Topics</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Status Filter */}
                <select 
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    value={poolFilterStatus}
                    onChange={(e) => setPoolFilterStatus(e.target.value)}
                >
                    <option value="All">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="accepted">Accepted</option>
                </select>

                {/* Difficulty Filter */}
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-400 uppercase">Diff</span>
                    <input 
                        type="number" 
                        className="w-12 bg-transparent text-sm text-center outline-none border-b border-transparent focus:border-indigo-500 font-bold text-slate-700"
                        value={poolFilterDiffMin}
                        onChange={e => setPoolFilterDiffMin(Number(e.target.value))}
                        placeholder="Min"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                        type="number" 
                        className="w-12 bg-transparent text-sm text-center outline-none border-b border-transparent focus:border-indigo-500 font-bold text-slate-700"
                        value={poolFilterDiffMax}
                        onChange={e => setPoolFilterDiffMax(Number(e.target.value))}
                        placeholder="Max"
                    />
                </div>

                <div className="flex-1"></div>

                {/* Sorting */}
                <div className="flex items-center gap-3">
                    <ArrowUpDown className="w-4 h-4 text-slate-400" />
                    <select 
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
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

            <div className="grid gap-8">
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
                      acceptedInQuotaName={quotas.find(q => q.id === p.quotaId)?.name}
                    />
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEW: ADMIN PANEL */}
        {view === 'admin' && isDirector && !isGuest && (
          <div className="max-w-6xl mx-auto">
             <div className="flex justify-between items-center mb-10">
                <h1 className="text-3xl font-bold text-slate-900">Contest Administration</h1>
                <div className="flex gap-3">
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
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
                   <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg">
                      <Layers className="w-5 h-5 text-indigo-600" /> Quota / Rounds
                   </h3>
                   
                   <div className="flex-1 space-y-4 mb-8">
                      {quotas.map(q => (
                         <div key={q.id} className={`p-5 rounded-2xl border flex flex-col gap-2 transition-all ${activeQuotaId === q.id ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-500' : 'bg-slate-50 border-slate-200'}`}>
                            {editingQuotaId === q.id ? (
                               <div className="space-y-3">
                                  <input 
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-black text-sm" 
                                    value={editQuotaForm.name} 
                                    onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})}
                                    placeholder="Name"
                                  />
                                  <div className="flex gap-3">
                                    <div className="flex flex-col gap-1 w-24">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Prob Qty</label>
                                        <input 
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-black text-sm" 
                                        type="number"
                                        value={editQuotaForm.target} 
                                        onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 w-24">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Vote Qty</label>
                                        <input 
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-black text-sm" 
                                        type="number"
                                        value={editQuotaForm.voteTarget} 
                                        onChange={e => setEditQuotaForm({...editQuotaForm, voteTarget: parseInt(e.target.value)})}
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-400">Due Date</label>
                                        <input 
                                          type="date"
                                          className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-black text-sm" 
                                          value={editQuotaForm.dueDate ? new Date(editQuotaForm.dueDate).toISOString().split('T')[0] : ''}
                                          onChange={e => setEditQuotaForm({...editQuotaForm, dueDate: e.target.valueAsNumber})}
                                        />
                                    </div>
                                  </div>
                                  <input 
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-black text-sm" 
                                      value={editQuotaForm.instructions} 
                                      onChange={e => setEditQuotaForm({...editQuotaForm, instructions: e.target.value})}
                                      placeholder="Instructions"
                                  />
                                  <div className="flex justify-end gap-2 mt-2">
                                     <button onClick={cancelEditQuota} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><X className="w-4 h-4" /></button>
                                     <button onClick={saveQuota} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Save className="w-4 h-4" /></button>
                                  </div>
                               </div>
                            ) : (
                               <div className="flex justify-between items-center">
                                  <div>
                                     <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-900 text-lg">{q.name}</span>
                                        {activeQuotaId === q.id && <span className="text-[10px] bg-indigo-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold shadow-sm">Active</span>}
                                     </div>
                                     <div className="text-xs text-slate-500 mt-2 flex gap-3 font-medium">
                                         <span>Target: {q.target}</span>
                                         <span>•</span>
                                         <span>Vote: {q.voteTarget || 3}</span>
                                         <span>•</span>
                                         <span className={q.dueDate ? 'text-indigo-600' : 'text-slate-400'}>
                                             {getFormatDate(q.dueDate)}
                                         </span>
                                     </div>
                                  </div>
                                  <div className="flex gap-2">
                                     <button onClick={() => startEditQuota(q)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors">
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

                   <div className="pt-6 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Create New Round</p>
                      <div className="space-y-4">
                         <div className="flex gap-2">
                           <input 
                              type="text" 
                              placeholder="Round Name" 
                              value={newQuotaName} 
                              onChange={e => setNewQuotaName(e.target.value)}
                              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                           />
                         </div>
                         <Button onClick={addQuota} disabled={!newQuotaName.trim()} className="w-full">Create Round</Button>
                      </div>
                   </div>
                </div>

                {/* Add User */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                   <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg">
                      <UserPlus className="w-5 h-5 text-indigo-600" /> Add New User
                   </h3>
                   <div className="space-y-5">
                      <input 
                        type="text" 
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input 
                        type="text" 
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      
                      <div className="flex gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                          <button 
                             onClick={() => setNewUserRole('writer')} 
                             className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${newUserRole === 'writer' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             Writer
                          </button>
                          <button 
                             onClick={() => setNewUserRole('director')} 
                             className={`flex-1 text-sm font-medium py-2 rounded-lg transition-all ${newUserRole === 'director' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             Director
                          </button>
                      </div>

                      <div className="flex justify-end pt-2">
                         <Button onClick={addUser} disabled={!newUserName.trim() || !newUserPassword.trim()} className="w-full">
                           Create Account
                         </Button>
                      </div>
                   </div>
                </div>
             </div>

             {/* Writer Progress & Voting Power Table */}
             <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
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
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">User</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Password</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Role & Power</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Write Override</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Progress</th>
                     <th className="px-6 py-4 font-semibold text-slate-600 text-sm uppercase tracking-wider">Actions</th>
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
                            <tr key={u.id} className="bg-slate-50 shadow-inner">
                                <td className="px-6 py-4">
                                    <input 
                                        className="w-full px-2 py-1 border border-indigo-300 rounded text-sm text-black" 
                                        value={editUserForm.name} 
                                        onChange={e => setEditUserForm({...editUserForm, name: e.target.value})}
                                    />
                                    {currentUser.role === 'admin' && (
                                       <select 
                                         className="mt-2 w-full text-xs border border-indigo-300 rounded p-1 bg-white"
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
                                                className="w-24 px-2 py-1 border border-indigo-300 rounded text-sm text-black" 
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
                                            className="w-16 px-2 py-1 border border-indigo-300 rounded text-sm text-black text-center font-bold"
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
                                            className="w-16 px-2 py-1 border border-indigo-300 rounded text-sm text-black text-center font-bold"
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
                                        <button onClick={() => saveUser(u.id)} className="p-1.5 text-green-600 bg-white border border-green-200 rounded-lg hover:bg-green-50"><Save className="w-4 h-4"/></button>
                                        <button onClick={() => setEditingUserId(null)} className="p-1.5 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><X className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                         )
                     }

                     return (
                       <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                         <td className="px-6 py-5 font-bold text-slate-800 flex items-center gap-2">
                           {u.name}
                           {u.role === 'admin' && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex items-center gap-1"><Crown className="w-3 h-3"/> Admin</span>}
                           {u.role === 'director' && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Director</span>}
                         </td>
                         <td className="px-6 py-5 text-sm font-mono text-slate-400">
                            {u.password || '********'}
                         </td>
                         <td className="px-6 py-5 text-sm">
                           <div className="flex items-center gap-1">
                              <Zap className="w-4 h-4 text-amber-500" />
                              <span className="font-bold text-slate-900">{u.votingPower}</span>
                           </div>
                         </td>
                         <td className="px-6 py-5 text-sm">
                             <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md min-w-[30px] text-center">
                                    {uTarget}
                                </span>
                             </div>
                         </td>
                         <td className="px-6 py-5">
                           <div className="flex flex-col gap-3 min-w-[140px]">
                              {/* Writing Progress */}
                              <div className="flex items-center gap-3 text-xs">
                                <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                    className={`h-full rounded-full ${uCount >= uTarget ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                                    style={{ width: `${Math.min((uCount / uTarget) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <span className={`font-mono font-bold ${uCount >= uTarget ? 'text-emerald-600' : 'text-slate-500'}`}>{uCount}/{uTarget}</span>
                              </div>
                              {/* Voting Progress */}
                              <div className="flex items-center gap-3 text-xs">
                                <ThumbsUp className="w-3.5 h-3.5 text-teal-400" />
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                    className={`h-full rounded-full ${uVoteCount >= uVoteTarget ? 'bg-emerald-500' : 'bg-teal-500'}`} 
                                    style={{ width: `${Math.min((uVoteCount / uVoteTarget) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                <span className={`font-mono font-bold ${uVoteCount >= uVoteTarget ? 'text-emerald-600' : 'text-slate-500'}`}>{uVoteCount}/{uVoteTarget}</span>
                              </div>
                           </div>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canEditThisUser && (
                                    <button onClick={() => startEditUser(u)} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors" title="Edit User">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                )}
                                {canDeleteThisUser && (
                                    <button onClick={() => deleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete User">
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