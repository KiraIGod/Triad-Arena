import { Layout } from "antd"
import { useEffect, useState, type PropsWithChildren } from "react"
import { useAppSelector } from "../store"
import socket from "../shared/socket/socket"

const { Content } = Layout

export default function AppLayout({ children }: PropsWithChildren) {
  const [, setIsOnline] = useState(socket.connected)
  const token = useAppSelector((state) => state.auth.token)

  useEffect(() => {
    if (!token) return

    socket.auth = { token }
    if (!socket.connected) {
      socket.connect()
    }

    const onConnect = () => setIsOnline(true)
    const onDisconnect = () => setIsOnline(false)

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
    };
  }, [token])

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <div className="appGlobalNoise parchment-texture" />

      <Content style={{ padding: 0 }}>{children}</Content>
    </Layout>
  )
}
