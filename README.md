# SoloQWaletasChallenge

Scoreboard para **ocho cuentas de League of Legends de LAS**, con Next.js, React y TypeScript. Diseño inspirado en Hextech, con emblemas oficiales de Riot y tabla adaptable a móviles. Con `SCOREBOARD_PUBLIC=true`, cualquier persona con el enlace puede ver la clasificación sin correo ni sesión; la administración sigue protegida.

Participantes: **Vurka#LAS**, **Nexklee#LAS**, **Nunc4gano#LAS**, **diez y siete#soloq**, **VNTCR47LaNovaEra#SOLOQ**, **ANGOL BrunoSex7#LAS**, **ZeroGokii#LAS** y **ThanaTosSP#LAS**. Las ocho cuentas se verificaron contra Riot el 9 de octubre de 2026.

## Ejecutar

Requiere Node.js **24 LTS**. En Windows, desde esta carpeta:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abre http://127.0.0.1:3000. El servidor escucha exclusivamente en este computador. Para cerrarlo, pulsa Ctrl+C en su terminal. Usa siempre `127.0.0.1` para coincidir con `APP_URL` y las cookies de acceso.

Los comandos de inicio usan `--use-system-ca` para reconocer los certificados de confianza de Windows, manteniendo activa la validación HTTPS. Esto evita errores de conexión en equipos cuya red utiliza una autoridad de certificación adicional.

## Acceso público sin correo

La instalación local usa `SCOREBOARD_PUBLIC=true`. Abre la página y consulta directamente los ocho jugadores. No se necesita Resend ni SMTP para publicar esta modalidad. Los visitantes solo leen la clasificación; los participantes se cambian en `src/lib/players.ts`.

La vista pública no muestra correos, accesos administrativos ni instrucciones de configuración. `ADMIN_EMAIL` y `AUTH_SECRET` se conservan para la administración existente. Cambiar `SCOREBOARD_PUBLIC=false` restaura el acceso por invitación y exige correo para una URL remota. No hay restricciones individuales para ver el tablero cuando el modo público está activo.

## Entrar como administrador (opcional)

La cuenta administradora se configura mediante `ADMIN_EMAIL` en `.env.local`. En este computador ya está preparada con el correo indicado por el propietario. El envío de correo todavía requiere configuración. Mientras tanto, abre **otra terminal** en la carpeta del proyecto y ejecuta:

```powershell
npm.cmd run auth:link
```

El comando muestra un enlace privado: ábrelo en tu navegador y pulsa **Entrar al desafío**. Caduca en 10 minutos y solo funciona una vez. No se envía ningún correo en este modo. El enlace solo debe verlo su destinatario; no lo publiques ni guardes su salida en un repositorio.

Dentro de la página, **Accesos** abre el panel del administrador. Permite autorizar correos, reenviar enlaces cuando el proveedor de correo está configurado y revocar accesos. La revocación invalida sus sesiones y enlaces pendientes. Los invitados solo pueden consultar el scoreboard.

Para probar un correo que ya autorizaste, desde tu terminal local:

```powershell
npm.cmd run auth:link -- persona@ejemplo.com
```

El comando local confía en quien tiene acceso al computador y a sus archivos; **no verifica la propiedad del correo**. Está restringido a una URL local. En una publicación, el destinatario debe recibir el enlace mediante el servicio de correo.

## Configuración del acceso y correo

Para otra instalación, copia `.env.example` como `.env.local` y completa:

- `APP_URL=http://127.0.0.1:3000`
- `ADMIN_EMAIL`: el correo del propietario.
- `AUTH_SECRET`: un secreto aleatorio de al menos 32 caracteres, que debes conservar entre reinicios. Puedes generarlo con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `RIOT_API_KEY`: tu clave vigente de Riot.

Para activar el envío real de enlaces, configura **Resend por HTTPS** con `RESEND_API_KEY` y `MAIL_FROM`, y reinicia el servidor. El remitente debe estar autorizado por Resend; para invitar a otras personas necesitas un dominio de envío verificado. La clave de Resend tiene prioridad si también hay credenciales SMTP.

También se admite SMTP mediante `SMTP_HOST`, `SMTP_PORT` (465 o 587), `SMTP_USER`, `SMTP_PASS` y `MAIL_FROM`, con TLS. Usa credenciales del proveedor o una contraseña de aplicación, nunca tu contraseña habitual. En Railway Free, Trial y Hobby, SMTP está bloqueado: usa Resend. No pegues secretos en el chat.

Sin proveedor configurado, la interfaz indica **Envío de correos pendiente**. Autorizar un correo no simula un envío. Una vez configurado, los invitados pueden solicitar su enlace y el administrador puede enviarlo o reenviarlo. La entrega real aún debe comprobarse con el proveedor elegido.

