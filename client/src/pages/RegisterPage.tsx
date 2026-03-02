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
    <Card>
      <Typography.Title level={3}>Регистрация</Typography.Title>
      <Form<RegisterFields>
        name="register"
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
          <Input.Password placeholder="••••••••" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Повторите пароль"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Повторите пароль" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Пароли не совпадают"));
              },
            }),
          ]}
        >
          <Input.Password placeholder="••••••••" autoComplete="new-password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Зарегистрироваться
          </Button>
        </Form.Item>
        <div>
          <Typography.Text type="secondary">Уже есть аккаунт? </Typography.Text>
          <Link to="/login">Вход</Link>
        </div>
      </Form>
    </Card>
  );
}
