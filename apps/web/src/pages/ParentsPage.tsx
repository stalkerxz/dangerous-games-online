import { useMemo, useState } from 'react';
import { ScenePlayer } from '../components/ScenePlayer';
import { useContent } from '../contentContext';
import type { StoryScene } from '../contentEngine';
import { completeLessonKit, readPlayerProgress } from '../playerProgress';

type SkillCard = {
  id: 'privacy' | 'account' | 'antifake' | 'communication' | 'antibullying';
  label: string;
  meaning: string;
  recommendations: string[];
};

type LessonKit = {
  id: string;
  title: string;
  sceneIds: string[];
};

const skillCards: SkillCard[] = [
  {
    id: 'privacy',
    label: 'Приватность',
    meaning: 'Показывает, насколько уверенно ребёнок защищает личные данные и границы.',
    recommendations: [
      'Обсудите правило: адрес, школа, номер телефона не публикуются в открытых чатах.',
      'Потренируйте фразы отказа, когда просят фото, геолокацию или личные контакты.',
      'Проверьте настройки приватности в играх и мессенджерах вместе.'
    ]
  },
  {
    id: 'account',
    label: 'Безопасность аккаунта',
    meaning: 'Отражает привычки по защите входа, паролей и подозрительных ссылок.',
    recommendations: [
      'Напомните: коды подтверждения и пароли нельзя отправлять никому, даже “админу”.',
      'Включите двухфакторную защиту там, где это возможно.',
      'Создайте семейный чек-лист признаков фишинга перед каждым входом по ссылке.'
    ]
  },
  {
    id: 'antifake',
    label: 'Антифейк',
    meaning: 'Показывает, как ребёнок проверяет правдивость сообщений и “срочных” новостей.',
    recommendations: [
      'Используйте правило двух источников: не верить одному скриншоту или одному каналу.',
      'Разбирайте примеры манипуляций: давление, “только сейчас”, обещание приза.',
      'Перед пересылкой делайте паузу и проверяйте официальный источник.'
    ]
  },
  {
    id: 'communication',
    label: 'Коммуникация',
    meaning: 'Показывает умение спокойно общаться, просить помощь и фиксировать договорённости.',
    recommendations: [
      'Договоритесь о фразе-сигнале, когда нужна помощь взрослого.',
      'Потренируйте вежливое завершение небезопасного диалога.',
      'Обсуждайте сложные переписки без обвинений, через вопросы “что ты почувствовал?”.'
    ]
  },
  {
    id: 'antibullying',
    label: 'Антибуллинг',
    meaning: 'Отражает навыки реагирования на травлю, поддержку свидетеля и сохранение доказательств.',
    recommendations: [
      'Повторите алгоритм: не отвечать агрессией, сохранить скриншоты, сообщить взрослому.',
      'Покажите, как безопасно поддержать жертву как свидетель.',
      'Назначьте взрослых, к которым ребёнок может обратиться в школе и дома.'
    ]
  }
];

const lessonKits: LessonKit[] = [
  {
    id: 'kit-privacy',
    title: 'Приватность',
    sceneIds: ['chats-geolocation', 'chats-evidence-trade', 'chats-final-checklist', 'chats-sms-code']
  },
  {
    id: 'kit-antifake',
    title: 'Антифейк',
    sceneIds: ['chats-prize-link', 'chats-second-channel', 'chats-evidence-fake-support', 'chats-pressure-admin']
  },
  {
    id: 'kit-cyberbullying',
    title: 'Кибербуллинг',
    sceneIds: ['chats-bullying-proof', 'chats-evidence-trade', 'chats-evidence-fake-support', 'chats-final-checklist']
  }
];

export function ParentsPage() {
  const { campaign, loading } = useContent();
  const [progress, setProgress] = useState(() => readPlayerProgress());
  const [activeKitId, setActiveKitId] = useState<string | null>(null);
  const [finishedKitId, setFinishedKitId] = useState<string | null>(null);
  const [lessonJustCompleted, setLessonJustCompleted] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'error'>('idle');

  const activeKit = lessonKits.find((kit) => kit.id === activeKitId) ?? null;

  const activeScenes = useMemo<StoryScene[]>(() => {
    if (!campaign || !activeKit) {
      return [];
    }

    return activeKit.sceneIds
      .map((sceneId) => campaign.scenes.find((scene) => scene.id === sceneId))
      .filter((scene): scene is StoryScene => scene !== undefined);
  }, [activeKit, campaign]);

  const reportText = useMemo(() => {
    const lines = [
      'Отчёт по навыкам цифровой безопасности (без персональных данных):',
      ...skillCards.map((skill) => {
        const value = progress.skills[skill.id] ?? 0;
        return `- ${skill.label}: ${value}`;
      }),
      `Завершённые мини-уроки: ${progress.completedLessonKitIds.length}/${lessonKits.length}`
    ];

    return lines.join('\n');
  }, [progress]);

  const onCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopyState('done');
    } catch {
      setCopyState('error');
    }
  };

  const onLessonComplete = () => {
    if (!activeKitId) {
      return;
    }

    setProgress(completeLessonKit(activeKitId));
    setFinishedKitId(activeKitId);
    setLessonJustCompleted(true);
  };

  if (loading) {
    return <section><h2>Parents / Teachers</h2><p>Загружаем отчёт…</p></section>;
  }

  if (activeKit && lessonJustCompleted) {
    return (
      <section>
        <h2>Урок завершён</h2>
        <p>Набор «{activeKit.title}» пройден. Можно вернуться к отчёту или запустить другой урок.</p>
        <button
          type="button"
          onClick={() => {
            setActiveKitId(null);
            setLessonJustCompleted(false);
          }}
        >
          Вернуться к дашборду
        </button>
      </section>
    );
  }

  if (activeKit && activeScenes.length > 0) {
    return (
      <section>
        <h2>Урок: {activeKit.title}</h2>
        <ScenePlayer
          title={`20-минутный набор: ${activeKit.title}`}
          scenes={activeScenes}
          onComplete={onLessonComplete}
          showSceneProgress
        />
      </section>
    );
  }

  return (
    <section>
      <h2>Parents / Teachers dashboard</h2>
      <p>Краткий отчёт по навыкам и готовые 20-минутные наборы сцен для совместного разбора.</p>

      <button type="button" onClick={onCopyReport}>Copy report</button>
      {copyState === 'done' && <p className="status-ok">Отчёт скопирован.</p>}
      {copyState === 'error' && <p className="status-error">Не удалось скопировать отчёт.</p>}

      <div className="parents-grid">
        {skillCards.map((skill) => (
          <article key={skill.id} className="skill-card">
            <h3>{skill.label}: {progress.skills[skill.id] ?? 0}</h3>
            <p>{skill.meaning}</p>
            <ul>
              {skill.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <h3>20-minute lesson kits</h3>
      <div className="kits-grid">
        {lessonKits.map((kit) => {
          const isCompleted = progress.completedLessonKitIds.includes(kit.id);
          const isFinishedNow = finishedKitId === kit.id;

          return (
            <article key={kit.id} className="kit-card">
              <h4>{kit.title} ({kit.sceneIds.length} scenes)</h4>
              {(isCompleted || isFinishedNow) && <span className="badge">Completed</span>}
              <button
                type="button"
                onClick={() => {
                  setLessonJustCompleted(false);
                  setActiveKitId(kit.id);
                }}
                disabled={!campaign}
              >
                Start lesson
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
