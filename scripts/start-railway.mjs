import { spawn } from "node:child_process";

const port = process.env.PORT;
if (!port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error("Railway debe proporcionar un PORT válido."); process.exit(1);
}
if (!process.env.RAILWAY_ENVIRONMENT_ID) {
  console.error("Este comando es exclusivo de Railway. En tu computador usa npm start o npm run dev."); process.exit(1);
}
const child = spawn(process.execPath, ["--use-system-ca", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", port], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("No se pudo iniciar el servidor."); process.exit(1); });
child.on("exit", (code, signal) => { process.exit(code ?? (signal === "SIGTERM" ? 143 : 1)); });
