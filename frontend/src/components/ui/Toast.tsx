import { useEffect, useState, createContext, useContext, useCallback, ReactNode } from 'react';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: (type: ToastItem['type'], message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const colors: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

function ToastMessage({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 300);
    }, item.duration || 3000);
    return () => clearTimeout(timer);
  }, [item, onRemove]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm transition-all duration-300 ${colors[item.type]} ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-xs font-bold">
        {icons[item.type]}
      </span>
      <span className="flex-1">{item.message}</span>
      <button onClick={() => { setVisible(false); setTimeout(() => onRemove(item.id), 300); }} className="opacity-70 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastItem['type'], message: string, duration?: number) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <ToastMessage key={t.id} item={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
