import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Typography, Form, Input, Button, message } from "antd";
import type { FormProps } from "antd";
import { useAppDispatch } from "../store";
import { setCredentials } from "../features/auth/authSlice";
import api from "../shared/api/axios";

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
    <Card>
      <Typography.Title level={3}>Вход</Typography.Title>
      <Form<LoginFields>
        name="login"
        layout="vertical"
        onFinish={onFinish}
        autoComplete="off"
        requiredMark={false}
      >
        <Form.Item
          name="username"
          label="Имя пользователя"
          rules={[{ required: true, message: "Введите имя пользователя" }]}
        >
          <Input placeholder="username" autoComplete="username" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Пароль"
          rules={[{ required: true, message: "Введите пароль" }]}
        >
          <Input.Password
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Войти
          </Button>
        </Form.Item>
        <div>
          <Typography.Text type="secondary">Нет аккаунта? </Typography.Text>
          <Link to="/register">Регистрация</Link>
        </div>
      </Form>
    </Card>
  );
}
