import { useEffect, useRef, useCallback, useState } from 'react';
import { DEFAULT_IDLE_TIMEOUT_MS } from '../types/avatar';

export interface UseIdleTimerOptions {
  timeoutMs?: number;
  enabled?: boolean;
  onIdle: () => void;
}

export interface UseIdleTimerReturn {
  resetTimer: () => void;
  setTimeoutMs: (ms: number) => void;
  timeoutMs: number;
  recordActivity: () => void;
}

export function useIdleTimer({
  timeoutMs: initialTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  enabled = true,
  onIdle,
}: UseIdleTimerOptions): UseIdleTimerReturn {
  const [timeoutMs, setTimeoutMs] = useState<number>(initialTimeoutMs);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isInteractingRef = useRef<boolean>(false);
  const onIdleRef = useRef(onIdle);

  // Keep latest onIdle callback
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const clearExistingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearExistingTimer();

    if (!enabled || timeoutMs <= 0) {
      return;
    }

    timerRef.current = setTimeout(() => {
      // If user is currently holding pointer down or actively interacting, don't sleep yet; reschedule
      if (isInteractingRef.current) {
        resetTimer();
        return;
      }
      onIdleRef.current();
    }, timeoutMs);
  }, [enabled, timeoutMs, clearExistingTimer]);

  const recordActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  // Set up event listeners for user activity across the window
  useEffect(() => {
    if (!enabled) {
      clearExistingTimer();
      return;
    }

    const handlePointerDown = () => {
      isInteractingRef.current = true;
      resetTimer();
    };

    const handlePointerUp = () => {
      isInteractingRef.current = false;
      resetTimer();
    };

    const handleUserActivity = () => {
      resetTimer();
    };

    // Attach listeners to detect user interaction
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
    window.addEventListener('pointermove', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('contextmenu', handleUserActivity, { passive: true });

    // Initial countdown when enabled
    resetTimer();

    return () => {
      clearExistingTimer();
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('pointermove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('contextmenu', handleUserActivity);
    };
  }, [enabled, resetTimer, clearExistingTimer]);

  return {
    resetTimer,
    setTimeoutMs,
    timeoutMs,
    recordActivity,
  };
}
