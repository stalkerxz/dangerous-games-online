import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AgeMode, SceneChoice, SceneMessage, SceneMiniTask, StoryScene } from '../contentEngine';
import type { GameEvent } from '../achievements';
import { recordDirectClue, recordSceneClues } from '../cluesCollection';

type ScenePlayerProps = {
  title: string;
  scenes: StoryScene[];
  startSceneId?: string;
  ageMode?: AgeMode;
  footer?: ReactNode;
  showSceneProgress?: boolean;
  onComplete?: () => void;
  onEvent?: (event: GameEvent) => void;
  onMicroReward?: (message: string) => void;
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


const READABLE_TAG_LABELS: Record<string, string> = {
  urgency: 'Давление и срочность',
  privacy: 'Личные данные',
  account: 'Защита аккаунта',
  antifake: 'Проверка информации',
  evidence: 'Сохранение доказательств',
  bullying_witness: 'Реакция на травлю',
  antibullying: 'Реакция на травлю',
  communication: 'Безопасное общение'
};

function toReadableTag(tag: string): string {
  return READABLE_TAG_LABELS[tag] ?? tag;
}

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


function isSafeChoice(choice: SceneChoice): boolean {
  return getChoiceRiskLevel(choice) === 'safe';
}


function getChoiceRiskLevel(choice: SceneChoice): 'safe' | 'risky' | 'neutral' {
  if (typeof choice.safe === 'boolean') {
    return choice.safe ? 'safe' : 'risky';
  }
  return classifyRisk(choice);
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
  const normalized = speaker.toLocaleLowerCase('ru-RU').trim();
  const latinTokens = new Set(normalized.split(/[^a-z]+/g).filter(Boolean));

  if (
    normalized.includes('ты')
    || normalized.includes('игрок')
    || normalized === 'я'
    || normalized.includes('ученик')
    || latinTokens.has('you')
    || latinTokens.has('me')
    || latinTokens.has('player')
  ) {
    return 'player';
  }

  if (
    normalized.includes('бот')
    || normalized.includes('админ')
    || normalized.includes('support')
    || normalized.includes('саппорт')
    || normalized.includes('система')
    || normalized.includes('модератор')
    || latinTokens.has('system')
    || latinTokens.has('moderator')
  ) {
    return 'system';
  }

  return 'other';
}

function getSkillFromTags(tags: string[] | undefined): string {
  if ((tags ?? []).includes('antibullying')) {
    return 'Коммуникация и поддержка';
  }
  if ((tags ?? []).includes('account')) {
    return 'Защита аккаунта';
  }
  if ((tags ?? []).includes('antifake')) {
    return 'Проверка источника';
  }
  return 'Цифровая безопасность';
}

function getAlgorithmFromTags(tags: string[] | undefined): string {
  if ((tags ?? []).includes('antifake')) {
    return 'Стоп → Проверь источник → Действуй через официальный канал';
  }
  if ((tags ?? []).includes('account')) {
    return 'Не делись кодами → Сверь адрес → Подтверди у взрослого';
  }
  if ((tags ?? []).includes('antibullying')) {
    return 'Поддержи → Сохрани доказательства → Сообщи взрослому';
  }
  return 'Пауза → Проверка → Безопасный выбор';
}


function getMicroRewardText(tag: string | undefined): string {
  if (tag === 'urgency') {
    return 'Ты заметил давление';
  }
  if (tag === 'account') {
    return 'Ты защитил аккаунт';
  }
  if (tag === 'antifake') {
    return 'Ты проверил источник';
  }
  if (tag === 'antibullying' || tag === 'bullying_witness' || tag === 'communication') {
    return 'Ты поддержал безопасно';
  }
  return 'Ты сделал безопасный шаг';
}
function getRiskAvoidedText(miniTask: SceneMiniTask): string {
  if (miniTask.type === 'find_clue') {
    return `Удалось заметить сигнал риска: ${miniTask.targetClue}.`;
  }
  if (miniTask.type === 'sort_safe_risky') {
    return 'Удалось отделить безопасные шаги от опасных импульсивных действий.';
  }
  return 'Удалось собрать корректный ответ без передачи данных и без эскалации конфликта.';
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
  onMicroReward,
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
  const [miniTaskPassed, setMiniTaskPassed] = useState(false);
  const [miniTaskFeedback, setMiniTaskFeedback] = useState<string | null>(null);
  const [miniTaskRiskFeedback, setMiniTaskRiskFeedback] = useState<string | null>(null);
  const [selectedClueOptionId, setSelectedClueOptionId] = useState<string | null>(null);
  const [miniTaskSubmitted, setMiniTaskSubmitted] = useState(false);
  const [sortAssignments, setSortAssignments] = useState<Record<string, 'safe' | 'risky'>>({});
  const [buildSelections, setBuildSelections] = useState<string[]>([]);
  const [rewardPulse, setRewardPulse] = useState(0);
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
  const effectiveHighlightTerms = scene.miniTask?.type === 'find_clue' && !miniTaskSubmitted ? [] : highlightTerms;

  useEffect(() => {
    setMiniTaskPassed(false);
    setMiniTaskFeedback(null);
    setMiniTaskRiskFeedback(null);
    setSelectedClueOptionId(null);
    setMiniTaskSubmitted(false);
    setSortAssignments({});
    setBuildSelections([]);
  }, [scene.id]);

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
      const riskLevel = getChoiceRiskLevel(choice);
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
    if (!selectedChoice || selectedQuizOption !== null) {
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

  const completeFindClueTask = (optionId: string) => {
    if (!scene.miniTask || scene.miniTask.type !== 'find_clue' || miniTaskSubmitted) {
      return;
    }

    const option = scene.miniTask.options.find((item) => item.id === optionId);
    if (!option) {
      return;
    }

    setMiniTaskSubmitted(true);
    setSelectedClueOptionId(optionId);
    if (option.clue === scene.miniTask.targetClue) {
      setMiniTaskPassed(true);
      setRewardPulse((value) => value + 1);
      setMiniTaskFeedback(`${scene.miniTask.successText} Отлично: ты точно выделил(а) фразу, которая несёт риск.`);
      setMiniTaskRiskFeedback(getRiskAvoidedText(scene.miniTask));
      recordDirectClue(scene.miniTask.targetClue, option.text);
      onEvent?.({ type: 'scene_completed', payload: { sceneId: scene.id, chapterId: eventContext?.chapterId ?? '', mini_task_completed: true } });
      onMicroReward?.(getMicroRewardText(scene.miniTask.targetClue));
    } else {
      setMiniTaskPassed(false);
      setMiniTaskFeedback('Это не главный сигнал риска. Обрати внимание на фразу, где давят, просят секретные данные или подталкивают к спешке.');
      setMiniTaskRiskFeedback(null);
    }
  };

  const assignSortBucket = (itemId: string, bucket: 'safe' | 'risky') => {
    if (miniTaskSubmitted) {
      return;
    }
    setSortAssignments((current) => ({ ...current, [itemId]: bucket }));
  };

  const evaluateSortTask = () => {
    if (!scene.miniTask || scene.miniTask.type !== 'sort_safe_risky' || miniTaskSubmitted) {
      return;
    }

    const isComplete = scene.miniTask.items.every((item) => sortAssignments[item.id]);
    if (!isComplete) {
      setMiniTaskPassed(false);
      setMiniTaskFeedback('Разложи все карточки по двум корзинам: Безопасно и Рискованно.');
      return;
    }

    const correct = scene.miniTask.items.every((item) => sortAssignments[item.id] === item.category);
    setMiniTaskSubmitted(true);
    if (correct) {
      setMiniTaskPassed(true);
      setRewardPulse((value) => value + 1);
      setMiniTaskFeedback('Отлично! Ты верно отделил(а) безопасные действия от рискованных.');
      setMiniTaskRiskFeedback(getRiskAvoidedText(scene.miniTask));
      recordDirectClue(scene.tags?.[0] ?? 'antifake', scene.miniTask.prompt);
      onEvent?.({ type: 'scene_completed', payload: { sceneId: scene.id, chapterId: eventContext?.chapterId ?? '', mini_task_completed: true } });
      onMicroReward?.(getMicroRewardText(scene.tags?.[0]));
      return;
    }

    setMiniTaskPassed(false);
    setMiniTaskFeedback('Есть ошибки в сортировке. Перепроверь, где действие действительно защищает, а где повышает риск.');
    setMiniTaskRiskFeedback(null);
  };

  const toggleBuildSelection = (fragmentId: string) => {
    if (!scene.miniTask || scene.miniTask.type !== 'build_safe_response' || miniTaskSubmitted) {
      return;
    }

    const requiredPicks = scene.miniTask.requiredPicks;
    setBuildSelections((current) => {
      if (current.includes(fragmentId)) {
        return current.filter((id) => id !== fragmentId);
      }
      if (current.length >= requiredPicks) {
        return current;
      }
      return [...current, fragmentId];
    });
  };

  const evaluateBuildTask = () => {
    if (!scene.miniTask || scene.miniTask.type !== 'build_safe_response' || miniTaskSubmitted) {
      return;
    }

    if (buildSelections.length !== scene.miniTask.requiredPicks) {
      setMiniTaskPassed(false);
      setMiniTaskFeedback(`Выбери ${scene.miniTask.requiredPicks} фрагмента(ов), чтобы собрать ответ.`);
      setMiniTaskRiskFeedback(null);
      return;
    }

    const selectedSet = new Set(buildSelections);
    const allCorrect = scene.miniTask.fragments
      .filter((fragment) => fragment.correct)
      .every((fragment) => selectedSet.has(fragment.id));

    setMiniTaskSubmitted(true);
    if (allCorrect) {
      setMiniTaskPassed(true);
      setRewardPulse((value) => value + 1);
      setMiniTaskFeedback(scene.miniTask.successText);
      setMiniTaskRiskFeedback(getRiskAvoidedText(scene.miniTask));
      recordDirectClue(scene.tags?.[0] ?? 'communication', scene.miniTask.prompt);
      onEvent?.({ type: 'scene_completed', payload: { sceneId: scene.id, chapterId: eventContext?.chapterId ?? '', mini_task_completed: true } });
      onMicroReward?.(getMicroRewardText(scene.tags?.[0]));
      return;
    }

    setMiniTaskPassed(false);
    setMiniTaskFeedback('Часть фраз усиливает риск. Убери лишнее и оставь только спокойный безопасный ответ.');
    setMiniTaskRiskFeedback(null);
  };

  const nextScene = () => {
    if (selectedChoice) {
      recordSceneClues(scene, selectedChoice);
      const primaryTag = scene.tags?.[0] ?? selectedChoice.effects?.clues?.[0] ?? selectedChoice.tags?.[0] ?? '';
      const riskLevel = getChoiceRiskLevel(selectedChoice);
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

      if (riskLevel === 'safe') {
        onMicroReward?.(getMicroRewardText(primaryTag));
      }

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

  const isMiniTaskRequired = Boolean(scene.miniTask);
  const isNextSceneUnlocked = selectedQuizOption !== null && (!isMiniTaskRequired || miniTaskPassed);
  const miniTaskTone = miniTaskPassed ? 'task-success' : miniTaskFeedback ? 'task-warning' : 'task-neutral';
  const findClueTask = scene.miniTask?.type === 'find_clue' ? scene.miniTask : null;
  const buildTaskFragments = scene.miniTask?.type === 'build_safe_response' ? scene.miniTask.fragments : [];

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
              <div className={`chat-content chat-content-${senderType}`}>
                <p className={`chat-bubble chat-bubble-${senderType}`}>
                  <span className="chat-speaker">{line.speaker}</span>
                  <span>{renderHighlightedText(line.text, effectiveHighlightTerms)}</span>
                </p>
                {line.attachment && (
                  <div aria-label={`Вложение: ${line.attachment.label}`} className={`attachment-card attachment-card-${senderType}`} role="group">
                    <span className="attachment-type">{line.attachment.type === 'image' ? '🖼️ Изображение' : '📎 Файл'}</span>
                    <p>{line.attachment.label}</p>
                    {line.attachment.type === 'image' && resolvedAttachmentSrc && (
                      <img alt={line.attachment.label} className="attachment-preview" loading="lazy" src={resolvedAttachmentSrc} />
                    )}
                  </div>
                )}
              </div>
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

      {scene.miniTask && (
        <section className={`task-card ${miniTaskTone}`} aria-label="Мини-задание">
          <div className="task-header-row">
            <h4>Мини-задание</h4>
            <span className="status-pill neutral">🎯 Практика</span>
          </div>
          <p>{scene.miniTask.prompt}</p>

          {findClueTask && (
            <div className="task-grid task-grid-clues">
              {findClueTask.options.map((option) => {
                const isTarget = option.clue === findClueTask.targetClue;
                const isSelected = selectedClueOptionId === option.id;
                const clueStateClass = !miniTaskSubmitted
                  ? isSelected
                    ? 'task-chip-selected'
                    : 'task-chip'
                  : isTarget
                    ? 'task-option-correct'
                    : isSelected
                      ? 'task-option-incorrect'
                      : 'task-option-disabled';

                return (
                  <div key={option.id}>
                    <button
                      className={`choice-button ${clueStateClass} task-option`}
                      type="button"
                    onClick={() => completeFindClueTask(option.id)}
                    disabled={miniTaskSubmitted}
                  >
                    <span aria-hidden="true">🔎</span>{' '}
                    {option.text}
                  </button>
                  {isSelected && miniTaskSubmitted && (
                    <p className="section-meta quiz-option-feedback">{isTarget ? '✅ Верно.' : '❌ Неверно.'}</p>
                  )}
                  </div>
                );
              })}
            </div>
          )}

          {scene.miniTask.type === 'sort_safe_risky' && (
            <div className="task-grid">
              {scene.miniTask.items.map((item) => (
                <div className="sort-row" key={item.id}>
                  <p><strong>Карточка:</strong> {item.text}</p>
                  <div className="sort-actions">
                    <button
                      className={`choice-button ${
                        !miniTaskSubmitted
                          ? sortAssignments[item.id] === 'safe'
                            ? 'task-chip-selected'
                            : 'task-chip'
                          : sortAssignments[item.id] === 'safe' && item.category === 'safe'
                            ? 'task-option-correct'
                            : sortAssignments[item.id] === 'safe' && item.category !== 'safe'
                              ? 'task-option-incorrect'
                              : 'task-option-disabled'
                      }`}
                      type="button"
                      onClick={() => assignSortBucket(item.id, 'safe')}
                      disabled={miniTaskSubmitted}
                    >
                      Безопасно
                    </button>
                    <button
                      className={`choice-button ${
                        !miniTaskSubmitted
                          ? sortAssignments[item.id] === 'risky'
                            ? 'task-chip-selected'
                            : 'task-chip'
                          : sortAssignments[item.id] === 'risky' && item.category === 'risky'
                            ? 'task-option-correct'
                            : sortAssignments[item.id] === 'risky' && item.category !== 'risky'
                              ? 'task-option-incorrect'
                              : 'task-option-disabled'
                      }`}
                      type="button"
                      onClick={() => assignSortBucket(item.id, 'risky')}
                      disabled={miniTaskSubmitted}
                    >
                      Рискованно
                    </button>
                  </div>
                  {miniTaskSubmitted && sortAssignments[item.id] && (
                    <p className="section-meta quiz-option-feedback">
                      {sortAssignments[item.id] === item.category ? `✅ Верно: ${item.explanation}` : `❌ Неверно: ${item.explanation}`}
                    </p>
                  )}
                </div>
              ))}
              <button className={`choice-button ${!miniTaskSubmitted ? "task-chip-selected" : "task-option-disabled"}`} type="button" onClick={evaluateSortTask} disabled={miniTaskSubmitted}>Проверить сортировку</button>
            </div>
          )}

          {scene.miniTask.type === 'build_safe_response' && (
            <div className="task-grid">
              <p className="section-meta">Собери алгоритм из {scene.miniTask.requiredPicks} безопасных шагов.</p>
              {scene.miniTask.fragments.map((fragment) => {
                const isSelected = buildSelections.includes(fragment.id);
                const fragmentClass = !miniTaskSubmitted
                  ? isSelected
                    ? 'task-chip-selected'
                    : 'task-chip'
                  : isSelected && fragment.correct
                    ? 'task-option-correct'
                    : isSelected && !fragment.correct
                      ? 'task-option-incorrect'
                      : 'task-option-disabled';

                return (
                  <div key={fragment.id}>
                    <button
                      className={`choice-button ${fragmentClass}`}
                      type="button"
                    onClick={() => toggleBuildSelection(fragment.id)}
                    disabled={miniTaskSubmitted}
                  >
                    {fragment.text}
                  </button>
                    {miniTaskSubmitted && isSelected && (
                    <p className="section-meta quiz-option-feedback">{fragment.correct ? '✅ Верно.' : '❌ Неверно.'}</p>
                  )}
                  </div>
                );
              })}
              <div className="chip-row" aria-label="Выбранные шаги">
                {buildSelections.length === 0 && <span className="section-meta">Пока шаги не выбраны.</span>}
                {buildSelections.map((id, index) => {
                  const fragment = buildTaskFragments.find((item) => item.id === id);
                  if (!fragment) {
                    return null;
                  }
                  return <span className="clue-chip" key={id}>{index + 1}. {fragment.text}</span>;
                })}
              </div>
              <button className="choice-button" type="button" onClick={evaluateBuildTask} disabled={miniTaskSubmitted}>Собрать безопасный ответ</button>
            </div>
          )}

          {miniTaskFeedback && <p className="section-meta">{miniTaskFeedback}</p>}
          {scene.miniTask.type === 'sort_safe_risky' && miniTaskPassed && <p className="section-meta">✅ Задание выполнено. Можно продолжить.</p>}
          {miniTaskRiskFeedback && (
            <div className="task-reward task-reward-burst" key={`${scene.id}-${rewardPulse}`} role="status">
              <p>🎉 Улика добавлена в коллекцию.</p>
              <p>{miniTaskRiskFeedback}</p>
              <p>Навык: {scene.miniTask.skill}</p>
              <p>Алгоритм: {scene.miniTask.algorithm}</p>
            </div>
          )}
        </section>
      )}

      <div className="choices">
        {scene.choices.map((choice) => {
          const isSelected = selectedChoiceId === choice.id;
          const isCorrectChoice = isSafeChoice(choice);
          const storyChoiceClass = selectedChoiceId === null
            ? 'task-chip'
            : isSelected && isCorrectChoice
              ? 'task-option-correct'
              : isSelected
                ? 'task-option-incorrect'
                : 'task-option-disabled';

          return (
            <div key={choice.id}>
              <button
                className={`choice-button ${storyChoiceClass}`}
                type="button"
                onClick={() => onChoose(choice.id)}
                disabled={selectedChoice !== null}
              >
                {choice.label}
              </button>
              {isSelected && (
                <p className="section-meta quiz-option-feedback">
                  {isCorrectChoice ? '✅ Верно.' : '❌ Неверно.'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {selectedChoice && (
        <div className="debrief-layout">
          <section className="debrief" aria-label="Разбор решения">
            <h4>Разбор решения</h4>
            <p>{selectedChoice.debrief}</p>
            <p className="section-meta">Что тренируем: замечать риск, выбирать безопасное действие и понимать, как обсудить ситуацию с взрослым дома или в школе.</p>
            <div className="chip-row" role="list" aria-label="Улики сцены и оценка решения">
              {(scene.tags ?? []).slice(0, 4).map((tag) => (
                <span className="clue-chip" key={tag} role="listitem">{toReadableTag(tag)}</span>
              ))}
              <span className={`status-pill ${isSafeChoice(selectedChoice) ? 'safe' : 'risky'}`} role="listitem">
                {isSafeChoice(selectedChoice) ? 'Безопасный выбор' : 'Рискованный выбор'}
              </span>
            </div>
            <div className="task-reward">
              <p>Риск: {isSafeChoice(selectedChoice) ? 'Риск снижен — ты не передал(а) данные и не поддался(лась) давлению.' : 'Риск вырос — действие могло привести к утечке/эскалации.'}</p>
              <p>Навык: {getSkillFromTags(scene.tags)}</p>
              <p>Алгоритм: {getAlgorithmFromTags(scene.tags)}</p>
            </div>
          </section>

          <section className="quiz-card" aria-label="Проверка понимания">
            <h5>Проверка понимания</h5>
            <p className="section-meta">Это учебная и профилактическая проверка: видно, как закрепляется безопасное поведение.</p>
            <p>{selectedChoice.quiz.question}</p>
            <ol className="quiz-options">
              {selectedChoice.quiz.options.map((option, index) => {
                const isAnswered = selectedQuizOption !== null;
                const isSelected = selectedQuizOption === index;
                const isCorrect = index === selectedChoice.quiz.answerIndex;
                const quizClass = !isAnswered
                  ? 'task-chip'
                  : isCorrect
                    ? 'task-option-correct'
                    : isSelected
                      ? 'task-option-incorrect'
                      : 'task-option-disabled';

                return (
                  <li key={`${option}-${index}`}>
                    <button className={`choice-button ${quizClass}`} type="button" onClick={() => onAnswerQuiz(index)} disabled={isAnswered}>
                      {option}
                    </button>
                    {isSelected && isAnswered && (
                      <p className="section-meta quiz-option-feedback">
                        {isCorrect
                          ? '✅ Верно. Отлично, ключевое правило усвоено.'
                          : `❌ Неверно. Правильный ответ: ${selectedChoice.quiz.options[selectedChoice.quiz.answerIndex]}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <button className="choice-button" type="button" onClick={nextScene} disabled={!isNextSceneUnlocked}>
              {sceneIndex < scenes.length - 1 ? 'Следующая сцена' : isCompleted ? 'Миссия завершена' : 'Завершить миссию'}
            </button>
            {isMiniTaskRequired && !isNextSceneUnlocked && !miniTaskPassed && <p className="section-meta">Сначала заверши мини-задание этой сцены.</p>}
          </section>
        </div>
      )}
      {footer}
    </article>
  );
}
