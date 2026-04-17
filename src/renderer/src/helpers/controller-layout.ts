import type { ControllerLayoutPreference } from "@types";

export type ResolvedControllerLayout = Exclude<ControllerLayoutPreference, "auto">;

export interface DetectedControllerLayout {
  layout: ResolvedControllerLayout;
  label: string;
  rawId: string;
}

const PLAYSTATION_PATTERN =
  /playstation|dualshock|dualsense|wireless controller|sony|ps4|ps5/i;
const XBOX_PATTERN = /xbox|xinput|microsoft|x-?box/i;

export function detectControllerLayoutFromId(
  rawId: string | null | undefined
): DetectedControllerLayout | null {
  if (!rawId) return null;

  if (PLAYSTATION_PATTERN.test(rawId)) {
    return {
      layout: "playstation",
      label: "PlayStation Controller",
      rawId,
    };
  }

  if (XBOX_PATTERN.test(rawId) || /standard/i.test(rawId)) {
    return {
      layout: "xbox",
      label: "Xbox Controller",
      rawId,
    };
  }

  return {
    layout: "xbox",
    label: rawId,
    rawId,
  };
}

export function scanConnectedControllerLayout(): DetectedControllerLayout | null {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return null;
  }

  const gamepads = navigator.getGamepads();
  for (const gamepad of gamepads) {
    if (!gamepad) continue;
    if (!gamepad.connected) continue;

    const detected = detectControllerLayoutFromId(gamepad.id);
    if (detected) {
      return detected;
    }
  }

  return null;
}

export function resolveControllerLayout(
  preference: ControllerLayoutPreference | null | undefined,
  detected: ResolvedControllerLayout | null | undefined
): ResolvedControllerLayout {
  if (preference === "xbox" || preference === "playstation") {
    return preference;
  }

  return detected ?? "xbox";
}

export function getControllerLayoutDisplayName(
  layout: ResolvedControllerLayout
): string {
  return layout === "playstation" ? "PlayStation" : "Xbox";
}
