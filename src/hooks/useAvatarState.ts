import { useState, useCallback, useEffect } from 'react';
import {
  AvatarExpression,
  AvatarLifecycleState,
  EXPRESSION_CONFIGS,
  INITIAL_DIALOGUE,
  INITIAL_EXPRESSION,
  INITIAL_LIFECYCLE_STATE,
  WAKE_DIALOGUE,
  VOICE_WAKE_DIALOGUE,
  SLEEP_DIALOGUE,
  DEFAULT_IDLE_TIMEOUT_MS,
} from '../types/avatar';
import { useIdleTimer } from './useIdleTimer';

export interface UseAvatarStateReturn {
  lifecycleState: AvatarLifecycleState;
  expression: AvatarExpression;
  dialogueText: string;
  isSleeping: boolean;
  isAwake: boolean;
  isMicEnabled: boolean;
  isListening: boolean;
  showDevControls: boolean;
  isAlwaysOnTop: boolean;
  idleTimeoutMs: number;
  wakeUp: (voiceActivated?: boolean) => void;
  goToSleep: () => void;
  handleAvatarClick: () => void;
  setExpression: (expr: AvatarExpression) => void;
  setDialogueText: (text: string) => void;
  toggleMic: () => void;
  toggleDevControls: () => void;
  toggleAlwaysOnTop: () => void;
  handleContextMenu: (e: React.MouseEvent) => void;
  recordActivity: () => void;
  setIdleTimeoutMs: (ms: number) => void;
  cycleNextExpression?: () => void;
}

