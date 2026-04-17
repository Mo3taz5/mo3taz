import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services";
import fs from "node:fs";
import path from "node:path";
import type { UpdateProfileRequest, UserProfile } from "@types";
import { omit } from "lodash-es";
import axios from "axios";
import { fileTypeFromFile } from "file-type";

export const patchUserProfile = async (updateProfile: UpdateProfileRequest) => {
  return HydraApi.patch<UserProfile>("/profile", updateProfile, {
    needsAuth: true,
  });
};

type PresignedUploadResponse = {
  presignedUrl: string;
  profileImageUrl?: string;
  backgroundImageUrl?: string;
  url?: string;
  imageUrl?: string;
};

const uploadImage = async (
  type: "profile-image" | "background-image",
  imagePath: string
) => {
  const stat = fs.statSync(imagePath);
  const fileBuffer = fs.readFileSync(imagePath);
  const fileSizeInBytes = stat.size;

  const response = await HydraApi.post<PresignedUploadResponse>(
    `/presigned-urls/${type}`,
    {
      imageExt: path.extname(imagePath).slice(1),
      imageLength: fileSizeInBytes,
    },
    {
      needsAuth: true,
    }
  );

  const mimeType = await fileTypeFromFile(imagePath);

  await axios.put(response.presignedUrl, fileBuffer, {
    headers: {
      "Content-Type": mimeType?.mime,
    },
  });

  const uploadedImageUrl =
    type === "background-image"
      ? response.backgroundImageUrl ?? response.imageUrl ?? response.url
      : response.profileImageUrl ?? response.imageUrl ?? response.url;

  if (!uploadedImageUrl) {
    throw new Error("Upload response did not include an image URL");
  }

  return uploadedImageUrl;
};

const updateProfile = async (
  _event: Electron.IpcMainInvokeEvent,
  updateProfile: UpdateProfileRequest
) => {
  const payload = omit(updateProfile, [
    "profileImageUrl",
    "backgroundImageUrl",
  ]);

  if (updateProfile.profileImageUrl !== undefined) {
    if (updateProfile.profileImageUrl === null) {
      payload["profileImageUrl"] = null;
    } else {
      const profileImageUrl = await uploadImage(
        "profile-image",
        updateProfile.profileImageUrl
      );

      payload["profileImageUrl"] = profileImageUrl;
    }
  }

  if (updateProfile.backgroundImageUrl !== undefined) {
    if (updateProfile.backgroundImageUrl === null) {
      payload["backgroundImageUrl"] = null;
    } else {
      const backgroundImageUrl = await uploadImage(
        "background-image",
        updateProfile.backgroundImageUrl
      );

      payload["backgroundImageUrl"] = backgroundImageUrl;
    }
  }

  return patchUserProfile(payload);
};

registerEvent("updateProfile", updateProfile);
