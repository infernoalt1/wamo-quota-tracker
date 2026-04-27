import React, { useState, useEffect, useRef } from 'react';
import { Problem, User, Quota, Round, Topic, ProblemStatus, Comment, QuotaType, AssignmentMode, Notification, NotificationType } from './types';
import { Button } from './components/Button';
import { ProblemCard } from './components/ProblemCard';
import { MathText } from './components/MathText';
import { Avatar } from './components/Avatar';
import { api } from './api';
import { motion, AnimatePresence, Variants, useAnimation } from 'framer-motion';
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
  Briefcase,
  Eye,
  EyeOff
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
const TOPIC_LABELS: Record<Topic, string> = {
  Algebra: 'A',
  Geometry: 'G',
  Combinatorics: 'C',
  'Number Theory': 'N'
};
const TOPIC_CHIP_CLASSES: Record<Topic, string> = {
  Algebra: 'bg-blue-50 text-blue-700 border-blue-200',
  Geometry: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Combinatorics: 'bg-orange-50 text-orange-700 border-orange-200',
  'Number Theory': 'bg-purple-50 text-purple-700 border-purple-200'
};
const DIFFICULTY_MIN = 0.5;
const DIFFICULTY_MAX = 10;
const DIFFICULTY_QUICK_VALUES = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

const DIFFICULTY_GUIDE = [
  { value: 0.5, label: 'Easiest', summary: 'Easiest AMC 8 1-5, MATHCOUNTS School Sprint 1-20, easier middle-school word problems, easier Math Kangaroo, MOEMS E.', references: 'Basic elementary-middle school techniques; usually one direct idea.', exampleTitle: '2003 AMC 8 Problem 1', exampleText: `Jamie counted the number of edges of a cube, Jimmy counted the numbers of corners, and Judy counted the number of faces. They then added the three numbers. What was the resulting sum?` },
  { value: 1.0, label: 'Beginner', summary: 'MOEMS M, MATHCOUNTS School Sprint 20-30/Target, Chapter Sprint 10-20, easier AMC 8 1-10, easier AMC 10 5-10, AMC 12 1-5.', references: 'Standard middle-school techniques with moderate word-problem setup.', exampleTitle: '2021 Spring AMC 10B Problem 1', exampleText: `How many integer values of $x$ satisfy $|x| < 3\\pi$?` },
  { value: 1.5, label: 'Strong Beginner', summary: 'AMC 8 11-20, moderately challenging AMC 10 1-10, AMC 12 1-5, and harder middle-school contest problems.', references: 'School-level knowledge used in a less routine way.', exampleTitle: '2020 AMC 8 Problem 19', exampleText: `A number is called flippy if its digits alternate between two distinct digits. For example, $2020$ and $37373$ are flippy, but $3883$ and $123123$ are not. How many five-digit flippy numbers are divisible by $15$?` },
  { value: 2.0, label: 'Motivated Beginner', summary: 'AMC 8 21-25, MATHCOUNTS Chapter Sprint 21-30/Target 6-8, States/Nationals, AMC 10 11-15, AMC 12 5-10, easiest AIME 1-3.', references: 'Harder beginner problems with real contest strategy.', exampleTitle: '2021 Spring AMC 10B Problem 18', exampleText: `A fair $6$-sided die is repeatedly rolled until an odd number appears. What is the probability that every even number appears at least once before the first occurrence of an odd number?` },
  { value: 2.5, label: 'Advanced Beginner', summary: 'Harder AMC 8 21-25, harder MATHCOUNTS States, AMC 10 16-20, AMC 12 11-15, usual AIME 1-3.', references: 'Hardest beginner tier; often needs organization or a useful representation.', exampleTitle: '2013 AMC 12A Problem 16', exampleText: `$A$, $B$, $C$ are three piles of rocks. The mean weight of the rocks in $A$ is $40$ pounds, the mean weight of the rocks in $B$ is $50$ pounds, the mean weight of the rocks in the combined piles $A$ and $B$ is $43$ pounds, and the mean weight of the rocks in the combined piles $A$ and $C$ is $44$ pounds. What is the greatest possible integer value for the mean in pounds of the rocks in the combined piles $B$ and $C$?` },
  { value: 3.0, label: 'Early Intermediate', summary: 'Harder MATHCOUNTS National questions, easiest AMC 10 21-25, easier AMC 12 15-20, harder AIME 1-3, easier AIME 4-6.', references: 'Creative thinking beyond direct application.', exampleTitle: '2018 AMC 10A Problem 24', exampleText: `Triangle $ABC$ with $AB=50$ and $AC=10$ has area $120$. Let $D$ be the midpoint of $\\overline{AB}$, and let $E$ be the midpoint of $\\overline{AC}$. The angle bisector of $\\angle BAC$ intersects $\\overline{DE}$ and $\\overline{BC}$ at $F$ and $G$, respectively. What is the area of quadrilateral $FDBG$?` },
  { value: 3.5, label: 'Early Intermediate+', summary: 'Upper AMC and mid-AIME transition problems, often AIME II or late AMC style.', references: 'Layered algebra, geometry, or casework with a hidden simplification.', exampleTitle: '2017 AIME II Problem 7', exampleText: `Find the number of integer values of $k$ in the closed interval $[-500,500]$ for which the equation $\\log(kx)=2\\log(x+2)$ has exactly one real solution.` },
  { value: 4.0, label: 'Intermediate', summary: 'AMC 12 21-25, medium-hard AIME 4-6, easy-medium AIME 7-10.', references: 'Strong contest technique and sustained execution.', exampleTitle: '2019 AMC 10B Problem 24 / 2019 AMC 12B Problem 22', exampleText: `Define a sequence recursively by $x_0=5$ and
$$x_{n+1}=\\frac{x_n^2+5x_n+4}{x_n+6}$$
for all nonnegative integers $n$. Let $m$ be the least positive integer such that
$$x_m\\le 4+\\frac{1}{2^{20}}.$$
In which of the following intervals does $m$ lie?

$\\text{(A) }[9,26]\\qquad \\text{(B) }[27,80]\\qquad \\text{(C) }[81,242]\\qquad \\text{(D) }[243,728]\\qquad \\text{(E) }[729,\\infty)$` },
  { value: 4.5, label: 'Intro Proof/Olympiad', summary: 'Hard AMC/AIME transition and easiest proof-based olympiad problems, such as USAJMO 1/4.', references: 'First proof-flavored level; may require a clean argument, not just computation.', exampleTitle: 'USAJMO 2011/1', exampleText: `Find, with proof, all positive integers $n$ for which $2^n+12^n+2011^n$ is a perfect square.` },
  { value: 5.0, label: 'Difficult AIME / Simple Olympiad', summary: 'Difficult AIME 11-13 and simple proof-based olympiad problems, including early JBMO and easiest USAJMO 1/4.', references: 'Advanced AIME or simple olympiad-style proof.', exampleTitle: 'JBMO 2020/1', exampleText: `Find all triples $(a,b,c)$ of real numbers such that the following system holds:
$$a+b+c=\\frac{1}{a}+\\frac{1}{b}+\\frac{1}{c},$$
$$a^2+b^2+c^2=\\frac{1}{a^2}+\\frac{1}{b^2}+\\frac{1}{c^2}.$$` },
  { value: 5.5, label: 'Advanced AIME / Proof', summary: 'Advanced AIME and proof problems between difficult AIME and introductory olympiad.', references: 'Multiple linked ideas; geometry/proof setup is common.', exampleTitle: '2011 AMC 12A Problem 25', exampleText: `Triangle $ABC$ has $\\angle BAC=60^\\circ$, $\\angle CBA\\le 90^\\circ$, $BC=1$, and $AC\\ge AB$. Let $H$, $I$, and $O$ be the orthocenter, incenter, and circumcenter of $\\triangle ABC$, respectively. Assume that the area of pentagon $BCOIH$ is the maximum possible. What is $\\angle CBA$?` },
  { value: 6.0, label: 'Intro Olympiad', summary: 'AIME 14/15 and introductory olympiad questions, harder USAJMO 1/4, easier USAJMO 2/5, easier USAMO/IMO 1/4.', references: 'Genuine olympiad-level reasoning with a discoverable main idea.', exampleTitle: '2020 AIME I Problem 15', exampleText: `Let $\\triangle ABC$ be an acute triangle with circumcircle $\\omega$, and let $H$ be the intersection of the altitudes of $\\triangle ABC$. Suppose the tangent to the circumcircle of $\\triangle HBC$ at $H$ intersects $\\omega$ at points $X$ and $Y$ with $HA=3$, $HX=2$, and $HY=6$. The area of $\\triangle ABC$ can be written in the form $m\\sqrt n$, where $m$ and $n$ are positive integers, and $n$ is not divisible by the square of any prime. Find $m+n$.` },
  { value: 6.5, label: 'Olympiad', summary: 'Olympiad problems around USAMO/USAJMO early-mid difficulty.', references: 'Proof-level geometry, algebra, number theory, or combinatorics with a serious lemma.', exampleTitle: 'USAMO 2021/1, USAJMO 2021/2', exampleText: `Rectangles $BCC_1B_2$, $CAA_1C_2$, and $ABB_1A_2$ are erected outside an acute triangle $ABC$. Suppose that
$$\\angle BC_1C+\\angle CA_1A+\\angle AB_1B=180^\\circ.$$
Prove that lines $B_1C_2$, $C_1A_2$, and $A_1B_2$ are concurrent.` },
  { value: 7.0, label: 'Tough Olympiad', summary: 'Harder USAJMO 2/5, most USAJMO 3/6, extremely hard USAMO/IMO 1/4, easy-medium USAMO/IMO 2/5.', references: 'Technical olympiad problems requiring several insights.', exampleTitle: 'IMO 2015/1', exampleText: `We say that a finite set $S$ in the plane is balanced if, for any two different points $A,B$ in $S$, there is a point $C$ in $S$ such that $AC=BC$. We say that $S$ is centre-free if for any three different points $A,B,C$ in $S$, there is no point $P$ in $S$ such that $PA=PB=PC$.

a. Show that for all integers $n\\ge 3$, there exists a balanced set consisting of $n$ points.

b. Determine all integers $n\\ge 3$ for which there exists a balanced centre-free set consisting of $n$ points.` },
  { value: 7.5, label: 'Advanced Olympiad', summary: 'Advanced national olympiad level, around hard USAMO/IMO 2/5.', references: 'Hard functional equations, geometry, or number theory with a hidden structure.', exampleTitle: 'USAMO 2014/2', exampleText: `Let $\\mathbb Z$ be the set of integers. Find all functions $f:\\mathbb Z\\to\\mathbb Z$ such that
$$xf(2f(y)-x)+y^2f(2x-f(y))=\\frac{f(x)^2}{x}+f(yf(y))$$
for all $x,y\\in\\mathbb Z$ with $x\\ne 0$.` },
  { value: 8.0, label: 'High Olympiad', summary: 'Medium-hard USAMO and IMO 2/5, easiest USAMO and IMO 3/6.', references: 'High olympiad level with a very non-obvious main idea.', exampleTitle: 'IMO 2014/5', exampleText: `For each positive integer $n$, the Bank of Cape Town issues coins of denomination $\\frac{1}{n}$. Given a finite collection of such coins (of not necessarily different denominations) with total value at most $99+\\frac{1}{2}$, prove that it is possible to split this collection into $100$ or fewer groups, such that each group has total value at most $1$.` },
  { value: 8.5, label: 'Very High Olympiad', summary: 'Very hard national/IMO-level problems above standard problem 2/5 difficulty.', references: 'Deep olympiad geometry or combinatorics; usually elite training level.', exampleTitle: 'IMO 2019/6', exampleText: `Let $I$ be the incentre of acute triangle $ABC$ with $AB\\ne AC$. The incircle $\\omega$ of $ABC$ is tangent to sides $BC$, $CA$, and $AB$ at $D$, $E$, and $F$, respectively. The line through $D$ perpendicular to $EF$ meets $\\omega$ at $R$. Line $AR$ meets $\\omega$ again at $P$. The circumcircles of triangle $PCE$ and $PBF$ meet again at $Q$.

Prove that lines $DI$ and $PQ$ meet on the line through $A$ perpendicular to $AI$.` },
  { value: 9.0, label: 'Expert Olympiad', summary: 'Average USAMO and IMO 3/6.', references: 'Expert olympiad problems where very few students find the central idea quickly.', exampleTitle: 'IMO 2022/3', exampleText: `Let $k$ be a positive integer and let $S$ be a finite set of odd prime numbers. Prove that there is at most one way (up to rotation and reflection) to place the elements of $S$ around the circle such that the product of any two neighbors is of the form $x^2+x+k$ for some positive integer $x$.` },
  { value: 9.5, label: 'Hardest Olympiad', summary: 'Hard USAMO and IMO 3/6; among the hardest problems strong students could reasonably solve.', references: 'The hardest regular olympiad tier.', exampleTitle: 'IMO 2018/3', exampleText: `An anti-Pascal triangle is an equilateral triangular array of numbers such that, except for the numbers in the bottom row, each number is the absolute value of the difference of the two numbers immediately below it. For example, the following is an anti-Pascal triangle with four rows which contains every integer from $1$ to $10$:
$$\\begin{array}{c}
4\\\\
2\\quad 6\\\\
5\\quad 7\\quad 1\\\\
8\\quad 3\\quad 10\\quad 9
\\end{array}$$
Does there exist an anti-Pascal triangle with $2018$ rows which contains every integer from $1$ to $1+2+3+\\cdots+2018$?` },
  { value: 10.0, label: 'Historically Hard', summary: 'Historically hard problems, often too tedious, long, or difficult even for very hard contests.', references: 'World-class difficulty; very few students solve globally.', exampleTitle: 'IMO 2020/6', exampleText: `Prove that there exists a positive constant $c$ such that the following statement is true: Consider an integer $n>1$, and a set $S$ of $n$ points in the plane such that the distance between any two different points in $S$ is at least $1$. It follows that there is a line $\\ell$ separating $S$ such that the distance from any point of $S$ to $\\ell$ is at least $cn^{-1/3}$.

(A line $\\ell$ separates a set of points $S$ if some segment joining two points in $S$ crosses $\\ell$.)` },
];

