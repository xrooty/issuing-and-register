import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
let isShuttingDown = false;

function spawnScript(scriptName) {
  const child = spawn(npmCommand, ["run", scriptName], {
    stdio: "inherit",
    shell: true,
  });

  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      try {
        child.kill();
      } catch {
        // Ignore shutdown errors while terminating sibling processes.
      }
    }
  }

  process.exit(exitCode);
}

const server = spawnScript("dev:server");
const client = spawnScript("dev:client");

server.on("exit", (code) => {
  if (isShuttingDown) {
    return;
  }

  shutdown(Number(code || 0));
});

client.on("exit", (code) => {
  if (isShuttingDown) {
    return;
  }

  shutdown(Number(code || 0));
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

