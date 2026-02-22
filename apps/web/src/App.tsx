import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { AchievementsPage } from './pages/AchievementsPage';
import { CampaignPage } from './pages/CampaignPage';
import { ParentsPage } from './pages/ParentsPage';
import { WeeklyPage } from './pages/WeeklyPage';

const navItems = [
  { to: '/campaign', label: 'Campaign' },
  { to: '/weekly', label: 'Weekly' },
  { to: '/achievements', label: 'Achievements' },
  { to: '/parents', label: 'Parents' }
];

export function App() {
  return (
    <div className="layout">
      <header>
        <h1>Dangerous Games Online</h1>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
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
        </Routes>
      </main>
    </div>
  );
}
