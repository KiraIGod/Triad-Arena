import { useCallback, useEffect, useRef, useState } from "react";

type UseTimedNoticeOptions = {
  visibleMs?: number;
  fadeMs?: number;
};

type UseTimedNoticeResult = {
  value: string | null;
  isFading: boolean;
  show: (message: string | null) => void;
  hide: () => void;
};

export function useTimedNotice(options?: UseTimedNoticeOptions): UseTimedNoticeResult {
  const visibleMs = options?.visibleMs ?? 2000;
  const fadeMs = options?.fadeMs ?? 3000;
  const hideMs = visibleMs + fadeMs;

  const [value, setValue] = useState<string | null>(null);
  const [isFading, setIsFading] = useState(false);
  const fadeTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (fadeTimeoutRef.current) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimers();
    setValue(null);
    setIsFading(false);
  }, [clearTimers]);

  const show = useCallback((message: string | null) => {
    hide();
    if (!message) return;

    setValue(message);
    setIsFading(false);

    fadeTimeoutRef.current = window.setTimeout(() => {
      setIsFading(true);
      fadeTimeoutRef.current = null;
    }, visibleMs);

    hideTimeoutRef.current = window.setTimeout(() => {
      setValue(null);
      setIsFading(false);
      hideTimeoutRef.current = null;
    }, hideMs);
  }, [hide, hideMs, visibleMs]);

  useEffect(() => hide, [hide]);

  return { value, isFading, show, hide };
}
