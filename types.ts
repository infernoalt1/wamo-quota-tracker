export interface ProblemValidation {
  isAcceptable: boolean;
  rejectionReason?: string;
}

export interface Quota {
  id: string;
  name: string;
  target: number;
  instructions: string;
  dueDate: number | null; // Timestamp
}

export type Topic = 'Algebra' | 'Geometry' | 'Combinatorics' | 'Number Theory';

export type ProblemStatus = 'pending' | 'shortlisted' | 'accepted';

export interface Problem {
  id: string;
  authorId: string;
  authorName: string; // Stored for admin, hidden in UI
  quotaId: string;    // Crucial for tracking which round this belongs to
  title: string;
  statement: string;
  difficulty: number;
  topics: Topic[];
  createdAt: number;
  score: number;
  votedBy: string[]; // User IDs who have voted
  status: ProblemStatus;
}

export interface User {
  id: string;
  name: string;
  password: string; // Stored locally for this app version
  role: 'admin' | 'director' | 'writer';
  submittedCount: number; // Dynamic count based on active quota
  votingPower: number;
  customTargets: Record<string, number>; // Map of quotaId -> target override
}