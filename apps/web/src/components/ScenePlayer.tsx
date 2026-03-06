import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AgeMode, SceneChoice, StoryScene } from '../contentEngine';
import type { GameEvent } from '../achievements';
import { recordSceneClues } from '../cluesCollection';

type ScenePlayerProps = {
  title: string;
  scenes: StoryScene[];
  startSceneId?: string;
  ageMode?: AgeMode;
  footer?: ReactNode;
  showSceneProgress?: boolean;
  onComplete?: () => void;
  onEvent?: (event: GameEvent) => void;
  eventContext?: {
    chapterId?: string;
    weeklyId?: string;
    rewardSkills?: Record<string, number>;
  };
};

function classifyRisk(choice: SceneChoice): 'safe' | 'risky' | 'neutral' {
  if (typeof choice.effects?.risk === 'number') {
    return choice.effects.risk <= 0 ? 'safe' : 'risky';
  }

  const fallbackSignals = [
    ...(choice.tags ?? []),
    ...(choice.effects?.clues ?? [])
  ].map((value) => value.toLowerCase());

  if (fallbackSignals.some((value) => value.includes('safe') || value.includes('protect') || value.includes('evidence'))) {
    return 'safe';
  }

  if (fallbackSignals.some((value) => value.includes('risk') || value.includes('unsafe') || value.includes('urgency') || value.includes('pressure'))) {
    return 'risky';
  }

  return 'neutral';
}

export function ScenePlayer({
  title,
  scenes,
  startSceneId,
  ageMode = '11-14',
  footer,
  showSceneProgress = false,
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
      const riskLevel = classifyRisk(choice);
      onEvent?.({
        type: 'choice_made',
        payload: {
          sceneId: scene.id,
          chapterId: eventContext?.chapterId ?? '',
          safe: riskLevel === 'safe',
          risk_level: riskLevel,
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
        chapterId: eventContext?.chapterId ?? '',
        tag: scene.tags?.[0] ?? selectedChoice.effects?.clues?.[0] ?? '',
        clue: selectedChoice.effects?.clues?.[0] ?? '',
        correct: index === selectedChoice.quiz.answerIndex
      }
    });
  };

  const nextScene = () => {
    if (selectedChoice) {
      recordSceneClues(scene, selectedChoice);
      const primaryTag = scene.tags?.[0] ?? selectedChoice.effects?.clues?.[0] ?? selectedChoice.tags?.[0] ?? '';
      const riskLevel = classifyRisk(selectedChoice);
      onEvent?.({
        type: 'scene_completed',
        payload: {
          sceneId: scene.id,
          chapterId: eventContext?.chapterId ?? '',
          tag: primaryTag,
          clue: selectedChoice.effects?.clues?.[0] ?? '',
          safe: riskLevel === 'safe',
          risk_level: riskLevel,
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
      <h3 className="scene-title">{title}</h3>
      {showSceneProgress && <p className="scene-progress">Progress: {Math.min(sceneIndex + 1, scenes.length)}/{scenes.length}</p>}
      <ul className="chat-log">
        {scene.chat.map((line, index) => (
          <li key={`${line.speaker}-${index}`}>
            <strong>{line.speaker}:</strong> {line.text}
          </li>
        ))}
      </ul>

      <div className="choices">
        {scene.choices.map((choice) => (
          <button className="choice-button" key={choice.id} type="button" onClick={() => onChoose(choice.id)}>
            {choice.label}
          </button>
        ))}
      </div>

      {selectedChoice && (
        <div className="debrief">
          <h4>Debrief</h4>
          <p>{selectedChoice.debrief}</p>

          <div className="quiz-card">
            <h5>Quiz</h5>
            <p>{selectedChoice.quiz.question}</p>
            <ol className="quiz-options">
              {selectedChoice.quiz.options.map((option, index) => (
                <li key={option}>
                  <button className="choice-button" type="button" onClick={() => onAnswerQuiz(index)}>
                    {option}
                  </button>
                  {selectedQuizOption === index && index === selectedChoice.quiz.answerIndex ? ' ✅' : ''}
                </li>
              ))}
            </ol>
            <button className="choice-button" type="button" onClick={nextScene} disabled={selectedQuizOption === null}>
              {sceneIndex < scenes.length - 1 ? 'Next scene' : isCompleted ? 'Completed' : 'Finish mission'}
            </button>
          </div>
        </div>
      )}
      {footer}
    </article>
  );
}
