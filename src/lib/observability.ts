export type ClientLogLevel = 'info' | 'warn' | 'error';

type ClientLogPayload = {
  level: ClientLogLevel;
  message: string;
  context?: Record<string, unknown>;
  source?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
};

function getEndpoint(): string | null {
  const raw = (import.meta as any).env?.VITE_CLIENT_LOG_ENDPOINT;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function safeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  try {
    return JSON.parse(JSON.stringify(context));
  } catch {
    return { note: 'context_not_serializable' };
  }
}

export function reportClientLog(payload: ClientLogPayload): void {
  const endpoint = getEndpoint();
  const body = {
    ...payload,
    context: safeContext(payload.context),
    source: payload.source || 'client',
    url: payload.url || (typeof window !== 'undefined' ? window.location.href : undefined),
    userAgent:
      payload.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  try {
    if (endpoint && typeof fetch === 'function') {
      const json = JSON.stringify(body);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([json], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: json,
          keepalive: true,
        });
      }
    } else {
      const fn =
        payload.level === 'error'
          ? console.error
          : payload.level === 'warn'
            ? console.warn
            : console.info;
      fn('[client-log]', body);
    }
  } catch (error) {
    console.error('[client-log] failed to report', error);
  }
}

export function installGlobalClientErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.__styledbyc_error_handlers_installed) return;
  w.__styledbyc_error_handlers_installed = true;

  window.addEventListener('error', (event) => {
    reportClientLog({
      level: 'error',
      message: event.message || 'window.error',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      },
      source: 'window.error',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    reportClientLog({
      level: 'error',
      message: reason?.message || 'unhandledrejection',
      context: {
        reason: typeof reason === 'string' ? reason : reason?.stack || String(reason),
      },
      source: 'unhandledrejection',
    });
  });
}
