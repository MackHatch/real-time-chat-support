/**
 * Support Widget Loader
 * Embeds an iframe-based chat widget on any website
 */

interface WidgetOptions {
  inboxId?: string;
  baseUrl?: string;
}

interface WidgetContext {
  pageUrl?: string;
  referrer?: string;
}

class SupportWidget {
  private container: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private launcher: HTMLButtonElement | null = null;
  private isOpen = false;
  private inboxId: string;
  private baseUrl: string;
  private iframeOrigin: string;
  private messageListener: ((e: MessageEvent) => void) | null = null;

  constructor(inboxId: string = '', baseUrl: string) {
    this.inboxId = inboxId;
    this.baseUrl = baseUrl;
    this.iframeOrigin = new URL(baseUrl).origin;
  }

  init() {
    if (this.container) {
      return; // Already initialized
    }

    // Create container
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // Create launcher button
    this.launcher = document.createElement('button');
    this.launcher.setAttribute('aria-label', 'Open support chat');
    this.launcher.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #1e293b;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: transform 0.2s;
    `;
    this.launcher.textContent = '💬';
    this.launcher.addEventListener('click', () => this.toggle());
    this.launcher.addEventListener('mouseenter', () => {
      if (this.launcher) {
        this.launcher.style.transform = 'scale(1.1)';
      }
    });
    this.launcher.addEventListener('mouseleave', () => {
      if (this.launcher) {
        this.launcher.style.transform = 'scale(1)';
      }
    });

    // Create iframe
    this.iframe = document.createElement('iframe');
    const iframeUrl = `${this.baseUrl}/embed/widget?inboxId=${encodeURIComponent(this.inboxId)}`;
    this.iframe.src = iframeUrl;
    this.iframe.style.cssText = `
      width: 400px;
      height: 600px;
      border: none;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      display: none;
      background: white;
    `;
    this.iframe.setAttribute('allow', 'microphone; camera');

    // Setup message listener
    this.messageListener = (e: MessageEvent) => {
      if (e.origin !== this.iframeOrigin) {
        return; // Ignore messages from other origins
      }

      if (e.data?.type === 'WIDGET_READY') {
        // Send initial context
        this.sendContext();
      } else if (e.data?.type === 'WIDGET_RESIZE') {
        if (this.iframe && typeof e.data.height === 'number') {
          this.iframe.style.height = `${e.data.height}px`;
        }
      } else if (e.data?.type === 'WIDGET_SET_BADGE') {
        // Optional: update badge count
        // For MVP, we can ignore this
      }
    };

    window.addEventListener('message', this.messageListener);

    // Append elements
    this.container.appendChild(this.iframe);
    this.container.appendChild(this.launcher);
    document.body.appendChild(this.container);
  }

  private sendContext() {
    if (!this.iframe) return;

    const context: WidgetContext = {
      pageUrl: window.location.href,
      referrer: document.referrer || undefined,
    };

    this.iframe.contentWindow?.postMessage(
      {
        type: 'WIDGET_SET_CONTEXT',
        context,
      },
      this.iframeOrigin,
    );
  }

  open() {
    if (!this.container || !this.iframe || !this.launcher) {
      this.init();
      return;
    }

    this.isOpen = true;
    this.iframe.style.display = 'block';
    this.launcher.style.display = 'none';
    this.sendContext();

    // Notify iframe
    this.iframe.contentWindow?.postMessage(
      {
        type: 'WIDGET_SET_OPEN',
        open: true,
      },
      this.iframeOrigin,
    );
  }

  close() {
    if (!this.iframe || !this.launcher) return;

    this.isOpen = false;
    this.iframe.style.display = 'none';
    this.launcher.style.display = 'block';

    // Notify iframe
    this.iframe.contentWindow?.postMessage(
      {
        type: 'WIDGET_SET_OPEN',
        open: false,
      },
      this.iframeOrigin,
    );
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.iframe = null;
    this.launcher = null;
    this.isOpen = false;
  }
}

// Global API
interface SupportWidgetGlobal {
  init(options?: WidgetOptions): void;
  open(): void;
  close(): void;
  toggle(): void;
  destroy(): void;
}

declare global {
  interface Window {
    SupportWidget?: SupportWidgetGlobal;
  }
}

// Auto-initialize from script tag
(function () {
  let widgetInstance: SupportWidget | null = null;

  function findScriptTag(): HTMLScriptElement | null {
    // Try currentScript first (works when script is executing)
    if (document.currentScript && document.currentScript instanceof HTMLScriptElement) {
      return document.currentScript;
    }

    // Fallback: find script by src
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      if (script.src && script.src.includes('widget.js')) {
        return script;
      }
    }

    return null;
  }

  function getBaseUrl(script: HTMLScriptElement): string {
    const src = script.src;
    if (!src) {
      return window.location.origin;
    }

    try {
      const url = new URL(src);
      return url.origin;
    } catch {
      return window.location.origin;
    }
  }

  function initFromScriptTag() {
    if (widgetInstance) {
      return; // Already initialized
    }

    const script = findScriptTag();
    if (!script) {
      console.warn('[SupportWidget] Could not find script tag');
      return;
    }

    const inboxId = script.getAttribute('data-inbox-id') || '';
    const dataBaseUrl = script.getAttribute('data-base-url');
    const baseUrl = dataBaseUrl || getBaseUrl(script);

    widgetInstance = new SupportWidget(inboxId, baseUrl);
    widgetInstance.init();
  }

  // Expose global API
  window.SupportWidget = {
    init(options?: WidgetOptions) {
      if (widgetInstance) {
        widgetInstance.destroy();
      }

      const script = findScriptTag();
      const inboxId = options?.inboxId || script?.getAttribute('data-inbox-id') || '';
      const baseUrl =
        options?.baseUrl ||
        script?.getAttribute('data-base-url') ||
        (script ? getBaseUrl(script) : window.location.origin);

      widgetInstance = new SupportWidget(inboxId, baseUrl);
      widgetInstance.init();
    },
    open() {
      if (!widgetInstance) {
        initFromScriptTag();
      }
      widgetInstance?.open();
    },
    close() {
      widgetInstance?.close();
    },
    toggle() {
      if (!widgetInstance) {
        initFromScriptTag();
      }
      widgetInstance?.toggle();
    },
    destroy() {
      widgetInstance?.destroy();
      widgetInstance = null;
    },
  };

  // Auto-init if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFromScriptTag);
  } else {
    initFromScriptTag();
  }
})();
