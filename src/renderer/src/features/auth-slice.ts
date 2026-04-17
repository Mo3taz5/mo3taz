import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { Auth, User } from "@types";

export interface AuthState {
  auth: Auth | null;
  user: User | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  auth: null,
  user: null,
  isAuthenticated: false,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<Auth | null>) => {
      state.auth = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
    },
    clearAuth: (state) => {
      state.auth = null;
      state.user = null;
      state.isAuthenticated = false;
    },
  },
});

export const { setAuth, setUser, clearAuth } = authSlice.actions;
