import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const DEMO_CREDENTIALS = {
  admin: { email: 'admin@local.test', password: 'Admin123!' },
  agent: { email: 'agent@local.test', password: 'Agent123!' },
};

export function DemoTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Show in dev by default, or if explicitly enabled in localStorage
    const showDemo = localStorage.getItem('showDemoTour') !== 'false';
    const isDev = import.meta.env.DEV;
    setIsVisible(showDemo && isDev);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('showDemoTour', 'false');
  };

  const handleCopyEmbed = async () => {
    const baseUrl = window.location.origin;
    const snippet = `<script src="${baseUrl}/widget.js"
          data-base-url="${baseUrl}"></script>`;

    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = snippet;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      data-testid="demo-tour"
      className="fixed bottom-4 right-4 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 p-4"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-100">🎯 Demo Tour</h3>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-200 text-xs"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3 text-xs text-slate-300">
        <div>
          <div className="text-slate-400 mb-1">Login Credentials:</div>
          <div className="space-y-1 font-mono text-xs">
            <div>
              <span className="text-slate-500">Admin:</span>{' '}
              {DEMO_CREDENTIALS.admin.email} / {DEMO_CREDENTIALS.admin.password}
            </div>
            <div>
              <span className="text-slate-500">Agent:</span>{' '}
              {DEMO_CREDENTIALS.agent.email} / {DEMO_CREDENTIALS.agent.password}
            </div>
          </div>
        </div>

        <div>
          <div className="text-slate-400 mb-1">Quick Links:</div>
          <div className="space-y-1">
            <Link
              to="/app/inbox?assigned=unassigned"
              className="block text-blue-400 hover:text-blue-300 underline"
            >
              → Inbox (Unassigned)
            </Link>
            <Link
              to="/app/inbox?needsAttention=true"
              className="block text-blue-400 hover:text-blue-300 underline"
            >
              → Inbox (Needs Attention)
            </Link>
            <Link
              to="/app/tickets"
              className="block text-blue-400 hover:text-blue-300 underline"
            >
              → Tickets
            </Link>
            <Link
              to="/app/analytics"
              className="block text-blue-400 hover:text-blue-300 underline"
            >
              → Analytics
            </Link>
            <Link
              to="/widget"
              className="block text-blue-400 hover:text-blue-300 underline"
            >
              → Widget Demo
            </Link>
            <a
              href="/examples/vanilla/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-blue-400 hover:text-blue-300 underline"
            >
              → Embed Demo (examples/vanilla/index.html)
            </a>
          </div>
        </div>

        <div>
          <div className="text-slate-400 mb-1">Embed Widget:</div>
          <button
            type="button"
            onClick={handleCopyEmbed}
            data-testid="demo-copy-embed"
            className="w-full px-2 py-1.5 text-xs font-medium rounded bg-slate-700 text-slate-100 hover:bg-slate-600"
          >
            {copied ? '✓ Copied!' : 'Copy Embed Snippet'}
          </button>
        </div>
      </div>
    </div>
  );
}
