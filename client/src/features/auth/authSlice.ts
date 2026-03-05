import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthState } from "../../types/auth";

const AUTH_STORAGE_KEY = "triad_arena_auth";

function loadPersistedAuth(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: null, userId: null };
    const parsed = JSON.parse(raw) as { token?: string; userId?: string | number };
    if (parsed?.token && typeof parsed.token === "string") {
      return {
        token: parsed.token,
        userId: parsed.userId as AuthState["userId"]
      };
    }
  } catch {
    /* ignore */
  }
  return { token: null, userId: null };
}

const initialState: AuthState = loadPersistedAuth();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; userId: number }>) {
      state.token = action.payload.token;
      state.userId = action.payload.userId;
      try {
        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({ token: action.payload.token, userId: action.payload.userId })
        );
      } catch {
        /* ignore */
      }
    },
    clearCredentials(state) {
      state.token = null;
      state.userId = null;
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
