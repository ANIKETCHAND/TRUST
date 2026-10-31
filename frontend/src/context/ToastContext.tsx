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
              border: 'border-emerald-700 bg-emerald-950/90 text-emerald-200',
              icon: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />,
            },
            error: {
              border: 'border-rose-700 bg-rose-950/90 text-rose-200',
              icon: <XCircle className="h-5 w-5 text-rose-400 shrink-0" />,
            },
            warning: {
              border: 'border-amber-700 bg-amber-950/90 text-amber-200',
              icon: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />,
            },
            info: {
              border: 'border-cyan-700 bg-cyan-950/90 text-cyan-200',
              icon: <Info className="h-5 w-5 text-cyan-400 shrink-0" />,
            },
          }[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-xl backdrop-blur transition-all animate-slide-in ${config.border}`}
            >
              {config.icon}
              <div className="flex-1 text-xs">
                <div className="font-bold text-white">{t.title}</div>
                {t.message && <div className="mt-0.5 text-slate-300">{t.message}</div>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
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
