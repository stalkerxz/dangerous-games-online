import { useMemo } from 'react';
import { getClueDescription, readCluesCollection } from '../cluesCollection';

function formatDate(value: string): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('ru-RU');
}

export function CluesPage() {
  const clues = useMemo(() => readCluesCollection(), []);
  const items = useMemo(
    () => Object.entries(clues).sort((a, b) => b[1].count - a[1].count),
    [clues]
  );

  return (
    <section>
      <h2>Улики риска</h2>
      {items.length === 0 && <p>Пока нет собранных улик. Пройдите сцену, чтобы начать коллекцию.</p>}
      {items.length > 0 && (
        <ul className="clues-list">
          {items.map(([clue, entry]) => (
            <li key={clue} className="clue-card">
              <h3>{clue}</h3>
              <p>{getClueDescription(clue)}</p>
              <p>Количество: <strong>{entry.count}</strong></p>
              <p>Последний раз: {formatDate(entry.last_seen)}</p>
              {entry.examples.length > 0 ? (
                <>
                  <p>Примеры:</p>
                  <ul>
                    {entry.examples.map((sample) => (
                      <li key={`${clue}-${sample}`}>{sample}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>встречалось в сценах: {entry.count}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
