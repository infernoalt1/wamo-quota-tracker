import React, { useState, useEffect, useRef } from 'react';
import { Problem, User, Quota, Round, Topic, ProblemStatus, Comment } from './types';
import { Button } from './components/Button';
import { ProblemCard } from './components/ProblemCard';
import { MathText } from './components/MathText';
import { api } from './api';
import { motion, AnimatePresence, Variants, useMotionValue, useTransform } from 'framer-motion';
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
  Briefcase
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
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } }
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
    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
      active
        ? 'bg-slate-900 text-white shadow-md shadow-slate-200'
        : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
    }`}
  >
    <div className={active ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-600'}>
        {React.cloneElement(icon as React.ReactElement<any>, { size: 16 })}
    </div>
    <span className="flex-1 text-left tracking-tight">{label}</span>
    {badge !== undefined && badge > 0 && (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center ${active ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
        {badge}
      </span>
    )}
  </button>
);

const TOPICS: Topic[] = ['Algebra', 'Geometry', 'Combinatorics', 'Number Theory'];

const AOPS_SCALE_INFO = (
    <div className="text-[10px] text-slate-500 space-y-1.5 mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <p className="font-bold text-slate-800 text-xs">AoPS Competition Ratings Scale (Estimate)</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <p><span className="text-indigo-600 font-bold">1:</span> Beginner</p>
            <p><span className="text-indigo-600 font-bold">2:</span> Motivated Beginner</p>
            <p><span className="text-indigo-600 font-bold">3:</span> Early Intermediate</p>
            <p><span className="text-indigo-600 font-bold">4:</span> Intermediate</p>
            <p><span className="text-indigo-600 font-bold">5:</span> Difficult AIME</p>
            <p><span className="text-indigo-600 font-bold">6:</span> Intro Olympiad</p>
            <p><span className="text-indigo-600 font-bold">7:</span> Tough Olympiad</p>
            <p><span className="text-indigo-600 font-bold">8:</span> High Olympiad</p>
            <p><span className="text-indigo-600 font-bold">9:</span> Expert</p>
            <p><span className="text-indigo-600 font-bold">10:</span> World Class</p>
        </div>
    </div>
);

// --- CONSTELLATION BACKGROUND COMPONENT ---
const ConstellationBg = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        const points: {x: number, y: number, vx: number, vy: number}[] = [];
        const numPoints = 60;
        const connectionDist = 180;

        for (let i = 0; i < numPoints; i++) {
            points.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4
            });
        }

        const render = () => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#E2E8F0'; // Slate 200
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; // Slate 400 with opacity

            points.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fill();

                for (let j = i + 1; j < numPoints; j++) {
                    const p2 = points[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectionDist) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.lineWidth = 1 - dist / connectionDist;
                        ctx.stroke();
                    }
                }
            });
            animationFrameId = requestAnimationFrame(render);
        };

        const handleResize = () => {
             w = canvas.width = window.innerWidth;
             h = canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', handleResize);
        render();

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ opacity: 0.6 }} />;
};

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
  const [difficulty, setDifficulty] = useState('');
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
    setDifficulty('');
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
        <motion.div 
          layout
          draggable={!editMode}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={(e) => {
              // Pass drag over event up for calculation if accepted item
              if (isAccepted && !isDragging) {
                  onDragOverItem && onDragOverItem(e, index);
              }
          }}
          className={`bg-white rounded-lg transition-all duration-200 shadow-sm border ${
              isDragging ? 'opacity-40 ring-2 ring-indigo-200 border-indigo-400 rotate-2' : ''
          } ${
              isAccepted ? 'border-indigo-100 hover:border-indigo-300 hover:shadow-md cursor-move' : 'border-slate-200 hover:border-slate-300 cursor-grab active:cursor-grabbing hover:shadow-sm'
          }`}
        >
            <div className="p-2.5 flex items-start gap-2.5">
                {isAccepted ? (
                   <div className="text-indigo-600 mt-1 cursor-move flex items-center justify-center">
                      <GripVertical className="w-4 h-4" />
                   </div>
                ) : (
                   <div className="text-slate-400 mt-1">
                      <GripVertical className="w-4 h-4 opacity-50" />
                   </div>
                )}
                
                {isAccepted && (
                    <div className="font-mono font-bold text-indigo-600 text-xs mt-1 w-4 text-center">{index! + 1}.</div>
                )}
                
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !editMode && onToggleExpand()}>
                    <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-800 text-xs leading-tight hover:text-indigo-600 transition-colors line-clamp-1">
                            <MathText text={problem.title} />
                        </h4>
                        <span className="ml-2 text-[9px] font-bold bg-slate-50 text-slate-500 px-1 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                            D: {problem.difficulty}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap gap-2 items-center">
                        <span className="truncate max-w-[150px]">{problem.topics.join(', ')}</span>
                        {problem.score > 0 && (
                            <span className="flex items-center gap-0.5 text-indigo-600 font-bold bg-indigo-50 px-1 rounded">
                                <ThumbsUp className="w-2.5 h-2.5"/> {problem.score}
                            </span>
                        )}
                        <span className="flex items-center gap-0.5 text-slate-400">
                             <MessageSquare className="w-2.5 h-2.5" /> {problem.commentCount}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <button 
                       onClick={() => isAccepted ? handleRemoveFromRound(problem) : handleAddToRound(problem)}
                       className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                           isAccepted 
                           ? 'hover:bg-red-50 text-slate-300 hover:text-red-500' 
                           : 'hover:bg-indigo-50 text-slate-300 hover:text-indigo-600'
                       }`}
                       title={isAccepted ? "Remove" : "Add"}
                    >
                        {isAccepted ? <X className="w-3.5 h-3.5"/> : <ArrowRight className="w-3.5 h-3.5"/>}
                    </button>
                    <button onClick={onToggleExpand} className="text-slate-300 hover:text-slate-600 w-6 h-6 flex items-center justify-center">
                        {expanded ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
                    </button>
                </div>
            </div>

            <AnimatePresence>
            {(expanded || editMode) && (
                <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-100 p-2.5 bg-slate-50/50 text-xs"
                >
                    {editMode ? (
                        <div className="space-y-2">
                            <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Statement</label>
                                <textarea 
                                    className="w-full p-2 bg-white border border-indigo-200 rounded text-xs font-mono h-24 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                                    value={localStatement}
                                    onChange={e => setLocalStatement(e.target.value)}
                                />
                            </div>
                            {isAccepted && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Solution</label>
                                        <textarea 
                                            className="w-full p-2 bg-white border border-indigo-200 rounded text-xs font-mono h-20 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                                            value={localSolution}
                                            onChange={e => setLocalSolution(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Answer</label>
                                        <input 
                                            className="w-full p-2 bg-white border border-indigo-200 rounded text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                                            value={localAnswer}
                                            onChange={e => setLocalAnswer(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-1.5 mt-1">
                                <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setLocalStatement(problem.statement); setLocalSolution(problem.solution || ''); setLocalAnswer(problem.answerKey || ''); }}>Cancel</Button>
                                <Button size="sm" onClick={saveEdit}>Save</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="relative group/latex">
                            <MathText text={problem.statement} className="text-slate-700 whitespace-pre-wrap font-serif mb-2 leading-snug" />
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
                        <img src={problem.imageData} alt="Problem attachment" className="max-h-32 w-auto mb-2 object-contain border border-slate-200 rounded bg-white" />
                    )}
                    
                    {!editMode && (
                        <div className="grid grid-cols-2 gap-2">
                             <div className="bg-white p-2 rounded border border-slate-200 shadow-sm">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Solution Outline</span>
                                 <div className="max-h-24 overflow-y-auto custom-scrollbar">
                                    <MathText text={problem.solution || 'None'} className="text-[10px] text-slate-600" />
                                 </div>
                             </div>
                             <div className="bg-white p-2 rounded border border-slate-200 h-fit shadow-sm">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Answer</span>
                                 <div className="font-mono font-bold text-slate-800 text-xs">{problem.answerKey || '-'}</div>
                             </div>
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </motion.div>
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
            await api.updateProblem(p.id, { ...formData });
            await refreshData();
            setIsExpanded(false);
        } catch(e) { console.error(e); alert("Failed to save"); }
        finally { setIsSaving(false); }
    };
    
    const approve = async () => {
        await api.updateProblem(p.id, { ...formData, status: 'approved' });
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
        <motion.div 
            layout
            className={`bg-white rounded-xl border-l-4 ${hasChanges ? 'border-l-indigo-500' : 'border-l-amber-400'} border-y border-r border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-y-4`}
        >
            {/* ROW 1: HEADER (Title, Meta, and Actions) */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                    <input 
                        className="font-bold text-slate-900 text-lg w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none transition-colors py-0.5"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-3">
                        <span>ID: {p.id.substring(0,8)}</span>
                        <span>•</span>
                        <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 shrink-0">
                    <div className="flex flex-col items-center px-2 border-r border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Diff</span>
                        <input 
                            type="number" step="0.1"
                            className="w-10 text-sm bg-transparent text-center font-bold text-slate-800 outline-none placeholder:text-slate-400" 
                            value={formData.difficulty} 
                            placeholder="0.0"
                            onChange={e => setFormData({...formData, difficulty: Number(e.target.value)})} 
                        />
                    </div>
                    {/* ORIGINAL GREEN APPROVE BUTTON */}
                    <Button 
                        size="sm" 
                        onClick={approve} 
                        className="!bg-white !text-emerald-600 border border-slate-200 hover:!bg-slate-50 h-8 text-xs px-4 shadow-sm font-bold"
                    >
                        Approve
                    </Button>
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className={`p-1.5 rounded-md border transition-colors ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border-slate-200'}`}
                    >
                        {isExpanded ? <X size={16} /> : <Pencil size={16} />}
                    </button>
                </div>
            </div>

            {/* ROW 2: STATEMENT */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Statement</label>
                {isExpanded ? (
                    <textarea 
                        className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-serif focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                        value={formData.statement}
                        onChange={e => setFormData({...formData, statement: e.target.value})}
                    />
                ) : (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm font-serif text-slate-700 leading-relaxed">
                        <MathText text={formData.statement} />
                        {p.imageData && (
                            <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 bg-white inline-block">
                                <img src={p.imageData} alt="Problem attachment" className="max-h-64 w-auto object-contain" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ROW 3: SOLUTION & ANSWER (Shown by Default) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solution</label>
                    {isExpanded ? (
                        <textarea 
                            className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-serif focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                            value={formData.solution}
                            onChange={e => setFormData({...formData, solution: e.target.value})}
                        />
                    ) : (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs font-serif text-slate-600">
                            <MathText text={formData.solution || 'No solution provided.'} />
                        </div>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Answer Key</label>
                    {isExpanded ? (
                        <input 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                            value={formData.answerKey}
                            onChange={e => setFormData({...formData, answerKey: e.target.value})}
                        />
                    ) : (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm font-mono font-bold text-indigo-600">
                            {formData.answerKey || '—'}
                        </div>
                    )}
                </div>
            </div>

            {/* ROW 4: TOPICS & SAVE (Shown by Default) */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex flex-wrap gap-1.5">
                    {TOPICS.map(t => (
                        <button
                            key={t}
                            onClick={() => isExpanded && toggleTopic(t)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${
                                formData.topics.includes(t) 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {hasChanges && isExpanded && (
                    <Button size="sm" onClick={handleSave} isLoading={isSaving} className="px-6">
                        Save Changes
                    </Button>
                )}
            </div>
        </motion.div>
    );
}
  
  // Composer Scroll Fix
  const composerListRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      if (composerListRef.current) {
         // Logic to maintain scroll
      }
  }, [problems]);

  // --- PLACE THIS INSIDE App.tsx BEFORE THE RETURN ---

if (!currentUser) {
  // 1. GPU-ACCELERATED TILT (No Re-renders)
  // We use useMotionValue instead of useState for 60fps performance
  const cardX = useMotionValue(0);
  const cardY = useMotionValue(0);
  const rotateX = useTransform(cardY, [-300, 300], [10, -10]); // Reverse axis for natural tilt
  const rotateY = useTransform(cardX, [-300, 300], [-10, 10]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    cardX.set(x);
    cardY.set(y);
  };

  const handleMouseLeave = () => {
    cardX.set(0);
    cardY.set(0);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#FAFAFA] flex items-center justify-center overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* --- LAYER 1: CINEMATIC BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         {/* A. The "Breathing" Mesh Gradient */}
         <motion.div 
            animate={{ 
               scale: [1, 1.1, 1],
               rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-50%] left-[-20%] w-[150%] h-[150%] opacity-40 blur-[100px]"
            style={{
               background: "radial-gradient(circle at 50% 50%, #E0E7FF 0%, rgba(255,255,255,0) 50%), radial-gradient(circle at 80% 20%, #F0FDFA 0%, rgba(255,255,255,0) 30%)"
            }}
         />

         {/* B. Floating 3D Elements (Math Symbols) */}
         {/* We position them explicitly to ensure they are visible */}
         {[
            { sym: "∫", top: "15%", left: "15%", delay: 0 },
            { sym: "∑", top: "20%", right: "20%", delay: 2 },
            { sym: "π", bottom: "15%", left: "25%", delay: 4 },
            { sym: "∞", bottom: "25%", right: "15%", delay: 1 },
         ].map((item, i) => (
            <motion.div
               key={i}
               initial={{ y: 0, opacity: 0 }}
               animate={{ 
                  y: [-20, 20, -20],
                  rotate: [0, 10, -10, 0],
                  opacity: [0.3, 0.6, 0.3]
               }}
               transition={{ 
                  duration: 8, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: item.delay
               }}
               className="absolute text-8xl font-serif font-bold text-slate-900/5 select-none z-0"
               style={{ top: item.top, left: item.left, right: item.right, bottom: item.bottom }}
            >
               {item.sym}
            </motion.div>
         ))}

         {/* C. The Moving Grid (Subtle Technical Feel) */}
         <div 
            className="absolute inset-0 opacity-[0.04] z-0"
            style={{ 
               backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
               backgroundSize: '80px 80px' 
            }} 
         />
      </div>

      {/* --- LAYER 2: MAIN INTERFACE --- */}
      <div className="relative z-10 w-full max-w-7xl px-6 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-16 lg:gap-0">
         
         {/* Left Side: Brand Narrative */}
         <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} // "Apple" Easing
            className="text-center lg:text-left lg:max-w-xl"
         >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm mb-8">
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
               </span>
               <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System v3.0 Live</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.9] mb-6">
               Problem <br />
               <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  Architecture.
               </span>
            </h1>
            <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-md mx-auto lg:mx-0">
               A pristine environment for the curation, analysis, and deployment of mathematical contests.
            </p>
         </motion.div>

         {/* Right Side: The Physics Card */}
         <motion.div
            style={{ perspective: 2000 }} // Deep perspective for 3D effect
            className="w-full max-w-[420px]"
         >
            <motion.div
               style={{ rotateX, rotateY }} // Bind MotionValues directly
               onMouseMove={handleMouseMove}
               onMouseLeave={handleMouseLeave}
               className="relative bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-[0_50px_100px_-20px_rgba(50,50,93,0.12)] overflow-hidden"
            >
               {/* Glossy Sheen Overlay */}
               <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-black/5 pointer-events-none" />

               <div className="relative z-10 p-10 flex flex-col min-h-[500px]">
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-10">
                     <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <BookOpen size={24} strokeWidth={3} />
                     </div>
                     <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Access Node</div>
                        <div className="text-[10px] font-bold text-slate-400">Secure Connection</div>
                     </div>
                  </div>

                  <AnimatePresence mode="wait">
                     {!selectedLoginId ? (
                        <motion.div 
                           key="list"
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: -20 }}
                           transition={{ duration: 0.3 }}
                           className="flex-1 flex flex-col"
                        >
                           <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-6">Select Identity</h3>
                           
                           <div className="flex-1 overflow-y-auto -mx-4 px-4 space-y-2 custom-scrollbar-none">
                              {users.map((user) => (
                                 <motion.button
                                    layoutId={`user-card-${user.id}`}
                                    key={user.id}
                                    onClick={() => setSelectedLoginId(user.id)}
                                    className="group w-full p-3 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4 hover:border-indigo-500 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
                                 >
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-900 font-black text-sm border border-slate-200 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                       {user.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 text-left">
                                       <div className="text-sm font-bold text-slate-800">{user.name}</div>
                                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user.role}</div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                 </motion.button>
                              ))}
                           </div>

                           <div className="pt-6 mt-4 border-t border-slate-100">
                              <button onClick={handleGuestLogin} className="w-full py-3 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 group">
                                 Guest Observer
                                 <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                              </button>
                           </div>
                        </motion.div>
                     ) : (
                        <motion.div 
                           key="form"
                           initial={{ opacity: 0, x: 20 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: 20 }}
                           transition={{ duration: 0.3 }}
                           className="flex-1 flex flex-col"
                        >
                           <motion.div 
                              layoutId={`user-card-${selectedLoginId}`}
                              className="w-full p-4 rounded-2xl bg-slate-900 shadow-xl flex items-center gap-4 mb-8"
                           >
                              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white font-black text-lg border border-white/10">
                                 {users.find(u => u.id === selectedLoginId)?.name.charAt(0)}
                              </div>
                              <div className="flex-1 text-left">
                                 <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Authenticating</div>
                                 <div className="text-lg font-bold text-white">{users.find(u => u.id === selectedLoginId)?.name}</div>
                              </div>
                              <button onClick={() => { setSelectedLoginId(''); setLoginPassword(''); }} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors">
                                 <X size={16} />
                              </button>
                           </motion.div>

                           <div className="space-y-6 flex-1">
                              <div>
                                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Access Key</label>
                                 <input 
                                    type="password"
                                    value={loginPassword}
                                    onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-900 font-mono text-lg outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner text-center tracking-[0.3em]"
                                    autoFocus
                                 />
                              </div>
                              
                              <AnimatePresence>
                                 {loginError && (
                                    <motion.div 
                                       initial={{ height: 0, opacity: 0 }} 
                                       animate={{ height: "auto", opacity: 1 }}
                                       className="text-red-500 text-[10px] font-bold text-center bg-red-50 py-2 rounded-lg"
                                    >
                                       {loginError}
                                    </motion.div>
                                 )}
                              </AnimatePresence>
                           </div>

                           <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleLogin}
                              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-200 transition-all mt-auto"
                           >
                              Initialize Session
                           </motion.button>
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>
            </motion.div>
         </motion.div>
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
  const composerSelectedRound = rounds.find(r => r.id === composerSelectedRoundId);
  const composerSelectedRoundTag = composerSelectedRound?.tag;
  
  const composerAccepted = problems
    .filter(p => p.roundIds && p.roundIds.includes(composerSelectedRoundId || '') && p.status === 'accepted')
    .sort((a,b) => a.orderIndex - b.orderIndex);
  
  const composerCandidates = problems
    .filter(p => {
        if (p.roundIds && p.roundIds.includes(composerSelectedRoundId || '')) return false;
        if (p.status === 'accepted' && p.roundIds && p.roundIds.length > 0) {
             const assignedRounds = rounds.filter(r => p.roundIds?.includes(r.id));
             if (!composerSelectedRoundTag) return false; 
             const hasIncompatibleRound = assignedRounds.some(r => r.tag !== composerSelectedRoundTag);
             if (hasIncompatibleRound) return false;
        }
        if (p.status === 'pending') return false; 
        if (composerSourceQuota !== 'All' && p.quotaId !== composerSourceQuota) return false;
        if (composerFilterTopic !== 'All' && !p.topics.includes(composerFilterTopic as Topic)) return false;
        if (p.difficulty < composerMinDiff || p.difficulty > composerMaxDiff) return false;
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

  const composerAvgDiff = composerAccepted.length > 0 
      ? (composerAccepted.reduce((acc, p) => acc + p.difficulty, 0) / composerAccepted.length).toFixed(1) 
      : '0.0';
  
  const composerTopicCounts: Record<string, number> = {};
  TOPICS.forEach(t => composerTopicCounts[t] = 0);
  composerAccepted.forEach(p => {
      p.topics.forEach(t => { if(composerTopicCounts[t] !== undefined) composerTopicCounts[t]++ });
  });
  
  const pendingCount = problems.filter(p => p.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col md:flex-row font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      
      {/* Sidebar Navigation - Compact */}
      <aside className="fixed md:sticky top-0 left-0 w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-30 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-sm">
                <BookOpen className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                WAMO<span className="text-slate-400 font-normal">Tracker</span>
            </h2>
        </div>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {!isGuest && (
              <NavItem 
                icon={<LayoutDashboard />} 
                label="Overview" 
                active={view === 'dashboard'} 
                onClick={() => setView('dashboard')} 
              />
          )}
          
          <NavItem 
            icon={<PlusCircle />} 
            label={isGuest ? "Propose" : "Composer"} 
            active={view === 'submit'} 
            onClick={() => { resetForm(); setView('submit'); }} 
          />
          
          {!isGuest && (
            <NavItem 
                icon={<Layers />} 
                label="Problem Pool" 
                active={view === 'pool'} 
                onClick={() => setView('pool')} 
            />
          )}

          {isDirector && !isGuest && (
            <div className="mt-6">
              <div className="mb-2 px-3 flex items-center gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Director</p>
                <div className="h-px bg-slate-100 flex-1"></div>
              </div>
              <div className="space-y-1">
                  <NavItem 
                    icon={<ListChecks />} 
                    label="Waitlist" 
                    active={view === 'waitlist'} 
                    onClick={() => setView('waitlist')}
                    badge={pendingCount}
                  />
                  <NavItem 
                    icon={<Briefcase />} 
                    label="Round Editor" 
                    active={view === 'composer'} 
                    onClick={() => setView('composer')} 
                  />
                  <NavItem 
                    icon={<Settings />} 
                    label="Admin" 
                    active={view === 'admin'} 
                    onClick={() => setView('admin')} 
                  />
              </div>
            </div>
          )}
        </nav>

        <div className="mt-auto p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${currentUser.role === 'admin' ? 'bg-purple-600' : currentUser.role === 'director' ? 'bg-indigo-600' : currentUser.role === 'guest' ? 'bg-amber-500' : 'bg-slate-700'}`}>
               {isGuest ? <UserIcon className="w-4 h-4" /> : currentUser.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
               <p className="text-[10px] text-slate-500 capitalize">{currentUser.role}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full text-xs h-8 justify-start pl-2 text-slate-500 hover:text-red-600 hover:bg-red-50">
             <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto custom-scrollbar relative p-4 md:p-8 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto">
        
        {/* VIEW: WAITLIST */}
        {view === 'waitlist' && isDirector && !isGuest && (
            <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Waitlist Queue</h1>
                        <p className="text-slate-500 text-sm mt-1">Review pending submissions.</p>
                    </div>
                    <span className="bg-white text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 shadow-sm">{pendingCount} Pending</span>
                </div>
                
                {pendingCount > 0 ? (
                    <div className="grid gap-4">
                        {problems.filter(p => p.status === 'pending').map(p => (
                            <motion.div variants={itemVar} key={p.id}>
                                <WaitlistProblemCard p={p} />
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <motion.div variants={itemVar} className="bg-white border border-slate-200 rounded-xl p-16 text-center flex flex-col items-center shadow-sm">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
                            <CheckCircle className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800">Queue Cleared</h3>
                        <p className="text-slate-400 text-sm mt-1">All submissions have been processed.</p>
                    </motion.div>
                )}
            </motion.div>
        )}

        {/* VIEW: DASHBOARD (BENTO GRID) */}
        {view === 'dashboard' && !isGuest && (
          <motion.div variants={containerVar} initial="hidden" animate="show" className="grid grid-cols-12 gap-4">
             {/* Header */}
             <div className="col-span-12 mb-2">
                <motion.h1 variants={itemVar} className="text-2xl font-bold text-slate-900 tracking-tight">
                  Mission Control
                </motion.h1>
             </div>

             {/* Quota Card */}
             <motion.div variants={itemVar} className="col-span-12 md:col-span-8 bg-white border border-slate-200 rounded-xl p-6 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none -mr-16 -mt-16 group-hover:opacity-75 transition-opacity"></div>
                 <div className="relative z-10">
                     <div className="flex justify-between items-start mb-4">
                         <div>
                             <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">Active Cycle</span>
                             <h2 className="text-3xl font-bold text-slate-900 mt-3 tracking-tight">{activeQuota.name}</h2>
                         </div>
                         {activeQuota.dueDate && (
                             <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                 <Clock className="w-3.5 h-3.5" />
                                 {getFormatDate(activeQuota.dueDate)}
                             </div>
                         )}
                     </div>
                     <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">{activeQuota.instructions}</p>
                 </div>
             </motion.div>

             {/* Stats Column */}
             <div className="col-span-12 md:col-span-4 grid grid-rows-2 gap-4">
                 <motion.div variants={itemVar} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                     <div className="flex justify-between items-center">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submissions</span>
                         <Pencil className="w-4 h-4 text-indigo-500" />
                     </div>
                     <div className="mt-2">
                         <div className="flex items-end gap-2">
                             <span className="text-3xl font-bold text-slate-900 leading-none">{submissionCount}</span>
                             <span className="text-sm text-slate-400 font-medium mb-1">/ {submissionTarget}</span>
                         </div>
                         <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                             <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${subPercent}%` }}></div>
                         </div>
                     </div>
                 </motion.div>

                 <motion.div variants={itemVar} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                     <div className="flex justify-between items-center">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Voting</span>
                         <ThumbsUp className="w-4 h-4 text-emerald-500" />
                     </div>
                     <div className="mt-2">
                         <div className="flex items-end gap-2">
                             <span className="text-3xl font-bold text-slate-900 leading-none">{userVoteCount}</span>
                             <span className="text-sm text-slate-400 font-medium mb-1">/ {voteTarget}</span>
                         </div>
                         <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                             <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${votePercent}%` }}></div>
                         </div>
                     </div>
                 </motion.div>
             </div>

             {/* User's Problems List */}
             <div className="col-span-12 mt-4">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800">Your Contributions</h3>
                    <Button size="sm" variant="ghost" onClick={() => { resetForm(); setView('submit'); }} className="text-xs">
                       <PlusCircle className="w-3.5 h-3.5" /> Create New
                    </Button>
                 </div>
                 
                 <div className="grid gap-4">
                    <AnimatePresence>
                    {problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).length > 0 ? (
                        problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId).map(p => (
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
                        ))
                    ) : (
                        <div className="col-span-12 text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <p className="text-slate-400 text-sm font-medium">No submissions yet.</p>
                        </div>
                    )}
                    </AnimatePresence>
                 </div>
             </div>
          </motion.div>
        )}

        {/* VIEW: ROUND COMPOSER */}
        {view === 'composer' && isDirector && !isGuest && (
            <motion.div variants={containerVar} initial="hidden" animate="show" className="h-[calc(100vh-4rem)] flex flex-col">
              
              {!composerSelectedRoundId ? (
                // --- COMPOSER: LANDING / SELECTION ---
                <div className="max-w-5xl mx-auto w-full pt-6">
                    <header className="mb-10 text-center">
                        <motion.h1 variants={itemVar} className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Round Editor</motion.h1>
                        <motion.p variants={itemVar} className="text-slate-500 text-sm">Configure rounds and assign problems.</motion.p>
                    </header>
                    
                    {isCreatingRound ? (
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-xl border border-slate-200 shadow-xl max-w-lg mx-auto">
                           <h3 className="font-bold text-slate-900 mb-6 text-lg">Create New Round</h3>
                           <div className="space-y-4">
                               <input 
                                  type="text" 
                                  placeholder="Round Name (e.g. Fall 2024 Final)" 
                                  value={newRoundName} 
                                  onChange={e => setNewRoundName(e.target.value)}
                                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                  autoFocus
                               />
                               <input 
                                  type="text" 
                                  placeholder="Tag (e.g. 'Fall2024')" 
                                  value={newRoundTag} 
                                  onChange={e => setNewRoundTag(e.target.value)}
                                  className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                               />
                               <textarea
                                   placeholder="Description..."
                                   value={newRoundDesc}
                                   onChange={e => setNewRoundDesc(e.target.value)}
                                   className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-900 outline-none h-24 resize-none focus:ring-2 focus:ring-indigo-500"
                               />
                               <div className="flex gap-3 pt-2">
                                  <Button variant="secondary" onClick={() => setIsCreatingRound(false)} className="flex-1">Cancel</Button>
                                  <Button onClick={addRound} disabled={!newRoundName.trim()} className="flex-1">Create</Button>
                                </div>
                           </div>
                        </motion.div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <motion.button 
                               variants={itemVar}
                               onClick={() => setIsCreatingRound(true)}
                               className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 h-48 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-colors text-slate-400 hover:text-indigo-600 group"
                            >
                                <PlusCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-sm">New Round</span>
                            </motion.button>
                            
                            {rounds.map(r => {
                                const rProbCount = r.problemCount !== undefined 
                                   ? r.problemCount 
                                   : problems.filter(p => p.roundIds && p.roundIds.includes(r.id)).length;
                                return (
                                    <motion.div 
                                        variants={itemVar}
                                        whileHover={{ y: -2 }}
                                        key={r.id}
                                        onClick={() => setComposerSelectedRoundId(r.id)}
                                        className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between h-48 group"
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                                                    <FolderOpen className="w-5 h-5" />
                                                </div>
                                                {r.tag && <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase border border-slate-200">{r.tag}</span>}
                                            </div>
                                            <h3 className="font-bold text-slate-900 text-lg leading-tight mt-3">{r.name}</h3>
                                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">{r.description || 'No description.'}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            <LayoutList className="w-3.5 h-3.5" /> {rProbCount} Problems
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
                <motion.header initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-between items-center mb-4 shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm z-20">
                   <div className="flex items-center gap-4 flex-1">
                      <Button variant="secondary" onClick={() => setComposerSelectedRoundId(null)} className="h-9 w-9 p-0 rounded-lg shrink-0">
                          <RotateCcw className="w-4 h-4" />
                      </Button>
                      
                      {isEditingRound ? (
                          <div className="flex-1 flex gap-2 items-center">
                              <input 
                                className="px-3 py-1.5 bg-slate-50 border border-indigo-200 rounded-lg font-bold text-base text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500" 
                                value={editRoundForm.name} 
                                onChange={e => setEditRoundForm({...editRoundForm, name: e.target.value})} 
                                placeholder="Round Name"
                              />
                              <input 
                                className="w-24 px-3 py-1.5 bg-slate-50 border border-indigo-200 rounded-lg text-xs text-slate-900 outline-none" 
                                value={editRoundForm.tag} 
                                onChange={e => setEditRoundForm({...editRoundForm, tag: e.target.value})} 
                                placeholder="Tag"
                              />
                              <Button size="sm" onClick={editRound}>Save</Button>
                              <Button size="sm" variant="ghost" onClick={() => setIsEditingRound(false)}>Cancel</Button>
                          </div>
                      ) : (
                          <div className="flex-1 min-w-0 flex items-center gap-3">
                              <h1 className="text-xl font-bold text-slate-900 truncate tracking-tight">{composerSelectedRound?.name}</h1>
                              {composerSelectedRound?.tag && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">{composerSelectedRound.tag}</span>}
                              
                              <div className="flex gap-1 ml-2">
                                  <button onClick={() => { setIsEditingRound(true); setEditRoundForm(composerSelectedRound || {}); }} className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-slate-100 rounded transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                                  <button onClick={deleteRound} className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-slate-100 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                          </div>
                      )}
                   </div>
                   <Button onClick={openExportModal} size="sm" variant="secondary" className="gap-2 h-9 border-slate-200 shadow-sm">
                       <Download className="w-3.5 h-3.5" /> Export
                   </Button>
                </motion.header>

                {showExportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4 border border-slate-200">
                            <h2 className="text-xl font-bold text-slate-900">Export LaTeX</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Contest Name</label>
                                    <input 
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-indigo-500 outline-none"
                                        value={exportContestName}
                                        onChange={e => setExportContestName(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Round Name</label>
                                        <input 
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-indigo-500 outline-none"
                                            value={exportRoundName}
                                            onChange={e => setExportRoundName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                                        <input 
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:border-indigo-500 outline-none"
                                            value={exportDate}
                                            onChange={e => setExportDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setShowExportModal(false)}>Cancel</Button>
                                <Button onClick={handleExportLatex} className="gap-2">
                                    <Copy className="w-3.5 h-3.5" /> Copy TeX
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
    
                <div className="flex-1 grid grid-cols-12 gap-4 min-h-0 pb-2">
                    {/* LEFT: CANDIDATE POOL */}
                    <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onDragOver={handleDragOver}
                        onDrop={handleDropOnCandidates}
                        className="col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
                    >
                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                   <LayoutList className="w-4 h-4 text-slate-500"/> Pool
                                </h2>
                                <span className="text-[10px] font-bold bg-white text-slate-500 px-2 py-0.5 rounded border border-slate-200">{composerCandidates.length}</span>
                            </div>
                            
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Filter..."
                                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-indigo-500 outline-none placeholder-slate-400"
                                    value={composerSearchText}
                                    onChange={e => setComposerSearchText(e.target.value)}
                                />
                            </div>

                            {/* Filters Grid - High Density */}
                            <div className="flex gap-2">
                                 <select className="flex-1 px-2 py-1.5 text-[10px] border border-slate-200 rounded-lg bg-white text-slate-700 outline-none font-medium" value={composerSourceQuota} onChange={e => setComposerSourceQuota(e.target.value)}>
                                    <option value="All">All Cycles</option>
                                    {quotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                                 </select>
                                 <select className="flex-1 px-2 py-1.5 text-[10px] border border-slate-200 rounded-lg bg-white text-slate-700 outline-none font-medium" value={composerFilterTopic} onChange={e => setComposerFilterTopic(e.target.value)}>
                                    <option value="All">All Topics</option>
                                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                                 </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase">Diff</span>
                                <input type="number" className="w-10 text-[10px] p-1 border border-slate-200 bg-white text-slate-700 rounded outline-none text-center font-bold" value={composerMinDiff} onChange={e => setComposerMinDiff(Number(e.target.value))} />
                                <span className="text-slate-300">-</span>
                                <input type="number" className="w-10 text-[10px] p-1 border border-slate-200 bg-white text-slate-700 rounded outline-none text-center font-bold" value={composerMaxDiff} onChange={e => setComposerMaxDiff(Number(e.target.value))} />
                                <div className="flex-1"></div>
                                <select className="px-2 py-1 text-[10px] border border-slate-200 rounded bg-white text-slate-600 outline-none font-medium" value={composerSort} onChange={e => setComposerSort(e.target.value as any)}>
                                    <option value="votes">Votes</option>
                                    <option value="difficulty">Diff</option>
                                    <option value="newest">New</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-slate-50/50">
                            {composerCandidates.length === 0 ? (
                               <div className="text-center py-10 text-slate-400 text-xs italic">No candidates.</div>
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
                    </motion.div>
    
                    {/* RIGHT: FINAL ROUND (Drag and Drop Area) */}
                    <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onDragOver={(e) => handleContainerDragOver(e, composerAccepted.length)}
                        onDrop={(e: any) => handleDropOnRound(e)}
                        className="col-span-7 bg-white rounded-xl border border-indigo-200 shadow-md shadow-indigo-100/50 flex flex-col overflow-hidden relative"
                    >
                        <div className="p-3 border-b border-indigo-100 bg-indigo-50/50 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h2 className="font-bold text-indigo-900 flex items-center gap-1.5 text-sm">
                                       <CheckCircle className="w-4 h-4 text-indigo-600"/> Round Order
                                    </h2>
                                    <span className="text-[10px] font-bold bg-white text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 shadow-sm">
                                        {composerAccepted.length} Items
                                    </span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => toggleExpandAll(false)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors" title="Collapse">
                                        <Minimize2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => toggleExpandAll(true)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors" title="Expand">
                                        <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            {/* Stats Bar */}
                            <div className="flex gap-4 text-[9px] text-slate-400 uppercase font-bold tracking-wider bg-white/60 p-2 rounded border border-indigo-50">
                                <span>Avg Diff: <span className="text-slate-800 ml-1">{composerAvgDiff}</span></span>
                                <span className="text-slate-300">|</span>
                                {Object.entries(composerTopicCounts).map(([t, c]) => (
                                    <span key={t} className={c === 0 ? 'text-slate-300' : 'text-slate-500'}>{t.substring(0,3)}: <span className={c>0?'text-slate-800':''}>{c}</span></span>
                                ))}
                            </div>
                        </div>
                        
                        <div 
                            className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white space-y-2"
                            ref={composerListRef}
                        >
                             {composerAccepted.length === 0 ? (
                                <div className="text-center py-20 pointer-events-none">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 text-slate-300 mb-2 border border-slate-100">
                                        <Layers className="w-6 h-6" />
                                    </div>
                                    <p className="text-slate-400 text-xs font-medium">Empty Round.<br/>Drag & Drop here.</p>
                                </div>
                             ) : (
                                composerAccepted.map((p, idx) => (
                                    <React.Fragment key={p.id}>
                                        {dragOverIndex === idx && (
                                            <div className="h-1 bg-indigo-500 rounded-full my-1 transition-all pointer-events-none" />
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
                             {dragOverIndex === composerAccepted.length && (
                                 <div className="h-1 bg-indigo-500 rounded-full my-1 transition-all pointer-events-none" />
                             )}
                        </div>
                    </motion.div>
                </div>
                </>
              )}
            </motion.div>
        )}

        {/* VIEW: SUBMIT / EDIT / BULK */}
        {view === 'submit' && (
          <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-3xl mx-auto pb-10">
            <header className="mb-6 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  {!isGuest && (
                      <button onClick={() => setView('dashboard')} className="p-2 rounded-full hover:bg-white text-slate-400 hover:text-indigo-600 transition-colors">
                        <ArrowUp className="-rotate-90 w-5 h-5" />
                      </button>
                  )}
                  <motion.h1 variants={itemVar} className="text-2xl font-bold text-slate-900 tracking-tight">
                      {editingProblemId ? 'Edit Problem' : 'New Problem'}
                  </motion.h1>
               </div>
               {!editingProblemId && !isGuest && (
                   <Button size="sm" variant="secondary" onClick={() => setShowBulkImport(true)} className="flex items-center gap-2 border-slate-200">
                       <FileText className="w-3.5 h-3.5"/> Bulk Import
                   </Button>
               )}
            </header>

            {/* Bulk Import Modal */}
            {showBulkImport ? (
               <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl border border-slate-200 shadow-xl p-8 space-y-6 relative z-50">
                   <div className="flex justify-between items-center">
                       <h2 className="text-lg font-bold text-slate-900">Import LaTeX</h2>
                       <button onClick={() => setShowBulkImport(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                   </div>
                   
                   {parsedProblems.length === 0 ? (
                       <>
                           <textarea
                               value={bulkText}
                               onChange={e => setBulkText(e.target.value)}
                               placeholder={`\\begin{problem}\n...\n\\end{problem}\n\\answer{42}`}
                               className="w-full h-48 p-4 border border-slate-200 rounded-lg font-mono text-xs bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                           />
                           <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Topic</label>
                                    <select 
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                                        onChange={e => setSelectedTopics([e.target.value as Topic])}
                                    >
                                        {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Diff</label>
                                    <input 
                                        type="number" 
                                        value={difficulty} 
                                        onChange={e => setDifficulty(e.target.value)}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none"
                                    />
                                </div>
                           </div>
                           <div className="flex justify-end gap-2 pt-2">
                               <Button variant="ghost" onClick={() => setShowBulkImport(false)}>Cancel</Button>
                               <Button onClick={handleBulkParse} disabled={!bulkText}>Parse</Button>
                           </div>
                       </>
                   ) : (
                       <div className="space-y-4">
                           <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-indigo-700 text-xs font-medium">
                               Detected {parsedProblems.length} problems.
                           </div>
                           <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar border border-slate-200 rounded-lg p-3 bg-slate-50">
                               {parsedProblems.map((p, idx) => (
                                   <div key={idx} className="bg-white p-3 rounded border border-slate-100 text-xs">
                                       <strong className="text-slate-900 mr-2">{idx + 1}.</strong> {p.statement.substring(0, 80)}...
                                   </div>
                               ))}
                           </div>
                           <div className="flex justify-end gap-2 pt-2">
                               <Button variant="ghost" onClick={() => setParsedProblems([])}>Back</Button>
                               <Button onClick={handleBulkCommit} isLoading={isSubmitting}>Import All</Button>
                           </div>
                       </div>
                   )}
               </motion.div>
            ) : (
            <motion.div variants={itemVar} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-8 space-y-6">
                {/* Title */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Problem Name"
                    className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-slate-900 text-base font-semibold placeholder:text-slate-300"
                  />
                </div>

                {/* Topics & Difficulty */}
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Difficulty</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                step="0.1"
                                min="0"
                                max="10"
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                                className="w-24 px-4 py-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-lg font-bold font-mono text-center"
                            />
                            <button onClick={() => setShowRatingScale(!showRatingScale)} className="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1 ml-2">
                                <Info className="w-3.5 h-3.5" /> Scale Guide
                            </button>
                        </div>
                        {showRatingScale && AOPS_SCALE_INFO}
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Topics</label>
                        <div className="flex flex-wrap gap-2">
                            {TOPICS.map(t => (
                                <button
                                    key={t}
                                    onClick={() => handleTopicToggle(t)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${
                                        selectedTopics.includes(t) 
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Statement */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Statement (LaTeX supported)
                  </label>
                  <textarea 
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    rows={5}
                    placeholder="Let $ABC$ be a triangle..."
                    className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-serif text-slate-800 text-sm leading-relaxed placeholder:text-slate-300"
                  />
                  
                  {/* Image Upload */}
                  <div className="flex items-center gap-4 mt-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer hover:text-indigo-600 transition-colors bg-slate-50 px-3 py-2 rounded border border-slate-200">
                          <ImageIcon className="w-4 h-4" />
                          <span>Attach Image</span>
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      {imageData && (
                          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-xs font-medium border border-indigo-100">
                              <span>Image Loaded</span>
                              <button onClick={() => setImageData(null)} className="hover:text-indigo-900"><X className="w-3.5 h-3.5"/></button>
                          </div>
                      )}
                  </div>
                </div>

                {/* Solution & Answer */}
                <div className="grid md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Solution Outline</label>
                         <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={4} className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-serif text-slate-700 text-xs" placeholder="Proof sketch..."/>
                     </div>
                     <div className="space-y-2">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Answer Key</label>
                         <input type="text" value={answerKey} onChange={e => setAnswerKey(e.target.value)} className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-mono text-sm" placeholder="e.g. 42"/>
                     </div>
                </div>

                {/* Preview */}
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 mt-4">
                     <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Preview</span>
                     <MathText 
                         text={statement || '...'} 
                         className="font-serif text-slate-800 text-base leading-relaxed whitespace-pre-wrap min-h-[1.5rem]" 
                     />
                     {imageData && (
                        <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 bg-white inline-block">
                            <img src={imageData} alt="Preview" className="max-h-48 w-auto object-contain" />
                        </div>
                     )}
                  </div>

                {/* Verification */}
                <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer hover:bg-white transition-colors">
                   <input type="checkbox" checked={isVerified} onChange={() => setIsVerified(!isVerified)} className="w-4 h-4 accent-indigo-600 rounded" />
                   <span className="text-xs font-bold text-slate-600 select-none">
                       {isGuest ? "I agree to the submission terms." : "I certify this problem is correct and appropriate."}
                   </span>
                </label>

                {submissionError && (
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    <span className="text-xs font-bold text-red-700">{submissionError}</span>
                  </div>
                )}
              </div>
              
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
                {!isGuest && <Button variant="ghost" onClick={() => setView('dashboard')}>Cancel</Button>}
                <Button 
                  onClick={handleSubmit} 
                  disabled={!title || !statement || !isVerified}
                  isLoading={isSubmitting}
                  className="px-8 shadow-md shadow-indigo-100"
                >
                  {editingProblemId ? 'Save Changes' : 'Submit'}
                </Button>
              </div>
            </motion.div>
            )}
          </motion.div>
        )}

        {/* VIEW: POOL (BLIND REVIEW) */}
        {view === 'pool' && !isGuest && (
          <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-6">
            <header className="flex justify-between items-center">
               <div>
                  <motion.h1 variants={itemVar} className="text-2xl font-bold text-slate-900 tracking-tight">Problem Pool</motion.h1>
                  <motion.p variants={itemVar} className="text-slate-500 text-sm mt-0.5">
                    Blind Review Active
                  </motion.p>
               </div>
            </header>
            
            {/* Filters Bar - Compact */}
            <motion.div variants={itemVar} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-2 items-center">
                <div className="flex items-center gap-2 pl-2 pr-4 border-r border-slate-100">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Filter</span>
                </div>

                <select 
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                    value={poolFilterQuota}
                    onChange={(e) => setPoolFilterQuota(e.target.value)}
                >
                    <option value="All">All Cycles</option>
                    {quotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                </select>
                
                <select 
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                    value={poolFilterTopic}
                    onChange={(e) => setPoolFilterTopic(e.target.value)}
                >
                    <option value="All">All Topics</option>
                    {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Diff</span>
                    <input 
                        type="number" 
                        className="w-8 bg-transparent text-xs text-center outline-none border-b border-slate-300 font-bold text-slate-800"
                        value={poolFilterDiffMin}
                        onChange={e => setPoolFilterDiffMin(Number(e.target.value))}
                    />
                    <span className="text-slate-300">-</span>
                    <input 
                        type="number" 
                        className="w-8 bg-transparent text-xs text-center outline-none border-b border-slate-300 font-bold text-slate-800"
                        value={poolFilterDiffMax}
                        onChange={e => setPoolFilterDiffMax(Number(e.target.value))}
                    />
                </div>

                <div className="flex-1"></div>

                <div className="flex items-center gap-2 pr-1">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
                        value={poolSort}
                        onChange={(e) => setPoolSort(e.target.value as any)}
                    >
                        <option value="highest">Votes High</option>
                        <option value="lowest">Votes Low</option>
                        <option value="hardest">Diff High</option>
                        <option value="easiest">Diff Low</option>
                        <option value="newest">Newest</option>
                    </select>
                </div>
            </motion.div>

            <div className="grid gap-3">
              {poolIds.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                   <p className="text-slate-400 text-sm font-medium">No problems found matching criteria.</p>
                </div>
              ) : (
                poolIds.map(id => {
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
                        defaultExpanded={false}
                      />
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        {/* VIEW: ADMIN PANEL */}
        {view === 'admin' && isDirector && !isGuest && (
          <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-6xl mx-auto space-y-8 pb-10">
             <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Admin</h1>
                <div className="flex gap-3">
                  <Button onClick={openExportModal} size="sm" variant="secondary" className="gap-2 border-slate-200">
                      <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                  {currentUser.role === 'admin' && (
                     <Button onClick={handleResetVotes} size="sm" variant="danger" className="gap-2">
                         <ShieldAlert className="w-3.5 h-3.5" /> Reset Votes
                     </Button>
                  )}
                </div>
             </div>
             
             <div className="grid md:grid-cols-2 gap-6">
                 {/* Quota Management */}
                 <motion.div variants={itemVar} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
                     <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <Activity className="w-4 h-4 text-indigo-500" /> Cycles
                     </h3>
                     <div className="flex-1 space-y-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
                        {quotas.map(q => (
                            <div key={q.id} className={`p-4 rounded-lg border transition-all ${activeQuotaId === q.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                                {editingQuotaId === q.id ? (
                                    <div className="space-y-3">
                                        <input className="w-full p-2 border border-indigo-200 rounded text-sm outline-none" value={editQuotaForm.name} onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})} placeholder="Name" />
                                        <div className="flex gap-2">
                                            <input type="number" className="w-16 p-2 border border-indigo-200 rounded text-sm" value={editQuotaForm.target} onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})} placeholder="Qt" />
                                            <input type="number" className="w-16 p-2 border border-indigo-200 rounded text-sm" value={editQuotaForm.voteTarget} onChange={e => setEditQuotaForm({...editQuotaForm, voteTarget: parseInt(e.target.value)})} placeholder="Vt" />
                                            <input type="date" className="flex-1 p-2 border border-indigo-200 rounded text-sm" value={editQuotaForm.dueDate ? new Date(editQuotaForm.dueDate).toISOString().split('T')[0] : ''} onChange={e => setEditQuotaForm({...editQuotaForm, dueDate: e.target.valueAsNumber})} />
                                        </div>
                                        <input className="w-full p-2 border border-indigo-200 rounded text-sm outline-none" value={editQuotaForm.instructions} onChange={e => setEditQuotaForm({...editQuotaForm, instructions: e.target.value})} placeholder="Instructions" />
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" onClick={cancelEditQuota}>Cancel</Button>
                                            <Button size="sm" onClick={saveQuota}>Save</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 text-sm">{q.name}</span>
                                                {activeQuotaId === q.id && <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold">ACTIVE</span>}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                Target: {q.target} • Vote: {q.voteTarget || 3}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => startEditQuota(q)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded"><Pencil className="w-3.5 h-3.5"/></button>
                                            {activeQuotaId !== q.id && <button onClick={() => switchQuota(q.id)} className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded border border-transparent hover:border-indigo-100">ACTIVATE</button>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                     </div>
                 </motion.div>

                 {/* Add User */}
                 <motion.div variants={itemVar} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <UserPlus className="w-4 h-4 text-emerald-500" /> New User
                     </h3>
                    <div className="space-y-3">
                        <input className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500" placeholder="Full Name" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                        <input className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-indigo-500" placeholder="Password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                        <div className="flex gap-2">
                            <button onClick={() => setNewUserRole('writer')} className={`flex-1 py-2 text-xs font-bold rounded border ${newUserRole === 'writer' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>Writer</button>
                            <button onClick={() => setNewUserRole('director')} className={`flex-1 py-2 text-xs font-bold rounded border ${newUserRole === 'director' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>Director</button>
                        </div>
                        <Button onClick={addUser} disabled={!newUserName || !newUserPassword} className="w-full">Create Account</Button>
                    </div>
                 </motion.div>
             </div>

             {/* User Table */}
             <motion.div variants={itemVar} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">User Database</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase font-semibold">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Password</th>
                                <th className="px-4 py-3">Power</th>
                                <th className="px-4 py-3">Target</th>
                                <th className="px-4 py-3 w-40">Progress</th>
                                <th className="px-4 py-3">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {users.map(u => {
                                const isEdit = editingUserId === u.id;
                                const uTarget = u.customTargets?.[activeQuotaId] || activeQuota.target;
                                const uCount = u.submittedCount || 0;
                                
                                return (
                                    <tr key={u.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-3 font-medium text-slate-900">
                                            {isEdit ? ( 
                                                <div className="flex flex-col gap-1">
                                                    <input className="w-full p-1 border rounded text-xs" value={editUserForm.name} onChange={e => setEditUserForm({...editUserForm, name: e.target.value})} />
                                                    <select 
                                                        className="w-full p-1 border rounded text-[10px] bg-slate-50 font-bold text-indigo-600"
                                                        value={editUserForm.role}
                                                        onChange={e => setEditUserForm({...editUserForm, role: e.target.value as any})}
                                                    >
                                                        <option value="writer">Writer</option>
                                                        <option value="director">Director</option>
                                                    </select>
                                                </div>
                                                ) : (
                                                <div className="flex items-center gap-1.5">
                                                    {u.name}
                                                    {u.role === 'admin' && <Crown className="w-3 h-3 text-purple-500"/>}
                                                    {u.role === 'director' && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded border border-indigo-100">DIR</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                            {isEdit ? (currentUser.role === 'admin' ? <input className="w-full p-1 border rounded text-xs" placeholder="New Pass" value={editUserForm.password} onChange={e => setEditUserForm({...editUserForm, password: e.target.value})} /> : 'Locked') : (u.password || '••••')}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEdit ? <input type="number" className="w-12 p-1 border rounded text-xs" value={editUserForm.votingPower} onChange={e => setEditUserForm({...editUserForm, votingPower: parseInt(e.target.value)})} /> : <span className="font-mono text-slate-600 bg-slate-100 px-1.5 rounded">{u.votingPower}</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            {isEdit ? <input type="number" className="w-12 p-1 border rounded text-xs" value={editUserForm.customTargets?.[activeQuotaId] || activeQuota.target} onChange={e => updateUserTarget(u.id, parseInt(e.target.value))} /> : <span className="font-mono text-slate-600 bg-slate-100 px-1.5 rounded">{uTarget}</span>}
                                        </td>
                                        <td className="px-4 py-3 min-w-[160px]">
                                            <div className="space-y-2">
                                                <div>
                                                    <div className="flex justify-between text-[8px] font-bold uppercase text-slate-400 mb-0.5"><span>Writing</span> <span>{u.submittedCount}/{uTarget}</span></div>
                                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="bg-indigo-500 h-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ width: `${Math.min((u.submittedCount / uTarget) * 100, 100)}%` }}></div></div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[8px] font-bold uppercase text-slate-400 mb-0.5"><span>Voting</span> <span>{u.voteCount}/{voteTarget}</span></div>
                                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="bg-emerald-500 h-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${Math.min(((u.voteCount || 0) / voteTarget) * 100, 100)}%` }}></div></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                        {isEdit ? (
                                            <div className="flex justify-end gap-1">
                                                <button 
                                                    onClick={() => saveUser(u.id)} 
                                                    className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                                                    title="Save"
                                                >
                                                    <Save className="w-3.5 h-3.5" />
                                                </button>
                                                <button 
                                                    onClick={() => setEditingUserId(null)} 
                                                    className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-slate-50 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            /* REMOVED OPACITY CLASSES BELOW */
                                            <div className="flex justify-end gap-1">
                                                {(currentUser.role === 'admin' || (currentUser.role === 'director' && u.role !== 'admin')) && (
                                                    <button 
                                                        onClick={() => startEditUser(u)} 
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                                        title="Edit User"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                
                                                {(currentUser.role === 'admin' || (currentUser.role === 'director' && u.role === 'writer')) && (
                                                    <button 
                                                        onClick={() => deleteUser(u.id)} 
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                                        title="Delete User"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
             </motion.div>
          </motion.div>
        )}
        </div>
      </main>
    </div>
  );
}       