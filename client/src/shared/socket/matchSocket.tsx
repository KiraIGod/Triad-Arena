import { useEffect, useState } from "react";
import matchSocket from "./socket";



function GamePage() {
  const matchId = "test-match-1"

  const [status, setStatus] = useState("idle"); // idle | connecting | in_match
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);


  useEffect(() => {
    if (!matchId) return;

    setStatus("connecting");
    setError(null);

    if (!matchSocket.connected) matchSocket.connect();

    // listeners
    const onState = (data) => {
      setGameState(data.gameState);
      setStatus("in_match");
    };

    const onUpdate = (data) => {
      setGameState(data.gameState);
    };

    const onError = (err) => {
      setError(err);
      setStatus("idle");
    };

    matchSocket.on("match:state", onState);
    matchSocket.on("match:update", onUpdate);
    matchSocket.on("match:error", onError);

    matchSocket.emit("match:join", { matchId }, (payload) => {
      if (payload && payload.ok === false) {
        setError(payload.error || { type: "JOIN_FAILED", message: "Join failed" });
        setStatus("idle");
      }
    });
    matchSocket.on("match:join", (data) => {
      console.log("✅ joined match::: ", data);
    })



    const onConnect = () => {
      console.log("✅ connected:::: ", matchSocket.id);
    };


    const onDisconnect = (reason) => {
      console.log("❌ disconnected:", reason);
    };

      

    matchSocket.on("connect", onConnect);
    matchSocket.on("disconnect", onDisconnect);

    return () => {
      matchSocket.off("match:state", onState);
      matchSocket.off("match:update", onUpdate);
      matchSocket.off("match:error", onError);
      matchSocket.off("connect", onConnect);
      matchSocket.off("disconnect", onDisconnect);
      matchSocket.disconnect();
    };
  }, [matchId])

  return (
    <>
    </>
  )
}