export type QuotaType = 'formal' | 'general';
export type AssignmentMode = 'global' | 'selected';
export type VoteBucket = 'quota_pool' | 'global_pool';

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

  /**
   * Desired number of slots/problems this round should contain.
   * This is the round capacity and must not be confused with problemCount.
   */
  targetSize: number;

  /**
   * Actual number of problems currently assigned to the round, if provided by the backend.
   */
  problemCount?: number;
}

export interface Quota {
  id: string;
  name: string;
  target: number;
  voteTarget: number;
  quotaPoolVoteTarget: number;
  globalPoolVoteTarget: number;
  minVotingPoolSize: number;
  votingEnabled: boolean;
  instructions: string;
  dueDate: number | null;
  quotaType: QuotaType;
  assignmentMode: AssignmentMode;
  isEnabled: boolean;
  assignedUserIds?: string[];
}

export interface VotingBucketProgress {
  completed: number;
  rawCompleted: number;
  required: number;
}

export interface VotingQuotaProgress {
  quota: Quota;
  writingCompleted: number;
  writingRequired: number;
  quotaPool: VotingBucketProgress;
  globalPool: VotingBucketProgress;
  totalCompleted: number;
  totalRawCompleted: number;
  totalRequired: number;
  isComplete: boolean;
}

export interface VotingTriple {
  status: 'ready' | 'blocked' | 'complete';
  quotaId: string;
  bucket: VoteBucket;
  nextBucket: VoteBucket;
  problems: Problem[];
  progress: VotingQuotaProgress;
  eligibleCount?: number;
  minEligible?: number;
  message?: string;
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
  userAvatarUrl?: string | null;
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
  roundOrderIndexes?: Record<string, number>;
  version: number;
  commentCount?: number;
  comparisonAppearances?: number;
  comparisonWins?: number;
  comparisonLosses?: number;
  deletedAt?: number | null;
  deletedBy?: string | null;
  deletedByName?: string | null;
  deletedByAvatarUrl?: string | null;
  deletionReason?: string | null;
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
  avatarUrl?: string | null;
}

export type NotificationType =
  | 'problem_approved'
  | 'problem_returned_to_waitlist'
  | 'problem_added_to_round'
  | 'problem_removed_from_round'
  | 'problem_commented'
  | 'problem_deleted'
  | 'problem_restored'
  | 'problem_edited';

export interface Notification {
  id: string;
  userId: string;
  actorId?: string | null;
  actorName?: string | null;
  actorAvatarUrl?: string | null;
  problemId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  readAt?: number | null;
  createdAt: number;
}