const parseDifficultyValue = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDifficultyValue = (value: string) => {
  const parsed = parseDifficultyValue(value);
  if (parsed === null) return null;
  return Math.min(Math.max(parsed, DIFFICULTY_MIN), DIFFICULTY_MAX).toFixed(1);
};

const clampDifficultyNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DIFFICULTY_MIN;
  return Math.min(Math.max(parsed, DIFFICULTY_MIN), DIFFICULTY_MAX);
};

const getDifficultyReference = (item: typeof DIFFICULTY_GUIDE[number]) => item.summary;

const getDifficultyLabel = (value: string) => {
  const parsed = parseDifficultyValue(value);
  if (parsed === null) return 'Select difficulty';
  const d = Math.min(Math.max(parsed, DIFFICULTY_MIN), DIFFICULTY_MAX);
  const exact = DIFFICULTY_GUIDE.find(item => item.value === Number(d.toFixed(1)));
  if (exact) return getDifficultyReference(exact);
  const lower = [...DIFFICULTY_GUIDE].reverse().find(item => item.value < d);
  const upper = DIFFICULTY_GUIDE.find(item => item.value > d);
  if (lower && upper) return `${lower.value.toFixed(1)}-${upper.value.toFixed(1)}: ${lower.summary}`;
  const nearest = lower || upper;
  return nearest ? getDifficultyReference(nearest) : 'Select difficulty';
};

