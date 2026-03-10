import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AchievementsPage } from './pages/AchievementsPage';
import { CampaignPage } from './pages/CampaignPage';
import { ParentsPage } from './pages/ParentsPage';
import { WeeklyPage } from './pages/WeeklyPage';
import { SettingsPage } from './pages/SettingsPage';
import { CluesPage } from './pages/CluesPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { MyPathPage } from './pages/MyPathPage';
import { useOnboarding } from './onboarding';
import { usePresentationMode } from './presentationMode';

const navItems = [
  { to: '/campaign', label: 'Кампания' },
  { to: '/weekly', label: 'Неделя' },
  { to: '/achievements', label: 'Достижения' },
  { to: '/parents', label: 'Родителям' },
  { to: '/clues', label: 'Улики' },
  { to: '/path', label: 'Мой путь' },
  { to: '/settings', label: 'Настройки' }
];

export function App() {
  const { hasCompletedOnboarding } = useOnboarding();
  const { presentationMode } = usePresentationMode();

  if (!hasCompletedOnboarding) {
    return (
      <div className="layout onboarding-layout">
        <main>
          <OnboardingPage />
        </main>
      </div>
    );
  }

  return (
    <div className={`layout${presentationMode ? ' layout-presentation' : ''}`}>
      <header className="site-header">
        <h1>КиберДружина: безопасная школа онлайн</h1>
        <nav className="desktop-nav" aria-label="Основная навигация">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/campaign" replace />} />
          <Route path="/campaign" element={<CampaignPage />} />
          <Route path="/weekly" element={<WeeklyPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/parents" element={<ParentsPage />} />
          <Route path="/clues" element={<CluesPage />} />
          <Route path="/path" element={<MyPathPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <nav className="mobile-tab-bar" aria-label="Вкладки на телефоне">
        {navItems.map((item) => (
          <NavLink
            key={`mobile-${item.to}`}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
