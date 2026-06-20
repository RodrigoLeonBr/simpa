import { useCallback, useEffect, useState } from 'react';

interface ToastState {
  message: string;
  visible: boolean;
}

export function useToast(durationMs = 2500) {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });

  useEffect(() => {
    if (!toast.visible) return;
    const timer = window.setTimeout(() => {
      setToast((current) => ({ ...current, visible: false }));
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.visible, durationMs]);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
  }, []);

  return { toast, showToast };
}

export function ToastBanner({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="toast-banner" role="status" data-testid="toast-banner">
      {message}
    </div>
  );
}
