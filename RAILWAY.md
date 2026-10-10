# Publicar SoloQWaletasChallenge en Railway

Guía revisada el **10 de octubre de 2026**. El código está preparado; todavía no hay un proyecto desplegado. Con `SCOREBOARD_PUBLIC=true`, **cualquier persona con el enlace puede ver el scoreboard sin correo ni sesión**. La administración conserva su autenticación y no aparece en la vista pública.

## 1. Elegir acceso público

Usa `SCOREBOARD_PUBLIC=true`. No necesitas Resend, SMTP ni dominio de correo para publicar el tablero. Puedes saltar directamente al paso 2. La lista de participantes se controla desde `src/lib/players.ts`; los visitantes no pueden modificarla.

La configuración de `ADMIN_EMAIL` y `AUTH_SECRET` se conserva para proteger la administración existente. Sin proveedor de correo, no se envían enlaces de administración remotos; esto no impide consultar la clasificación. El generador local de enlaces solo funciona en el computador con URL local.

### Correo opcional para volver al acceso privado

Si más adelante cambias a `SCOREBOARD_PUBLIC=false`, necesitarás configurar entrega de enlaces para el acceso privado remoto:

Esta aplicación permite Resend por HTTPS o SMTP. Para Railway Free, Trial y Hobby, usa **Resend**: [Railway bloquea SMTP en esos planes](https://docs.railway.com/networking/outbound-networking).

1. Crea tu cuenta de Resend y añade un dominio de correo que controles.
2. Configura sus registros DNS y espera la verificación, siguiendo [la guía de Resend](https://resend.com/docs/dashboard/domains/introduction).
3. Crea una clave API con permiso para enviar desde ese dominio.
4. Elige un remitente, por ejemplo `Waletas <acceso@tu-dominio.cl>`. Sustituye el ejemplo por tu dominio real.

El dominio web gratuito de Railway no te da control de sus DNS para verificar un dominio de correo. Tampoco sirve poner una dirección Gmail propia como remitente verificado. Para una prueba solo a tu correo de la cuenta Resend se puede usar `onboarding@resend.dev`; [ese remitente de prueba no permite enviar invitaciones al grupo](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Si todavía no tienes dominio de envío, este punto queda pendiente antes de habilitar invitaciones reales.

## 2. Subir el código a GitHub

Usa un repositorio privado llamado `SoloQWaletasChallenge`, cuya raíz sea **esta carpeta**, no toda la carpeta Proyectos personales. Puedes usar GitHub Desktop para añadir la carpeta como repositorio, crear el primer commit y publicarlo como privado.

Antes de publicar, revisa que el commit contenga código, `package.json`, `package-lock.json`, `railway.json`, recursos y documentación. No debe incluir `.env.local`, otros `.env`, `data`, respaldos, enlaces de acceso, `node_modules` ni `.next`. `.gitignore` ya los excluye. No subas secretos aunque el repositorio sea privado.

Para revisar localmente:

```powershell
npm.cmd run preflight
npm.cmd run verify
```

## 3. Crear servicio y volumen

1. En Railway elige **New Project → Deploy from GitHub repo** y selecciona ese repositorio. Autoriza solo el repositorio necesario.
2. Si la raíz del repositorio es esta carpeta, deja el directorio raíz del servicio sin una subcarpeta adicional.
3. Añade un **Volume**, conéctalo al servicio de la web y establece su **Mount Path** en `/data`. [Los volúmenes conservan los archivos entre despliegues](https://docs.railway.com/volumes).
4. Mantén una sola región y **una sola réplica**. Esta versión usa SQLite y no admite múltiples servidores escribiendo la misma base.
5. En **Settings → Networking → Generate Domain**, genera la dirección pública. Guarda su origen HTTPS, por ejemplo `https://tu-servicio.up.railway.app`. [Railway proporciona dominio y HTTPS](https://docs.railway.com/networking/public-networking).

El primer intento puede fallar hasta completar las variables; termina toda la configuración y vuelve a desplegar. No hace falta crear un servicio PostgreSQL.

## 4. Configurar Variables

En la pestaña **Variables** del servicio, introduce estos valores sin comillas:

| Variable | Valor |
| --- | --- |
| `NODE_ENV` | `production` |
| `SCOREBOARD_PUBLIC` | `true` |
| `APP_URL` | Origen HTTPS exacto generado, sin rutas |
| `ADMIN_EMAIL` | `vladimirpepino08@gmail.com` |
| `AUTH_SECRET` | Secreto aleatorio de al menos 32 caracteres, estable entre reinicios |
| `RIOT_API_KEY` | Tu clave vigente de Riot |
| `DATA_DIR` | `/data` |

`RESEND_API_KEY` y `MAIL_FROM` son **opcionales en modo público**. Solo configúralos si quieres usar enlaces de correo para la administración o activar el modo privado.

Railway suministra `PORT` y `RAILWAY_ENVIRONMENT_ID`; no los inventes ni los copies desde tu entorno local. No uses variables `NEXT_PUBLIC_` para secretos. `.env.local` no se publica: los secretos se configuran en Railway.

Para una instalación nueva puedes generar `AUTH_SECRET` localmente con:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guárdalo de forma privada. Si vas a recuperar una base de accesos existente, conserva también el secreto de esa instalación. Cambiar `ADMIN_EMAIL` después de inicializar la base no transfiere automáticamente la propiedad.

## 5. Desplegar

Aplica los cambios pendientes y despliega. `railway.json` ya declara:

| Ajuste | Valor |
| --- | --- |
| Constructor | Railpack |
| Compilación | `npm run build` |
| Inicio | `npm run start:railway` |
| Comprobación de salud | `/api/health` |
| Espera de salud | 120 segundos |

Node.js 24 está declarado en `package.json`. El inicio de Railway escucha en `0.0.0.0` y usa el puerto que suministra la plataforma. En tu computador, sigue usando `npm.cmd start` o `npm.cmd run dev`.

No pongas `history:sync`, `backup` ni `preflight` como paso de compilación o pre-despliegue: [el volumen solo está montado cuando arranca el contenedor](https://docs.railway.com/volumes). La aplicación inicializa las bases al abrirlas en ejecución.

La comprobación de salud valida configuración y apertura de almacenamiento y devuelve únicamente `ok` o `unavailable`. No envía correos ni consulta Riot; un estado correcto no demuestra que las claves funcionen frente a esos proveedores.

## 6. Verificar antes de compartir

1. Abre la URL pública en una ventana privada: debe mostrar directamente el scoreboard con **Acceso público**, sin pedir correo.
2. Verifica los ocho Riot ID. La primera importación reconstruirá V/D, winrate y roles desde el 30 de septiembre de 2026 a las 00:00 de Chile. Puede tardar varios minutos; conserva la página abierta y deja completar la carga.
3. Comprueba que `/admin` sigue pidiendo autenticación y que la vista pública no muestra correos, botones de accesos ni configuración de Riot.
4. Reinicia el servicio y confirma que se conserva el historial. Si desaparece, revisa que el volumen esté conectado y que tanto su montaje como `DATA_DIR` sean `/data`.
5. Comparte el enlace. Cualquier destinatario podrá abrirlo y volver a compartirlo; no es un enlace de invitación individual.

Si configuras correo para administrar, comprueba por separado recepción y acceso con el propietario autorizado. En modo público, revocar una cuenta administrativa no impide que esa persona vea el tablero público.

Una instalación nueva inicia con el propietario configurado. Los invitados y sesiones locales no se transfieren a GitHub. Puedes volver a autorizar a tus invitados; el historial se reconstruye con Riot. Para migrar los datos completos, usa un respaldo consistente siguiendo [PREDEPLOY.md](PREDEPLOY.md), detén escritores y restaura por un canal privado al volumen mediante [las herramientas de archivos de Railway](https://docs.railway.com/volumes#manage-volume-files). No copies bases activas mezclándolas con archivos WAL de otra instalación.

## 7. Mantenimiento y costo

- Para renovar Riot, cambia `RIOT_API_KEY` en **Variables** y aplica un nuevo despliegue. La clave de desarrollo caduca diariamente; el registro del proyecto y una clave adecuada para el grupo siguen pendientes.
- Ejecuta respaldos dentro del servidor con `npm run backup` y conserva una copia privada fuera del volumen. La herramienta crea `manifest.json` cuando termina correctamente. No hay programación automática de estos respaldos todavía. `railway run` ejecuta localmente con variables remotas; no sirve para respaldar el volumen remoto. Usa una sesión del contenedor, por ejemplo Railway SSH.
- Con una sola instancia y un volumen puede haber una interrupción breve al desplegar. La importación se retoma; la aplicación no promete capturar cambios continuamente cuando nadie consulta el tablero.
- El plan Free incluye **USD 1 de crédito mensual**; Hobby parte de **USD 5 al mes**, con consumo sujeto a los límites y cargos del plan. No se puede asegurar que esta web funcione todo el mes gratis sin medir su uso. Consulta [los planes vigentes y el consumo](https://docs.railway.com/pricing/plans) y configura límites de gasto. La disponibilidad gratuita no cubre necesariamente el dominio de envío de correo.

## Problemas habituales

| Síntoma | Revisar |
| --- | --- |
| Salud 503 | Variables completas, secreto válido y escritura en `/data` |
| Error 502 o aplicación sin respuesta | Inicio `npm run start:railway`, puerto automático y logs del servicio |
| Solicitud no permitida | `APP_URL` coincide exactamente con el host HTTPS que estás abriendo |
| Correo no llega | Clave Resend, permisos del dominio, remitente verificado, registro de entrega y spam |
| Riot rechaza la conexión | Clave vigente; reemplazarla y desplegar de nuevo |
| Historial en actualización | Esperar límites de Riot; se muestran los últimos totales completos mientras se importa |
| Se pierden accesos al reiniciar | Volumen conectado a este servicio y `DATA_DIR=/data` |

No compartas logs que contengan claves o enlaces de acceso. El despliegue, la entrega real del correo y la persistencia remota se verifican en Railway cuando se configure el servicio.
