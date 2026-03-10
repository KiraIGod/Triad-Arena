import { Layout } from "antd";
import { useEffect, useState, type PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";
import { useAppSelector } from "../store";
import socket from "../shared/socket/socket";

const { Header, Content } = Layout;

export default function AppLayout({ children }: PropsWithChildren) {
  const [isOnline, setIsOnline] = useState(socket.connected);
  const { pathname } = useLocation();
  const nickname = useAppSelector((state) => state.auth.nickname);
  const userId = useAppSelector((state) => state.auth.userId);
  const token = useAppSelector((state) => state.auth.token);
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (!token) return;

    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }

    const onConnect = () => setIsOnline(true);
    const onDisconnect = () => setIsOnline(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [token]);

  const displayName = nickname || (userId != null ? `PILOT_${userId}` : "PILOT_ZERO");
  const shouldShowHeader = !isAuthPage && pathname !== "/game";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <div className="appGlobalNoise parchment-texture" />

      {shouldShowHeader && (
        <Header
          style={{
            height: "auto",
            lineHeight: "normal",
            padding: 0,
            background: "transparent"
          }}
        >
          <header className="app-header">
            <div className="app-header__brand-wrap">
              <div className="app-header__brand-accent" />
              <div className="app-header__brand">
                <h1 className="app-header__title">Triad Arena</h1>
                <p className="app-header__subtitle">Sector_7 // Encampment</p>
              </div>
            </div>

            <div className="app-header__right">
              <p className="app-header__status">
                Status{" "}
                <span className={isOnline ? "app-header__online" : "app-header__offline"}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </p>
              <p className="app-header__user">User: {displayName}</p>
            </div>
          </header>
        </Header>
      )}
      <Content style={{ padding: 0 }}>{children}</Content>
    </Layout>
  );
}
