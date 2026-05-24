import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from './pages/authPage';
import HomePage from './pages/homePage';
import TodayPage from './pages/todayPage';
import UpcomingPage from './pages/upcomingPage';
import InboxPage from './pages/InboxPage';
import { FiltersProvider } from './context/FiltersContext';
import { TeamsProvider } from './context/TeamsContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import FiltersModal from './components/modals/FiltersModal';
import AddTeamModal from './components/modals/AddTeamModal';

export default function App() {
  return (
    <AuthProvider>
      <FiltersProvider>
        <ToastProvider>
          <ConfirmProvider>
            <TeamsProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <HomePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/today"
                    element={
                      <ProtectedRoute>
                        <TodayPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/upcoming"
                    element={
                      <ProtectedRoute>
                        <UpcomingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/inbox"
                    element={
                      <ProtectedRoute>
                        <InboxPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>

                <FiltersModal />
                <AddTeamModal />
              </BrowserRouter>
            </TeamsProvider>
          </ConfirmProvider>
        </ToastProvider>
      </FiltersProvider>
    </AuthProvider>
  );
}
