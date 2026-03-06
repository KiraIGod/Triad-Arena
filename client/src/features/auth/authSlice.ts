import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthState } from "../../types/auth";

const AUTH_STORAGE_KEY = "triad_arena_auth";

function loadPersistedAuth(): AuthState {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: null, userId: null, nickname: null };
    const parsed = JSON.parse(raw) as { token?: string; userId?: string | number; nickname?: string };
    if (parsed?.token && typeof parsed.token === "string") {
      return {
        token: parsed.token,
        userId: parsed.userId as AuthState["userId"],
        nickname: parsed.nickname as AuthState["nickname"],
      };
    }
  } catch {
    /* ignore */
  }
  return { token: null, userId: null, nickname: null };
}

const initialState: AuthState = loadPersistedAuth();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; userId: number; nickname: string }>) {
      state.token = action.payload.token;
      state.userId = action.payload.userId;
      state.nickname = action.payload.nickname;
      try {
        sessionStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ token: action.payload.token, userId: action.payload.userId, nickname: action.payload.nickname })
        );
      } catch {
        /* ignore */
      }
    },
    clearCredentials(state) {
      state.token = null;
      state.userId = null;
      state.nickname = null;
      try {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
