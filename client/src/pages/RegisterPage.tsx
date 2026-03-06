import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Typography, Form, Input, Button, message } from "antd";
import type { FormProps } from "antd";
import { useAppDispatch } from "../store";
import { setCredentials } from "../features/auth/authSlice";
import api from "../shared/api/axios";

import "./LoginRegister.css";

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
      const { data } = await api.post<{ token: string; userId: number; nickname: string }>(
        "/auth/register",
        {
          username: values.username.trim(),
          password: values.password,
        },
      );
      dispatch(setCredentials({ token: data.token, userId: data.userId, nickname: typeof data.nickname === "string" ? data.nickname : "" }));
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
    // <Card className="registerCard">
    //   <Typography.Title level={3}>Join the dark side</Typography.Title>
    //   <Form<RegisterFields>
    //     name="register"
    //     layout="vertical"
    //     onFinish={onFinish}
    //     autoComplete="off"
    //     requiredMark={false}
    //   >
    //     <Form.Item
    //       name="username"
    //       label=""
    //       rules={[{ required: true, message: "Введите имя пользователя" }]}
    //     >
    //       <Input placeholder="username" autoComplete="username" />
    //     </Form.Item>
    //     <Form.Item
    //       name="password"
    //       label=""
    //       rules={[{ required: true, message: "Введите пароль" }]}
    //     >
    //       <Input.Password placeholder="password" autoComplete="new-password" />
    //     </Form.Item>
    //     <Form.Item
    //       name="confirmPassword"
    //       label=""
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
    //       <Input.Password placeholder="repeat password" autoComplete="new-password" />
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
      <div className="authBg" />
      <div className="authTexture" />
      <div className="authVignette darkest-vignette" />

      <div className="authContainer">
        <div className="authOrnament authOrnamentTop">
          <div className="authOrnamentLine" />
          <div className="authOrnamentDiamond" />
          <div className="authOrnamentLine" />
        </div>

        <div className="authPanel ink-border parchment-panel">
          <div className="authPanelInner">
            <h1 className="authTitle comic-text-shadow ink-drip">JOIN THE ARENA</h1>
            <div className="angular-divider authDivider" />
            <p className="authSubtitle">Sign the Blood Oath</p>

            <Form<RegisterFields>
              name="register"
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
              requiredMark={false}
              className="authFields auth-form"
            >
              <Form.Item
                name="username"
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
                rules={[
                  { required: true, message: "Enter password" },
                  { min: 8, message: 'Чуваааак, пароль должен быть минимум 8 символов'},
                  {
                    pattern: /^(?=.*[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|])/,
                    message: 'Погоди, нужен хотя бы один спецсимвол',
                  },
                ]}
              >
                <Input.Password
                  placeholder="PASSWORD"
                  autoComplete="new-password"
                  className="authInput parchment-texture"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
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
                <Input.Password
                  placeholder="CONFIRM PASSWORD"
                  autoComplete="new-password"
                  className="authInput parchment-texture"
                />
              </Form.Item>

              <Form.Item className="authSubmitWrap">
                <Button
                  htmlType="submit"
                  loading={loading}
                  className="authSubmit stress-warning"
                  block
                >
                  <span className="comic-text-shadow authSubmitText">SWEAR ALLEGIANCE</span>
                </Button>
              </Form.Item>

              <div className="authActions registerActions">
                <Typography.Text type="secondary">Already enlisted? </Typography.Text>
                <Link to="/login" className="authLink registerLink">Return</Link>
              </div>
            </Form>
          </div>
        </div>

        <div className="authOrnament authOrnamentBottom">
          <div className="authOrnamentLine" />
          <div className="authOrnamentDiamond" />
          <div className="authOrnamentLine" />
        </div>
      </div>
    </div>
  );
}
