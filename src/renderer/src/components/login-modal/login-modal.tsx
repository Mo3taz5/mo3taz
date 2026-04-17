import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, TextField } from "@renderer/components";
import { useToast, useAppDispatch } from "@renderer/hooks";
import { setAuth } from "@renderer/features";
import { AuthPage } from "@shared";
import "./login-modal.scss";

export interface LoginModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LoginModal({ visible, onClose }: LoginModalProps) {
  const { t } = useTranslation("login");
  const { showErrorToast, showSuccessToast } = useToast();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showErrorToast(t("fill_all_fields"));
      return;
    }

    setIsLoading(true);

    try {
      console.log("[LoginModal] Attempting login for:", email);
      const auth = await window.electron.login(email, password);
      console.log("[LoginModal] Login response received:", auth ? "has data" : "null");
      dispatch(setAuth(auth));
      showSuccessToast(t("login_success"));
      onClose();
    } catch (error: any) {
      console.error("[LoginModal] Login error:", error);
      const message = error?.message || error?.toString() || t("login_error");
      showErrorToast(`Login failed: ${message}`);
      alert(`Login Error:\n${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    await window.electron.openAuthWindow(AuthPage.SignUp);
  };

  const handleForgotPassword = async () => {
    await window.electron.openAuthWindow(AuthPage.ForgotPassword);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <Modal
      visible={visible}
      title={t("title")}
      description={t("description")}
      onClose={onClose}
    >
      <div className="login-modal">
        <div className="login-modal__fields">
          <TextField
            label={t("email")}
            placeholder={t("email_placeholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            type="email"
            autoComplete="email"
          />

          <TextField
            label={t("password")}
            placeholder={t("password_placeholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            type="password"
            autoComplete="current-password"
          />
        </div>

        <div className="login-modal__forgot-password">
          <button
            type="button"
            className="login-modal__forgot-password-link"
            onClick={handleForgotPassword}
            disabled={isLoading}
          >
            {t("forgot_password")}
          </button>
        </div>

        <div className="login-modal__actions">
          <Button
            type="button"
            theme="primary"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? t("logging_in") : t("login")}
          </Button>
        </div>

        <div className="login-modal__sign-up">
          <span>{t("no_account")}</span>
          <button
            type="button"
            className="login-modal__sign-up-link"
            onClick={handleSignUp}
            disabled={isLoading}
          >
            {t("sign_up")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
