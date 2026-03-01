import { Layout, Typography } from "antd";
import type { PropsWithChildren } from "react";

const { Header, Content } = Layout;

export default function AppLayout({ children }: PropsWithChildren) {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ display: "flex", alignItems: "center" }}>
        <Typography.Title level={4} style={{ color: "#fff", margin: 0 }}>
          Triad Arena
        </Typography.Title>
      </Header>
      <Content style={{ padding: 24 }}>{children}</Content>
    </Layout>
  );
}
