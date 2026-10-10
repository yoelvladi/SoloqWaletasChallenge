# Preparación para publicar

El proyecto permanece local. Esta revisión prepara el código y los procedimientos; no crea alojamiento, dominio ni túnel.

## Revisión realizada el 10 de octubre de 2026

- 31 pruebas automatizadas aprobadas, comprobación de tipos y compilación de producción correctas.
- Auditoría de dependencias de producción: cero vulnerabilidades conocidas reportadas en esta revisión.
- Ocho historiales reales importados desde el inicio del desafío; el tablero confirmó ocho rangos y ocho historiales actualizados.
- Prueba HTTP de producción local: scoreboard público sin sesión y administración protegida, controles de origen/host, cabeceras, recursos y página 404.
- Inicio de sesión y panel administrador verificados en navegador. La sesión y los conteos se conservaron al reiniciar.
- Vistas de 1440 px y 390 px comprobadas; ocho filas, emblemas cargados y tabla con desplazamiento propio en móvil. Sin errores de consola en la vista final.
- Respaldos de ambas bases verificados mediante `quick_check`. Los archivos privados de datos, respaldos y entorno no figuran en las trazas finales de empaquetado.
- Roles principales importados para los ocho jugadores; pruebas de posiciones desconocidas, empates y migración de historial aprobadas.
- Preparados inicio específico para Railway, comprobación de salud y envío por Resend HTTPS. Correo real y alojamiento siguen pendientes; los resultados anteriores no sustituyen esas comprobaciones externas.

## Comprobar la entrega

Desde la carpeta del proyecto, con Node.js 24 LTS:

```powershell
npm.cmd ci
npm.cmd run preflight
npm.cmd run verify
```

`preflight` no prueba la vigencia de Riot ni la entrega de correo. Para Riot usa `npm.cmd run riot:check`. Para una primera importación completa usa `npm.cmd run history:sync` con el servidor detenido. Ambos consumen la cuota de la clave.

La compilación puede probarse localmente con `npm.cmd start`, después de detener `npm.cmd run dev`. Ambos escuchan en `127.0.0.1:3000`. Con `SCOREBOARD_PUBLIC=true`, `/` y `/api/scoreboard` funcionan sin sesión. `/admin` y su API siguen protegidos. Con `SCOREBOARD_PUBLIC=false`, el tablero redirige a `/acceso` y su API devuelve 401 sin sesión.

Con el servidor local encendido, `npm.cmd run smoke` comprueba estas rutas, los controles de origen y host, las cabeceras, los emblemas y la página 404. Si abres `localhost:3000`, se muestra un enlace a la dirección correcta para evitar mezclar cookies entre dos orígenes.

Las pruebas cubren autorización, expiración y uso único de enlaces, revocación de sesiones y enlaces, cookies HTTPS, rechazo de peticiones de otro origen, límites, errores de correo y solicitudes a Resend simuladas, paginación de más de 100 partidas, corte de fecha inclusivo, remakes identificados, roles y migración del historial, conservación del último total completo, reintentos y recuperación tras reiniciar.

## Datos y respaldo

La carpeta `DATA_DIR` contiene:

| Archivo | Contenido |
| --- | --- |
| `access.sqlite` | Propietario, invitados, sesiones, enlaces con hash y límites de acceso |
| `history.sqlite` | Conteos completos, avance de importación y caché de resultados de partidas |
| `scoreboard.json` | Últimos rangos correctos |

Ejecuta `npm.cmd run backup`. Se crea una carpeta fechada en `DATA_DIR/backups/`, con copia consistente de cada base mediante la API de respaldo de SQLite, comprobación de integridad y un manifiesto. Puede ejecutarse con la aplicación abierta; cada base es independiente. Una copia solo está terminada cuando aparece `manifest.json` y el comando finaliza correctamente. Copia esa carpeta a otro lugar privado fuera del servidor. No publiques respaldos: contienen datos de acceso.

`.env.local` y los secretos del alojamiento **no se incluyen** en el respaldo automático. Consérvalos por separado en un lugar privado, especialmente `AUTH_SECRET`. No cambies ese secreto en cada reinicio.

Para recuperar:

1. Detén servidor e importadores.
2. Conserva la carpeta de datos actual completa en otro lugar, incluidos los archivos `-wal` y `-shm`, para poder deshacer la recuperación.
3. Prepara una carpeta nueva y vacía para los datos. Copia allí los archivos que enumera el manifiesto del respaldo; no mezcles archivos WAL antiguos con las bases recuperadas.
4. Configura `DATA_DIR` hacia esa carpeta, restaura los mismos secretos y ejecuta `npm.cmd run preflight`.
5. Inicia la aplicación, comprueba acceso y ocho jugadores. Las consultas de Riot actualizarán los datos anteriores. Un respaldo de accesos puede restaurar permisos antiguos: revisa y vuelve a revocar los que corresponda antes de exponer el sitio.

No hay eliminación automática de respaldos ni tarea programada todavía. Su frecuencia y almacenamiento externo se decidirán con el alojamiento.

## Decisiones pendientes del despliegue

- **Alojamiento:** proceso Node.js 24 persistente, una sola instancia y disco persistente local para SQLite. Esta versión no admite réplicas ni compartir la base mediante un sistema de archivos de red. No usar disco efímero para `DATA_DIR`.
- **URL:** configurar `APP_URL` con el origen HTTPS exacto. El proxy del alojamiento debe conservar el host público; no se confía en un host arbitrario enviado por el visitante. `npm run start:railway` escucha en `0.0.0.0` y el `PORT` suministrado por Railway; los comandos locales siguen restringidos a loopback. `/api/health` es público y devuelve solo disponibilidad, sin datos del scoreboard.
- **Correo:** configurar Resend HTTPS con remitente verificado, o SMTP con TLS (465 o 587) donde esté permitido. Railway Free, Trial y Hobby requieren HTTPS. Probar solicitud, recepción, confirmación, reenvío y caducidad con un destinatario autorizado. No se ha verificado entrega real porque todavía no hay proveedor configurado.
- **Riot:** mantener una clave vigente. Las claves de desarrollo caducan; completar el registro y tipo de clave adecuado antes de depender del sitio continuamente. Nunca usar `NEXT_PUBLIC_` para los secretos.
- **Operación:** elegir programación de respaldos, alertas si Riot rechaza la clave y conservación de registros sin tokens ni secretos. El tablero actual consulta mientras hay visitantes; no promete captura continua ni actualización instantánea.

La configuración rechaza una URL pública sin HTTPS y ruta absoluta de datos. El correo es opcional con `SCOREBOARD_PUBLIC=true`; se exige para modo privado remoto. Que una ruta sea absoluta no demuestra que el alojamiento la conserve: esto debe verificarse reiniciando el servicio en el proveedor elegido. Los pasos específicos están en [RAILWAY.md](RAILWAY.md).
