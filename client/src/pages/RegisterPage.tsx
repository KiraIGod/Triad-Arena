import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Typography, Form, Input, Button, message } from "antd";
import type { FormProps } from "antd";
import { useAppDispatch } from "../store";
import { setCredentials } from "../features/auth/authSlice";
import api from "../shared/api/axios";

type RegisterFields = {
  username: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);

  const onFinish: FormProps<RegisterFields>["onFinish"] = async (values) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; userId: number }>(
        "/auth/register",
        {
          username: values.username.trim(),
          password: values.password,
        },
      );
      dispatch(setCredentials({ token: data.token, userId: data.userId }));
      message.success("Регистрация успешна");
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
          : "Ошибка регистрации";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    // <Card>
    //   <Typography.Title level={3}>Регистрация</Typography.Title>
    //   <Form<RegisterFields>
    //     name="register"
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
    //       <Input.Password placeholder="••••••••" autoComplete="new-password" />
    //     </Form.Item>
    //     <Form.Item
    //       name="confirmPassword"
    //       label="Повторите пароль"
    //       dependencies={["password"]}
    //       rules={[
    //         { required: true, message: "Повторите пароль" },
    //         ({ getFieldValue }) => ({
    //           validator(_, value) {
    //             if (!value || getFieldValue("password") === value) {
    //               return Promise.resolve();
    //             }
    //             return Promise.reject(new Error("Пароли не совпадают"));
    //           },
    //         }),
    //       ]}
    //     >
    //       <Input.Password placeholder="••••••••" autoComplete="new-password" />
    //     </Form.Item>
    //     <Form.Item>
    //       <Button type="primary" htmlType="submit" block loading={loading}>
    //         Зарегистрироваться
    //       </Button>
    //     </Form.Item>
    //     <div>
    //       <Typography.Text type="secondary">Уже есть аккаунт? </Typography.Text>
    //       <Link to="/login">Вход</Link>
    //     </div>
    //   </Form>
    // </Card>

    <div className="authPage">
      {/* Background */}
      <div
        className="authBg"
        style={{ backgroundImage: `url(${backgroundImageUrl})` }}
      />
      <div className="authTexture parchment-texture" />
      <div className="authVignette darkest-vignette" />

      <div className="authContainer">
        {/* Ornamental top decoration */}
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

        {/* Main Panel */}
        <div className="authPanel ink-border parchment-panel">
          <div className="authPanelInner">
            <h1 className="authTitle comic-text-shadow ink-drip">
              TRIAD ARENA
            </h1>

            <div className="angular-divider" style={{ margin: "16px 0" }} />

            <p className="authSubtitle">Return to Darkness</p>

            <Form
              name="login"
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
              requiredMark={false}
              className="authFields"
            >
              <Form.Item
                name="username"
                label={
                  <Typography.Text style={{ color: "var(--text-faded)" }}>
                    Имя пользователя
                  </Typography.Text>
                }
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
                label={
                  <Typography.Text style={{ color: "var(--text-faded)" }}>
                    Пароль
                  </Typography.Text>
                }
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
                <Typography.Text type="secondary">
                  Нет аккаунта?{" "}
                </Typography.Text>
                <Link to="/register" style={{ color: "var(--blood-red)" }}>
                  Регистрация
                </Link>
              </div>
            </Form>
          </div>
        </div>

        {/* Ornamental bottom decoration */}
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
