import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Typography, Form, Input, Button, notification } from "antd"
import type { FormProps } from "antd"
import { useAppDispatch } from "../store"
import { setCredentials } from "../features/auth/authSlice"
import api from "../shared/api/axios"

import "./LoginRegister.css"

type RegisterFields = {
  username: string;
  password: string;
  confirmPassword: string
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [loading, setLoading] = useState(false)

  const onFinish: FormProps<RegisterFields>["onFinish"] = async (values) => {
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; userId: string | number; nickname: string }>(
        "/auth/register",
        {
          username: values.username.trim(),
          password: values.password,
        },
      )
      dispatch(setCredentials({ token: data.token, userId: data.userId, nickname: typeof data.nickname === "string" ? data.nickname : "" }))

      notification.success({
        message: "Registration is successful",
        placement: 'top',
        className: 'arena-custom-notification',
        duration: 3,
      })

      navigate("/lobby", { replace: true })
    } catch (err) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err &&
        typeof (err as { response?: { data?: { message?: string } } }).response
          ?.data?.message === "string"
          ? (err as { response: { data: { message: string } } }).response.data
              .message
          : "Registration error"

      notification.error({
        message: msg,
        placement: 'top',
        className: 'arena-custom-notification',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
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
                rules={[{ required: true, message: "Enter the user's name" }]}
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
                  { min: 8, message: 'Minimum of 8 characters'},
                  {
                    pattern: /^(?=.*[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|])/,
                    message: 'At least one special character',
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
                  { required: true, message: "Repeat the password" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Passwords don't match"));
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
  )
}