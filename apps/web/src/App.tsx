import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AchievementsPage } from './pages/AchievementsPage';
import { CampaignPage } from './pages/CampaignPage';
import { ParentsPage } from './pages/ParentsPage';
import { WeeklyPage } from './pages/WeeklyPage';
import { SettingsPage } from './pages/SettingsPage';
import { CluesPage } from './pages/CluesPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { useOnboarding } from './onboarding';

const navItems = [
  { to: '/campaign', label: 'Campaign' },
  { to: '/weekly', label: 'Weekly' },
  { to: '/achievements', label: 'Achievements' },
  { to: '/parents', label: 'Parents' },
  { to: '/clues', label: 'Улики' },
  { to: '/settings', label: 'Settings' }
];

export function App() {
  const { hasCompletedOnboarding } = useOnboarding();

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
    <div className="layout">
      <header className="site-header">
        <h1>Dangerous Games Online</h1>
        <nav className="desktop-nav" aria-label="Primary">
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
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <nav className="mobile-tab-bar" aria-label="Mobile tabs">
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