Better Auth gestiona los enlaces y cookies de sesión. Los enlaces se guardan con hash, duran 10 minutos y se consumen una sola vez. Las sesiones duran hasta 7 días y usan cookies HttpOnly/SameSite=Lax; en HTTPS se marcan Secure. La autorización se verifica en el servidor tanto en las páginas como en las APIs. Hay comprobaciones de origen, límites de solicitudes y ninguna ruta pública de registro libre.

Los usuarios, permisos, enlaces y sesiones se guardan en `data/access.sqlite`, excluido del repositorio. `DATA_DIR` permite cambiar la carpeta; una instalación pública exige una ruta absoluta en un volumen persistente. No borres esta base para reiniciar el servidor. Cambiar el correo administrador requiere una migración explícita; editar `ADMIN_EMAIL` no reemplaza al propietario ya guardado. Consulta el respaldo y la recuperación en [PREDEPLOY.md](PREDEPLOY.md).

## Conectar Riot

1. Obtén una clave de desarrollo en https://developer.riotgames.com/.
2. Abre `.env.local` y completa `RIOT_API_KEY=` con tu clave, sin espacios adicionales.
3. Guarda el archivo. Next.js normalmente recarga el entorno; si no lo hace, detén el servidor y vuelve a ejecutar `npm.cmd run dev`.
4. Pulsa **Actualizar** o **Comprobar conexión** en la página.

Si `.env.local` no existe, copia `.env.example` con ese nombre. No compartas la clave por chat ni subas `.env.local` al repositorio. Ya está excluido mediante `.gitignore`. Nunca uses el prefijo `NEXT_PUBLIC_` para esta clave.

La clave de desarrollo caduca cada 24 horas. Para el grupo privado, registrar el proyecto y solicitar una clave personal es una etapa posterior. La clave permanece en el servidor: se transmite a Riot mediante `X-Riot-Token`, nunca en una URL ni en la respuesta al navegador.

## Alcance de esta entrega

- Vista del scoreboard con ocho cuentas. Rango, división y LP determinan el orden; los empates comparten posición y las cuentas sin rango confirmado aparecen al final.
- Consultas Account-V1 en AMERICAS y League-V4 en LA2 por PUUID.
- Solo/Duo: `RANKED_SOLO_5x5`. Rango, división y LP actuales. Las V/D y el winrate del tablero se calculan con Match-V5 para el período del desafío; no son los totales de temporada de League-V4.
- Estado explícito sin clave, sin clasificar, cuenta no encontrada, acceso rechazado, fallo de red y límite de consultas.
- Caché de 60 segundos por jugador y agrupación de peticiones simultáneas. El fallo de una cuenta no interrumpe las otras.
- Respeto a `Retry-After` por cuenta y pausa compartida de nuevas peticiones cuando Riot devuelve 429.
- Copia de los últimos datos correctos en `data/scoreboard.json`, excluida del repositorio. Escritura mediante archivo temporal y reemplazo. No contiene claves ni PUUID. Al reiniciar, los datos guardados se marcan como anteriores hasta confirmar una consulta nueva. No constituye un historial de evolución.
- El navegador comprueba los datos cada 15 segundos mientras está visible. Riot se consulta como máximo una vez por minuto y por cuenta para el rango.
- No se muestran estadísticas de ejemplo. Los únicos datos ficticios están en las pruebas.

El acceso público, el modo privado por invitación, los roles y la persistencia local ya están implementados. **No se ha publicado ni abierto un túnel público.** La restricción de host en `src/proxy.ts` acepta el host exacto de `APP_URL`. Para utilizar ngrok o un hosting hace falta configurar esa URL HTTPS y `DATA_DIR`. El modo público no requiere correo; la administración conserva su autenticación. SQLite requiere disco persistente y esta instalación está pensada para un único proceso servidor, sin réplicas.

Todavía no hay gráfica de evolución, lista visual de partidas recientes ni Spectator. La sincronización automática del historial se ejecuta después de responder a consultas del tablero; no hay un trabajador permanente cuando nadie lo mira. No se requiere PostgreSQL para este grupo.

## V/D desde el comienzo del desafío

Se incluyen las partidas Solo/Dúo (`queue=420`) que comenzaron **desde el 30 de septiembre de 2026 a las 00:00, hora de Chile**, inclusive. El instante fijo es `2026-09-30T03:00:00Z`. El porcentaje es `victorias / (victorias + derrotas) × 100`, redondeado al entero. Sin partidas, se muestra `0 / 0` y el porcentaje queda como `—`.

