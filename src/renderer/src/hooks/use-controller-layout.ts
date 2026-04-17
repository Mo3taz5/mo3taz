import { useEffect, useMemo, useState } from "react";

import type { ControllerLayoutPreference } from "@types";
import {
  resolveControllerLayout,
  scanConnectedControllerLayout,
  type DetectedControllerLayout,
  type ResolvedControllerLayout,
} from "@renderer/helpers/controller-layout";

export function useControllerLayout(
  preference: ControllerLayoutPreference | null | undefined = "auto"
) {
  const [detectedController, setDetectedController] =
    useState<DetectedControllerLayout | null>(null);

  useEffect(() => {
    let interval = 0;

    const updateDetection = () => {
      const nextController = scanConnectedControllerLayout();
      setDetectedController((current) => {
        if (
          current?.layout === nextController?.layout &&
          current?.rawId === nextController?.rawId &&
          current?.label === nextController?.label
        ) {
          return current;
        }

        return nextController;
      });
    };

    updateDetection();
    interval = window.setInterval(updateDetection, 1500);

    const handleGamepadChange = () => updateDetection();
    window.addEventListener("gamepadconnected", handleGamepadChange);
    window.addEventListener("gamepaddisconnected", handleGamepadChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("gamepadconnected", handleGamepadChange);
      window.removeEventListener("gamepaddisconnected", handleGamepadChange);
    };
  }, []);

  const resolvedLayout = useMemo<ResolvedControllerLayout>(() => {
    return resolveControllerLayout(preference, detectedController?.layout);
  }, [detectedController?.layout, preference]);

  return {
    detectedController,
    detectedLayout: detectedController?.layout ?? null,
    detectedLabel: detectedController?.label ?? null,
    detectedRawId: detectedController?.rawId ?? null,
    resolvedLayout,
  };
}