type ToastVariant = 'success' | 'info' | 'warning' | 'error';

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

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
  const [deletedProblems, setDeletedProblems] = useState<Problem[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [activeQuotaId, setActiveQuotaId] = useState<string>('q1');

  // --- Session State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'dashboard' | 'pool' | 'submit' | 'admin' | 'composer' | 'waitlist'>('dashboard');
  const [waitlistTab, setWaitlistTab] = useState<'pending' | 'deleted'>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  
  // Login State
  const [loginNameInput, setLoginNameInput] = useState(''); // <--- ADD THIS
  const [isLoggingIn, setIsLoggingIn] = useState(false);    // <--- ADD THIS
  const [selectedLoginId, setSelectedLoginId] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
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
  const [expandedGuideValue, setExpandedGuideValue] = useState<number | null>(null);
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

  // Quota management state
  const [isCreatingQuota, setIsCreatingQuota] = useState(false);
  const [newQuotaForm, setNewQuotaForm] = useState<Partial<Quota> & { assignedUserIds: string[] }>({
    name: '', target: 5, voteTarget: 3, instructions: '', quotaType: 'formal',
    assignmentMode: 'global', isEnabled: true, assignedUserIds: []
  });
  const [expandedQuotaProgressId, setExpandedQuotaProgressId] = useState<string | null>(null);
  // Which quota is selected for the submission form
  const [selectedSubmissionQuotaId, setSelectedSubmissionQuotaId] = useState<string>('');
  
  // Round Create New State
  const [newRoundName, setNewRoundName] = useState('');
  const [newRoundTag, setNewRoundTag] = useState('');
  const [newRoundDesc, setNewRoundDesc] = useState('');

  // Pool View State (Sorting/Filtering)
  const [poolSort, setPoolSort] = useState<'highest' | 'lowest' | 'hardest' | 'easiest' | 'newest'>('highest');
  const [poolFilterTopic, setPoolFilterTopic] = useState<string>('All');
  const [poolFilterStatus, setPoolFilterStatus] = useState<string>('All');
  const [poolFilterQuota, setPoolFilterQuota] = useState<string>('All');
  const [poolFilterDiffMin, setPoolFilterDiffMin] = useState<string>('');
  const [poolFilterDiffMax, setPoolFilterDiffMax] = useState<string>('');
  const [contributionFilterQuota, setContributionFilterQuota] = useState<string>('All');

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

  const dismissToast = (id: string) => {
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showToast = (toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = toast.duration ?? (toast.variant === 'error' ? 5500 : 4000);
    setToasts(prev => [{ ...toast, id, duration }, ...prev].slice(0, 5));
    const timeoutId = window.setTimeout(() => dismissToast(id), duration);
    toastTimeoutsRef.current.set(id, timeoutId);
  };

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach(timeoutId => window.clearTimeout(timeoutId));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  const getToastIcon = (variant: ToastVariant) => {
    switch (variant) {
      case 'success': return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case 'error': return <ShieldAlert className="h-4 w-4 text-red-600" />;
      default: return <Info className="h-4 w-4 text-indigo-600" />;
    }
  };

  const getToastAccent = (variant: ToastVariant) => {
    switch (variant) {
      case 'success': return 'border-l-emerald-500';
      case 'warning': return 'border-l-amber-500';
      case 'error': return 'border-l-red-500';
      default: return 'border-l-indigo-500';
    }
  };

  const ToastViewport = () => (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-[360px] flex-col gap-2 sm:right-5 sm:top-5">
      <AnimatePresence initial={false}>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto rounded-xl border border-l-4 bg-white p-3 shadow-lg ${getToastAccent(toast.variant)}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                {getToastIcon(toast.variant)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5 text-slate-900">{toast.title}</p>
                {toast.message && <p className="mt-0.5 text-xs leading-5 text-slate-500">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );


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
          const [u, p, q, r, notifs] = await Promise.all([
              api.getUsers(),
              api.getProblems(),
              api.getQuotas(),
              api.getRounds(),
              api.getNotifications().catch(() => [] as Notification[])
          ]);
          setUsers(u);
          setProblems(p);
          setQuotas(q);
          setRounds(r);
          setNotifications(notifs);
          
          // Ensure active quota ID is valid
          if (q.length > 0 && !q.find(i => i.id === activeQuotaId)) {
             setActiveQuotaId(q[0].id);
          }
          if (poolFilterQuota !== 'All' && !q.find(i => i.id === poolFilterQuota)) {
             setPoolFilterQuota('All');
          }
          if (contributionFilterQuota !== 'All' && !q.find(i => i.id === contributionFilterQuota)) {
             setContributionFilterQuota('All');
          }
          // Fetch deleted problems for admin/director in the same pass
          if (currentUser?.role === 'admin' || currentUser?.role === 'director') {
              api.getDeletedProblems().then(setDeletedProblems).catch(() => {});
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

  // Auto-select a default submission quota when quotas load or user changes
  useEffect(() => {
    if (quotas.length === 0 || !currentUser) return;
    const formals = quotas.filter(q => q.quotaType === 'formal' && canCurrentUserUseQuota(q));
    const general = quotas.find(q => q.quotaType === 'general' && canCurrentUserUseQuota(q));
    const allEligible = [...formals, ...(general ? [general] : [])];
    if (allEligible.length > 0 && !allEligible.find(q => q.id === selectedSubmissionQuotaId)) {
      setSelectedSubmissionQuotaId(formals[0]?.id || general?.id || '');
    }
  }, [quotas, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (poolFilterQuota !== 'All' && quotas.length > 0 && !quotas.some(q => q.id === poolFilterQuota)) {
      setPoolFilterQuota('All');
    }
    if (composerSourceQuota !== 'All' && quotas.length > 0 && !quotas.some(q => q.id === composerSourceQuota)) {
      setComposerSourceQuota('All');
    }
    if (contributionFilterQuota !== 'All' && quotas.length > 0 && !quotas.some(q => q.id === contributionFilterQuota)) {
      setContributionFilterQuota('All');
    }
  }, [quotas, poolFilterQuota, composerSourceQuota, contributionFilterQuota]);

  const isOffWaitlist = (p: Problem) => p.status === 'approved' || p.status === 'accepted';

  // Update Users submitted & voted count locally based on ACTIVE QUOTA
  useEffect(() => {
    if (currentUser?.role === 'guest') return;

    if (problems.length >= 0 && users.length > 0) {
      const activeProblems = problems.filter(p => p.quotaId === activeQuotaId);
      const countableActiveProblems = activeProblems.filter(isOffWaitlist);
      
      const updatedUsers = users.map(u => ({
        ...u,
        submittedCount: countableActiveProblems.filter(p => p.authorId === u.id).length,
        voteCount: activeProblems.filter(p => p.votedBy?.includes(u.id)).length
      }));
      
      const isDifferent = JSON.stringify(updatedUsers.map(u => ({s: u.submittedCount, v: u.voteCount}))) !== JSON.stringify(users.map(u => ({s: u.submittedCount, v: u.voteCount})));
      if (isDifferent) {
         setUsers(updatedUsers);
      }
    }
  }, [problems, activeQuotaId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const getErrorMessage = (e: unknown, fallback: string) => e instanceof Error ? e.message : fallback;
  const canCurrentUserUseQuota = (q: Quota) => {
    if (!q.isEnabled) return false;
    if (q.quotaType === 'general' || q.assignmentMode === 'global') return true;
    if (!currentUser) return false;
    if (currentUser.role !== 'admin' && currentUser.role !== 'director') return true;
    return q.assignedUserIds?.includes(currentUser.id) ?? false;
  };

  // --- Actions ---

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setLoginError('');
    setIsLoggingIn(true);

    // 1. Find User ID by Name (Case insensitive)
    const targetUser = users.find(u => u.name.toLowerCase() === loginNameInput.trim().toLowerCase());

    if (!targetUser) {
        setLoginError('User identity not found.');
        setIsLoggingIn(false);
        return;
    }

    // 2. Attempt API Login
    try {
        const { user } = await api.login(targetUser.id, loginPassword);
        setCurrentUser(user);
        if (user.role === 'guest') {
            setView('submit');
        } else {
            setView('dashboard');
        }
        setLoginPassword('');
        setLoginNameInput('');
    } catch (e) {
        setLoginError('Access Key Invalid');
    } finally {
        setIsLoggingIn(false);
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
        showToast({ variant: 'success', title: 'Round created', message: `${newRound.name} is ready.` });
    } catch(e) {
        console.error("Failed to create round", e);
        showToast({ variant: 'error', title: "Couldn't create round", message: getErrorMessage(e, 'Please try again.') });
    }
  };

  const cancelCreateRound = () => {
    setIsCreatingRound(false);
    setNewRoundName('');
    setNewRoundTag('');
    setNewRoundDesc('');
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
          showToast({ variant: 'success', title: 'Round updated', message: 'Round settings were saved.' });
      } catch (e) {
          console.error("Edit round failed", e);
          showToast({ variant: 'error', title: "Couldn't update round", message: getErrorMessage(e, 'Please try again.') });
      }
  };

  const deleteRound = async () => {
      if (!composerSelectedRoundId) return;
      if (!window.confirm("Are you sure you want to delete this round? Problems will be unassigned, not deleted.")) return;
      try {
          await api.deleteRound(composerSelectedRoundId);
          setComposerSelectedRoundId(null);
          refreshData();
          showToast({ variant: 'success', title: 'Round deleted', message: 'Problems were unassigned, not deleted.' });
      } catch (e) {
          console.error("Delete round failed", e);
          showToast({ variant: 'error', title: "Couldn't delete round", message: getErrorMessage(e, 'Please try again.') });
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
        target: editQuotaForm.target ?? 5,
        voteTarget: editQuotaForm.voteTarget ?? 3,
        instructions: editQuotaForm.instructions || '',
        dueDate: editQuotaForm.dueDate || null,
        quotaType: editQuotaForm.quotaType || 'formal',
        assignmentMode: editQuotaForm.assignmentMode || 'global',
        isEnabled: editQuotaForm.isEnabled !== false,
        assignedUserIds: editQuotaForm.assignedUserIds || []
      });
      await refreshData();
      setEditingQuotaId(null);
      showToast({ variant: 'success', title: 'Quota updated', message: 'Cycle settings were saved.' });
    } catch (e) {
      console.error("Failed to update quota");
      showToast({ variant: 'error', title: "Couldn't save quota", message: getErrorMessage(e, 'Please try again.') });
    }
  };

  const createNewQuota = async () => {
    if (!newQuotaForm.name?.trim()) return;
    try {
      await api.createQuota({
        name: newQuotaForm.name,
        target: newQuotaForm.target ?? 5,
        voteTarget: newQuotaForm.voteTarget ?? 3,
        instructions: newQuotaForm.instructions || '',
        dueDate: newQuotaForm.dueDate || null,
        quotaType: newQuotaForm.quotaType || 'formal',
        assignmentMode: newQuotaForm.assignmentMode || 'global',
        isEnabled: true,
        assignedUserIds: newQuotaForm.assignedUserIds || []
      });
      await refreshData();
      setIsCreatingQuota(false);
      setNewQuotaForm({ name: '', target: 5, voteTarget: 3, instructions: '', quotaType: 'formal', assignmentMode: 'global', isEnabled: true, assignedUserIds: [] });
      showToast({ variant: 'success', title: 'Quota created', message: 'The new cycle is ready.' });
    } catch (e) {
      console.error("Failed to create quota", e);
      showToast({ variant: 'error', title: "Couldn't create quota", message: getErrorMessage(e, 'Please try again.') });
    }
  };

  const getQuotaProgressData = (q: Quota) => {
    const eligibleUsers = q.assignmentMode === 'global'
      ? users.filter(u => u.role !== 'guest')
      : users.filter(u => q.assignedUserIds?.includes(u.id));
    return eligibleUsers.map(u => {
      const submitted = problems.filter(p => p.authorId === u.id && p.quotaId === q.id && isOffWaitlist(p)).length;
      const target = u.customTargets?.[q.id] || q.target;
      return { user: u, submitted, target };
    }).sort((a, b) => b.submitted - a.submitted);
  };

  const switchQuota = (id: string) => {
    setActiveQuotaId(id);
    localStorage.setItem('probfair_active_quota_id', id);
  };

  const handlePoolQuotaFilterChange = (id: string) => {
    setPoolFilterQuota(id);
    setPoolFilterTopic('All');
    setPoolFilterStatus('All');
    setPoolFilterDiffMin('');
    setPoolFilterDiffMax('');
  };

  const clearPoolFilters = () => {
    setPoolFilterQuota('All');
    setPoolFilterTopic('All');
    setPoolFilterStatus('All');
    setPoolFilterDiffMin('');
    setPoolFilterDiffMax('');
  };

  // -- User Management --

  const addUser = async () => {
    if (!newUserName.trim() || !newUserPassword.trim()) return;
    const roleToCreate = currentUser?.role !== 'admin' ? 'writer' : newUserRole;
    try {
        const newUser = await api.createUser({
          name: newUserName.trim(),
          password: newUserPassword.trim(),
          role: roleToCreate,
          submittedCount: 0,
          votingPower: roleToCreate === 'director' ? 5 : 1,
          customTargets: {}
        });
        setUsers([...users, newUser]);
        setNewUserName('');
        setNewUserPassword('');
        setNewUserRole('writer');
        showToast({ variant: 'success', title: 'User created', message: 'The new account is ready.' });
    } catch(e) {
        console.error("Failed to create user", e);
        showToast({ variant: 'error', title: "Couldn't create user", message: getErrorMessage(e, 'Please try again.') });
    }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Are you sure? This deletes their submitted problems too.")) return;
    try {
        await api.deleteUser(id);
        await refreshData();
        showToast({ variant: 'success', title: 'User deleted', message: 'The account and related submissions were removed.' });
    } catch(e) {
        console.error("Delete failed");
        showToast({ variant: 'error', title: "Couldn't delete user", message: getErrorMessage(e, 'You may not have permission to delete this user.') });
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
      showToast({ variant: 'success', title: 'User updated', message: 'Account changes were saved.' });
    } catch (e) {
      console.error("Failed to update user");
      showToast({ variant: 'error', title: "Couldn't update user", message: getErrorMessage(e, 'Directors cannot change passwords.') });
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
        showToast({ variant: 'success', title: 'Votes reset', message: 'All problem scores were cleared.' });
    } catch(e) {
        console.error("Failed to reset votes");
        showToast({ variant: 'error', title: "Couldn't reset votes", message: getErrorMessage(e, 'Please try again.') });
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
      setDifficulty(Number(prob.difficulty).toFixed(1));
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
          showToast({ variant: 'warning', title: 'Image too large', message: 'Please use an image under 2MB.' });
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
    const normalizedDifficulty = normalizeDifficultyValue(difficulty);
    if (!normalizedDifficulty) {
        setSubmissionError("Please enter a valid difficulty.");
        showToast({ variant: 'warning', title: 'Difficulty required', message: 'Enter a difficulty from 0.5 to 10.0.' });
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
          difficulty: parseFloat(normalizedDifficulty),
          topics: selectedTopics,
          quotaId: selectedSubmissionQuotaId || activeQuotaId,
          imageData: imageData || undefined,
          version: editingProblemVersion // Pass version for check
      };

      if (editingProblemId) {
          await api.updateProblem(editingProblemId, payload);
          showToast({ variant: 'success', title: 'Problem updated', message: 'Your changes were saved.' });
      } else {
          await api.submitProblem({
              ...payload,
              authorId: currentUser.id,
              authorName: currentUser.name,
          });
          showToast({ variant: 'success', title: 'Problem submitted', message: 'Your problem was added to the waitlist.' });
      }
      
      // If guest, do not refresh data or change view heavily
      if (currentUser.role === 'guest') {
          resetForm();
      } else {
          await refreshData();
          resetForm();
          setView('dashboard');
      }
    } catch (e: any) {
      const message = e.message || "System error during validation.";
      setSubmissionError(message);
      showToast({ variant: 'error', title: "Couldn't save problem", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // -- Bulk Import --
  const handleBulkParse = async () => {
      if (!bulkText) return;
      const normalizedDifficulty = normalizeDifficultyValue(difficulty);
      if (!normalizedDifficulty) {
          showToast({ variant: 'warning', title: 'Difficulty required', message: 'Enter a difficulty from 0.5 to 10.0.' });
          return;
      }
      try {
          const parsed = await api.parseBulkLatex(bulkText, selectedTopics, parseFloat(normalizedDifficulty));
          setParsedProblems(parsed);
      } catch (e) {
          showToast({ variant: 'error', title: "Couldn't parse import", message: getErrorMessage(e, 'Please check the format.') });
      }
  };

  const handleBulkCommit = async () => {
      setIsSubmitting(true);
      let successCount = 0;
      for (const p of parsedProblems) {
          try {
              await api.submitProblem({
                  ...p,
                  quotaId: selectedSubmissionQuotaId || activeQuotaId,
                  authorId: currentUser?.id,
                  authorName: currentUser?.name
              });
              successCount++;
          } catch(e) { console.error(e); }
      }
      setIsSubmitting(false);
      showToast({
        variant: successCount === parsedProblems.length ? 'success' : 'warning',
        title: successCount === parsedProblems.length ? 'Problems imported' : 'Import partially completed',
        message: `Imported ${successCount} of ${parsedProblems.length} problem${parsedProblems.length === 1 ? '' : 's'}.`
      });
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
        showToast({ variant: 'info', title: 'Vote updated' });
    } catch (e) {
        setProblems(oldProblems);
        console.error("Vote failed");
        showToast({ variant: 'error', title: "Couldn't update vote", message: getErrorMessage(e, 'Please try again.') });
    }
  };

  const refreshNotifications = async () => {
    if (!currentUser || currentUser.role === 'guest') return;
    setNotificationsLoading(true);
    try {
      const notifs = await api.getNotifications();
      setNotifications(notifs);
      const deletedProblemIds = new Set(
        notifs
          .filter(n => n.type === 'problem_deleted' && n.problemId)
          .map(n => n.problemId as string)
      );
      if (deletedProblemIds.size > 0) {
        setProblems(prev => prev.filter(p => !deletedProblemIds.has(p.id)));
      }
    } catch(e) {
      // non-fatal
    } finally {
      setNotificationsLoading(false);
    }
  };

  const refreshDeletedProblems = async () => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'director')) return;
    try {
      const deleted = await api.getDeletedProblems();
      setDeletedProblems(deleted);
    } catch(e) {
      // non-fatal
    }
  };

  useEffect(() => {
    if (!currentUser || currentUser.role === 'guest') return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications();
        refreshData();
      }
    };

    const onFocus = () => {
      refreshNotifications();
      refreshData();
    };

    const intervalId = window.setInterval(refreshNotifications, 15000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [currentUser?.id, currentUser?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'waitlist' || waitlistTab === 'deleted') {
      refreshDeletedProblems();
    }
  }, [view, waitlistTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? Date.now() })));
    } catch(e) {}
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.readAt) {
      api.markNotificationRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, readAt: Date.now() } : n));
    }
    if (notif.problemId) {
      const problem = problems.find(p => p.id === notif.problemId);
      if (problem) {
        switchQuota(problem.quotaId);
        setView('dashboard');
      }
    }
  };

  const handleStatusChange = async (problemId: string, status: ProblemStatus) => {
     try {
        await api.updateProblemStatus(problemId, status);
        const updated = problems.map(p => p.id === problemId ? { ...p, status } : p);
        setProblems(updated);
        refreshNotifications();
        const title = status === 'approved'
          ? 'Problem approved'
          : status === 'pending'
            ? 'Returned to waitlist'
            : 'Problem accepted';
        const message = status === 'approved'
          ? 'The author will see this update on their dashboard.'
          : status === 'pending'
            ? 'The problem is back in the review queue.'
            : 'The problem status was updated.';
        showToast({ variant: 'success', title, message });
     } catch(e) {
        console.error("Failed to update status");
        showToast({ variant: 'error', title: "Couldn't update status", message: getErrorMessage(e, 'Please try again.') });
     }
  };

  const handleDeleteProblem = async (problem: Problem) => {
    if (!window.confirm(`Remove "${problem.title}" from the pool? The author will be notified. You can restore it later from the Deleted tab.`)) {
      return;
    }
    const reasonInput = window.prompt('Optional reason for deletion (shown to the author):');
    const reason = reasonInput?.trim() || undefined;

    const previousProblems = problems;
    setProblems(prev => prev.filter(p => p.id !== problem.id));
    // Optimistically add to deleted list so it appears immediately
    setDeletedProblems(prev => [{
      ...problem,
      deletedAt: Date.now(),
      deletedBy: currentUser!.id,
      deletedByName: currentUser!.name,
      deletedByAvatarUrl: currentUser!.avatarUrl || null,
      deletionReason: reason || null,
    }, ...prev.filter(p => p.id !== problem.id)]);

    try {
      await api.deleteProblem(problem.id, reason);
      refreshNotifications();
      refreshDeletedProblems(); // sync with server truth
      showToast({ variant: 'success', title: 'Problem removed', message: 'The author has been notified and can see the reason.' });
    } catch (e) {
      console.error("Failed to delete problem", e);
      setProblems(previousProblems);
      setDeletedProblems(prev => prev.filter(p => p.id !== problem.id));
      showToast({ variant: 'error', title: "Couldn't remove problem", message: getErrorMessage(e, 'Please try again.') });
    }
  };

  const handleRestoreProblem = async (problem: Problem) => {
    if (!window.confirm(`Restore "${problem.title}" back to the pool?`)) return;
    try {
      await api.restoreProblem(problem.id);
      setDeletedProblems(prev => prev.filter(p => p.id !== problem.id));
      await refreshData();
      refreshNotifications();
      showToast({ variant: 'success', title: 'Problem restored', message: 'The problem is back in the pool and the author has been notified.' });
    } catch(e) {
      showToast({ variant: 'error', title: "Couldn't restore problem", message: getErrorMessage(e, 'Please try again.') });
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
          showToast({ variant: 'error', title: "Couldn't save", message: getErrorMessage(e, 'Composer changes were reverted.') });
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
         showToast({ variant: 'success', title: 'Added to round', message: `The problem was added to ${composerSelectedRound?.name || 'the round'}.` });
      } catch(e) {
          refreshData();
          showToast({ variant: 'error', title: "Couldn't add to round", message: getErrorMessage(e, 'Please try again.') });
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
          showToast({ variant: 'error', title: "Couldn't remove from round", message: getErrorMessage(e, 'Please try again.') });
          return;
      }
      showToast({ variant: 'success', title: 'Removed from round', message: `The problem was removed from ${composerSelectedRound?.name || 'the round'}.` });
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
              showToast({ variant: 'error', title: "Couldn't reorder round", message: getErrorMessage(e, 'Please try again.') });
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
          showToast({ variant: 'success', title: 'Export copied', message: 'WAMT TeX template copied to clipboard.' });
          setShowExportModal(false);
      }).catch(err => {
          console.error("Failed to copy", err);
          showToast({ variant: 'error', title: "Couldn't copy export", message: getErrorMessage(err, 'Clipboard access failed.') });
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
                            D: {Number(problem.difficulty).toFixed(1)}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex flex-wrap gap-2 items-center">
                        <span className="flex items-center gap-1">
                          {[...(problem.topics || [])].sort((a, b) => TOPICS.indexOf(a) - TOPICS.indexOf(b)).map(t => {
                            return (
                              <span key={t} title={t} className={`grid h-4 w-4 place-items-center rounded-full border text-[8px] font-black ${TOPIC_CHIP_CLASSES[t]}`}>
                                {TOPIC_LABELS[t]}
                              </span>
                            );
                          })}
                        </span>
                        <span className="flex items-center gap-0.5 text-slate-400">
                            <FolderOpen className="w-2.5 h-2.5" /> {quotas.find(q => q.id === problem.quotaId)?.name || 'Unknown cycle'}
                        </span>
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
                            <MathText text={problem.statement} className="text-xs text-slate-700 whitespace-pre-wrap font-serif mb-2 leading-snug" />
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
                                    <MathText text={problem.solution || 'None'} className="text-xs text-slate-600 font-serif leading-snug" />
                                 </div>
                             </div>
                             <div className="bg-white p-2 rounded border border-slate-200 h-fit shadow-sm">
                                 <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Answer</span>
                                 <MathText text={problem.answerKey || '—'} className="text-xs text-slate-700 font-serif leading-snug" />
                             </div>
                        </div>
                    )}
                </motion.div>
            )}
            </AnimatePresence>
        </motion.div>
      );
  };

  // --- Notification Helpers ---

  const getTimeAgo = (ts: number): string => {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hours = Math.floor(min / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  const getNotifIcon = (type: NotificationType) => {
    switch (type) {
      case 'problem_approved': return <CheckCircle className="w-4 h-4" />;
      case 'problem_returned_to_waitlist': return <Clock className="w-4 h-4" />;
      case 'problem_added_to_round': return <FolderOpen className="w-4 h-4" />;
      case 'problem_removed_from_round': return <X className="w-4 h-4" />;
      case 'problem_commented': return <MessageSquare className="w-4 h-4" />;
      case 'problem_deleted': return <Trash2 className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getNotifStyle = (type: NotificationType): string => {
    switch (type) {
      case 'problem_approved': return 'bg-emerald-50 border-emerald-100 text-emerald-600';
      case 'problem_returned_to_waitlist': return 'bg-amber-50 border-amber-100 text-amber-600';
      case 'problem_added_to_round': return 'bg-indigo-50 border-indigo-100 text-indigo-600';
      case 'problem_removed_from_round': return 'bg-orange-50 border-orange-100 text-orange-600';
      case 'problem_commented': return 'bg-blue-50 border-blue-100 text-blue-600';
      case 'problem_deleted': return 'bg-red-50 border-red-100 text-red-600';
      default: return 'bg-slate-50 border-slate-100 text-slate-500';
    }
  };

  const shouldShowActorAvatar = (notif: Notification) => {
    return notif.type === 'problem_commented' && Boolean(notif.actorName && notif.actorId);
  };

  const NotificationItem = ({ notif }: { notif: Notification }) => {
    const isUnread = !notif.readAt;
    const showActorAvatar = shouldShowActorAvatar(notif);
    return (
      <div
        onClick={() => handleNotificationClick(notif)}
        className={`flex items-start gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all ${
          isUnread
            ? 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100/80'
            : 'bg-white border-slate-200 hover:bg-slate-50'
        }`}
      >
        {showActorAvatar ? (
          <Avatar name={notif.actorName || undefined} size="sm" />
        ) : (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${getNotifStyle(notif.type)}`}>
            {getNotifIcon(notif.type)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-tight ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
              {notif.title}
            </p>
            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5">
              {getTimeAgo(notif.createdAt)}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
        </div>
        {isUnread && (
          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
        )}
      </div>
    );
  };

  const renderDifficultyGuideModal = () => {
    const selected = normalizeDifficultyValue(difficulty);
    return (
      <AnimatePresence initial={false}>
        {showRatingScale && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="shrink-0 border-b border-slate-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">Competition Difficulty Scale</h2>
                    <p className="mt-1 text-sm text-slate-500">Use anchors as reference points; exact submissions can use tenths.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRatingScale(false)}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close difficulty guide"
                    title="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid gap-2">
                  {DIFFICULTY_GUIDE.map(item => {
                    const itemValue = item.value.toFixed(1);
                    const isCurrent = selected === itemValue;
                    const expanded = expandedGuideValue === item.value;
                    return (
                      <div
                        key={item.value}
                        className={`rounded-xl border p-4 transition-all ${isCurrent ? 'border-indigo-300 bg-indigo-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200'}`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                          <button
                            type="button"
                            onClick={() => {
                              setDifficulty(itemValue);
                              showToast({ variant: 'success', title: 'Difficulty selected', message: `${itemValue} - ${item.label}` });
                            }}
                            className={`grid h-12 w-16 shrink-0 place-items-center rounded-xl border font-mono text-lg font-black transition ${isCurrent ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-indigo-300 hover:text-indigo-700'}`}
                            title={`Use ${itemValue}`}
                          >
                            {itemValue}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900">{item.summary}</h3>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">{item.label}</span>
                              {isCurrent && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Current</span>}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{item.references}</p>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedGuideValue(expanded ? null : item.value)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
                            >
                              {expanded ? 'Hide example' : 'Show example'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDifficulty(itemValue);
                                setShowRatingScale(false);
                              }}
                              className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                            >
                              Use
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-xs font-bold text-slate-800">{item.exampleTitle}</p>
                            <MathText text={item.exampleText} className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
    const [difficultyInput, setDifficultyInput] = useState(String(p.difficulty));
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
            showToast({ variant: 'success', title: 'Problem updated', message: 'Your changes were saved.' });
        } catch(e) {
            console.error(e);
            showToast({ variant: 'error', title: "Couldn't save", message: getErrorMessage(e, 'Please try again.') });
        }
        finally { setIsSaving(false); }
    };
    
    const approve = async () => {
        try {
            await api.updateProblem(p.id, { ...formData, status: 'approved' });
            await refreshData();
            showToast({ variant: 'success', title: 'Problem approved', message: 'The author will see this update on their dashboard.' });
        } catch (e) {
            console.error(e);
            showToast({ variant: 'error', title: "Couldn't approve problem", message: getErrorMessage(e, 'Please try again.') });
        }
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
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                            <FolderOpen className="w-3 h-3" />
                            {quotas.find(q => q.id === p.quotaId)?.name || 'Unknown cycle'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 shrink-0">
                    <div className="flex flex-col items-center px-2 border-r border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">Diff</span>
                        <input
                            type="number" step="0.1"
                            className="w-10 text-sm bg-transparent text-center font-bold text-slate-800 outline-none placeholder:text-slate-400"
                            value={difficultyInput}
                            placeholder="0.0"
                            onChange={e => setDifficultyInput(e.target.value)}
                            onBlur={() => {
                                const parsed = parseFloat(difficultyInput);
                                if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 10) {
                                    setFormData({...formData, difficulty: parsed});
                                    setDifficultyInput(parsed.toFixed(1));
                                } else {
                                    setDifficultyInput(String(formData.difficulty));
                                }
                            }}
                        />
                    </div>
                    <Button
                        size="sm"
                        onClick={approve}
                        className="!bg-white !text-emerald-600 border border-slate-200 hover:!bg-slate-50 h-8 text-xs px-4 shadow-sm font-bold"
                    >
                        Approve
                    </Button>
                    <button
                        onClick={() => handleDeleteProblem(p)}
                        className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                        title="Remove problem"
                    >
                        <Trash2 size={16} />
                    </button>
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

            {/* ROW 3: SOLUTION & ANSWER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solution</label>
                    {isExpanded ? (
                        <textarea
                            className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-serif focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                            value={formData.solution}
                            onChange={e => setFormData({...formData, solution: e.target.value})}
                        />
                    ) : (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm font-serif text-slate-600">
                            <MathText text={formData.solution || 'No solution provided.'} />
                        </div>
                    )}
                </div>
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Answer Key</label>
                    {isExpanded ? (
                        <input
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-serif focus:ring-1 focus:ring-indigo-500 outline-none text-slate-800"
                            value={formData.answerKey}
                            onChange={e => setFormData({...formData, answerKey: e.target.value})}
                        />
                    ) : (
                        <div className="bg-white p-3 rounded-lg border border-slate-200 text-sm font-serif text-slate-700">
                            {formData.answerKey
                                ? <MathText text={formData.answerKey} />
                                : <span className="text-slate-400 italic">—</span>
                            }
                        </div>
                    )}
                </div>
            </div>

            {/* ROW 4: TOPICS & SAVE */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                <div className="flex flex-wrap gap-1.5">
                    {TOPICS.map(t => (
                        <button
                            key={t}
                            onClick={() => isExpanded && toggleTopic(t)}
                            title={t}
                            className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-black transition-all border ${
                                formData.topics.includes(t)
                                ? `${TOPIC_CHIP_CLASSES[t]} shadow-sm`
                                : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            {TOPIC_LABELS[t]}
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

  if (!currentUser) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
        <ToastViewport />
        <style>{`
          @keyframes wamo-symbol-fade { 0%, 100% { opacity: 0.04; } 50% { opacity: 0.095; } }
          @keyframes wamo-line-fade { 0%, 100% { stroke-opacity: 0.16; } 50% { stroke-opacity: 0.58; } }
          @keyframes wamo-trace { 0% { stroke-dashoffset: 200; opacity: 0.16; } 42% { opacity: 0.74; } 100% { stroke-dashoffset: 0; opacity: 0.16; } }
          @keyframes wamo-node { 0%, 100% { opacity: 0.45; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
          .wamo-watermark {
            display: none; position: absolute; z-index: 1; pointer-events: none;
            font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
            color: rgba(15, 23, 42, 0.06); line-height: 1;
            animation: wamo-symbol-fade 7s ease-in-out infinite; user-select: none;
          }
          .wamo-edge {
            display: none; position: absolute; z-index: 2; pointer-events: none; color: #64748b;
            font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 11px; letter-spacing: 0.02em;
          }
          .wamo-trace { stroke-dasharray: 200; animation: wamo-trace 8s linear infinite; }
          .wamo-pulse-line { animation: wamo-line-fade 6s ease-in-out infinite; }
          .wamo-pulse-node { transform-box: fill-box; transform-origin: center; animation: wamo-node 4s ease-in-out infinite; }
          .wamo-password-input::-ms-reveal,
          .wamo-password-input::-ms-clear {
            display: none;
          }
          .wamo-password-input::-webkit-credentials-auto-fill-button,
          .wamo-password-input::-webkit-caps-lock-indicator,
          .wamo-password-input::-webkit-textfield-decoration-container {
            visibility: hidden;
            pointer-events: none;
          }
          @media (prefers-reduced-motion: reduce) {
            .wamo-video { display: none; }
            .wamo-watermark, .wamo-trace, .wamo-pulse-line, .wamo-pulse-node { animation: none !important; }
          }
        `}</style>

        <video
          className="wamo-video absolute inset-0 z-0 h-full w-full object-cover opacity-95 [filter:saturate(.85)_contrast(.95)_brightness(1.05)]"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src="/assets/bg-math.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_55%_60%_at_50%_50%,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.78)_30%,rgba(255,255,255,0.35)_55%,rgba(255,255,255,0.05)_75%,rgba(255,255,255,0)_100%)]" />
        <div className="absolute inset-0 z-[1] pointer-events-none bg-[linear-gradient(180deg,rgba(248,250,252,0.45)_0%,rgba(248,250,252,0)_18%,rgba(248,250,252,0)_82%,rgba(248,250,252,0.55)_100%)]" />

        <div className="wamo-watermark left-[10%] top-[12%] hidden text-[120px] -rotate-[8deg] md:block">sum</div>
        <div className="wamo-watermark left-[8%] top-[70%] hidden text-[96px] md:block [animation-delay:1.5s]">pi</div>
        <div className="wamo-watermark right-[14%] top-[18%] hidden text-[110px] md:block [animation-delay:3s]">int</div>
        <div className="wamo-watermark bottom-[14%] right-[10%] hidden text-[130px] rotate-[5deg] md:block [animation-delay:4.5s]">dx</div>
        <div className="wamo-watermark left-[4%] top-[48%] hidden text-[72px] lg:block">f(x)</div>
        <div className="wamo-watermark right-[5%] top-[52%] hidden text-[80px] lg:block">theta</div>

        <div className="wamo-edge left-4 top-5 hidden sm:block md:left-8 md:top-7" aria-hidden="true">
          <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
            <line x1="20" y1="120" x2="180" y2="120" stroke="#94a3b8" strokeWidth="1" />
            <line x1="20" y1="120" x2="20" y2="10" stroke="#94a3b8" strokeWidth="1" />
            <g stroke="#94a3b8" strokeWidth="1" opacity="0.6">
              <line x1="60" y1="118" x2="60" y2="122" />
              <line x1="100" y1="118" x2="100" y2="122" />
              <line x1="140" y1="118" x2="140" y2="122" />
              <line x1="18" y1="80" x2="22" y2="80" />
              <line x1="18" y1="40" x2="22" y2="40" />
            </g>
            <path d="M 20 115 Q 70 30, 180 25" stroke="#2563eb" strokeWidth="1.4" fill="none" strokeLinecap="round" className="wamo-trace" />
            <circle cx="60" cy="92" r="3.5" fill="#2563eb" className="wamo-pulse-node" />
            <circle cx="100" cy="62" r="3.5" fill="#7c3aed" className="wamo-pulse-node [animation-delay:1.4s]" />
            <circle cx="140" cy="40" r="3.5" fill="#2563eb" className="wamo-pulse-node [animation-delay:2.8s]" />
            <text x="184" y="124" fontFamily="JetBrains Mono" fontSize="9" fill="#94a3b8">x</text>
            <text x="14" y="14" fontFamily="JetBrains Mono" fontSize="9" fill="#94a3b8">y</text>
          </svg>
          <div className="mt-1.5 opacity-70">f(x) = 1/2x^2 + 3</div>
        </div>

        <div className="wamo-edge right-4 top-5 hidden text-right sm:block md:right-8 md:top-7" aria-hidden="true">
          <div className="leading-7 text-slate-400">div E = rho / eps0</div>
          <div className="leading-7 text-slate-400 opacity-70">curl B = mu0J + mu0eps0 dE/dt</div>
          <div className="mt-2 text-slate-400">WAMO | 2026</div>
          <svg width="160" height="60" viewBox="0 0 160 60" fill="none" className="ml-auto mt-2.5">
            <line x1="10" y1="50" x2="120" y2="14" stroke="#7c3aed" strokeWidth="1.4" className="wamo-trace wamo-pulse-line" />
            <polygon points="120,14 110,15 116,22" fill="#7c3aed" />
            <circle cx="10" cy="50" r="3" fill="#7c3aed" className="wamo-pulse-node [animation-delay:.6s]" />
            <circle cx="120" cy="14" r="3" fill="#2563eb" className="wamo-pulse-node [animation-delay:2s]" />
            <text x="125" y="18" fontFamily="JetBrains Mono" fontSize="9" fill="#94a3b8">v</text>
          </svg>
        </div>

        <div className="wamo-edge bottom-8 left-8 hidden md:block" aria-hidden="true">
          <svg width="220" height="140" viewBox="0 0 220 140" fill="none">
            <g stroke="#94a3b8" strokeWidth="1" fill="none">
              <line x1="30" y1="100" x2="90" y2="50" className="wamo-pulse-line" />
              <line x1="90" y1="50" x2="160" y2="80" className="wamo-pulse-line [animation-delay:1s]" />
              <line x1="160" y1="80" x2="200" y2="30" className="wamo-pulse-line [animation-delay:2s]" />
              <line x1="30" y1="100" x2="160" y2="80" className="wamo-pulse-line [animation-delay:1.6s]" />
              <line x1="90" y1="50" x2="200" y2="30" className="wamo-pulse-line [animation-delay:2.4s]" />
              <line x1="30" y1="100" x2="120" y2="120" className="wamo-pulse-line [animation-delay:.8s]" />
              <line x1="160" y1="80" x2="120" y2="120" className="wamo-pulse-line [animation-delay:3s]" />
            </g>
            <circle cx="30" cy="100" r="3.5" fill="#2563eb" className="wamo-pulse-node [animation-delay:.3s]" />
            <circle cx="90" cy="50" r="3.5" fill="#7c3aed" className="wamo-pulse-node [animation-delay:1.2s]" />
            <circle cx="160" cy="80" r="3.5" fill="#2563eb" className="wamo-pulse-node [animation-delay:2.1s]" />
            <circle cx="200" cy="30" r="3.5" fill="#7c3aed" className="wamo-pulse-node [animation-delay:.9s]" />
            <circle cx="120" cy="120" r="3.5" fill="#2563eb" className="wamo-pulse-node [animation-delay:1.8s]" />
          </svg>
          <div className="mt-1 opacity-70">G = (V, E) | |V| = 5</div>
        </div>

        <div className="wamo-edge bottom-8 right-8 hidden text-right md:block" aria-hidden="true">
          <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
            <circle cx="110" cy="80" r="55" stroke="#94a3b8" strokeWidth="1.2" fill="none" className="wamo-trace" />
            <polygon points="110,30 162,108 58,108" stroke="#2563eb" strokeWidth="1.4" fill="none" className="wamo-pulse-line" />
            <line x1="110" y1="30" x2="110" y2="108" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <circle cx="110" cy="30" r="3" fill="#2563eb" className="wamo-pulse-node [animation-delay:.4s]" />
            <circle cx="162" cy="108" r="3" fill="#7c3aed" className="wamo-pulse-node [animation-delay:1.6s]" />
            <circle cx="58" cy="108" r="3" fill="#2563eb" className="wamo-pulse-node [animation-delay:2.6s]" />
            <path d="M 105 103 L 105 108 L 110 108" stroke="#94a3b8" strokeWidth="1" fill="none" opacity="0.6" />
            <text x="100" y="22" fontFamily="JetBrains Mono" fontSize="9" fill="#94a3b8">A</text>
            <text x="166" y="118" fontFamily="JetBrains Mono" fontSize="9" fill="#94a3b8">B</text>
            <text x="44" y="118" fontFamily="JetBrains Mono" fontSize="9" fill="#94a3b8">C</text>
          </svg>
          <div className="mt-1 opacity-70">ABC | R = 55</div>
        </div>

        <div className="relative z-[5] grid min-h-screen w-full place-items-center p-6">
          <div className="relative w-full max-w-[420px]">
            <motion.div
              className="rounded-[24px] border border-slate-200 bg-white/80 p-7 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-8px_rgba(15,23,42,0.10),0_32px_64px_-24px_rgba(15,23,42,0.18)] backdrop-blur-[18px] backdrop-saturate-150 sm:p-10"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-[22px] flex flex-col items-center gap-3.5">
                <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_4px_12px_-4px_rgba(31,107,58,0.25)]">
                  <img src="/assets/wamo-logo.webp" alt="WAMO logo" className="h-full w-full object-contain" />
                </div>
              </div>

              <h1 className="mb-1.5 text-center text-[26px] font-semibold tracking-tight text-slate-900">Welcome back</h1>
              <p className="mb-7 text-center text-sm leading-6 text-slate-500">Track your submissions & progress</p>

              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="login-full-name" className="mb-1.5 block text-[13px] font-medium text-slate-900">Full Name</label>
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="login-full-name"
                      type="text"
                      value={loginNameInput}
                      onChange={(e) => {
                        setLoginNameInput(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="Your full name"
                      autoComplete="username"
                      required
                      className="h-[46px] w-full rounded-xl border border-slate-200 bg-[#fbfcfe] pl-10 pr-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-medium text-slate-900">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="login-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => {
                        setLoginPassword(e.target.value);
                        if (loginError) setLoginError('');
                      }}
                      placeholder="Access key"
                      autoComplete="current-password"
                      required
                      className="wamo-password-input h-[46px] w-full rounded-xl border border-slate-200 bg-[#fbfcfe] pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((value) => !value)}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-900/5 hover:text-slate-900"
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      key="login-error"
                      initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-600">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        {loginError}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={isLoggingIn || usersLoading}
                  whileTap={{ scale: 0.99 }}
                  className="mt-3 inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold tracking-[0.005em] text-white shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_1px_2px_rgba(37,99,235,0.25),0_6px_18px_-6px_rgba(37,99,235,0.55)] transition hover:bg-blue-700 active:translate-y-px disabled:cursor-progress disabled:opacity-70"
                >
                  {isLoggingIn ? (
                    <>
                      <motion.span
                        className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                      />
                      <span>Signing in</span>
                    </>
                  ) : (
                    <>
                      <span>{usersLoading ? 'Loading users' : 'Sign in'}</span>
                      {!usersLoading && <ArrowRight className="h-4 w-4" />}
                    </>
                  )}
                </motion.button>

              </form>

              {usersError && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700">
                  User list could not load. Please refresh and try again.
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center overflow-hidden relative font-sans" style={{ background: '#0b1120' }}>

        {/* Dot grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Radial vignette — draws eye to center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 20%, rgba(0,0,0,0.55) 100%)' }}
        />

        {/* Subtle indigo center bloom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 55% 50% at 50% 52%, rgba(79,70,229,0.07) 0%, transparent 100%)' }}
        />

        {/* Slow horizontal scan line — "system active" signal */}
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.35) 50%, transparent 100%)' }}
          initial={{ top: '108%' }}
          animate={{ top: '-8%' }}
          transition={{ duration: 55, repeat: Infinity, ease: 'linear', repeatDelay: 18 }}
        />

        {/* Main content */}
        <div className="relative z-10 w-full max-w-[400px] px-6">

          {/* Brand header — above the card */}
          <motion.div
            className="text-center mb-7"
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-4 h-px bg-indigo-500/70" />
              <span className="text-[10px] font-mono text-indigo-400/80 uppercase tracking-[0.28em]">Competition Management System</span>
              <div className="w-4 h-px bg-indigo-500/70" />
            </div>
            <h1 className="text-[52px] font-black text-white tracking-tighter leading-none select-none">
              WAMO
            </h1>
          </motion.div>

          {/* Login card */}
          <motion.div
            className="bg-white rounded-xl overflow-hidden"
            style={{ boxShadow: '0 48px 80px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)' }}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            {/* Indigo accent stripe */}
            <div style={{ height: '2px', background: 'linear-gradient(90deg, #4f46e5 0%, #818cf8 100%)' }} />

            <div className="p-8">

              {/* Card heading */}
              <motion.div
                className="mb-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28, duration: 0.35 }}
              >
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Sign in</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">Enter your credentials to continue</p>
              </motion.div>

              <form onSubmit={handleLogin} className="space-y-4">

                {/* Name input */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.34, duration: 0.35 }}
                >
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                    Full Name
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-150 pointer-events-none">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={loginNameInput}
                      onChange={(e) => setLoginNameInput(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all duration-150"
                    />
                  </div>
                </motion.div>

                {/* Password input */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.41, duration: 0.35 }}
                >
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">
                    Password
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-150 pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Access key"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono placeholder:font-sans placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all duration-150"
                    />
                  </div>
                </motion.div>

                {/* Error message */}
                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      key="login-error"
                      initial={{ opacity: 0, y: -4, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 text-red-600 text-[12px] font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {loginError}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.48, duration: 0.35 }}
                  className="pt-1"
                >
                  <motion.button
                    type="submit"
                    disabled={isLoggingIn}
                    whileHover={{ scale: 1.012 }}
                    whileTap={{ scale: 0.982 }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-sm font-semibold rounded-lg transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoggingIn ? (
                      <motion.div
                        className="w-[18px] h-[18px] border-2 border-white/20 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
                      />
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </motion.button>
                </motion.div>

                {/* Divider */}
                <div className="flex items-center gap-3 py-0.5">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[11px] text-slate-400 select-none">or</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Guest login */}
                <motion.button
                  type="button"
                  onClick={handleGuestLogin}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55, duration: 0.35 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-2.5 text-[13px] text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg font-medium transition-all duration-150"
                >
                  Continue as Guest
                </motion.button>

              </form>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div
            className="text-center mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.72, duration: 0.4 }}
          >
            <span className="text-[10px] font-mono tracking-[0.22em] uppercase" style={{ color: 'rgba(255,255,255,0.14)' }}>
              WAMO System · v3.2
            </span>
          </motion.div>

        </div>
      </div>
    );
  }

  const activeQuota = getActiveQuota();
  const difficultyValue = parseDifficultyValue(difficulty);
  const isDifficultyValid = difficultyValue !== null && difficultyValue >= DIFFICULTY_MIN && difficultyValue <= DIFFICULTY_MAX;
  const difficultyLabel = getDifficultyLabel(difficulty);
  // Get override or default
  const submissionTarget = currentUser.customTargets?.[activeQuotaId] || activeQuota.target;
  // Vote target is currently global per quota
  const voteTarget = activeQuota.voteTarget ?? 3;

  // Count only off-waitlist problems for quota progress.
  const submissionCount = problems.filter(p => p.authorId === currentUser.id && p.quotaId === activeQuotaId && isOffWaitlist(p)).length;
  // Count votes (Strictly for active quota)
  const userVoteCount = problems.filter(p => p.quotaId === activeQuotaId && p.votedBy?.includes(currentUser.id)).length;

  const subPercent = Math.min((submissionCount / submissionTarget) * 100, 100);
  const votePercent = Math.min((userVoteCount / voteTarget) * 100, 100);
  
  const isDirector = currentUser.role === 'admin' || currentUser.role === 'director';
  const isGuest = currentUser.role === 'guest';

  // Quota eligibility derived state
  const myFormalQuotas = quotas.filter(q => q.quotaType === 'formal' && canCurrentUserUseQuota(q));
  const generalQuota = quotas.find(q => q.quotaType === 'general' && canCurrentUserUseQuota(q)) ?? null;
  const eligibleQuotas = [...myFormalQuotas, ...(generalQuota ? [generalQuota] : [])];

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
  const unreadNotifCount = notifications.filter(n => !n.readAt).length;
  const poolBaseProblems = problems.filter(p => p.status === 'approved' || p.status === 'accepted');
  const poolCountsByQuota = poolBaseProblems.reduce<Record<string, number>>((acc, p) => {
    acc[p.quotaId] = (acc[p.quotaId] || 0) + 1;
    return acc;
  }, {});
  const selectedPoolQuotaName = poolFilterQuota === 'All'
    ? 'all cycles'
    : quotas.find(q => q.id === poolFilterQuota)?.name || 'selected cycle';
  const selectedPoolQuotaBaseCount = poolFilterQuota === 'All'
    ? poolBaseProblems.length
    : poolCountsByQuota[poolFilterQuota] || 0;
  const poolDiffMin = poolFilterDiffMin === '' ? DIFFICULTY_MIN : (parseFloat(poolFilterDiffMin) || DIFFICULTY_MIN);
  const poolDiffMax = poolFilterDiffMax === '' ? DIFFICULTY_MAX : (parseFloat(poolFilterDiffMax) || DIFFICULTY_MAX);
  const filteredPoolProblems = [...problems]
    .filter(p => p.status === 'approved' || p.status === 'accepted')
    .filter(p => poolFilterQuota === 'All' || p.quotaId === poolFilterQuota)
    .filter(p => poolFilterTopic === 'All' || (p.topics && p.topics.includes(poolFilterTopic as Topic)))
    .filter(p => poolFilterStatus === 'All' || (p.status || 'pending') === poolFilterStatus)
    .filter(p => {
      const d = clampDifficultyNumber(p.difficulty);
      return d >= poolDiffMin && d <= poolDiffMax;
    })
    .sort((a, b) => {
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      const diffA = clampDifficultyNumber(a.difficulty);
      const diffB = clampDifficultyNumber(b.difficulty);
      switch (poolSort) {
        case 'highest': return scoreB - scoreA;
        case 'lowest': return scoreA - scoreB;
        case 'hardest': return diffB - diffA;
        case 'easiest': return diffA - diffB;
        case 'newest': return b.createdAt - a.createdAt;
        default: return 0;
      }
    });
  const currentUserContributions = [
    ...problems.filter(p => p.authorId === currentUser.id),
    ...deletedProblems.filter(p => p.authorId === currentUser.id)
  ]
    .filter(p => contributionFilterQuota === 'All' || p.quotaId === contributionFilterQuota)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="h-screen overflow-hidden bg-[#F8F9FA] text-slate-900 flex font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <ToastViewport />
      {renderDifficultyGuideModal()}
      
      {/* Sidebar Navigation */}
      <aside className="z-30 flex h-screen w-56 shrink-0 flex-col bg-white border-r border-slate-200 shadow-sm">
        <div className="shrink-0 px-4 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-white">
                <BookOpen className="w-3.5 h-3.5" strokeWidth={2.5} />
            </div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                WAMO<span className="text-slate-400 font-medium">Tracker</span>
            </h2>
        </div>
        
        <nav className="flex-1 min-h-0 p-2.5 space-y-0.5 overflow-y-auto custom-scrollbar">
          {!isGuest && (
              <NavItem
                icon={<LayoutDashboard />}
                label="Overview"
                active={view === 'dashboard'}
                onClick={() => setView('dashboard')}
                badge={unreadNotifCount > 0 ? unreadNotifCount : undefined}
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
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2 mb-1.5">Director</p>
              <div className="space-y-0.5">
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

        <div className="shrink-0 p-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <Avatar name={currentUser.name} size="md" />
            <div className="flex-1 min-w-0">
               <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{currentUser.name}</p>
               <p className="text-[10px] text-slate-400 capitalize leading-tight">{currentUser.role}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="w-full text-xs h-7 justify-start pl-1 text-slate-400 hover:text-red-600 hover:bg-red-50">
             <LogOut className="w-3 h-3 mr-1.5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto custom-scrollbar relative p-5 md:p-8 bg-[#F8F9FA]">
        <div className="max-w-7xl mx-auto">
        
        {/* VIEW: WAITLIST */}
        {view === 'waitlist' && isDirector && !isGuest && (
            <motion.div variants={containerVar} initial="hidden" animate="show" className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-end pb-4 border-b border-slate-200">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Waitlist Queue</h1>
                        <p className="text-slate-500 text-sm mt-1">Review pending submissions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setWaitlistTab('pending')}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${waitlistTab === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                        >
                            Pending · {pendingCount}
                        </button>
                        <button
                            onClick={() => setWaitlistTab('deleted')}
                            className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${waitlistTab === 'deleted' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                        >
                            Deleted · {deletedProblems.length}
                        </button>
                    </div>
                </div>

                {/* Always keep both sections mounted; toggle visibility with CSS to avoid remount flicker */}
                <div className={waitlistTab === 'pending' ? '' : 'hidden'}>
                    {pendingCount > 0 ? (
                        <div className="grid gap-4">
                            {problems.filter(p => p.status === 'pending').map(p => (
                                <div key={p.id}>
                                    <WaitlistProblemCard p={p} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center flex flex-col items-center shadow-sm">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 border border-emerald-100">
                                <CheckCircle className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">Queue Cleared</h3>
                            <p className="text-slate-400 text-sm mt-1">All submissions have been processed.</p>
                        </div>
                    )}
                </div>

                <div className={waitlistTab === 'deleted' ? '' : 'hidden'}>
                    {deletedProblems.length > 0 ? (
                        <div className="grid gap-4">
                            {deletedProblems.map(p => (
                                <div key={p.id} className="rounded-xl overflow-hidden border border-red-200/70 shadow-sm">
                                    <div className="bg-red-50/80 px-4 py-2 border-b border-red-100 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 text-xs text-red-700 flex-wrap min-w-0">
                                            <span className="flex items-center gap-1 font-bold bg-red-100 px-1.5 py-0.5 rounded border border-red-200 shrink-0">
                                                <Trash2 className="w-3 h-3" /> Deleted
                                            </span>
                                            <span className="shrink-0">by <span className="font-semibold">{p.deletedByName || '—'}</span></span>
                                            {p.deletedAt && <span className="text-red-500 shrink-0">{new Date(p.deletedAt).toLocaleDateString()}</span>}
                                            {p.deletionReason && <span className="italic text-red-600 truncate">"{p.deletionReason}"</span>}
                                        </div>
                                        <button
                                            onClick={() => handleRestoreProblem(p)}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-1 bg-white border border-red-200 rounded-lg text-xs font-bold text-red-700 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 transition-colors"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Restore
                                        </button>
                                    </div>
                                    <ProblemCard
                                        problem={{ ...p, status: 'pending', roundIds: [], roundId: undefined }}
                                        showAuthor={true}
                                        currentUserId={currentUser!.id}
                                        currentUserRole={currentUser!.role}
                                        onUpvote={() => {}}
                                        onEdit={() => {}}
                                        votingPower={currentUser!.votingPower}
                                        readOnly={true}
                                        className="rounded-t-none border-0 shadow-none hover:shadow-none"
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center flex flex-col items-center shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                <Trash2 className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">No Deleted Problems</h3>
                            <p className="text-slate-400 text-sm mt-1">Problems you remove will appear here for recovery.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        )}

        {/* VIEW: DASHBOARD (BENTO GRID) */}
        {view === 'dashboard' && !isGuest && (
          <motion.div variants={containerVar} initial="hidden" animate="show" className="grid grid-cols-12 gap-4">
             {/* Header */}
             <div className="col-span-12 mb-2">
                <motion.h1 variants={itemVar} className="text-2xl font-bold text-slate-900 tracking-tight">
                  Dashboard
                </motion.h1>
             </div>

             {/* My Quotas Grid */}
             <div className="col-span-12">
               <motion.div variants={itemVar}>
                 <div className="flex items-center justify-between mb-3">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">My Quotas</span>
                   {isDirector && (
                     <button onClick={() => setView('admin')} className="text-xs text-indigo-600 hover:underline font-medium">Manage →</button>
                   )}
                 </div>

                 {myFormalQuotas.length === 0 && !generalQuota ? (
                   <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
                     <p className="text-slate-400 text-sm">No quotas assigned yet.</p>
                     {isDirector && (
                       <button onClick={() => setView('admin')} className="mt-2 text-indigo-600 text-xs font-bold hover:underline">Set up quotas →</button>
                     )}
                   </div>
                 ) : (
                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {myFormalQuotas.map(q => {
                       const myCount = problems.filter(p => p.authorId === currentUser.id && p.quotaId === q.id && isOffWaitlist(p)).length;
                       const myTarget = currentUser.customTargets?.[q.id] || q.target;
                       const pct = myTarget > 0 ? Math.min((myCount / myTarget) * 100, 100) : 0;
                       const myVotes = problems.filter(p => p.quotaId === q.id && p.votedBy?.includes(currentUser.id)).length;
                       const votePct = q.voteTarget > 0 ? Math.min((myVotes / q.voteTarget) * 100, 100) : 0;
                       const isActive = activeQuotaId === q.id;
                       let statusLabel = 'Not started';
                       let statusCls = 'text-slate-400 bg-slate-50 border-slate-200';
                       if (myCount > 0 && myCount < myTarget) { statusLabel = 'In progress'; statusCls = 'text-indigo-600 bg-indigo-50 border-indigo-200'; }
                       if (myTarget > 0 && myCount >= myTarget) { statusLabel = 'Complete'; statusCls = 'text-emerald-600 bg-emerald-50 border-emerald-200'; }
                       if (myTarget > 0 && myCount > myTarget) { statusLabel = 'Exceeded'; statusCls = 'text-purple-600 bg-purple-50 border-purple-200'; }
                       return (
                         <div
                           key={q.id}
                           onClick={() => switchQuota(q.id)}
                           className={`bg-white border rounded-xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md ${isActive ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-200'}`}
                         >
                           <div className="flex justify-between items-start mb-2">
                             <h4 className="font-bold text-slate-900 text-sm leading-tight flex-1 truncate mr-2">{q.name}</h4>
                             <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${statusCls}`}>{statusLabel}</span>
                           </div>
                           {q.instructions && <p className="text-[11px] text-slate-400 mb-3 line-clamp-1">{q.instructions}</p>}
                           {q.dueDate && (
                             <div className="flex items-center gap-1 text-[10px] text-amber-600 mb-3">
                               <Clock className="w-3 h-3" /> {getFormatDate(q.dueDate)}
                             </div>
                           )}
                           <div className="space-y-2">
                             <div>
                               <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase mb-1">
                                 <span>Submissions</span><span>{myCount} / {myTarget}</span>
                               </div>
                               <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                 <div className={`h-full rounded-full transition-all duration-500 ${myTarget > 0 && myCount >= myTarget ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                               </div>
                             </div>
                             {q.voteTarget > 0 && (
                               <div>
                                 <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase mb-1">
                                   <span>Votes</span><span>{myVotes} / {q.voteTarget}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${votePct}%` }} />
                                 </div>
                               </div>
                             )}
                           </div>
                         </div>
                       );
                     })}

                     {generalQuota && (
                       <div
                         className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-5 shadow-sm cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between"
                         onClick={() => { setSelectedSubmissionQuotaId(generalQuota.id); resetForm(); setView('submit'); }}
                       >
                         <div>
                           <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center mb-3">
                             <FolderOpen className="w-4 h-4 text-slate-500" />
                           </div>
                           <h4 className="font-bold text-slate-700 text-sm">{generalQuota.name}</h4>
                           <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{generalQuota.instructions || 'Free submissions — no quota required.'}</p>
                         </div>
                         <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                           {problems.filter(p => p.authorId === currentUser.id && p.quotaId === generalQuota.id).length} submitted
                         </div>
                       </div>
                     )}
                   </div>
                 )}
               </motion.div>
             </div>

             {/* Updates / Notifications */}
             <div className="col-span-12 mt-4">
               <motion.div variants={itemVar}>
                 <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2.5">
                     <h3 className="text-lg font-bold text-slate-800">Updates</h3>
                     {unreadNotifCount > 0 && (
                       <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                         {unreadNotifCount} new
                       </span>
                     )}
                   </div>
                   {unreadNotifCount > 0 && (
                     <button
                       onClick={handleMarkAllRead}
                       className="text-xs text-indigo-600 hover:underline font-medium"
                     >
                       Mark all read
                     </button>
                   )}
                 </div>

                 {notificationsLoading ? (
                   <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-slate-400 text-sm shadow-sm">
                     Loading updates...
                   </div>
                 ) : notifications.length === 0 ? (
                   <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-start gap-3">
                     <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                       <Activity className="w-4 h-4 text-slate-400" />
                     </div>
                     <div>
                       <p className="text-sm font-medium text-slate-600">No updates yet</p>
                       <p className="text-xs text-slate-400 mt-0.5">Approvals, round changes, and comments on your problems will appear here.</p>
                     </div>
                   </div>
                 ) : (
                   <div className="space-y-2">
                     {notifications.slice(0, 5).map(notif => (
                       <NotificationItem key={notif.id} notif={notif} />
                     ))}
                     {notifications.length > 5 && (
                       <p className="text-center text-xs text-slate-400 pt-1">
                         +{notifications.length - 5} older updates
                       </p>
                     )}
                   </div>
                 )}
               </motion.div>
             </div>

             {/* User's Problems List */}
             <div className="col-span-12 mt-4">
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-3">
                     <h3 className="text-lg font-bold text-slate-800">Your Contributions</h3>
                     {eligibleQuotas.length > 1 && (
                       <select
                         className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 outline-none"
                         value={contributionFilterQuota}
                         onChange={e => setContributionFilterQuota(e.target.value)}
                       >
                         <option value="All">All quotas</option>
                         {myFormalQuotas.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                         {generalQuota && <option value={generalQuota.id}>{generalQuota.name}</option>}
                       </select>
                     )}
                   </div>
                    <Button size="sm" variant="ghost" onClick={() => { resetForm(); setView('submit'); }} className="text-xs">
                       <PlusCircle className="w-3.5 h-3.5" /> Create New
                    </Button>
                 </div>

                 <div className="grid gap-4">
                    <AnimatePresence>
                    {currentUserContributions.length > 0 ? (
                        currentUserContributions.map(p => (
                            p.deletedAt ? (
                                <div key={p.id} className="rounded-xl overflow-hidden border border-red-200/70 shadow-sm opacity-80">
                                    <div className="bg-red-50/80 px-3 py-1.5 border-b border-red-100 flex items-center gap-3">
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                                            <Trash2 className="w-3 h-3" /> Deleted
                                        </span>
                                        {p.deletedAt && <span className="text-[10px] text-red-500">{new Date(p.deletedAt).toLocaleDateString()}</span>}
                                        {p.deletionReason && <span className="text-[10px] text-red-600 italic truncate">"{p.deletionReason}"</span>}
                                    </div>
                                    <ProblemCard
                                        problem={{ ...p, status: 'pending', roundIds: [], roundId: undefined }}
                                        quotaName={quotas.find(q => q.id === p.quotaId)?.name || 'Unknown cycle'}
                                        showAuthor={true}
                                        currentUserId={currentUser.id}
                                        currentUserRole={currentUser.role}
                                        onUpvote={() => {}}
                                        onEdit={() => {}}
                                        votingPower={currentUser.votingPower}
                                        readOnly={true}
                                        className="rounded-t-none border-0 shadow-none hover:shadow-none"
                                    />
                                </div>
                            ) : (
                                <ProblemCard
                                    key={p.id}
                                    problem={p}
                                    roundName={rounds.find(r => p.roundIds?.includes(r.id))?.name}
                                    quotaName={quotas.find(q => q.id === p.quotaId)?.name || 'Unknown cycle'}
                                    showAuthor={true}
                                    currentUserId={currentUser.id}
                                    currentUserRole={currentUser.role}
                                    onUpvote={handleToggleVote}
                                    onEdit={handleStartEdit}
                                    onDelete={handleDeleteProblem}
                                    onStatusChange={handleStatusChange}
                                    onCommentPosted={() => showToast({ variant: 'success', title: 'Comment posted', message: 'Your comment was added.' })}
                                    onCommentError={(message) => showToast({ variant: 'error', title: "Couldn't post comment", message })}
                                    votingPower={currentUser.votingPower}
                                    defaultExpanded={false}
                                    showWaitlistBadge={true}
                                />
                            )
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
                        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Round Editor</motion.h1>
                        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }} className="text-slate-500 text-sm">Configure rounds and assign problems.</motion.p>
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
                                  <Button variant="secondary" onClick={cancelCreateRound} className="flex-1">Cancel</Button>
                                   <Button onClick={addRound} disabled={!newRoundName.trim()} className="flex-1">Create</Button>
                                 </div>
                            </div>
                         </motion.div>
                     ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            <motion.button 
                               initial={{ opacity: 0, scale: 0.98 }}
                               animate={{ opacity: 1, scale: 1 }}
                               transition={{ duration: 0.2 }}
                               onClick={() => setIsCreatingRound(true)}
                               className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 h-48 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-colors text-slate-400 hover:text-indigo-600 group"
                            >
                                <PlusCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                <span className="font-semibold text-sm">New Round</span>
                            </motion.button>
                            
                            {rounds.map(r => {
                                const rProbCount = problems.filter(p => p.roundIds && p.roundIds.includes(r.id)).length;
                                return (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2 }}
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
                        </motion.div>
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
                {/* Quota Selector — hidden when editing an existing problem */}
                {!editingProblemId && eligibleQuotas.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Submitting To</label>
                    {eligibleQuotas.length === 1 ? (
                      <div className="px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 flex items-center gap-2">
                        {eligibleQuotas[0].quotaType === 'general'
                          ? <FolderOpen className="w-4 h-4 text-slate-400" />
                          : <Target className="w-4 h-4 text-indigo-500" />}
                        {eligibleQuotas[0].name}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {eligibleQuotas.map(q => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => setSelectedSubmissionQuotaId(q.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center gap-1.5 ${
                              selectedSubmissionQuotaId === q.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            {q.quotaType === 'general'
                              ? <FolderOpen className="w-3.5 h-3.5" />
                              : <Target className="w-3.5 h-3.5" />}
                            {q.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                        <div className="flex items-center gap-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Difficulty</label>
                            <button type="button" onClick={() => setShowRatingScale(true)} className="text-xs text-indigo-600 hover:underline font-bold flex items-center gap-1">
                                <Info className="w-3.5 h-3.5" /> Open Scale Guide
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            <input 
                                type="number" 
                                step="0.1"
                                min={DIFFICULTY_MIN}
                                max="10"
                                value={difficulty}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  const parsed = parseDifficultyValue(next);
                                  if (parsed !== null && parsed > DIFFICULTY_MAX) {
                                    setDifficulty(DIFFICULTY_MAX.toFixed(1));
                                  } else {
                                    setDifficulty(next);
                                  }
                                }}
                                onBlur={() => {
                                  const normalized = normalizeDifficultyValue(difficulty);
                                  if (normalized) setDifficulty(normalized);
                                }}
                                className={`w-24 px-4 py-3 bg-white rounded-lg border focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-lg font-bold font-mono text-center ${difficulty && !isDifficultyValid ? 'border-red-300' : 'border-slate-200'}`}
                            />
                            <span className={`max-w-full px-2.5 py-1 rounded-lg border text-xs font-bold leading-5 ${isDifficultyValid ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                              {difficultyLabel}
                            </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick set</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DIFFICULTY_QUICK_VALUES.map(value => {
                              const label = value.toFixed(1);
                              const isActive = normalizeDifficultyValue(difficulty) === label;
                              return (
                                <button
                                  key={label}
                                  type="button"
                                  onClick={() => setDifficulty(label)}
                                  className={`px-2.5 py-1 rounded-md border text-[11px] font-bold transition-all ${
                                    isActive
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Topics</label>
                        <div className="flex flex-wrap gap-2">
                            {TOPICS.map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    title={t}
                                    onClick={() => handleTopicToggle(t)}
                                    className={`grid h-9 w-9 place-items-center rounded-full text-sm font-black border transition-all ${
                                        selectedTopics.includes(t) 
                                        ? `${TOPIC_CHIP_CLASSES[t]} ring-2 ring-offset-1 ring-indigo-100` 
                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                    }`}
                                >
                                    {TOPIC_LABELS[t]}
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
                         <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={4} className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-serif text-slate-700 text-sm" placeholder="Proof sketch..."/>
                     </div>
                     <div className="space-y-2">
                         <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Answer Key</label>
                         <input type="text" value={answerKey} onChange={e => setAnswerKey(e.target.value)} className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-mono text-sm" placeholder="e.g. 42"/>
                     </div>
                </div>

                {/* Live Preview */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Preview</span>
                  <ProblemCard
                    problem={{
                      id: 'preview',
                      authorId: currentUser!.id,
                      authorName: currentUser!.name,
                      quotaId: selectedSubmissionQuotaId || activeQuotaId,
                      title: title || 'Untitled',
                      statement: statement || '...',
                      solution: solution || undefined,
                      answerKey: answerKey || undefined,
                      imageData: imageData ?? undefined,
                      difficulty: difficultyValue ?? 0,
                      topics: selectedTopics,
                      createdAt: Date.now(),
                      score: 0,
                      votedBy: [],
                      status: 'pending',
                      orderIndex: 0,
                      version: 1,
                      commentCount: 0,
                    }}
                    showAuthor={true}
                    currentUserId={currentUser!.id}
                    currentUserRole={currentUser!.role}
                    onUpvote={() => {}}
                    onEdit={() => {}}
                    votingPower={currentUser!.votingPower}
                    readOnly={true}
                    defaultExpanded={false}
                  />
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
                  disabled={!title || !statement || !isVerified || !isDifficultyValid}
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
                    onChange={(e) => handlePoolQuotaFilterChange(e.target.value)}
                >
                    <option value="All">All Cycles ({poolBaseProblems.length})</option>
                    {quotas.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.name} ({poolCountsByQuota[q.id] || 0})
                      </option>
                    ))}
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
                    <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Diff</span>
                    <input
                        type="number"
                        placeholder="Min"
                        value={poolFilterDiffMin}
                        onChange={e => setPoolFilterDiffMin(e.target.value)}
                        onBlur={e => {
                            const val = e.target.value.trim();
                            if (val === '') { setPoolFilterDiffMin(''); return; }
                            const n = Math.min(Math.max(parseFloat(val), DIFFICULTY_MIN), DIFFICULTY_MAX);
                            const normalized = n.toFixed(1);
                            const curMax = poolFilterDiffMax === '' ? DIFFICULTY_MAX : parseFloat(poolFilterDiffMax) || DIFFICULTY_MAX;
                            setPoolFilterDiffMin(n > curMax ? curMax.toFixed(1) : normalized);
                        }}
                        className="w-14 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400 text-center"
                        aria-label="Minimum difficulty"
                    />
                    <span className="text-slate-400 text-xs">–</span>
                    <input
                        type="number"
                        placeholder="Max"
                        value={poolFilterDiffMax}
                        onChange={e => setPoolFilterDiffMax(e.target.value)}
                        onBlur={e => {
                            const val = e.target.value.trim();
                            if (val === '') { setPoolFilterDiffMax(''); return; }
                            const n = Math.min(Math.max(parseFloat(val), DIFFICULTY_MIN), DIFFICULTY_MAX);
                            const normalized = n.toFixed(1);
                            const curMin = poolFilterDiffMin === '' ? DIFFICULTY_MIN : parseFloat(poolFilterDiffMin) || DIFFICULTY_MIN;
                            setPoolFilterDiffMax(n < curMin ? curMin.toFixed(1) : normalized);
                        }}
                        className="w-14 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400 text-center"
                        aria-label="Maximum difficulty"
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
              {filteredPoolProblems.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                   <p className="text-slate-400 text-sm font-medium">
                    {selectedPoolQuotaBaseCount > 0
                      ? `No problems in ${selectedPoolQuotaName} match the active topic/status/difficulty filters.`
                      : `No approved problems found in ${selectedPoolQuotaName}.`}
                   </p>
                   <button
                     type="button"
                     onClick={clearPoolFilters}
                     className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-indigo-200 hover:text-indigo-600"
                   >
                     Clear filters
                   </button>
                </div>
              ) : (
                filteredPoolProblems.map(p => {
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                    >
                      <ProblemCard 
                        problem={p} 
                        roundName={rounds.find(r => p.roundIds?.includes(r.id))?.name}
                        quotaName={quotas.find(q => q.id === p.quotaId)?.name || 'Unknown cycle'}
                        showAuthor={p.authorId === currentUser.id} 
                        currentUserId={currentUser.id}
                        currentUserRole={currentUser.role}
                        onUpvote={handleToggleVote}
                        onEdit={handleStartEdit}
                        onDelete={handleDeleteProblem}
                        onStatusChange={handleStatusChange}
                        onCommentPosted={() => showToast({ variant: 'success', title: 'Comment posted', message: 'Your comment was added.' })}
                        onCommentError={(message) => showToast({ variant: 'error', title: "Couldn't post comment", message })}
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
             
             {/* ── QUOTA MANAGER ── */}
             <motion.div variants={itemVar} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                   <Activity className="w-4 h-4 text-indigo-500" /> Quota Manager
                 </h3>
                 <Button size="sm" onClick={() => { setIsCreatingQuota(true); setExpandedQuotaProgressId(null); }} className="gap-1.5 text-xs">
                   <PlusCircle className="w-3.5 h-3.5" /> New Quota
                 </Button>
               </div>

               {/* Create new quota form */}
               {isCreatingQuota && (
                 <div className="p-5 border-b border-slate-100 bg-slate-50/60 space-y-4">
                   <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Create Quota</h4>
                   <div className="grid md:grid-cols-2 gap-4">
                     <input className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-indigo-500" placeholder="Quota name" value={newQuotaForm.name || ''} onChange={e => setNewQuotaForm({...newQuotaForm, name: e.target.value})} />
                     <input className="p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:border-indigo-500" placeholder="Instructions (optional)" value={newQuotaForm.instructions || ''} onChange={e => setNewQuotaForm({...newQuotaForm, instructions: e.target.value})} />
                   </div>
                   {/* Type selector */}
                   <div className="flex gap-2">
                     <span className="text-[10px] font-bold text-slate-400 uppercase self-center mr-1">Type</span>
                     {(['formal', 'general'] as QuotaType[]).map(t => (
                       <button key={t} type="button" onClick={() => setNewQuotaForm({...newQuotaForm, quotaType: t})}
                         className={`px-3 py-1.5 text-xs font-bold rounded border capitalize ${newQuotaForm.quotaType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                         {t}
                       </button>
                     ))}
                   </div>
                   {newQuotaForm.quotaType === 'formal' && (
                     <>
                       {/* Assignment mode */}
                       <div className="flex gap-2 items-center">
                         <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Assign</span>
                         {(['global', 'selected'] as AssignmentMode[]).map(m => (
                           <button key={m} type="button" onClick={() => setNewQuotaForm({...newQuotaForm, assignmentMode: m, assignedUserIds: []})}
                             className={`px-3 py-1.5 text-xs font-bold rounded border ${newQuotaForm.assignmentMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                             {m === 'global' ? 'Everyone' : 'Selected Users'}
                           </button>
                         ))}
                       </div>
                       {newQuotaForm.assignmentMode === 'selected' && (
                         <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg max-h-36 overflow-y-auto custom-scrollbar">
                           {users.filter(u => u.role !== 'guest').map(u => {
                             const checked = newQuotaForm.assignedUserIds?.includes(u.id) ?? false;
                             return (
                               <label key={u.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition-all ${checked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                 <input type="checkbox" checked={checked} onChange={() => {
                                   const ids = newQuotaForm.assignedUserIds || [];
                                   setNewQuotaForm({...newQuotaForm, assignedUserIds: checked ? ids.filter(i => i !== u.id) : [...ids, u.id]});
                                 }} className="accent-indigo-600 w-3 h-3" />
                                 {u.name}
                               </label>
                             );
                           })}
                         </div>
                       )}
                       <div className="flex gap-3">
                         <div>
                           <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Sub Target</label>
                           <input type="number" min="0" className="w-16 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none text-center font-mono" value={newQuotaForm.target ?? 5} onChange={e => setNewQuotaForm({...newQuotaForm, target: parseInt(e.target.value)})} />
                         </div>
                         <div>
                           <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Vote Target</label>
                           <input type="number" min="0" className="w-16 p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none text-center font-mono" value={newQuotaForm.voteTarget ?? 3} onChange={e => setNewQuotaForm({...newQuotaForm, voteTarget: parseInt(e.target.value)})} />
                         </div>
                         <div className="flex-1">
                           <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Due Date</label>
                           <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white outline-none" value={newQuotaForm.dueDate ? new Date(newQuotaForm.dueDate).toISOString().split('T')[0] : ''} onChange={e => setNewQuotaForm({...newQuotaForm, dueDate: e.target.valueAsNumber || null})} />
                         </div>
                       </div>
                     </>
                   )}
                   <div className="flex justify-end gap-2 pt-1">
                     <Button size="sm" variant="ghost" onClick={() => setIsCreatingQuota(false)}>Cancel</Button>
                     <Button size="sm" onClick={createNewQuota} disabled={!newQuotaForm.name?.trim()}>Create Quota</Button>
                   </div>
                 </div>
               )}

               {/* Quota list */}
               <div className="divide-y divide-slate-100">
                 {quotas.length === 0 && (
                   <div className="p-8 text-center text-slate-400 text-sm">No quotas yet.</div>
                 )}
                 {quotas.map(q => {
                   const isEdit = editingQuotaId === q.id;
                   const isExpanded = expandedQuotaProgressId === q.id;
                   const progressData = isExpanded ? getQuotaProgressData(q) : [];
                   const totalAssigned = q.assignmentMode === 'global'
                     ? users.filter(u => u.role !== 'guest').length
                     : (q.assignedUserIds?.length || 0);
                   const totalSubmitted = problems.filter(p => p.quotaId === q.id && isOffWaitlist(p)).length;
                   return (
                     <div key={q.id}>
                       {isEdit ? (
                         <div className="p-5 bg-slate-50 space-y-3">
                           <div className="grid md:grid-cols-2 gap-3">
                             <input className="p-2 border border-indigo-200 rounded text-sm outline-none bg-white" value={editQuotaForm.name || ''} onChange={e => setEditQuotaForm({...editQuotaForm, name: e.target.value})} placeholder="Name" />
                             <input className="p-2 border border-indigo-200 rounded text-sm outline-none bg-white" value={editQuotaForm.instructions || ''} onChange={e => setEditQuotaForm({...editQuotaForm, instructions: e.target.value})} placeholder="Instructions" />
                           </div>
                           {/* Type */}
                           <div className="flex gap-2 items-center">
                             <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Type</span>
                             {(['formal', 'general'] as QuotaType[]).map(t => (
                               <button key={t} type="button" onClick={() => setEditQuotaForm({...editQuotaForm, quotaType: t})}
                                 className={`px-3 py-1 text-xs font-bold rounded border capitalize ${editQuotaForm.quotaType === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                                 {t}
                               </button>
                             ))}
                             <label className="ml-auto flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                               <input type="checkbox" checked={editQuotaForm.isEnabled !== false} onChange={e => setEditQuotaForm({...editQuotaForm, isEnabled: e.target.checked})} className="accent-indigo-600" />
                               Enabled
                             </label>
                           </div>
                           {editQuotaForm.quotaType === 'formal' && (
                             <>
                               <div className="flex gap-2 items-center">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Assign</span>
                                 {(['global', 'selected'] as AssignmentMode[]).map(m => (
                                   <button key={m} type="button" onClick={() => setEditQuotaForm({...editQuotaForm, assignmentMode: m, assignedUserIds: []})}
                                     className={`px-3 py-1 text-xs font-bold rounded border ${editQuotaForm.assignmentMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                                     {m === 'global' ? 'Everyone' : 'Selected Users'}
                                   </button>
                                 ))}
                               </div>
                               {editQuotaForm.assignmentMode === 'selected' && (
                                 <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg max-h-36 overflow-y-auto custom-scrollbar">
                                   {users.filter(u => u.role !== 'guest').map(u => {
                                     const checked = editQuotaForm.assignedUserIds?.includes(u.id) ?? false;
                                     return (
                                       <label key={u.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-xs font-medium transition-all ${checked ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                         <input type="checkbox" checked={checked} onChange={() => {
                                           const ids = editQuotaForm.assignedUserIds || [];
                                           setEditQuotaForm({...editQuotaForm, assignedUserIds: checked ? ids.filter(i => i !== u.id) : [...ids, u.id]});
                                         }} className="accent-indigo-600 w-3 h-3" />
                                         {u.name}
                                       </label>
                                     );
                                   })}
                                 </div>
                               )}
                               <div className="flex gap-3">
                                 <div>
                                   <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Sub Target</label>
                                   <input type="number" min="0" className="w-16 p-2 border border-indigo-200 rounded text-sm bg-white outline-none text-center font-mono" value={editQuotaForm.target ?? 5} onChange={e => setEditQuotaForm({...editQuotaForm, target: parseInt(e.target.value)})} />
                                 </div>
                                 <div>
                                   <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Vote Target</label>
                                   <input type="number" min="0" className="w-16 p-2 border border-indigo-200 rounded text-sm bg-white outline-none text-center font-mono" value={editQuotaForm.voteTarget ?? 3} onChange={e => setEditQuotaForm({...editQuotaForm, voteTarget: parseInt(e.target.value)})} />
                                 </div>
                                 <div className="flex-1">
                                   <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Due Date</label>
                                   <input type="date" className="w-full p-2 border border-indigo-200 rounded text-sm bg-white outline-none" value={editQuotaForm.dueDate ? new Date(editQuotaForm.dueDate).toISOString().split('T')[0] : ''} onChange={e => setEditQuotaForm({...editQuotaForm, dueDate: e.target.valueAsNumber || null})} />
                                 </div>
                               </div>
                             </>
                           )}
                           <div className="flex justify-end gap-2">
                             <Button size="sm" variant="ghost" onClick={cancelEditQuota}>Cancel</Button>
                             <Button size="sm" onClick={saveQuota}>Save</Button>
                           </div>
                         </div>
                       ) : (
                         <div className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 flex-wrap">
                               <span className="font-semibold text-slate-900 text-sm">{q.name}</span>
                               <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${q.quotaType === 'general' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
                                 {q.quotaType}
                               </span>
                               <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 uppercase">
                                 {q.assignmentMode === 'global' ? 'Global' : `${q.assignedUserIds?.length || 0} users`}
                               </span>
                               {activeQuotaId === q.id && (
                                 <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold">FOCUSED</span>
                               )}
                               {!q.isEnabled && (
                                 <span className="text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded font-bold">DISABLED</span>
                               )}
                             </div>
                             <div className="text-[10px] text-slate-400 mt-0.5 flex gap-3">
                               {q.quotaType === 'formal' && <span>Target: {q.target} • Votes: {q.voteTarget}</span>}
                               <span>{totalSubmitted} submissions</span>
                               {q.assignmentMode !== 'global' && <span>{totalAssigned} assigned</span>}
                               {q.dueDate && <span className="text-amber-600">Due {getFormatDate(q.dueDate)}</span>}
                             </div>
                           </div>
                           <div className="flex items-center gap-1 shrink-0">
                             <button onClick={() => setExpandedQuotaProgressId(isExpanded ? null : q.id)}
                               className={`p-1.5 rounded transition-colors text-xs font-bold flex items-center gap-1 border ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-600 hover:border-indigo-200'}`}
                               title="View progress">
                               <BarChart2 className="w-3.5 h-3.5" />
                             </button>
                             <button onClick={() => { startEditQuota(q); setExpandedQuotaProgressId(null); }}
                               className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors border border-transparent hover:border-indigo-100"
                               title="Edit quota">
                               <Pencil className="w-3.5 h-3.5" />
                             </button>
                             {activeQuotaId !== q.id && (
                               <button onClick={() => switchQuota(q.id)}
                                 className="text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded border border-transparent hover:border-indigo-100 transition-colors">
                                 FOCUS
                               </button>
                             )}
                           </div>
                         </div>
                       )}

                       {/* Per-user progress view */}
                       {isExpanded && !isEdit && (
                         <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                           <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">
                             User Progress — {q.name}
                           </h5>
                           {progressData.length === 0 ? (
                             <p className="text-xs text-slate-400 italic">No users assigned.</p>
                           ) : (
                             <div className="space-y-2">
                               {progressData.map(({ user: u, submitted, target }) => {
                                 const pct = target > 0 ? Math.min((submitted / target) * 100, 100) : 0;
                                 let badge = 'Not started'; let badgeCls = 'text-slate-400 bg-slate-100';
                                 if (submitted > 0 && submitted < target) { badge = 'In progress'; badgeCls = 'text-indigo-600 bg-indigo-50'; }
                                 if (target > 0 && submitted >= target) { badge = 'Complete'; badgeCls = 'text-emerald-600 bg-emerald-50'; }
                                 if (target > 0 && submitted > target) { badge = 'Exceeded'; badgeCls = 'text-purple-600 bg-purple-50'; }
                                 return (
                                   <div key={u.id} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-slate-100">
                                     <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${u.role === 'admin' ? 'bg-purple-500' : u.role === 'director' ? 'bg-indigo-500' : 'bg-slate-500'}`}>
                                       {u.name.charAt(0)}
                                     </div>
                                     <span className="text-xs font-semibold text-slate-800 w-28 truncate">{u.name}</span>
                                     <div className="flex-1">
                                       <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                         <div className={`h-full rounded-full transition-all ${target > 0 && submitted >= target ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                                       </div>
                                     </div>
                                     <span className="text-[10px] font-mono text-slate-500 w-12 text-right">{submitted}/{target}</span>
                                     <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeCls}`}>{badge}</span>
                                   </div>
                                 );
                               })}
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })}
               </div>
             </motion.div>

             {/* ── NEW USER + USER TABLE row ── */}
             <div className="grid md:grid-cols-2 gap-6">
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
                            {currentUser.role === 'admin' && (
                                <button onClick={() => setNewUserRole('director')} className={`flex-1 py-2 text-xs font-bold rounded border ${newUserRole === 'director' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-500 border-slate-200'}`}>Director</button>
                            )}
                        </div>
                        <Button onClick={addUser} disabled={!newUserName || !newUserPassword} className="w-full">Create Account</Button>
                    </div>
                 </motion.div>

                 {/* Quota Focus Selector (for pool/contributions filtering) */}
                 <motion.div variants={itemVar} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                   <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                     <Target className="w-4 h-4 text-indigo-500" /> Active Focus
                   </h3>
                   <p className="text-xs text-slate-500 mb-3">The focused quota is used for pool filtering and contribution stats.</p>
                   <div className="space-y-2">
                     {quotas.map(q => (
                       <button key={q.id} onClick={() => switchQuota(q.id)}
                         className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${activeQuotaId === q.id ? 'bg-indigo-50 border-indigo-200 text-indigo-800 font-semibold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                         <span className="truncate">{q.name}</span>
                         <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ml-2 shrink-0 ${q.quotaType === 'general' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
                           {q.quotaType}
                         </span>
                       </button>
                     ))}
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
                                const uTarget = u.customTargets?.[activeQuotaId] ?? activeQuota.target;
                                const isAssigned = activeQuota.assignmentMode === 'global' || activeQuota.assignedUserIds?.includes(u.id);
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
                                                        {currentUser.role === 'admin' && <option value="admin">Admin</option>}
                                                    </select>
                                                </div>
                                                ) : (
                                                <div className="flex items-center gap-2">
                                                    <Avatar name={u.name} size="sm" />
                                                    <span className="truncate">{u.name}</span>
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
                                            {isAssigned ? (
                                                <div className="space-y-2">
                                                    <div>
                                                        <div className="flex justify-between text-[8px] font-bold uppercase text-slate-400 mb-0.5"><span>Writing</span> <span>{u.submittedCount}/{uTarget}</span></div>
                                                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="bg-indigo-500 h-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ width: `${uTarget === 0 ? 100 : Math.min((u.submittedCount / uTarget) * 100, 100)}%` }}></div></div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between text-[8px] font-bold uppercase text-slate-400 mb-0.5"><span>Voting</span> <span>{u.voteCount}/{voteTarget}</span></div>
                                                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden shadow-inner"><div className="bg-emerald-500 h-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" style={{ width: `${voteTarget === 0 ? 100 : Math.min(((u.voteCount || 0) / voteTarget) * 100, 100)}%` }}></div></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic">Not assigned quota</span>
                                            )}
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
                                                {currentUser.role === 'admin' && (
                                                    <button
                                                        onClick={() => startEditUser(u)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                                        title="Edit User"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                {currentUser.role === 'admin' && u.role !== 'admin' && (
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
