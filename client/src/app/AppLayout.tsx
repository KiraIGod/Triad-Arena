import { Layout, Typography } from "antd";
import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";

const { Header, Content } = Layout;

export default function AppLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation()
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/lobby"

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <div className="appGlobalNoise parchment-texture" />

      {!isAuthPage &&
        <Header style={{ display: "flex", alignItems: "center" }}>
          <Typography.Title level={4} style={{ color: "#fff", margin: 0 }}>
            Triad Arena
          </Typography.Title>
        </Header>
      }
      <Content style={{ padding: 0 }}>{children}</Content>
    </Layout>
  );
}
