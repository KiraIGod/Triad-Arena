import { useEffect, useMemo, useRef, useState } from "react";

type TurnCountdownProps = {
  turnKey: string; // например `${turn}:${activePlayer}`
  seconds?: number;
  paused?: boolean;
  className?: string;
};

export default function TurnCountdown({
  turnKey,
  seconds = 30,
  paused = false,
  className
}: TurnCountdownProps) {
  const [left, setLeft] = useState(seconds);
  const deadlineRef = useRef<number>(Date.now() + seconds * 1000);

  useEffect(() => {
    deadlineRef.current = Date.now() + seconds * 1000;
    setLeft(seconds);
  }, [turnKey, seconds]);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      const leftMs = deadlineRef.current - Date.now();
      setLeft(Math.max(0, Math.ceil(leftMs / 1000)));
    }, 250);
    return () => window.clearInterval(id);
  }, [paused]);

  const text = useMemo(() => `${left}s`, [left]);

  return <span className={className}>{text}</span>;
}
