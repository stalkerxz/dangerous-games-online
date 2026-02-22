import { useMemo, useState } from 'react';
import { ScenePlayer } from '../components/ScenePlayer';
import { useContent } from '../contentContext';
import { completeWeeklyMission, readPlayerProgress } from '../playerProgress';

function isBetweenInclusive(today: string, start: string, end: string) {
  return today >= start && today <= end;
}

export function WeeklyPage() {
  const { weeklyPacks, loading } = useContent();
  const [progress, setProgress] = useState(() => readPlayerProgress());
  const today = new Date().toISOString().slice(0, 10);

  const sortedWeekly = useMemo(
    () => [...weeklyPacks].sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [weeklyPacks]
  );

  const activeWeekly = sortedWeekly.find((pack) => isBetweenInclusive(today, pack.start_date, pack.end_date)) ?? null;
  const nextWeekly = sortedWeekly
    .filter((pack) => pack.start_date > today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null;

  const onComplete = () => {
    if (!activeWeekly) {
      return;
    }

    const result = completeWeeklyMission(activeWeekly.id, activeWeekly.rewards);
    setProgress(result.progress);
  };

  return (
    <section>
      <h2>Weekly Missions</h2>
      {!activeWeekly && nextWeekly && (
        <p>Coming next: {nextWeekly.title} ({nextWeekly.start_date} - {nextWeekly.end_date})</p>
      )}
      {!activeWeekly && !nextWeekly && <p>No active weekly mission.</p>}

      {activeWeekly && (
        <>
          <p>
            Active now: {activeWeekly.start_date} - {activeWeekly.end_date}
            {progress.completedWeeklyIds.includes(activeWeekly.id) ? ' • Completed' : ''}
          </p>
          <ScenePlayer
            title={activeWeekly.title}
            scenes={activeWeekly.scenes}
            startSceneId={activeWeekly.start_scene}
            onComplete={onComplete}
            footer={(
              <p>
                Reward: badge <strong>{activeWeekly.rewards.badge}</strong>, skills{' '}
                {Object.entries(activeWeekly.rewards.skills)
                  .map(([key, value]) => `${key} +${value}`)
                  .join(', ')}
              </p>
            )}
          />
        </>
      )}

      <h3>Archive</h3>
      {loading && <p>Loading weekly archive…</p>}
      {!loading && sortedWeekly.length === 0 && <p>No downloaded weekly packs yet.</p>}
      {!loading && sortedWeekly.length > 0 && (
        <ul>
          {sortedWeekly.map((pack) => (
            <li key={pack.id}>
              {pack.title} ({pack.start_date} - {pack.end_date})
              {progress.completedWeeklyIds.includes(pack.id) ? ' ✅ Completed' : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
