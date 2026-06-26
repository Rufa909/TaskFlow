const { execFileSync, spawn } = require("child_process");
const path = require("path");

const port = Number(process.env.PORT || 5000);
const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "server");

function getPidsUsingPort(targetPort) {
  if (process.platform === "win32") {
    const output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    return [
      ...new Set(
        output
          .split(/\r?\n/)
          .filter((line) => line.includes("LISTENING"))
          .filter((line) => new RegExp(`[:.]${targetPort}\\s`).test(line))
          .map((line) => Number(line.trim().split(/\s+/).at(-1)))
          .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid),
      ),
    ];
  }

  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${targetPort}`], {
      encoding: "utf8",
    });
    return output
      .split(/\r?\n/)
      .map((pid) => Number(pid.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid);
  } catch {
    return [];
  }
}

for (const pid of getPidsUsingPort(port)) {
  try {
    process.kill(pid);
    console.log(`Stopped old server process on port ${port} (PID ${pid}).`);
  } catch (err) {
    console.warn(`Could not stop process ${pid} on port ${port}: ${err.message}`);
  }
}

const child = spawn(process.execPath, ["src/app.js"], {
  cwd: serverDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
