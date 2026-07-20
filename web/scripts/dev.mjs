import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const server = spawn(process.execPath, ["--watch", "--watch-preserve-output", resolve(root, "server/index.mjs")], { cwd: root, stdio: "inherit" });
const vite = spawn(process.execPath, [resolve(root, "node_modules/vite/bin/vite.js")], { cwd: root, stdio: "inherit" });
const children = [server, vite];

function stop(exitCode = 0) {
  children.forEach((child) => { if (!child.killed) child.kill(); });
  process.exit(exitCode);
}

children.forEach((child) => child.on("exit", (code) => { if (code && code !== 0) stop(code); }));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