Se consulta Match-V5 por AMERICAS, paginando de 100 en 100 con `startTime` y un `endTime` fijo durante cada importación. También se verifica fecha y cola en cada detalle. Se excluyen los remakes identificados: partidas de menos de 5 minutos con `gameEndedInEarlySurrender` marcado para todos los participantes; una rendición normal sí cuenta.

El avance y los resultados completos se guardan en `data/history.sqlite`. Las partidas compartidas entre integrantes se descargan una sola vez. Se almacenan resultados mínimos e identificadores de participante con hash, sin clave ni PUUID en claro. No se muestran conteos parciales como si fueran definitivos. Mientras se importa se muestra el progreso; ante fallos se conserva el último total completo, identificado como dato anterior.

La primera importación tarda varios minutos según la cantidad de partidas y los límites de Riot. Las siguientes reutilizan los detalles guardados, revisan nuevas partidas y respetan `Retry-After`. El rango se actualiza por separado. Para preparar o retomar la importación sin abrir el tablero, **con el servidor detenido**:

```powershell
npm.cmd run history:sync
```

El comando tiene un máximo de 20 minutos por ejecución, conserva el avance y puede volver a ejecutarse. No lo ejecutes junto con otro importador o servidor que esté sincronizando la misma base. Cambiar la fecha inicial requiere cambiar la constante en `src/lib/challenge-period.ts`; los conteos del nuevo período se reconstruyen usando la caché de detalles.

Los jugadores se configuran en `src/lib/players.ts`. Todos usan LA2/AMERICAS, incluso si su etiqueta es distinta de LAS. La consulta de Account-V1 valida cada Riot ID; una cuenta no encontrada queda visible con un aviso, sin rango inventado. Al agregar o corregir una cuenta, mantén un identificador único coherente con esa cuenta.

## Roles principales

Cada jugador muestra sus dos posiciones más jugadas en las mismas partidas del desafío: `TOP`, `JG`, `MID`, `ADC` y `SUPP`. El distintivo dorado junto al nombre es la línea principal; debajo se conserva la secundaria. El número indica cuántas partidas jugó en esa posición.

Los nombres enlazan al perfil correspondiente de OP.GG en LAS y abren en otra pestaña. Se utiliza el Riot ID real, codificando los espacios; la clave entre paréntesis es solo una etiqueta visual. Estas claves se configuran en el campo `alias` de `src/lib/players.ts` y no cambian las cuentas de Riot ni los identificadores del historial.

Se usa `teamPosition` de Match-V5. Los empates se resuelven por la partida más reciente en cada posición y después por un orden fijo. Si solo hay una posición registrada, se muestra una; una partida sin posición válida cuenta para V/D, pero no se le inventa un rol. Los historiales antiguos se amplían automáticamente con posiciones y conservan sus últimos totales completos mientras se actualizan.

## Railway

La configuración de compilación, inicio con el puerto de Railway y comprobación de salud está preparada en `railway.json`. Mantén **una sola réplica**, un volumen en `/data`, `DATA_DIR=/data` y una URL HTTPS exacta. Sigue [RAILWAY.md](RAILWAY.md) para publicar desde GitHub y comprobar la persistencia. Configura `SCOREBOARD_PUBLIC=true` en Railway para consultar sin correo ni sesión.

## Comprobar

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run riot:check
npm.cmd run preflight
npm.cmd run backup
```

Las pruebas usan respuestas simuladas; no consumen la cuota de Riot. `riot:check` sí consulta Riot usando la clave local y actualiza la copia de últimos datos. Su salida solo muestra estados y rangos, nunca claves ni PUUID. `npm.cmd run verify` reúne comprobación de tipos, pruebas y compilación. `preflight` comprueba configuración, permisos de escritura, integridad de las bases y emblemas, sin llamadas externas ni envío de correos.

Los emblemas se encuentran en `public/ranks`. Se descargaron del [paquete oficial de Riot](https://developer.riotgames.com/docs/lol#general_icons-and-emblems), incluidos los diez rangos de Hierro a Retador. No se descargan de sitios de terceros ni dependen de otra API; Next.js los optimiza al servirlos. Las cuentas sin clasificar o sin datos usan un símbolo neutro, sin asignarles un rango ficticio.

## Próximas etapas

1. Crear el alojamiento con HTTPS y almacenamiento persistente; usar `SCOREBOARD_PUBLIC=true` para acceso sin correo.
2. Comprobar acceso público, administración protegida y persistencia después de reiniciar. El correo queda opcional para administración o modo privado.
3. Incorporar partidas recientes y seguimiento de rango si se desea.

La arquitectura local no requiere suscripción, base de datos externa ni compra de dominio. Usa fuentes de Google Fonts con tipografías de sistema como alternativa si no hay conexión.
