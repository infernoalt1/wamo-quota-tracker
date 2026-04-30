import assert from 'node:assert/strict';

const isEligibleForBucket = (problem, { quotaId, userId, bucket }) => {
  if (problem.deletedAt) return false;
  if (!['approved', 'accepted'].includes(problem.status)) return false;
  if (problem.authorId === userId) return false;
  if (bucket === 'quota_pool') return problem.quotaId === quotaId;
  if (bucket === 'global_pool' && problem.inFinalizedRound) return false;
  if (bucket === 'global_pool') return problem.quotaId !== quotaId;
  return false;
};

const awardComparison = (problem, selected) => ({
  ...problem,
  comparisonAppearances: (problem.comparisonAppearances || 0) + 1,
  comparisonWins: (problem.comparisonWins || 0) + (selected ? 1 : 0),
  comparisonLosses: (problem.comparisonLosses || 0) + (selected ? 0 : 1),
  score: (problem.score || 0) + (selected ? 1 : 0),
});

const hasThreeDistinctProblemIds = problems => problems.length === 3 && new Set(problems.map(p => p.id)).size === 3;

const canFinalizeRound = role => role === 'admin';

const finalizeRound = round => ({ ...round, finalized: true });

const applyProgress = (events, quotaId, userId, required) => {
  const counts = { quota_pool: 0, global_pool: 0 };
  for (const event of events) {
    if (event.quotaId !== quotaId || event.voterId !== userId || event.skipped || !event.valid) continue;
    counts[event.bucket] += 1;
  }
  return {
    quotaPoolCompleted: Math.min(counts.quota_pool, required.quota_pool),
    globalPoolCompleted: Math.min(counts.global_pool, required.global_pool),
    totalCompleted: Math.min(counts.quota_pool, required.quota_pool) + Math.min(counts.global_pool, required.global_pool),
    isComplete: counts.quota_pool >= required.quota_pool && counts.global_pool >= required.global_pool,
  };
};

const quotaId = 'speed';
const otherQuotaId = 'team';
const generalQuotaId = 'general';
const userId = 'writer-1';
const otherUserId = 'writer-2';

const problems = [
  { id: 'own-speed', quotaId, authorId: userId, status: 'approved' },
  { id: 'speed-a', quotaId, authorId: otherUserId, status: 'approved' },
  { id: 'speed-b', quotaId, authorId: 'writer-3', status: 'accepted' },
  { id: 'other-a', quotaId: otherQuotaId, authorId: otherUserId, status: 'approved' },
  { id: 'draft-round-a', quotaId: otherQuotaId, authorId: 'writer-5', status: 'approved', inDraftRound: true },
  { id: 'finalized-round-a', quotaId: otherQuotaId, authorId: 'writer-6', status: 'approved', inFinalizedRound: true },
  { id: 'general-a', quotaId: generalQuotaId, authorId: 'writer-4', status: 'approved' },
  { id: 'deleted', quotaId, authorId: otherUserId, status: 'approved', deletedAt: Date.now() },
  { id: 'pending', quotaId, authorId: otherUserId, status: 'pending' },
];

assert.deepEqual(
  problems.filter(p => isEligibleForBucket(p, { quotaId, userId, bucket: 'quota_pool' })).map(p => p.id),
  ['speed-a', 'speed-b'],
  'quota-pool voting only uses selected-quota, non-owned, active problems'
);

assert.deepEqual(
  problems.filter(p => isEligibleForBucket(p, { quotaId, userId, bucket: 'global_pool' })).map(p => p.id),
  ['other-a', 'draft-round-a', 'general-a'],
  'global-pool voting uses active non-owned problems outside the selected quota, including general submissions and draft-round problems, but excludes finalized-round problems'
);

assert.deepEqual(
  problems.filter(p => isEligibleForBucket(p, { quotaId: otherQuotaId, userId, bucket: 'quota_pool' })).map(p => p.id),
  ['other-a', 'draft-round-a', 'finalized-round-a'],
  'quota-pool voting is not affected by finalized-round status'
);

assert.deepEqual(
  awardComparison({ id: 'speed-a', score: 4, comparisonWins: 2, comparisonLosses: 0, comparisonAppearances: 2 }, true),
  { id: 'speed-a', score: 5, comparisonWins: 3, comparisonLosses: 0, comparisonAppearances: 3 },
  'selected comparison winner receives exactly +1 score/win'
);

assert.equal(hasThreeDistinctProblemIds([{ id: 'a' }, { id: 'b' }, { id: 'c' }]), true);
assert.equal(hasThreeDistinctProblemIds([{ id: 'a' }, { id: 'a' }, { id: 'c' }]), false);

assert.equal(canFinalizeRound('admin'), true, 'admin can finalize a round');
assert.equal(canFinalizeRound('director'), false, 'non-admin director cannot finalize a round');
assert.equal(canFinalizeRound('writer'), false, 'non-admin writer cannot finalize a round');
assert.deepEqual(
  finalizeRound({ id: 'round-1', finalized: false, problemIds: ['a', 'b'] }),
  { id: 'round-1', finalized: true, problemIds: ['a', 'b'] },
  'finalization does not delete or modify round problems'
);

const progress = applyProgress(
  [
    { quotaId, voterId: userId, bucket: 'quota_pool', valid: true },
    { quotaId, voterId: userId, bucket: 'quota_pool', valid: true },
    { quotaId, voterId: userId, bucket: 'global_pool', valid: true },
    { quotaId, voterId: userId, bucket: 'global_pool', skipped: true, valid: true },
    { quotaId, voterId: otherUserId, bucket: 'quota_pool', valid: true },
  ],
  quotaId,
  userId,
  { quota_pool: 2, global_pool: 1 }
);

assert.deepEqual(progress, {
  quotaPoolCompleted: 2,
  globalPoolCompleted: 1,
  totalCompleted: 3,
  isComplete: true,
});

console.log('Voting rule tests passed');
