export const LEVELS = [
  { level: 1, title: 'Sprout', threshold: 0, icon: '🌱' },
  { level: 2, title: 'Sapling', threshold: 100, icon: '🌿' },
  { level: 3, title: 'Budding Star', threshold: 250, icon: '⭐' },
  { level: 4, title: 'Achiever', threshold: 500, icon: '🏅' },
  { level: 5, title: 'Trailblazer', threshold: 900, icon: '🚀' },
  { level: 6, title: 'Champion', threshold: 1400, icon: '🏆' },
  { level: 7, title: 'Superstar', threshold: 2000, icon: '🌟' },
  { level: 8, title: 'Legend', threshold: 2800, icon: '👑' },
  { level: 9, title: 'Icon', threshold: 3800, icon: '💎' },
  { level: 10, title: 'Hall of Fame', threshold: 5000, icon: '🎖️' },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getLevelInfo(lifetimePoints) {
  const points = Math.max(0, lifetimePoints || 0);
  let current = LEVELS[0];
  let next = LEVELS[1] || null;

  for (let i = 0; i < LEVELS.length; i += 1) {
    if (points >= LEVELS[i].threshold) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }

  const progress = next
    ? clamp((points - current.threshold) / (next.threshold - current.threshold), 0, 1)
    : 1;

  return {
    level: current.level,
    title: current.title,
    icon: current.icon,
    points,
    currentThreshold: current.threshold,
    nextThreshold: next?.threshold ?? null,
    pointsToNext: next ? Math.max(0, next.threshold - points) : 0,
    progress,
    isMaxLevel: !next,
  };
}
