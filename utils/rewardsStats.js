import { getStartOfWeek, toJsDate } from './dateKeys';

// Sums points of approved submissions per user, restricted to the current ISO week.
// This keeps the weekly leaderboard accurate for every member in real time,
// independent of when each member's own userStats.weeklyPoints was last recomputed.
export function computeWeeklyPointsByUser(submissions) {
  const startOfWeek = getStartOfWeek();
  const totals = new Map();

  (submissions || []).forEach((submission) => {
    if (submission.status !== 'approved') return;
    const submittedAt = toJsDate(submission.submittedAt);
    if (!submittedAt || submittedAt < startOfWeek) return;
    const prev = totals.get(submission.userId) || 0;
    totals.set(submission.userId, prev + (submission.points || 0));
  });

  return totals;
}
