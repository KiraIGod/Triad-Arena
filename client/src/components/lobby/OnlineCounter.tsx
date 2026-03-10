import { useEffect, useState } from "react";
import socket from "../../shared/socket/socket";
import styles from "./OnlineCounter.module.css";

export function OnlineCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = (n: number) => setCount(n);
    socket.on("arena:online", handleOnline);
    return () => {
      socket.off("arena:online", handleOnline);
    };
  }, []);

  if (count === null) return null;

  return (
    <div className={styles.counter}>
      <span className={styles.dot} aria-hidden />
      Players in arena:&nbsp;<strong>{count}</strong>
    </div>
  );
}
