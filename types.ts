
export type QuotaType = 'formal' | 'general';
export type AssignmentMode = 'global' | 'selected';

export interface ProblemValidation {
  isAcceptable: boolean;
  rejectionReason?: string;
}

export interface Round {
  id: string;
  name: string;
  tag?: string;
  description: string;
  createdAt?: number;
  problemCount?: number;
}

export interface Quota {
  id: string;
  name: string;
  target: number;
  voteTarget: number;
  instructions: string;
  dueDate: number | null;
  // Extended fields
  quotaType: QuotaType;           // 'formal' | 'general'
  assignmentMode: AssignmentMode; // 'global' | 'selected'
  isEnabled: boolean;
  assignedUserIds?: string[];     // populated for admin views
}

export interface QuotaUserProgress {
  userId: string;
  userName: string;
  role: string;
  submittedCount: number;
  target: number;
}

export type Topic = 'Algebra' | 'Geometry' | 'Combinatorics' | 'Number Theory';

export type ProblemStatus = 'pending' | 'approved' | 'accepted';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export interface Problem {
  id: string;
  authorId: string;
  authorName: string;
  quotaId: string;
  roundId?: string;
  roundIds?: string[];
  title: string;
  statement: string;
  solution?: string;
  answerKey?: string;
  imageData?: string;
  difficulty: number;
  topics: Topic[];
  createdAt: number;
  score: number;
  votedBy: string[];
  status: ProblemStatus;
  orderIndex: number;
  version: number;
  commentCount?: number;
}

export interface User {
  id: string;
  name: string;
  password: string;
  role: 'admin' | 'director' | 'writer' | 'guest';
  submittedCount: number;
  voteCount: number;
  votingPower: number;
  customTargets: Record<string, number>;
}
