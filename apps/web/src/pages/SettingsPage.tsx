import { useAgeMode, type AgeMode } from '../ageMode';

const options: Array<{ value: AgeMode; label: string; hint: string }> = [
  { value: '8-10', label: '8-10', hint: 'Проще формулировки и короткие подсказки.' },
  { value: '11-14', label: '11-14', hint: 'Более подробные формулировки и контекст.' },
  { value: 'all', label: 'All — Полный чат (демо)', hint: 'Показывает полный чат со всеми эффектами (delay, вложения).' }
];

export function SettingsPage() {
  const { ageMode, setAgeMode } = useAgeMode();

  return (
    <section>
      <h2>Settings</h2>
      <h3>Age mode</h3>
      <p>Choose how scene text is shown in campaign and weekly missions.</p>
      {options.map((option) => (
        <label key={option.value} style={{ display: 'block', marginBottom: 12 }}>
          <input
            type="radio"
            name="age-mode"
            value={option.value}
            checked={ageMode === option.value}
            onChange={() => setAgeMode(option.value)}
          />{' '}
          <strong>{option.label}</strong> — {option.hint}
        </label>
      ))}
    </section>
  );
}
