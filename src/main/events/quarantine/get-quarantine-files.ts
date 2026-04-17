import fs from "node:fs";
import { registerEvent } from "../register-event";
import { quarantineFilesSublevel } from "@main/level";

const getQuarantineFiles = async () => {
  const files = await quarantineFilesSublevel.values().all();

  return files
    .filter(
      (file) =>
        file &&
        !file.restoredAt &&
        fs.existsSync(file.quarantinePath)
    )
    .sort((left, right) => right.createdAt - left.createdAt);
};

registerEvent("getQuarantineFiles", getQuarantineFiles);
