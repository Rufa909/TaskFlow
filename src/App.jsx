import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/project/ProtectedRoute';
import AuthPage from './pages/authPage';
import HomePage from './pages/homePage';
import TodayPage from './pages/todayPage';
import UpcomingPage from './pages/upcomingPage';
import InboxPage from './pages/InboxPage';
import InboxDetailPage from './pages/InboxDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import { FiltersProvider } from './context/FiltersContext';
import { TeamsProvider } from './context/TeamsContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import FiltersModal from './components/modals/FiltersModal';
import AddTeamModal from './components/modals/AddTeamModal';
import AIChatBox from './components/AI/AIChatBox';
import ProjectWorkflowTracker from './components/project/ProjectWorkflowTracker';

function AuthenticatedAIChatBox() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || location.pathname === '/auth') {
    return null;
  }

  return <AIChatBox />;
}

function ProjectWorkflowPage() {
  const { projectId } = useParams();
  return <ProjectWorkflowTracker projectId={projectId} isOwner={false} />;
}

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
                  <Route
                    path="/inbox/:type"
                    element={
                      <ProtectedRoute>
                        <InboxDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                    <Route
                      path="/projects/:projectId/workflow"
                      element={
                        <ProtectedRoute>
                          <ProjectWorkflowPage />
                        </ProtectedRoute>
                      }
                    />
                </Routes>

                <FiltersModal />
                <AddTeamModal />
                <AuthenticatedAIChatBox />
              </BrowserRouter>
            </TeamsProvider>
          </ConfirmProvider>
        </ToastProvider>
      </FiltersProvider>
    </AuthProvider>
  );
}
