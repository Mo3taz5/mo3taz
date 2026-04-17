import { Modal } from "@renderer/components/modal/modal";
import { TextField } from "@renderer/components/text-field/text-field";
import { Button } from "@renderer/components/button/button";
import { useTranslation } from "react-i18next";
import { useUserDetails } from "@renderer/hooks";
import { Theme } from "@types";
import { useForm } from "react-hook-form";

import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { useCallback } from "react";
import { generateUUID } from "@renderer/helpers";
import { levelDBService } from "@renderer/services/leveldb.service";

import "./modals.scss";

interface AddThemeModalProps {
  visible: boolean;
  onClose: () => void;
  onThemeAdded: () => void;
}

interface FormValues {
  name: string;
}

const DEFAULT_THEME_CODE = `/*
  Hydra Theme - Starter Theme
  Edit CSS below to customize your theme.
  
  Documentation: https://docs.hydralauncher.gg/themes.html
*/

:root {
  --color-primary: #66c0f4;
  --color-primary-rgb: 102, 192, 244;
  --color-text: #c6d4df;
  --color-text-secondary: #8f98a0;
  --color-background: #1b2838;
  --color-background-light: #2a475e;
  --color-surface: #2a475e;
  --color-border: rgba(102, 192, 244, 0.15);
}

body, #root {
  background-color: #1b2838 !important;
  color: #c6d4df !important;
}

.sidebar, .header {
  background-color: #171a21 !important;
  backdrop-filter: blur(12px) saturate(150%);
}

.card, .panel, .game-card {
  background-color: #2a475e !important;
  border: 1px solid rgba(102, 192, 244, 0.1) !important;
  border-radius: 8px !important;
}

button.primary {
  background-color: #66c0f4 !important;
  color: #1b2838 !important;
}
`;

export function AddThemeModal({
  visible,
  onClose,
  onThemeAdded,
}: Readonly<AddThemeModalProps>) {
  const { t } = useTranslation("settings");
  const { userDetails } = useUserDetails();

  const schema = yup.object({
    name: yup
      .string()
      .required(t("required_field"))
      .min(3, t("name_min_length")),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      const theme: Theme = {
        id: generateUUID(),
        name: values.name,
        isActive: false,
        author: userDetails?.id,
        authorName: userDetails?.username,
        code: DEFAULT_THEME_CODE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await levelDBService.put(theme.id, theme, "themes");
      onThemeAdded();
      onClose();
      reset();
    },
    [onClose, onThemeAdded, userDetails?.id, userDetails?.username, reset]
  );

  return (
    <Modal
      visible={visible}
      title={t("create_theme_modal_title")}
      description={t("create_theme_modal_description")}
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="add-theme-modal__container"
      >
        <TextField
          {...register("name")}
          label={t("theme_name")}
          placeholder={t("insert_theme_name")}
          hint={errors.name?.message}
          error={errors.name?.message}
        />

        <Button type="submit" theme="primary" disabled={isSubmitting}>
          {t("create_theme")}
        </Button>
      </form>
    </Modal>
  );
}
