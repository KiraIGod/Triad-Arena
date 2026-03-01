import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthState } from "../../types/auth";

const initialState: AuthState = {
  token: null,
  userId: null
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; userId: number }>) {
      state.token = action.payload.token;
      state.userId = action.payload.userId;
    },
    clearCredentials(state) {
      state.token = null;
      state.userId = null;
    }
  }
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
