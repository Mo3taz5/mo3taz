import { registerEvent } from "../register-event";
import { HydraApi, WindowManager, logger } from "@main/services";
import type { AxiosError } from "axios";
import fs from "fs";
import path from "path";

const login = async (
  _event: Electron.IpcMainInvokeEvent,
  email: string,
  password: string
) => {
  const logFile = path.join(process.env.APPDATA || process.env.HOME || '.', 'mo3taz-login-debug.log');
  const timestamp = new Date().toISOString();

  try {
    fs.appendFileSync(logFile, `\n[${timestamp}] Login attempt for: ${email}\n`);
    logger.info(`Login attempt for: ${email}`);
    const result = await HydraApi.login(email, password);
    fs.appendFileSync(logFile, `[${timestamp}] Login SUCCESS\n`);
    logger.info("Login successful, notifying renderer and returning auth data");
    
    // Notify renderer that user signed in
    WindowManager.mainWindow?.webContents.send("on-signin");
    
    return result;
  } catch (error: any) {
    const axiosError = error as AxiosError<any>;

    // Log to file since console might not be available
    const errorMsg = `
[${timestamp}] LOGIN FAILED
Error message: ${error.message}
Error stack: ${error.stack}
Response status: ${axiosError.response?.status}
Response data type: ${typeof axiosError.response?.data}
Response data (first 500): ${JSON.stringify(axiosError.response?.data).substring(0, 500)}
Request URL: ${axiosError.config?.url}
Request method: ${axiosError.config?.method}
`;

    fs.appendFileSync(logFile, errorMsg);
    logger.error("Login failed:", error.message);
    if (axiosError.response) {
      logger.error("Response status:", axiosError.response.status);
      logger.error("Response data:", JSON.stringify(axiosError.response.data).substring(0, 500));
    }

    // Extract meaningful error message
    const message = axiosError.response?.data?.message
      || axiosError.response?.data?.error
      || axiosError.message
      || "Login failed. Please check your credentials and try again.";

    throw new Error(message);
  }
};

registerEvent("login", login);
