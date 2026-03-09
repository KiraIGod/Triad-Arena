import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Card, Typography, Form, Input, Button, message } from "antd"
import type { FormProps } from "antd"
import { useAppDispatch } from "../store"
import { setCredentials } from "../features/auth/authSlice"
import api from "../shared/api/axios"

import "./LoginRegister.css"

type LoginFields = {
  username: string
  password: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [loading, setLoading] = useState(false)

  const onFinish: FormProps<LoginFields>["onFinish"] = async (values) => {
    setLoading(true)
    try {
      const { data } = await api.post<{ token: string; userId: number; nickname: string }>(
        "/auth/login",
        {
          username: values.username.trim(),
          password: values.password,
        },
      )
      dispatch(setCredentials({ token: data.token, userId: data.userId, nickname: typeof data.nickname === "string" ? data.nickname : "" }))
      message.success("Login completed")
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
          : "Login error"
      message.error(msg)
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
            <h1 className="authTitle comic-text-shadow ink-drip">TRIAD ARENA</h1>
            <div className="angular-divider authDivider" />
            <p className="authSubtitle">Return to Darkness</p>

            <Form<LoginFields>
              name="login"
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
              requiredMark={false}
              className="authFields auth-form"
            >
              <Form.Item
                name="username"
                rules={[{ required: true, message: "Enter username" }]}
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
                  { min: 8, message: 'Minimum of 8 characters' },
                  {
                    pattern: /^(?=.*[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|])/,
                    message: 'At least one special character',
                  },
                ]}
              >
                <Input.Password
                  placeholder="PASSWORD"
                  autoComplete="current-password"
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
                  <span className="comic-text-shadow authSubmitText">ENTER BATTLE</span>
                </Button>
              </Form.Item>

              <div className="authActions">
                <Typography.Text type="secondary">New recruit? </Typography.Text>
                <Link to="/register" className="authLink">Join</Link>
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
