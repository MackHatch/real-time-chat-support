import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';
import { AuthProvider } from './lib/auth';
import { AppRoutes } from './app/AppRoutes';

const queryClient = new QueryClient();

// Playwright sets navigator.webdriver; keep the floating RQ button out of e2e
// so it cannot intercept clicks on the conversation composer.
const showReactQueryDevtools =
  import.meta.env.DEV &&
  typeof navigator !== 'undefined' &&
  !navigator.webdriver;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
      {showReactQueryDevtools ? (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      ) : null}
    </QueryClientProvider>
  </StrictMode>,
);
