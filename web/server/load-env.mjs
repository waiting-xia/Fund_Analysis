import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const projectEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));

if (existsSync(projectEnvPath)) {
  try { process.loadEnvFile?.(projectEnvPath); }
  catch (error) { console.error(`无法读取统一配置文件 ${projectEnvPath}:`, error instanceof Error ? error.message : error); }
}
