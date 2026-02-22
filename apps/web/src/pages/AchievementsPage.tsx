import { useMemo } from 'react';
import { getAchievementViews } from '../achievements';
import { useContent } from '../contentContext';

export function AchievementsPage() {
  const { achievements } = useContent();

  const items = useMemo(() => getAchievementViews(achievements), [achievements]);

  return (
    <section>
      <h2>Achievements</h2>
      {items.length === 0 && <p>Achievements pack unavailable offline. Sync once to unlock tracking.</p>}
      {items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.icon} {item.name}</strong> — {item.description}
              <div>Status: {item.unlocked ? '✅ Unlocked' : '🔒 Locked'}</div>
              <div>Progress: {item.progress}/{item.target}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
