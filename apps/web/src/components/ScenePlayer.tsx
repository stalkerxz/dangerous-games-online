import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AgeMode, StoryScene } from '../contentEngine';
import type { GameEvent } from '../achievements';

type ScenePlayerProps = {
  title: string;
  scenes: StoryScene[];
  startSceneId?: string;
  ageMode?: AgeMode;
  footer?: ReactNode;
  onComplete?: () => void;
  onEvent?: (event: GameEvent) => void;
  eventContext?: {
    weeklyId?: string;
    rewardSkills?: Record<string, number>;
  };
};

export function ScenePlayer({
  title,
  scenes,
  startSceneId,
  ageMode = '11-14',
  footer,
  onComplete,
  onEvent,
  eventContext
}: ScenePlayerProps) {
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
  }, [initialIndex, scenes, ageMode]);

  const baseScene = scenes[sceneIndex];
  const modeScene = baseScene.modeContent?.[ageMode];
  const scene = {
    ...baseScene,
    title: modeScene?.title ?? baseScene.title,
    chat: modeScene?.chat ?? baseScene.chat,
    choices: modeScene?.choices ?? baseScene.choices
  };

  const selectedChoice = scene.choices.find((choice) => choice.id === selectedChoiceId) ?? null;

  const onChoose = (choiceId: string) => {
    const choice = scene.choices.find((item) => item.id === choiceId);
    if (choice) {
      const primaryTag = scene.tags?.[0] ?? choice.effects?.clues?.[0] ?? choice.tags?.[0] ?? '';
      onEvent?.({
        type: 'choice_made',
        payload: {
          sceneId: scene.id,
          safe: Boolean(choice.safe),
          tag: primaryTag,
          choiceTag: choice.tags?.[0] ?? '',
          clue: choice.effects?.clues?.[0] ?? ''
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
        tag: scene.tags?.[0] ?? selectedChoice.effects?.clues?.[0] ?? '',
        clue: selectedChoice.effects?.clues?.[0] ?? '',
        correct: index === selectedChoice.quiz.answerIndex
      }
    });
  };

  const nextScene = () => {
    if (selectedChoice) {
      const primaryTag = scene.tags?.[0] ?? selectedChoice.effects?.clues?.[0] ?? selectedChoice.tags?.[0] ?? '';
      onEvent?.({
        type: 'scene_completed',
        payload: {
          sceneId: scene.id,
          tag: primaryTag,
          clue: selectedChoice.effects?.clues?.[0] ?? '',
          safe: Boolean(selectedChoice.safe),
          action: selectedChoice.effects?.actions?.[0] ?? selectedChoice.actions?.[0] ?? ''
        }
      });

      if (selectedChoice.effects?.skills) {
        for (const [skill, level] of Object.entries(selectedChoice.effects.skills)) {
          onEvent?.({ type: 'skill_changed', payload: { skill, level } });
        }
      }
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
