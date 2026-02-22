import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StoryScene } from '../contentEngine';
import type { GameEvent } from '../achievements';

type ScenePlayerProps = {
  title: string;
  scenes: StoryScene[];
  startSceneId?: string;
  footer?: ReactNode;
  onComplete?: () => void;
  onEvent?: (event: GameEvent) => void;
  eventContext?: {
    weeklyId?: string;
    rewardSkills?: Record<string, number>;
  };
};

export function ScenePlayer({ title, scenes, startSceneId, footer, onComplete, onEvent, eventContext }: ScenePlayerProps) {
  const initialIndex = useMemo(() => {
    if (!startSceneId) {
      return 0;
    }

    const index = scenes.findIndex((scene) => scene.id === startSceneId);
    return index >= 0 ? index : 0;
  }, [scenes, startSceneId]);

  const [sceneIndex, setSceneIndex] = useState(initialIndex);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setSceneIndex(initialIndex);
    setSelectedChoiceId(null);
    setSelectedQuizOption(null);
    setIsCompleted(false);
  }, [initialIndex, scenes]);

  const scene = scenes[sceneIndex];
  const selectedChoice = scene.choices.find((choice) => choice.id === selectedChoiceId) ?? null;

  const onChoose = (choiceId: string) => {
    const choice = scene.choices.find((item) => item.id === choiceId);
    if (choice) {
      onEvent?.({
        type: 'choice_made',
        payload: {
          sceneId: scene.id,
          safe: Boolean(choice.safe),
          tag: scene.tags?.[0] ?? '',
          choiceTag: choice.tags?.[0] ?? ''
        }
      });
    }
    setSelectedChoiceId(choiceId);
    setSelectedQuizOption(null);
  };

  const onAnswerQuiz = (index: number) => {
    if (!selectedChoice) {
      return;
    }

    setSelectedQuizOption(index);
    onEvent?.({
      type: 'quiz_answered',
      payload: {
        sceneId: scene.id,
        tag: scene.tags?.[0] ?? '',
        correct: index === selectedChoice.quiz.answerIndex
      }
    });
  };

  const nextScene = () => {
    if (selectedChoice) {
      onEvent?.({
        type: 'scene_completed',
        payload: {
          sceneId: scene.id,
          tag: scene.tags?.[0] ?? '',
          safe: Boolean(selectedChoice.safe),
          action: selectedChoice.actions?.[0] ?? ''
        }
      });
    }

    if (sceneIndex < scenes.length - 1) {
      setSceneIndex((index) => index + 1);
      setSelectedChoiceId(null);
      setSelectedQuizOption(null);
      return;
    }

    if (!isCompleted) {
      setIsCompleted(true);
      if (eventContext?.weeklyId) {
        onEvent?.({ type: 'weekly_completed', payload: { weeklyId: eventContext.weeklyId } });
      }
      if (eventContext?.rewardSkills) {
        for (const [skill, level] of Object.entries(eventContext.rewardSkills)) {
          onEvent?.({ type: 'skill_changed', payload: { skill, level } });
        }
      }
      onComplete?.();
    }
  };

  return (
    <article className="scene-card">
      <h3>{title}</h3>
      <ul className="chat-log">
        {scene.chat.map((line, index) => (
          <li key={`${line.speaker}-${index}`}>
            <strong>{line.speaker}:</strong> {line.text}
          </li>
        ))}
      </ul>

      <div className="choices">
        {scene.choices.map((choice) => (
          <button key={choice.id} type="button" onClick={() => onChoose(choice.id)}>
            {choice.label}
          </button>
        ))}
      </div>

      {selectedChoice && (
        <div className="debrief">
          <h4>Debrief</h4>
          <p>{selectedChoice.debrief}</p>
          <h5>Quiz</h5>
          <p>{selectedChoice.quiz.question}</p>
          <ol>
            {selectedChoice.quiz.options.map((option, index) => (
              <li key={option}>
                <button type="button" onClick={() => onAnswerQuiz(index)}>
                  {option}
                </button>
                {selectedQuizOption === index && index === selectedChoice.quiz.answerIndex ? ' ✅' : ''}
              </li>
            ))}
          </ol>
          <button type="button" onClick={nextScene} disabled={selectedQuizOption === null}>
            {sceneIndex < scenes.length - 1 ? 'Next scene' : isCompleted ? 'Completed' : 'Finish mission'}
          </button>
        </div>
      )}
      {footer}
    </article>
  );
}
