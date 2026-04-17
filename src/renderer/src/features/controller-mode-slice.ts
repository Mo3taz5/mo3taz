import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ControllerModeState {
  isControllerMode: boolean;
}

const initialState: ControllerModeState = {
  isControllerMode: false,
};

export const controllerModeSlice = createSlice({
  name: "controllerMode",
  initialState,
  reducers: {
    toggleControllerMode: (state) => {
      state.isControllerMode = !state.isControllerMode;
    },
    setControllerMode: (state, action: PayloadAction<boolean>) => {
      state.isControllerMode = action.payload;
    },
  },
});

export const { toggleControllerMode, setControllerMode } =
  controllerModeSlice.actions;
