import { useState } from 'react';
import { useContent } from '../contentContext';

export function CampaignPage() {
  const { campaign, loading, error, source } = useContent();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  if (loading) {
    return <section><h2>Campaign</h2><p>Syncing content packs…</p></section>;
  }

  if (error || !campaign) {
    return <section><h2>Campaign</h2><p>Campaign unavailable offline. Connect once to cache packs.</p></section>;
  }

  const scene = campaign.scenes[sceneIndex];
  const selectedChoice = scene.choices.find((choice) => choice.id === selectedChoiceId) ?? null;

  const onChoose = (choiceId: string) => {
    setSelectedChoiceId(choiceId);
  };

  const nextScene = () => {
    if (sceneIndex < campaign.scenes.length - 1) {
      setSceneIndex((index) => index + 1);
      setSelectedChoiceId(null);
    }
  };

  return (
    <section>
      <h2>{campaign.title}</h2>
      <p>Source: {source === 'network' ? 'Online sync' : 'Cached offline packs'}</p>
      <article className="scene-card">
        <h3>{scene.title}</h3>
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
            {sceneIndex < campaign.scenes.length - 1 && (
              <button type="button" onClick={nextScene}>Next scene</button>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
