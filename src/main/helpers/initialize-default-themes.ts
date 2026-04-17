import { logger } from "@main/services";

export async function initializeDefaultThemes() {
  // SteamOS theme creation disabled - themes should be manually imported
  // No default themes are created automatically anymore
  logger.log("Default themes initialization disabled");
}

function getDefaultSteamOsThemeCode(): string {
  return `/* Steam OS Inspired Theme for Hydra */
:root {
  --color-primary: #66c0f4;
  --color-primary-rgb: 102, 192, 244;
  --color-text: #c6d4df;
  --color-text-secondary: #8f98a0;
  --color-background: #1b2838;
  --color-background-light: #2a475e;
  --color-background-secondary: #171a21;
  --color-surface: #2a475e;
  --color-border: rgba(102, 192, 244, 0.15);
}

body, #root {
  background-color: #1b2838 !important;
  color: #c6d4df !important;
}

.sidebar, .header {
  background-color: #171a21 !important;
}

.card, .panel, .surface {
  background-color: #2a475e !important;
}

button.primary {
  background-color: #66c0f4 !important;
  color: #1b2838 !important;
}`;
}
