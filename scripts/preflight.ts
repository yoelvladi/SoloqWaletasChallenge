import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { appConfig } from "../src/server/config";
import { players, challenge } from "../src/lib/players";
import { ranks } from "../src/lib/ranks";

try {
  if (Number(process.versions.node.split(".")[0]) !== 24) throw new Error("Usa Node.js 24 LTS.");
  const config = appConfig();
  if (!process.env.RIOT_API_KEY?.trim()) throw new Error("Falta RIOT_API_KEY.");
  if (players.length !== challenge.capacity || new Set(players.map(p => p.id)).size !== players.length) throw new Error("Revisa el número de jugadores y sus identificadores únicos.");
  mkdirSync(config.dataDir, { recursive: true });
  const probe = join(config.dataDir, `.write-check-${randomUUID()}`);
  writeFileSync(probe, "ok", { flag: "wx" }); unlinkSync(probe);
  for (const name of ["access.sqlite", "history.sqlite"]) {
    const path = join(config.dataDir, name);
    if (!existsSync(path)) { console.log(`Pendiente de inicializar: ${name}`); continue; }
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      if (db.prepare("PRAGMA quick_check").all().some(row => row.quick_check !== "ok")) throw new Error(`Revisa la integridad de ${name}.`);
      if (name === "access.sqlite") {
        const owner = db.prepare("SELECT email FROM access_grant WHERE role='admin' AND active=1").get();
        if (owner?.email !== config.adminEmail) throw new Error("ADMIN_EMAIL no coincide con el propietario guardado.");
      }
    } finally { db.close(); }
  }
  for (const rank of ranks) if (!existsSync(join("public", "ranks", `${rank.tier.toLowerCase()}.png`))) throw new Error(`Falta el emblema ${rank.tier}.`);
  console.log(`Correcto: Node 24, configuración, ${players.length} jugadores, emblemas, escritura e integridad de datos.`);
  console.log(config.local ? "Modo local. No se ha publicado la página." : "Configuración pública válida; confirma HTTPS y que DATA_DIR sea un volumen persistente en el alojamiento.");
  console.log(config.publicBoard ? "Scoreboard público: no requiere correo ni sesión. La administración conserva su autenticación." : "Scoreboard privado por invitación.");
  console.log(config.mail ? `Correo ${config.mail} configurado; la entrega real requiere una prueba con el proveedor.` : config.publicBoard ? "Correo opcional para administración; no se necesita para consultar el scoreboard." : "Pendiente para publicar: configurar correo y comprobar entrega de invitaciones.");
  console.log("La vigencia de la clave se comprueba con npm run riot:check. Este chequeo no llama a Riot ni envía correos.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo comprobar la configuración.");
  process.exitCode = 1;
}
