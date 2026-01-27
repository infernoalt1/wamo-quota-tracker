
export interface ProblemValidation {
  isAcceptable: boolean;
  rejectionReason?: string;
}

export interface Round {
  id: string;
  name: string;
  description: string;
  folder?: string; // New: Grouping mechanism
  createdAt?: number;
}

export interface Quota {
  id: string;
  name: string;
  target: number; // Submission target
  voteTarget: number; // New: Upvote target
  instructions: string;
  dueDate: number | null; // Timestamp
}

export type Topic = 'Algebra' | 'Geometry' | 'Combinatorics' | 'Number Theory';

// Updated Status flow: waitlist -> pending -> accepted
export type ProblemStatus = 'waitlist' | 'pending' | 'accepted';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export interface AssignedRound {
  roundId: string;
  orderIndex: number;
}

export interface Problem {
  id: string;
  authorId: string;
  authorName: string; // Stored for admin, hidden in UI
  quotaId: string;    // Crucial for tracking which submission cycle this belongs to
  // roundId is deprecated in favor of assignedRounds for M:N support, but kept optional for legacy type compat
  roundId?: string;   
  assignedRounds: AssignedRound[]; // New: M:N support
  title: string;
  statement: string;
  solution?: string; // New: Full LaTeX solution
  answerKey?: string; // New: Short answer for grading
  imageData?: string; // Base64 image data
  difficulty: number;
  topics: Topic[];
  createdAt: number;
  score: number;
  votedBy: string[]; // User IDs who have voted
  status: ProblemStatus;
  orderIndex: number; // Deprecated: Use assignedRounds
  version: number; // New: Optimistic concurrency control
  commentCount?: number; // Optional count for UI
}

export interface User {
  id: string;
  name: string;
  password: string; // Stored locally for this app version
  role: 'admin' | 'director' | 'writer' | 'guest';
  submittedCount: number; // Dynamic count based on active quota
  voteCount: number;      // Dynamic count of votes cast in active quota
  votingPower: number;
  customTargets: Record<string, number>; // Map of quotaId -> submission target override
}
