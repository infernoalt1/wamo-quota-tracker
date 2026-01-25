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

export interface Problem {
  id: string;
  authorId: string;
  authorName: string; // Stored for admin, hidden in UI
  quotaId: string;    // Crucial for tracking which round this belongs to
  title: string;
  statement: string;
  createdAt: number;
  score: number;
  votedBy: string[]; // User IDs who have voted
}

export interface User {
  id: string;
  name: string;
  password: string; // Stored locally for this app version
  role: 'admin' | 'writer';
  submittedCount: number; // Dynamic count based on active quota
  votingPower: number;
  customTargets: Record<string, number>; // Map of quotaId -> target override
}