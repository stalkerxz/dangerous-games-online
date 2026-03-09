import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgeMode, SceneChoice, SceneMessage, StoryScene } from '../contentEngine';
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

const HIGHLIGHT_TERMS: Record<string, string[]> = {
  urgency: ['срочно', '90 секунд', '30 секунд', 'иначе', 'быстро'],
  privacy: ['только тебе', 'никому', 'секрет'],
  account: ['код', 'смс', 'аккаунт', 'пароль'],
  antifake: ['админ', 'поддержка', 'проверка']
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function resolveAttachmentSrc(src: string | undefined): string | undefined {
  if (!src) {
    return undefined;
  }

  if (src.startsWith('/content/')) {
    return `${trimTrailingSlashes(API_BASE_URL)}${src}`;
  }

  return src;
}

function classifyRisk(choice: SceneChoice): 'safe' | 'risky' | 'neutral' {
  if (typeof choice.effects?.risk === 'number') {
    return choice.effects.risk <= 0 ? 'safe' : 'risky';
  }

  const fallbackSignals = [...(choice.tags ?? []), ...(choice.effects?.clues ?? [])].map((value) => value.toLowerCase());

  if (fallbackSignals.some((value) => value.includes('safe') || value.includes('protect') || value.includes('evidence'))) {
    return 'safe';
  }

  if (fallbackSignals.some((value) => value.includes('risk') || value.includes('unsafe') || value.includes('urgency') || value.includes('pressure'))) {
    return 'risky';
  }

  return 'neutral';
}

function getHighlightTerms(tags: string[] | undefined): string[] {
  const normalizedTags = (tags ?? []).map((tag) => tag.toLowerCase());
  const terms = new Set<string>();
  for (const tag of normalizedTags) {
    for (const term of HIGHLIGHT_TERMS[tag] ?? []) {
      terms.add(term);
    }
  }
  return Array.from(terms).sort((left, right) => right.length - left.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text: string, terms: string[]): ReactNode {
  if (terms.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${terms.map((term) => escapeRegExp(term)).join('|')})`, 'giu');
  const chunks = text.split(pattern);
  return chunks.map((chunk, index) => {
    const shouldHighlight = terms.some((term) => term.toLocaleLowerCase('ru-RU') === chunk.toLocaleLowerCase('ru-RU'));
    if (!shouldHighlight) {
      return <span key={`${chunk}-${index}`}>{chunk}</span>;
    }

    return (
      <mark className="risk-highlight" key={`${chunk}-${index}`}>
        {chunk}
      </mark>
    );
  });
}

function classifySpeaker(speaker: string): 'player' | 'system' | 'other' {
  const normalized = speaker.toLocaleLowerCase('ru-RU');
  if (normalized.includes('ты') || normalized.includes('игрок')) {
    return 'player';
  }
  if (normalized.includes('бот') || normalized.includes('админ') || normalized.includes('support') || normalized.includes('саппорт')) {
    return 'system';
  }
  return 'other';
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
  const [visibleChatCount, setVisibleChatCount] = useState(0);
  const [typingMessage, setTypingMessage] = useState<SceneMessage | null>(null);
  const chatListRef = useRef<HTMLUListElement | null>(null);
  const checkedAttachmentSrcRef = useRef(new Set<string>());

  useEffect(() => {
    setSceneIndex(initialIndex);
    setSelectedChoiceId(null);
    setSelectedQuizOption(null);
    setIsCompleted(false);
  }, [initialIndex, scenes, ageMode]);

  const baseScene = scenes[sceneIndex];
  const modeScene = ageMode === 'all' ? undefined : baseScene.modeContent?.[ageMode];
  const scene = {
    ...baseScene,
    title: modeScene?.title ?? baseScene.title,
    chat: modeScene?.chat ?? baseScene.chat,
    choices: modeScene?.choices ?? baseScene.choices
  };
  const highlightTerms = useMemo(() => getHighlightTerms(scene.tags), [scene.tags]);

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;
    const sceneChat = scene.chat;

    setVisibleChatCount(0);
    setTypingMessage(null);

    const renderNext = (index: number) => {
      if (cancelled) {
        return;
      }

      if (index >= sceneChat.length) {
        setTypingMessage(null);
        return;
      }

      const message = sceneChat[index];
      const delay = Math.max(0, message.delay_ms ?? 0);
      if (delay > 0) {
        setTypingMessage(message);
        timerId = window.setTimeout(() => {
          if (cancelled) {
            return;
          }
          setTypingMessage(null);
          setVisibleChatCount((count) => Math.max(count, index + 1));
          renderNext(index + 1);
        }, delay);
        return;
      }

      setVisibleChatCount((count) => Math.max(count, index + 1));
      renderNext(index + 1);
    };

    renderNext(0);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [scene.id, scene.chat]);

  useEffect(() => {
    if (!chatListRef.current) {
      return;
    }

    chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [visibleChatCount, typingMessage]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const controller = new AbortController();
    const imageSrcs = scene.chat
      .map((message) => (message.attachment?.type === 'image' ? resolveAttachmentSrc(message.attachment.src) : undefined))
      .filter((src): src is string => Boolean(src));

    for (const src of imageSrcs) {
      if (checkedAttachmentSrcRef.current.has(src)) {
        continue;
      }
      checkedAttachmentSrcRef.current.add(src);

      fetch(src, { method: 'GET', signal: controller.signal })
        .then((response) => {
          const contentType = response.headers.get('content-type') ?? '';
          if (!contentType.toLowerCase().startsWith('image/')) {
            console.warn(`[ScenePlayer] Attachment src did not return image content-type: ${src}`, {
              contentType,
              status: response.status
            });
          }
        })
        .catch((error: unknown) => {
          if ((error as Error).name !== 'AbortError') {
            console.warn(`[ScenePlayer] Failed to validate attachment src: ${src}`, error);
          }
        });
    }

    return () => {
      controller.abort();
    };
  }, [scene.chat]);

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
      {showSceneProgress && (
        <>
          <p className="scene-progress">Прогресс: {Math.min(sceneIndex + 1, scenes.length)}/{scenes.length}</p>
          <div className="progress" aria-hidden="true">
            <div
              className="progress-bar"
              style={{ width: `${Math.round((Math.min(sceneIndex + 1, scenes.length) / Math.max(1, scenes.length)) * 100)}%` }}
            />
          </div>
        </>
      )}
      <ul aria-live="polite" aria-relevant="additions text" className="chat-log" ref={chatListRef}>
        {scene.chat.slice(0, visibleChatCount).map((line, index) => {
          const resolvedAttachmentSrc = line.attachment?.type === 'image' ? resolveAttachmentSrc(line.attachment.src) : undefined;
          const senderType = classifySpeaker(line.speaker);
          return (
            <li className={`chat-row chat-row-${senderType}`} key={`${line.speaker}-${index}`}>
              <p className={`chat-bubble chat-bubble-${senderType}`}>
                <span className="chat-speaker">{line.speaker}</span>
                <span>{renderHighlightedText(line.text, highlightTerms)}</span>
              </p>
              {line.attachment && (
                <div aria-label={`Вложение: ${line.attachment.label}`} className="attachment-card" role="group">
                  <span className="attachment-type">{line.attachment.type === 'image' ? '🖼️ Изображение' : '📎 Файл'}</span>
                  <p>{line.attachment.label}</p>
                  {line.attachment.type === 'image' && resolvedAttachmentSrc && (
                    <img alt={line.attachment.label} className="attachment-preview" loading="lazy" src={resolvedAttachmentSrc} />
                  )}
                </div>
              )}
            </li>
          );
        })}
        {typingMessage && (
          <li className="typing-row" key={`${typingMessage.speaker}-typing`}>
            <p aria-label={`${typingMessage.speaker} печатает`} className="typing-bubble" role="status">
              <span className="chat-speaker">{typingMessage.speaker}</span>
              <span>печатает<span aria-hidden="true">…</span></span>
            </p>
          </li>
        )}
      </ul>

      <div className="choices">
        {scene.choices.map((choice) => (
          <button
            className={`choice-button choice-${classifyRisk(choice)}`}
            key={choice.id}
            type="button"
            onClick={() => onChoose(choice.id)}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {selectedChoice && (
        <div className="debrief-layout">
          <section className="debrief" aria-label="Разбор решения">
            <h4>Разбор решения</h4>
            <p>{selectedChoice.debrief}</p>
            <div className="chip-row" role="list" aria-label="Улики сцены и оценка решения">
              {(scene.tags ?? []).slice(0, 4).map((tag) => (
                <span className="clue-chip" key={tag} role="listitem">#{tag}</span>
              ))}
              <span className={`status-pill ${classifyRisk(selectedChoice)}`} role="listitem">
                {classifyRisk(selectedChoice) === 'safe' ? 'Безопасный выбор' : classifyRisk(selectedChoice) === 'risky' ? 'Рискованный выбор' : 'Нейтральный выбор'}
              </span>
            </div>
          </section>

          <section className="quiz-card" aria-label="Проверка понимания">
            <h5>Проверка понимания</h5>
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
              {sceneIndex < scenes.length - 1 ? 'Следующая сцена' : isCompleted ? 'Миссия завершена' : 'Завершить миссию'}
            </button>
          </section>
        </div>
      )}
      {footer}
    </article>
  );
}
