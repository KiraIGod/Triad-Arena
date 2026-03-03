import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "antd/dist/reset.css";
import App from "./App";
import { store } from "./store";
import "./styles/antd-overrides.css"
import { themeConfig } from "./theme/themeConfig"
import { ConfigProvider, theme as antdTheme } from "antd";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider
        theme={{
          algorithm: antdTheme.darkAlgorithm,
          ...themeConfig,
        }}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfigProvider>
    </Provider>
  </React.StrictMode>
);
