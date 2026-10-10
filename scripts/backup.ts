import { backup, DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync, copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appConfig } from "../src/server/config";

async function main() {
  const { dataDir } = appConfig();
  const destination = join(dataDir, "backups", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(destination, { recursive: true });
  const files: string[] = [];
  for (const name of ["access.sqlite", "history.sqlite"]) {
    const path = join(dataDir, name);
    if (!existsSync(path)) continue;
    const source = new DatabaseSync(path, { readOnly: true });
    try { await backup(source, join(destination, name)); }
    finally { source.close(); }
    const copy = new DatabaseSync(join(destination, name), { readOnly: true });
    try {
      if (copy.prepare("PRAGMA quick_check").all().some(row => row.quick_check !== "ok")) throw new Error("La copia no superó la comprobación de integridad.");
    } finally { copy.close(); }
    files.push(name);
  }
  if (existsSync(join(dataDir, "scoreboard.json"))) {
    copyFileSync(join(dataDir, "scoreboard.json"), join(destination, "scoreboard.json")); files.push("scoreboard.json");
  }
  writeFileSync(join(destination, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), files, includesSecrets: false }, null, 2));
  console.log(`Copia verificada: ${destination}\nArchivos: ${files.join(", ") || "ninguno: aún no hay datos"}.`);
  console.log("Guárdala también fuera del servidor en un lugar privado. Los secretos del entorno se respaldan por separado.");
}
main().catch(() => { console.error("No se pudo completar y verificar el respaldo. Revisa espacio y permisos; no utilices una copia incompleta."); process.exitCode = 1; });
