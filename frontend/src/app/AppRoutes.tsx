import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AgentLayout } from './layouts/AgentLayout';
import { LoginPage } from '../pages/LoginPage';
import { InboxPage } from '../pages/InboxPage';
import { ConversationPage } from '../pages/ConversationPage';
import { TicketsPage } from '../pages/TicketsPage';
import { TicketDetailPage } from '../pages/TicketDetailPage';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { WidgetPage } from '../pages/WidgetPage';
import { EmbedWidgetPage } from '../pages/EmbedWidgetPage';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthed } = useAuth();

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function AppRoutes() {
  const { isAuthed } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthed ? <Navigate to="/app/inbox" replace /> : <LoginPage />}
      />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AgentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="inbox" replace />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="conversations/:id" element={<ConversationPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>

      <Route path="/widget" element={<WidgetPage />} />
      <Route path="/embed/widget" element={<EmbedWidgetPage />} />

      <Route path="*" element={<Navigate to="/app/inbox" replace />} />
    </Routes>
  );
}

