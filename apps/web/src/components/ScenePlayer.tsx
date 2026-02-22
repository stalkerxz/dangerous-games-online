import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StoryScene } from '../contentEngine';

type ScenePlayerProps = {
  title: string;
  scenes: StoryScene[];
  startSceneId?: string;
  footer?: ReactNode;
  onComplete?: () => void;
};

export function ScenePlayer({ title, scenes, startSceneId, footer, onComplete }: ScenePlayerProps) {
  const initialIndex = useMemo(() => {
    if (!startSceneId) {
      return 0;
    }

    const index = scenes.findIndex((scene) => scene.id === startSceneId);
    return index >= 0 ? index : 0;
  }, [scenes, startSceneId]);

  const [sceneIndex, setSceneIndex] = useState(initialIndex);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setSceneIndex(initialIndex);
    setSelectedChoiceId(null);
    setIsCompleted(false);
  }, [initialIndex, scenes]);

  const scene = scenes[sceneIndex];
  const selectedChoice = scene.choices.find((choice) => choice.id === selectedChoiceId) ?? null;

  const onChoose = (choiceId: string) => {
    setSelectedChoiceId(choiceId);
  };

  const nextScene = () => {
    if (sceneIndex < scenes.length - 1) {
      setSceneIndex((index) => index + 1);
      setSelectedChoiceId(null);
      return;
    }

    if (!isCompleted) {
      setIsCompleted(true);
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
                {option}
                {index === selectedChoice.quiz.answerIndex ? ' ✅' : ''}
              </li>
            ))}
          </ol>
          <button type="button" onClick={nextScene}>
            {sceneIndex < scenes.length - 1 ? 'Next scene' : isCompleted ? 'Completed' : 'Finish mission'}
          </button>
        </div>
      )}
      {footer}
    </article>
  );
}
