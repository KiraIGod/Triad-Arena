import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Typography, Form, Input, Button, message } from "antd";
import type { FormProps } from "antd";
import { useAppDispatch } from "../store";
import { setCredentials } from "../features/auth/authSlice";
import api from "../shared/api/axios";
import "./LoginPage.css";

type LoginFields = {
  username: string;
  password: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);

  const onFinish: FormProps<LoginFields>["onFinish"] = async (values) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; userId: number }>(
        "/auth/login",
        {
          username: values.username.trim(),
          password: values.password,
        },
      );
      dispatch(setCredentials({ token: data.token, userId: data.userId }));
      message.success("Вход выполнен");
      navigate("/lobby", { replace: true });
    } catch (err) {
      const msg =
        err &&
          typeof err === "object" &&
          "response" in err &&
          typeof (err as { response?: { data?: { message?: string } } }).response
            ?.data?.message === "string"
          ? (err as { response: { data: { message: string } } }).response.data
            .message
          : "Ошибка входа";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    // <Card>
    //   <Typography.Title level={3}>Вход</Typography.Title>
    //   <Form<LoginFields>
    //     name="login"
    //     layout="vertical"
    //     onFinish={onFinish}
    //     autoComplete="off"
    //     requiredMark={false}
    //   >
    //     <Form.Item
    //       name="username"
    //       label="Имя пользователя"
    //       rules={[{ required: true, message: "Введите имя пользователя" }]}
    //     >
    //       <Input placeholder="username" autoComplete="username" />
    //     </Form.Item>
    //     <Form.Item
    //       name="password"
    //       label="Пароль"
    //       rules={[{ required: true, message: "Введите пароль" }]}
    //     >
    //       <Input.Password
    //         placeholder="••••••••"
    //         autoComplete="current-password"
    //       />
    //     </Form.Item>
    //     <Form.Item>
    //       <Button type="primary" htmlType="submit" block loading={loading}>
    //         Войти
    //       </Button>
    //     </Form.Item>
    //     <div>
    //       <Typography.Text type="secondary">Нет аккаунта? </Typography.Text>
    //       <Link to="/register">Регистрация</Link>
    //     </div>
    //   </Form>
    // </Card>

    <div className="authPage">
      {/* Background */}
      <div
        className="authBg"

      />

      {/* Overlay + vignette */}
      <div className="authTexture parchment-texture" />
      <div className="authVignette darkest-vignette" />

      <div className="authContainer">
        {/* Ornament top */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div style={{ width: 128, height: 2, background: "#000" }} />
          <div
            style={{
              width: 12,
              height: 12,
              background: "var(--blood-red)",
              margin: "0 16px",
              transform: "rotate(45deg)",
              border: "2px solid #000",
            }}
          />
          <div style={{ width: 128, height: 2, background: "#000" }} />
        </div>

        {/* Panel */}
        <div className="authPanel ink-border parchment-panel">
          <div className="authPanelInner">
            <h1 className="authTitle comic-text-shadow ink-drip">
              TRIAD ARENA
            </h1>

            <div className="angular-divider" style={{ margin: "16px 0" }} />

            <p className="authSubtitle">Return to Darkness</p>

            <Form<LoginFields>
              name="login"
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
              requiredMark={false}
              className="authFields"
            >
              <Form.Item
                name="username"
                label="Имя пользователя"
                rules={[{ required: true, message: "Введите имя пользователя" }]}
              >
                <Input
                  placeholder="USERNAME"
                  autoComplete="username"
                  className="authInput parchment-texture"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Пароль"
                rules={[{ required: true, message: "Введите пароль" }]}
              >
                <Input.Password
                  placeholder="PASSWORD"
                  autoComplete="current-password"
                  className="authInput parchment-texture"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  htmlType="submit"
                  loading={loading}
                  className="authSubmit stress-warning comic-text-shadow"
                  style={{ width: "100%" }}
                >
                  Enter Battle
                </Button>
              </Form.Item>

              <div style={{ marginTop: 24, textAlign: "center" }}>
                <Typography.Text type="secondary">New recruit? </Typography.Text>
                <Link to="/register" style={{ color: "var(--blood-red)" }}>
                  Join
                </Link>
              </div>
            </Form>
          </div>
        </div>

        {/* Ornament bottom */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 32,
          }}
        >
          <div style={{ width: 128, height: 2, background: "#000" }} />
          <div
            style={{
              width: 12,
              height: 12,
              background: "var(--blood-red)",
              margin: "0 16px",
              transform: "rotate(45deg)",
              border: "2px solid #000",
            }}
          />
          <div style={{ width: 128, height: 2, background: "#000" }} />
        </div>
      </div>
    </div>
  );
}
