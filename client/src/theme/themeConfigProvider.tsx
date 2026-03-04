import { ConfigProvider, theme as antdTheme } from "antd";
import { themeConfig } from "./themeConfig";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.darkAlgorithm,
        ...themeConfig,
      }}
    >
      {children}
    </ConfigProvider>
  );
}