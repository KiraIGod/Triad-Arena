import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthState } from "../../types/auth";

const storedToken = localStorage.getItem('token')
const storedUserId = localStorage.getItem('userId')

const initialState: AuthState = {
  token: storedToken || null,
  userId: storedToken ? Number(storedUserId) : null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; userId: number }>) {
      state.token = action.payload.token;
      state.userId = action.payload.userId;
      localStorage.setItem('token', action.payload.token)
      localStorage.setItem('userId', action.payload.userId.toString())
    },
    clearCredentials(state) {
      state.token = null;
      state.userId = null;
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
    }
  }
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
