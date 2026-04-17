import type { QuarantinedFile } from "@types";
import { db } from "../level";
import { levelKeys } from "./keys";

export const quarantineFilesSublevel = db.sublevel<string, QuarantinedFile>(
  levelKeys.quarantineFiles,
  {
    valueEncoding: "json",
  }
);