export function useAvatarState(): UseAvatarStateReturn {
  const [lifecycleState, setLifecycleState] = useState<AvatarLifecycleState>(INITIAL_LIFECYCLE_STATE);
  const [expression, setExpressionState] = useState<AvatarExpression>(INITIAL_EXPRESSION);
  const [dialogueText, setDialogueText] = useState<string>(INITIAL_DIALOGUE);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [showDevControls, setShowDevControls] = useState<boolean>(false);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false);

  const isSleeping = lifecycleState === 'sleeping';
  const isAwake = !isSleeping;

  const notifyLifecycleChange = useCallback((nextState: 'sleeping' | 'awake') => {
    if (window.desktopAssistant?.lifecycle?.setState) {
      window.desktopAssistant.lifecycle.setState(nextState);
    }
  }, []);

  const goToSleep = useCallback(() => {
    setLifecycleState('sleeping');
    setExpressionState('sleeping');
    setDialogueText(SLEEP_DIALOGUE);
    notifyLifecycleChange('sleeping');
  }, [notifyLifecycleChange]);

  const idleTimer = useIdleTimer({
    timeoutMs: DEFAULT_IDLE_TIMEOUT_MS,
    enabled: isAwake,
    onIdle: goToSleep,
  });

  const wakeUp = useCallback((voiceActivated: boolean = false) => {
    setLifecycleState('awake');
    setExpressionState('listening');
    setDialogueText(voiceActivated ? VOICE_WAKE_DIALOGUE : WAKE_DIALOGUE);
    notifyLifecycleChange('awake');
    idleTimer.resetTimer();
  }, [notifyLifecycleChange, idleTimer]);

  const handleAvatarClick = useCallback(() => {
    if (lifecycleState === 'sleeping') {
      wakeUp(false);
    } else {
      // In awake state, clicking the owl must NOT cycle randomly through expressions.
      // It counts as an interaction that resets the inactivity timer.
      idleTimer.recordActivity();
    }
  }, [lifecycleState, wakeUp, idleTimer]);

  const setExpression = useCallback((nextExpr: AvatarExpression) => {
    setExpressionState(nextExpr);
    if (nextExpr === 'sleeping') {
      setLifecycleState('sleeping');
      setDialogueText(SLEEP_DIALOGUE);
      notifyLifecycleChange('sleeping');
    } else {
      setLifecycleState(nextExpr);
      setDialogueText(EXPRESSION_CONFIGS[nextExpr].defaultDialogue);
      notifyLifecycleChange('awake');
      idleTimer.resetTimer();
    }
  }, [notifyLifecycleChange, idleTimer]);

  const toggleMic = useCallback(async () => {
    idleTimer.recordActivity();
    if (window.desktopAssistant?.voiceActivation?.toggleMic) {
      try {
        const nextState = await window.desktopAssistant.voiceActivation.toggleMic();
        setIsMicEnabled(Boolean(nextState));
      } catch (err) {
        console.error('[useAvatarState] Failed to toggle mic:', err);
        setIsMicEnabled((prev) => !prev);
      }
    } else {
      setIsMicEnabled((prev) => !prev);
    }
  }, [idleTimer]);

  const toggleDevControls = useCallback(() => {
    setShowDevControls((prev) => !prev);
    idleTimer.recordActivity();
  }, [idleTimer]);

  const toggleAlwaysOnTop = useCallback(async () => {
    idleTimer.recordActivity();
    if (window.desktopAssistant?.windowActions?.setAlwaysOnTop) {
      const next = !isAlwaysOnTop;
      const res = await window.desktopAssistant.windowActions.setAlwaysOnTop(next);
      setIsAlwaysOnTop(Boolean(res));
    }
  }, [isAlwaysOnTop, idleTimer]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    idleTimer.recordActivity();
    if (window.desktopAssistant?.windowActions?.showContextMenu) {
      window.desktopAssistant.windowActions.showContextMenu(expression, isAlwaysOnTop, isSleeping);
    }
  }, [expression, isAlwaysOnTop, isSleeping, idleTimer]);

  // Initial check for always on top status and persisted voice activation status
  useEffect(() => {
    if (window.desktopAssistant?.windowActions?.isAlwaysOnTop) {
      window.desktopAssistant.windowActions.isAlwaysOnTop().then((pinned) => {
        setIsAlwaysOnTop(Boolean(pinned));
      });
    }

    if (window.desktopAssistant?.voiceActivation?.getStatus) {
      window.desktopAssistant.voiceActivation.getStatus().then((status) => {
        if (status) {
          setIsMicEnabled(Boolean(status.isMicEnabled));
          setIsListening(Boolean(status.isListening));
        }
      });
    }
  }, []);

  // Listen to IPC events from main process
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

    const unsubManualSleep = window.desktopAssistant?.windowActions?.onManualSleep?.(() => {
      goToSleep();
    });

    const unsubGoToSleep = window.desktopAssistant?.lifecycle?.onGoToSleep?.(() => {
      goToSleep();
    });

    const unsubWakeUp = window.desktopAssistant?.lifecycle?.onWakeUp?.((info) => {
      wakeUp(Boolean(info?.voiceActivated));
    });

    const unsubStatus = window.desktopAssistant?.voiceActivation?.onStatusChanged?.((status) => {
      setIsMicEnabled(Boolean(status.isMicEnabled));
      setIsListening(Boolean(status.isListening));
    });

    const unsubWakeWord = window.desktopAssistant?.voiceActivation?.onWakeWordDetected?.(() => {
      idleTimer.recordActivity();
    });

    return () => {
      unsubExpr?.();
      unsubPin?.();
      unsubDev?.();
      unsubManualSleep?.();
      unsubGoToSleep?.();
      unsubWakeUp?.();
      unsubStatus?.();
      unsubWakeWord?.();
    };
  }, [setExpression, goToSleep, wakeUp, idleTimer]);

  // Keyboard shortcut listener:
  // Ctrl+Shift+S -> manual sleep
  // Ctrl+Shift+D -> dev tools toggle
  // 1-4 -> mood switches
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        goToSleep();
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
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
  }, [setExpression, goToSleep]);

  // Expose dev and automated testing helpers on window
  useEffect(() => {
    window.__TOGGLE_DEV_CONTROLS__ = () => setShowDevControls((prev) => !prev);
    window.__SET_EXPRESSION__ = (expr: string) => {
      if (['happy', 'listening', 'speaking', 'sleeping'].includes(expr)) {
        setExpression(expr as AvatarExpression);
      }
    };
    window.__SET_IDLE_TIMEOUT_MS__ = (ms: number) => {
      idleTimer.setTimeoutMs(ms);
    };
    window.__GET_LIFECYCLE_STATE__ = () => lifecycleState;
    window.__WAKE_UP__ = (voiceActivated?: boolean) => wakeUp(voiceActivated);
    window.__GO_TO_SLEEP__ = () => goToSleep();
    window.__RESET_IDLE_TIMER__ = () => idleTimer.resetTimer();
    window.__SIMULATE_WAKE_WORD__ = (phrase?: string) => {
      return window.desktopAssistant?.voiceActivation?.simulateWakeWord?.(phrase) ?? Promise.resolve();
    };
    window.__GET_VOICE_STATUS__ = () => {
      return window.desktopAssistant?.voiceActivation?.getStatus?.() ?? Promise.resolve(undefined);
    };
    window.__TOGGLE_MIC__ = () => {
      return window.desktopAssistant?.voiceActivation?.toggleMic?.() ?? Promise.resolve(undefined);
    };

    return () => {
      delete window.__TOGGLE_DEV_CONTROLS__;
      delete window.__SET_EXPRESSION__;
      delete window.__SET_IDLE_TIMEOUT_MS__;
      delete window.__GET_LIFECYCLE_STATE__;
      delete window.__WAKE_UP__;
      delete window.__GO_TO_SLEEP__;
      delete window.__RESET_IDLE_TIMER__;
      delete window.__SIMULATE_WAKE_WORD__;
      delete window.__GET_VOICE_STATUS__;
      delete window.__TOGGLE_MIC__;
    };
  }, [setExpression, idleTimer, lifecycleState, wakeUp, goToSleep]);

  return {
    lifecycleState,
    expression,
    dialogueText,
    isSleeping,
    isAwake,
    isMicEnabled,
    isListening,
    showDevControls,
    isAlwaysOnTop,
    idleTimeoutMs: idleTimer.timeoutMs,
    wakeUp,
    goToSleep,
    handleAvatarClick,
    setExpression,
    setDialogueText,
    toggleMic,
    toggleDevControls,
    toggleAlwaysOnTop,
    handleContextMenu,
    recordActivity: idleTimer.recordActivity,
    setIdleTimeoutMs: idleTimer.setTimeoutMs,
  };
}
