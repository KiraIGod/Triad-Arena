import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./app/AppLayout";
import ProtectedRoute from "./app/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import DeckBuilderPage from "./pages/DeckBuilderPage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/deck-builder" element={<ProtectedRoute><DeckBuilderPage /></ProtectedRoute>} />
        <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
      </Routes>
    </AppLayout>
  );
}
