import { useState, useCallback, useEffect } from 'react';
import {
  AvatarExpression,
  EXPRESSION_CONFIGS,
  INITIAL_DIALOGUE,
  INITIAL_EXPRESSION,
} from '../types/avatar';

export interface UseAvatarStateReturn {
  expression: AvatarExpression;
  dialogueText: string;
  isMicEnabled: boolean;
  showDevControls: boolean;
  isAlwaysOnTop: boolean;
  setExpression: (expr: AvatarExpression) => void;
  setDialogueText: (text: string) => void;
  toggleMic: () => void;
  cycleNextExpression: () => void;
  toggleDevControls: () => void;
  toggleAlwaysOnTop: () => void;
  handleContextMenu: (e: React.MouseEvent) => void;
}

const EXPRESSION_ORDER: AvatarExpression[] = ['happy', 'listening', 'speaking', 'sleeping'];

export function useAvatarState(): UseAvatarStateReturn {
  const [expression, setExpressionState] = useState<AvatarExpression>(INITIAL_EXPRESSION);
  const [dialogueText, setDialogueText] = useState<string>(INITIAL_DIALOGUE);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(false);
  const [showDevControls, setShowDevControls] = useState<boolean>(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false);

  const setExpression = useCallback((nextExpr: AvatarExpression) => {
    setExpressionState(nextExpr);
    setDialogueText(EXPRESSION_CONFIGS[nextExpr].defaultDialogue);
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicEnabled((prev) => !prev);
  }, []);

  const toggleDevControls = useCallback(() => {
    setShowDevControls((prev) => !prev);
  }, []);

  const cycleNextExpression = useCallback(() => {
    setExpressionState((current) => {
      const currentIndex = EXPRESSION_ORDER.indexOf(current);
      const nextIndex = (currentIndex + 1) % EXPRESSION_ORDER.length;
      const nextExpr = EXPRESSION_ORDER[nextIndex];
      setDialogueText(EXPRESSION_CONFIGS[nextExpr].defaultDialogue);
      return nextExpr;
    });
  }, []);

  const toggleAlwaysOnTop = useCallback(async () => {
    if (window.desktopAssistant?.windowActions?.setAlwaysOnTop) {
      const next = !isAlwaysOnTop;
      const res = await window.desktopAssistant.windowActions.setAlwaysOnTop(next);
      setIsAlwaysOnTop(Boolean(res));
    }
  }, [isAlwaysOnTop]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (window.desktopAssistant?.windowActions?.showContextMenu) {
      window.desktopAssistant.windowActions.showContextMenu(expression, isAlwaysOnTop);
    }
  }, [expression, isAlwaysOnTop]);

  // Initial check for always on top status
  useEffect(() => {
    if (window.desktopAssistant?.windowActions?.isAlwaysOnTop) {
      window.desktopAssistant.windowActions.isAlwaysOnTop().then((pinned) => {
        setIsAlwaysOnTop(Boolean(pinned));
      });
    }
  }, []);

  // Listen to main process context menu IPC events
  useEffect(() => {
    const unsubExpr = window.desktopAssistant?.windowActions?.onSetExpression?.((expr) => {
      if (['happy', 'listening', 'speaking', 'sleeping'].includes(expr)) {
        setExpression(expr as AvatarExpression);
      }
    });

    const unsubPin = window.desktopAssistant?.windowActions?.onAlwaysOnTopChanged?.((pinned) => {
      setIsAlwaysOnTop(pinned);
    });

    const unsubDev = window.desktopAssistant?.windowActions?.onToggleDevControls?.(() => {
      setShowDevControls((prev) => !prev);
    });

    return () => {
      unsubExpr?.();
      unsubPin?.();
      unsubDev?.();
    };
  }, [setExpression]);

  // Keyboard shortcut listener (Ctrl+Shift+D for dev tools, 1-4 for quick mood switches)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setShowDevControls((prev) => !prev);
      } else if (e.key === '1') {
        setExpression('happy');
      } else if (e.key === '2') {
        setExpression('listening');
      } else if (e.key === '3') {
        setExpression('speaking');
      } else if (e.key === '4') {
        setExpression('sleeping');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setExpression]);

  // Expose dev helpers on window for development & automated tests
  useEffect(() => {
    window.__TOGGLE_DEV_CONTROLS__ = () => setShowDevControls((prev) => !prev);
    window.__SET_EXPRESSION__ = (expr: string) => {
      if (['happy', 'listening', 'speaking', 'sleeping'].includes(expr)) {
        setExpression(expr as AvatarExpression);
      }
    };

    return () => {
      delete window.__TOGGLE_DEV_CONTROLS__;
      delete window.__SET_EXPRESSION__;
    };
  }, [setExpression]);

  return {
    expression,
    dialogueText,
    isMicEnabled,
    showDevControls,
    isAlwaysOnTop,
    setExpression,
    setDialogueText,
    toggleMic,
    cycleNextExpression,
    toggleDevControls,
    toggleAlwaysOnTop,
    handleContextMenu,
  };
}
