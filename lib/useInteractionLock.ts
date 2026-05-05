import { useEffect, useRef, useState } from "react";

export function useInteractionLock(defaultDelay = 450) {
  const [isLocked, setIsLocked] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  function lock(delay = defaultDelay) {
    setIsLocked(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsLocked(false);
      timeoutRef.current = null;
    }, delay);
  }

  function unlock() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsLocked(false);
  }

  return {
    isLocked,
    lock,
    unlock,
  };
}