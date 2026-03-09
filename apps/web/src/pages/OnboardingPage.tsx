import { useState } from 'react';
import { useAgeMode, type AgeMode } from '../ageMode';
import { useOnboarding } from '../onboarding';

type Step = {
  title: string;
  body: string;
  bullets?: string[];
};

const steps: Step[] = [
  {
    title: 'Что это за приложение',
    body: 'Это безопасный обучающий квест про интернет-безопасность. Ты проходишь истории, учишься замечать риски и принимать правильные решения без реальной опасности.'
  },
  {
    title: 'Как это работает',
    body: 'Внутри тебя ждут интерактивные чаты и выборы действий.',
    bullets: ['Читай диалоги', 'Выбирай варианты ответа', 'Собирай улики и подсказки', 'Открывай достижения']
  },
  {
    title: 'Почему это важно',
    body: 'Навыки из игры пригодятся каждый день: для защиты личных данных, распознавания фейков, безопасного общения и реакции на травлю в сети.',
    bullets: ['Защита приватности', 'Проверка подозрительной информации', 'Противодействие буллингу', 'Безопасная коммуникация']
  }
];

const ageOptions: Array<{ value: AgeMode; label: string }> = [
  { value: '8-10', label: '8-10' },
  { value: '11-14', label: '11-14' },
  { value: 'all', label: 'All' }
];

export function OnboardingPage() {
  const { ageMode, setAgeMode } = useAgeMode();
  const { completeOnboarding } = useOnboarding();
  const [stepIndex, setStepIndex] = useState(0);

  const isFinalStep = stepIndex === steps.length;
  const currentStep = !isFinalStep ? steps[stepIndex] : null;
  const stepBullets = currentStep?.bullets ?? [];

  const goBack = () => {
    setStepIndex((previous) => Math.max(0, previous - 1));
  };

  const goNext = () => {
    setStepIndex((previous) => Math.min(steps.length, previous + 1));
  };

  return (
    <section className="onboarding" aria-label="Онбординг">
      <div className="onboarding-card polished-card">
        <div className="page-illustration" aria-hidden="true">✨🛡️✨</div>
        <p className="onboarding-progress">Шаг {Math.min(stepIndex + 1, steps.length + 1)} из {steps.length + 1}</p>

        {!isFinalStep && (
          <>
            <h2>{currentStep?.title}</h2>
            <p>{currentStep?.body}</p>
            {stepBullets.length > 0 && (
              <ul className="onboarding-list">
                {stepBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {isFinalStep && (
          <>
            <h2>Выбери возрастной режим</h2>
            <p>Это поможет адаптировать текст и подсказки под нужный формат.</p>
            <fieldset className="onboarding-age-options">
              <legend>Возраст</legend>
              {ageOptions.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="onboarding-age-mode"
                    value={option.value}
                    checked={ageMode === option.value}
                    onChange={() => setAgeMode(option.value)}
                  />{' '}
                  {option.label}
                </label>
              ))}
            </fieldset>
          </>
        )}

        <div className="onboarding-actions">
          <button type="button" onClick={goBack} disabled={stepIndex === 0}>
            Назад
          </button>

          {!isFinalStep && (
            <button type="button" onClick={goNext}>
              Далее
            </button>
          )}

          {isFinalStep && (
            <button type="button" className="onboarding-primary" onClick={completeOnboarding}>
              Начать путешествие
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
