import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  showToast: (first: string | ToastType, second?: string | ToastType, third?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((first: string | ToastType, second?: string | ToastType, third?: string) => {
    let effectiveType: ToastType = 'info';
    let effectiveTitle = '';
    let effectiveMessage: string | undefined = undefined;

    const validTypes: ToastType[] = ['success', 'error', 'warning', 'info'];

    if (validTypes.includes(first as ToastType)) {
      effectiveType = first as ToastType;
      effectiveTitle = (second as string) || '';
      effectiveMessage = third;
    } else {
      effectiveTitle = first as string;
      if (second && validTypes.includes(second as ToastType)) {
        effectiveType = second as ToastType;
        effectiveMessage = third;
      } else {
        effectiveMessage = second as string;
      }
    }

    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, type: effectiveType, title: effectiveTitle, message: effectiveMessage }]);

    // Auto dismiss after 4.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => showToast('success', title, message), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast('error', title, message), [showToast]);
  const warning = useCallback((title: string, message?: string) => showToast('warning', title, message), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast('info', title, message), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/* Toast Render Strip */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const config = {
            success: {
              card: 'border-emerald-500/30 bg-[#0a0d14]/95 text-emerald-400',
              icon: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />,
            },
            error: {
              card: 'border-rose-500/30 bg-[#0a0d14]/95 text-rose-400',
              icon: <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />,
            },
            warning: {
              card: 'border-amber-500/30 bg-[#0a0d14]/95 text-amber-400',
              icon: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />,
            },
            info: {
              card: 'border-kali-cyan/30 bg-[#0a0d14]/95 text-kali-cyan',
              icon: <Info className="h-4 w-4 text-kali-cyan shrink-0 mt-0.5" />,
            },
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all ${config.card}`}
            >
              {config.icon}
              <div className="flex-1 text-xs">
                <div className="font-semibold text-white tracking-wide">{t.title}</div>
                {t.message && <div className="mt-1 text-slate-400 leading-relaxed">{t.message}</div>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-500 hover:text-white transition-colors p-0.5"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
