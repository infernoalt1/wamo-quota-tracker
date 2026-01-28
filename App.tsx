
import React, { useState, useEffect, useRef } from 'react';
import { Problem, User, Quota, Round, Topic, ProblemStatus, Comment } from './types';
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
  Hourglass
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
  const [rounds, setRounds] = useState<Round[]>([]);
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
          className={`bg-white border rounded-xl transition-all duration-200 shadow-sm ${
              isDragging ? 'opacity-40 ring-2 ring-indigo-400 border-indigo-400 bg-indigo-50' : ''
          } ${
              isAccepted ? 'border-indigo-100 hover:border-indigo-300 cursor-move' : 'border-slate-200 hover:border-slate-300 cursor-grab active:cursor-grabbing'
          }`}
        >
            <div className="p-3 flex items-start gap-3">
                {isAccepted ? (
                   <div className="text-slate-300 mt-2 cursor-move flex items-center justify-center h-full">
                      <GripVertical className="w-4 h-4" />
                   </div>
                ) : (
                   <div className="text-slate-300 mt-2">
                      <GripVertical className="w-4 h-4 opacity-50" />
                   </div>
                )}
                
                {isAccepted && (
                    <div className="font-mono font-bold text-indigo-400 text-sm mt-1 w-5 text-center">{index! + 1}.</div>
                )}
                
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !editMode && onToggleExpand()}>
                    <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900 text-sm leading-tight hover:text-indigo-600 transition-colors">
                            <MathText text={problem.title} />
                        </h4>
                        <span className="ml-2 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded whitespace-nowrap">
                            Diff: {problem.difficulty}
                        </span>
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
                       onClick={() => isAccepted ? handleRemoveFromRound(problem) : handleAddToRound(problem)}
                       className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                           isAccepted 
                           ? 'hover:bg-red-50 text-slate-300 hover:text-red-500' 
                           : 'hover:bg-indigo-50 text-slate-300 hover:text-indigo-600 bg-slate-50'
                       }`}
                       title={isAccepted ? "Remove from Round" : "Add to Round"}
                    >
                        {isAccepted ? <X className="w-4 h-4"/> : <ArrowRight className="w-4 h-4"/>}
                    </button>
                    <button onClick={onToggleExpand} className="text-slate-300 hover:text-slate-500">
                        {expanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                    </button>
                </div>
            </div>

            {(expanded || editMode) && (
                <div className="border-t border-slate-100 p-3 bg-slate-50/50 text-sm animate-in slide-in-from-top-1">
                    {editMode ? (
                        <div className="space-y-3 mb-2">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Statement</label>
                                <textarea 
                                    className="w-full p-2 border border-indigo-300 rounded-lg text-sm font-mono h-32 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={localStatement}
                                    onChange={e => setLocalStatement(e.target.value)}
                                />
                            </div>
                            {isAccepted && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Solution</label>
                                        <textarea 
                                            className="w-full p-2 border border-indigo-300 rounded-lg text-sm font-mono h-24 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={localSolution}
                                            onChange={e => setLocalSolution(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Answer</label>
                                        <input 
                                            className="w-full p-2 border border-indigo-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
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
                            <MathText text={problem.statement} className="text-slate-700 whitespace-pre-wrap font-serif mb-3" />
                            {isAccepted && (
                                <button 
                                    onClick={() => { setEditMode(true); setLocalStatement(problem.statement); setLocalSolution(problem.solution || ''); setLocalAnswer(problem.answerKey || ''); }}
                                    className="absolute top-0 right-0 p-1 bg-white border border-slate-200 rounded shadow-sm opacity-0 group-hover/latex:opacity-100 transition-opacity text-slate-400 hover:text-indigo-600"
                                    title="Edit Content"
                                >
                                    <Pencil className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}
                    
                    {problem.imageData && (
                        <img src={problem.imageData} alt="Problem attachment" className="max-h-48 w-auto mb-3 object-contain border border-slate-200 rounded bg-white" />
                    )}
                    
                    {!editMode && (
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
                    )}
                </div>
            )}
        </div>
      );
  };

  const WaitlistProblemCard = ({ p }: { p: Problem }) => {
      const [editDiff, setEditDiff] = useState(p.difficulty);
      const [isEditing, setIsEditing] = useState(false);
      
      const approve = async () => {
          if (editDiff !== p.difficulty) {
              await api.updateProblem(p.id, { difficulty: editDiff });
          }
          await handleStatusChange(p.id, 'approved');
      };

      return (
          <div className="bg-white border border-l-4 border-l-amber-400 border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                  <div>
                      <h4 className="font-bold text-slate-800 text-sm"><MathText text={p.title} /></h4>
                      <p className="text-xs text-slate-400 mt-1">By {p.authorName} • {new Date(p.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">Diff</span>
                       <input 
                          type="number" 
                          className="w-12 text-xs p-1 border rounded bg-slate-50 text-center" 
                          value={editDiff} 
                          onChange={e => setEditDiff(Number(e.target.value))} 
                       />
                       <Button size="sm" onClick={approve} className="bg-emerald-600 hover:bg-emerald-700 text-white border-none py-1 h-8 text-xs">
                           Approve
                       </Button>
                  </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm font-serif">
                  <MathText text={p.statement} className="line-clamp-3"/>
              </div>
              <div className="flex gap-2">
                   {p.topics.map(t => <span key={t} className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">{t}</span>)}
              </div>
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
                icon={
                    <div className="relative">
                        <Settings className="w-5 h-5" />
                        {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>}
                    </div>
                } 
                label={pendingCount > 0 ? `Director Panel (${pendingCount})` : "Director Panel"} 
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
            {/* ... Dashboard Content ... */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Hello, {currentUser.name.split(' ')[0]}</h1>
                <p className="text-lg text-slate-500 mt-2">Here is the current round status.</p>
              </div>
            </header>

            {/* Active Quota Info (Renamed from Round to prevent confusion) */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-8 relative">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none transform translate-x-10 -translate-y-4">
                    <BookOpen size={200} />
                </div>
                <div className="flex justify-between items-start mb-6 relative z-10">
                   <div>
                      <div className="flex items-center gap-2 mb-3">
                         <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wider">Active Quota</span>
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
              
              {!composerSelectedRoundId ? (
                // --- COMPOSER: LANDING / SELECTION ---
                <div className="max-w-5xl mx-auto w-full">
                    <header className="mb-10 text-center">
                        <h1 className="text-4xl font-bold text-slate-900 mb-3">Round Composer</h1>
                        <p className="text-slate-500">Select a round to edit or create a new one.</p>
                    </header>
                    
                    {isCreatingRound ? (
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto animate-in slide-in-from-bottom-4">
                           <h3 className="font-bold text-slate-900 mb-6 text-xl">Create New Round</h3>
                           <div className="space-y-4">
                               <input 
                                  type="text" 
                                  placeholder="Round Name (e.g. Fall 2024 Final)" 
                                  value={newRoundName} 
                                  onChange={e => setNewRoundName(e.target.value)}
                                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base bg-white text-black focus:ring-2 focus:ring-indigo-500 outline-none"
                                  autoFocus
                               />
                               <div className="flex gap-2 items-center">
                                   <Tag className="w-5 h-5 text-slate-400" />
                                   <input 
                                      type="text" 
                                      placeholder="Round Tag (e.g. 'Fall2024' - allows shared problems)" 
                                      value={newRoundTag} 
                                      onChange={e => setNewRoundTag(e.target.value)}
                                      className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-sm"
                                   />
                               </div>
                               <textarea
                                   placeholder="Description..."
                                   value={newRoundDesc}
                                   onChange={e => setNewRoundDesc(e.target.value)}
                                   className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm h-32 resize-none"
                               />
                               <div className="flex gap-3 pt-2">
                                  <Button variant="ghost" onClick={() => setIsCreatingRound(false)} className="flex-1">Cancel</Button>
                                  <Button onClick={addRound} disabled={!newRoundName.trim()} className="flex-1">Create & Edit</Button>
                                </div>
                           </div>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div 
                               onClick={() => setIsCreatingRound(true)}
                               className="bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 min-h-[180px] cursor-pointer hover:bg-indigo-100 transition-colors text-indigo-600 hover:text-indigo-800"
                            >
                                <PlusCircle className="w-10 h-10" />
                                <span className="font-bold text-lg">Create New Round</span>
                            </div>
                            
                            {rounds.map(r => {
                                const rProbCount = problems.filter(p => p.roundIds && p.roundIds.includes(r.id)).length;
                                return (
                                    <div 
                                        key={r.id}
                                        onClick={() => setComposerSelectedRoundId(r.id)}
                                        className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <FolderOpen className="w-5 h-5" />
                                            </div>
                                            {r.tag && <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">{r.tag}</span>}
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-lg mb-1">{r.name}</h3>
                                        <p className="text-sm text-slate-500 mb-4 line-clamp-2 min-h-[40px]">{r.description || 'No description.'}</p>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                                            <LayoutList className="w-3 h-3" /> {rProbCount} Problems
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
              ) : (
                // --- COMPOSER: EDITING VIEW ---
                <>
                <header className="flex justify-between items-center mb-6 shrink-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                   <div className="flex items-center gap-4 flex-1">
                      <Button variant="ghost" onClick={() => setComposerSelectedRoundId(null)} className="h-10 w-10 p-0 rounded-full border border-slate-200 shrink-0">
                          <RotateCcw className="w-4 h-4" />
                      </Button>
                      
                      {isEditingRound ? (
                          <div className="flex-1 flex gap-2">
                              <input 
                                className="px-3 py-1 border border-indigo-300 rounded-lg font-bold text-lg text-slate-900" 
                                value={editRoundForm.name} 
                                onChange={e => setEditRoundForm({...editRoundForm, name: e.target.value})} 
                                placeholder="Round Name"
                              />
                              <input 
                                className="w-32 px-3 py-1 border border-indigo-300 rounded-lg text-sm" 
                                value={editRoundForm.tag} 
                                onChange={e => setEditRoundForm({...editRoundForm, tag: e.target.value})} 
                                placeholder="Tag"
                              />
                              <input 
                                className="flex-1 px-3 py-1 border border-indigo-300 rounded-lg text-sm" 
                                value={editRoundForm.description} 
                                onChange={e => setEditRoundForm({...editRoundForm, description: e.target.value})} 
                                placeholder="Description"
                              />
                              <Button size="sm" onClick={editRound}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setIsEditingRound(false)}>Cancel</Button>
                          </div>
                      ) : (
                          <div className="flex-1 min-w-0 group/header relative">
                              <div className="flex items-center gap-2">
                                  <h1 className="text-2xl font-bold text-slate-900 truncate">{composerSelectedRound?.name}</h1>
                                  {composerSelectedRound?.tag && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded uppercase border border-indigo-100">{composerSelectedRound.tag}</span>}
                              </div>
                              <p className="text-slate-500 text-xs mt-0.5 truncate">{composerSelectedRound?.description || 'No description'}</p>
                              
                              <div className="absolute right-0 top-1 opacity-0 group-hover/header:opacity-100 transition-opacity flex gap-2 bg-white pl-4">
                                  <button onClick={() => { setIsEditingRound(true); setEditRoundForm(composerSelectedRound || {}); }} className="text-slate-400 hover:text-indigo-600"><Pencil className="w-4 h-4" /></button>
                                  <button onClick={deleteRound} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 w-full max-w-lg space-y-6">
                            <h2 className="text-xl font-bold text-slate-900">Export Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contest Name</label>
                                    <input 
                                        className="w-full p-2 border border-slate-300 rounded-xl text-sm"
                                        value={exportContestName}
                                        onChange={e => setExportContestName(e.target.value)}
                                        placeholder="e.g. Washington Math Tournament"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Round Name</label>
                                        <input 
                                            className="w-full p-2 border border-slate-300 rounded-xl text-sm"
                                            value={exportRoundName}
                                            onChange={e => setExportRoundName(e.target.value)}
                                            placeholder="e.g. Speed Round 5th/6th"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                                        <input 
                                            className="w-full p-2 border border-slate-300 rounded-xl text-sm"
                                            value={exportDate}
                                            onChange={e => setExportDate(e.target.value)}
                                            placeholder="e.g. Oct 11th, 2025"
                                        />
                                    </div>
                                </div>
                                <div>
                                     <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Format</label>
                                     <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 font-bold text-sm flex items-center gap-2">
                                         <CheckCircle className="w-4 h-4" /> WAMT Template (Clipboard Copy)
                                     </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
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
                        className="col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-colors hover:bg-slate-50/50"
                    >
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold text-slate-700 flex items-center gap-2">
                                   <LayoutList className="w-4 h-4"/> Candidates
                                </h2>
                                <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{composerCandidates.length}</span>
                            </div>
                            
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Search problems..."
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={composerSearchText}
                                    onChange={e => setComposerSearchText(e.target.value)}
                                />
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
                               <div className="text-center py-10 text-slate-400 italic text-sm">No matching problems found.<br/>Check filters or Waitlist.</div>
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
                        className="col-span-7 bg-white rounded-3xl border border-indigo-200 shadow-md flex flex-col overflow-hidden relative transition-colors hover:bg-indigo-50/20"
                    >
                        <div className="p-4 border-b border-indigo-100 bg-indigo-50/50 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-indigo-900 flex items-center gap-2">
                                       <CheckCircle className="w-4 h-4"/> Official Round Order
                                    </h2>
                                    <span className="text-xs font-bold bg-white text-indigo-600 px-2 py-1 rounded-full border border-indigo-100">
                                        {composerAccepted.length} Problems
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => toggleExpandAll(false)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors" title="Collapse All">
                                        <Minimize2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => toggleExpandAll(true)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors" title="Expand All">
                                        <Maximize2 className="w-4 h-4" />
                                    </button>
                                </div>
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
                        
                        <div 
                            className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30"
                            ref={composerListRef}
                        >
                             {composerAccepted.length === 0 ? (
                                <div className="text-center py-20 pointer-events-none">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-300 mb-3">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <p className="text-slate-400 italic text-sm">The round is empty.<br/>Drag problems from the left to add.</p>
                                </div>
                             ) : (
                                composerAccepted.map((p, idx) => (
                                    <React.Fragment key={p.id}>
                                        {dragOverIndex === idx && (
                                            <div className="h-1.5 bg-indigo-500 rounded-full my-1 transition-all animate-pulse shadow-sm pointer-events-none" />
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
                                 <div className="h-1.5 bg-indigo-500 rounded-full my-1 transition-all animate-pulse shadow-sm pointer-events-none" />
                             )}
                        </div>
                    </div>
                </div>
                </>
              )}
            </div>
        )}

        {/* VIEW: SUBMIT / EDIT / BULK */}
        {/* ... (rest of the file remains unchanged, just ensuring closure) ... */}
        {view === 'submit' && (
          <div className="max-w-4xl mx-auto">
            <header className="mb-10 flex justify-between items-start">
               <div>
                  {!isGuest && (
                      <Button variant="ghost" onClick={() => setView('dashboard')} className="mb-6 pl-0 hover:bg-transparent text-slate-500 hover:text-slate-900">
                        ← Back to Dashboard
                      </Button>
                  )}
                  <h1 className="text-3xl font-bold text-slate-900">
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
               <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
                   <div className="flex justify-between items-center">
                       <h2 className="text-xl font-bold text-slate-900">Bulk Import from LaTeX</h2>
                       <button onClick={() => setShowBulkImport(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
                   </div>
                   
                   {parsedProblems.length === 0 ? (
                       <>
                           <textarea
                               value={bulkText}
                               onChange={e => setBulkText(e.target.value)}
                               placeholder={`Paste LaTeX here. Format example:\n\n\\begin{problem}\nProblem text...\n\\end{problem}\n\n\\begin{solution}\nSolution text...\n\\end{solution}\n\n\\answer{42}`}
                               className="w-full h-64 p-4 border border-slate-200 rounded-xl font-mono text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                           />
                           <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Default Topic</label>
                                    <select 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                                        onChange={e => setSelectedTopics([e.target.value as Topic])}
                                    >
                                        {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Default Difficulty</label>
                                    <input 
                                        type="number" 
                                        value={difficulty} 
                                        onChange={e => setDifficulty(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
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
                           <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-indigo-700 text-sm">
                               <strong>Found {parsedProblems.length} problems!</strong> Review them below before importing.
                           </div>
                           <div className="max-h-96 overflow-y-auto space-y-3 custom-scrollbar border border-slate-100 rounded-xl p-2">
                               {parsedProblems.map((p, idx) => (
                                   <div key={idx} className="bg-slate-50 p-3 rounded-lg text-xs">
                                       <strong>{idx + 1}.</strong> {p.statement.substring(0, 100)}...
                                       <div className="mt-1 text-slate-500">Ans: {p.answerKey || 'None'}</div>
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
            )}
          </div>
        )}

        {/* VIEW: POOL (BLIND REVIEW) */}
        {view === 'pool' && !isGuest && (
          <div className="max-w-6xl mx-auto">
            <header className="mb-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
               <div>
                  <h1 className="text-3xl font-bold text-slate-900">Problem Pool</h1>
                  <p className="text-slate-500 mt-2">
                    {problems.filter(p => p.status === 'approved').length} approved problems • <span className="text-indigo-600 font-semibold">Blind Review Active</span>
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
                    <option value="approved">Approved</option>
                    <option value="accepted">Accepted in Round</option>
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
          </div>
        )}

        {/* VIEW: ADMIN PANEL */}
        {view === 'admin' && isDirector && !isGuest && (
          <div className="max-w-6xl mx-auto">
             <div className="flex justify-between items-center mb-10">
                <h1 className="text-3xl font-bold text-slate-900">Director Administration</h1>
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
             
             {/* PENDING WAITLIST (New Feature) */}
             <div className="mb-12">
                 <div className="flex items-center gap-3 mb-6">
                     <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Hourglass className="w-4 h-4"/></div>
                     <h3 className="font-bold text-slate-900 text-xl">Problem Waitlist</h3>
                     <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{pendingCount} Pending</span>
                 </div>
                 
                 {pendingCount > 0 ? (
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {problems.filter(p => p.status === 'pending').map(p => (
                             <WaitlistProblemCard key={p.id} p={p} />
                         ))}
                     </div>
                 ) : (
                     <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
                         No problems waiting for approval.
                     </div>
                 )}
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
