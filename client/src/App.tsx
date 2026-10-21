import { Route, Routes } from 'react-router-dom';
import { Layout, RequireRole } from './components/Layout';
import { Empty } from './components/Status';
import { AccountPage } from './pages/AccountPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { PaintingDetailPage } from './pages/PaintingDetailPage';
import { PaintingFormPage } from './pages/PaintingFormPage';
import { PaintingsPage } from './pages/PaintingsPage';
import { PotteryFormPage } from './pages/PotteryFormPage';
import { StudioDashboardPage } from './pages/StudioDashboardPage';
import { WallBookingPage } from './pages/WallBookingPage';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PaintingsPage />} />
        <Route path="paintings/:id" element={<PaintingDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route path="account" element={<RequireRole role="customer"><AccountPage /></RequireRole>} />
        <Route path="wall-booking" element={<RequireRole role="customer"><WallBookingPage /></RequireRole>} />
        <Route path="pottery/new" element={<RequireRole role="customer"><PotteryFormPage /></RequireRole>} />
        <Route path="pottery/:id/edit" element={<RequireRole role="customer"><PotteryFormPage /></RequireRole>} />

        <Route path="studio" element={<RequireRole role="studio"><StudioDashboardPage /></RequireRole>} />
        <Route path="studio/paintings/new" element={<RequireRole role="studio"><PaintingFormPage /></RequireRole>} />
        <Route path="studio/paintings/:id/edit" element={<RequireRole role="studio"><PaintingFormPage /></RequireRole>} />

        <Route path="*" element={<Empty>Page not found.</Empty>} />
      </Route>
    </Routes>
  );
}
