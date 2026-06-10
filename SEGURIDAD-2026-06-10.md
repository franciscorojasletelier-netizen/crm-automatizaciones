# Análisis de Seguridad — CRM Autopilot · 10 junio 2026

Auditoría profunda de autenticación, autorización, RLS, webhooks y exposición de datos.
Clasificación: 🔴 Crítico · 🟠 Alto · 🟡 Medio · 🟢 Bajo/informativo.

---

## 🔴 CRÍTICO-1 — Escalada de privilegios: un usuario puede auto-promoverse a Super Admin

**Dónde:** política RLS de `profiles` (migración 003) + `UserRoleEditor` (cliente).

```sql
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);
```

**Problema:** la política permite a cualquier usuario actualizar **su propia fila** de `profiles`,
incluida la columna `role`. La restricción de "qué roles puede asignar" vive **solo en el
cliente** (`ASSIGNABLE_BY_GERENTE`, etc.). Desde la consola del navegador, cualquier
comercial autenticado puede ejecutar:

```js
supabase.from('profiles').update({ role: 'super_admin' }).eq('id', MI_PROPIO_ID)
```

y obtener acceso total (gestión de usuarios, reportes, eliminación de deals, etc.).

**Impacto:** total. Rompe todo el modelo de roles del CRM.

**Solución:** impedir que un usuario modifique su propia columna `role` / `is_active`.
La columna `role` solo debe poder cambiarla un gerente/super_admin, y nunca sobre sí mismo.
SQL recomendado:

```sql
-- 1. Quitar la policy permisiva de UPDATE
drop policy if exists "Users can update own profile" on profiles;

-- 2. El usuario puede editar su perfil PERO sin tocar role ni is_active
create policy "Users update own profile (no role)" on profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from profiles where id = auth.uid())
    and is_active = (select is_active from profiles where id = auth.uid())
  );

-- 3. Gerentes/super_admin pueden cambiar role de OTROS (no de sí mismos)
create policy "Admins manage other roles" on profiles
  for update using (
    exists (select 1 from profiles me where me.id = auth.uid()
            and me.role in ('super_admin','gerente'))
    and id <> auth.uid()
  );
```
> Nota: comparar `role` contra una subconsulta de la misma tabla puede requerir una
> función `SECURITY DEFINER` para evitar recursión de RLS. Alternativa robusta: mover el
> cambio de rol a un endpoint server-side con `service_role` que valide la jerarquía, y
> quitar del cliente el `update` directo a `role`.

---

## 🔴 CRÍTICO-2 — RLS no aísla datos por rol: cualquier usuario ve TODO

**Dónde:** políticas RLS de `deals`, `contacts`, `companies`, `tasks`, `interactions`
(migraciones 002 y 003).

```sql
create policy "Authenticated users can view deals"
  on deals for select using (auth.uid() is not null);
```

**Problema:** todas las tablas de negocio usan `auth.uid() is not null` — es decir,
**cualquier usuario autenticado puede leer y escribir todos los registros**. El filtrado
por rol (`lib/visibility.ts`, los `.eq('owner_id', …)` en las páginas) es **solo de
aplicación**. Un comercial puede abrir la consola y hacer:

```js
supabase.from('deals').select('*')   // ← ve TODOS los deals, no solo los suyos
```

y obtener todo el pipeline, valores, contactos y datos de clientes de toda la empresa.
Lo mismo aplica a `UPDATE`/`DELETE`: un comercial podría modificar o borrar deals ajenos.

**Impacto:** alto — fuga de datos comerciales completos y manipulación cruzada. La
separación de visibilidad que ve el usuario en la UI es cosmética a nivel de seguridad.

**Solución:** reescribir las políticas para que repliquen `visibility.ts` en la base de datos.
Ejemplo para `deals` (SELECT):

```sql
drop policy if exists "Authenticated users can view deals" on deals;
create policy "deals_select_by_role" on deals for select using (
  exists (select 1 from profiles me where me.id = auth.uid()
          and me.role in ('super_admin','gerente'))         -- gerentes ven todo
  or owner_id = auth.uid()                                   -- dueño
  or exists (select 1 from deal_members dm                   -- miembro
             where dm.deal_id = deals.id and dm.user_id = auth.uid())
);
```
Replicar el mismo patrón para UPDATE/DELETE y para `contacts`/`companies` (vía join al deal).
Recomendado encapsular la lógica en una función `SECURITY DEFINER` `can_see_deal(uid, deal_id)`
para no repetir y evitar recursión.

---

## 🟠 ALTO-1 — Webhooks de Meta sin validación de firma

**Dónde:** `api/webhooks/meta/route.ts` y `api/webhooks/meta-leads/route.ts` (POST).

**Problema:** el POST no valida la cabecera `X-Hub-Signature-256` que Meta firma con el
App Secret. Cualquiera que conozca la URL puede inyectar leads falsos ilimitados
(spam de pipeline, posible DoS de la base y de cuota de Resend/Graph API).

**Solución:** validar HMAC-SHA256 del cuerpo crudo contra `META_APP_SECRET`:

```ts
import crypto from 'crypto'
const sig = request.headers.get('x-hub-signature-256') ?? ''
const raw = await request.text()
const expected = 'sha256=' + crypto.createHmac('sha256', process.env.META_APP_SECRET!)
  .update(raw).digest('hex')
if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
```

---

## 🟠 ALTO-2 — Webhook `/api/webhooks/lead` con token opcional

**Dónde:** `api/webhooks/lead/route.ts`.

```ts
if (webhookToken && authHeader !== `Bearer ${webhookToken}`) { ...401 }
```

**Problema:** la verificación solo ocurre **si `WEBHOOK_SECRET_TOKEN` está seteado**. Si la
variable no existe en Vercel, el `if` se salta y el endpoint queda **abierto a cualquiera**
para inyectar leads + disparar correos vía Resend (abuso de cuota / spam saliente desde tu
dominio recién verificado → riesgo de reputación del dominio).

**Solución:** exigir el token siempre; si falta la env var, rechazar:

```ts
if (!webhookToken || authHeader !== `Bearer ${webhookToken}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Y confirmar que `WEBHOOK_SECRET_TOKEN` está configurado en Vercel.

---

## 🟠 ALTO-3 — Bucket de propuestas público con URL adivinable

**Dónde:** `deal-stage-selector.tsx` y `kanban-board.tsx` → `getPublicUrl('propuestas')`.

**Problema:** las propuestas comerciales (documentos potencialmente sensibles: precios,
condiciones) se guardan en un bucket **público**. La URL es `getPublicUrl`, accesible sin
autenticación por cualquiera que tenga el enlace; y el path `dealId/timestamp_nombre` es
parcialmente predecible.

**Solución:** hacer el bucket **privado** y servir los archivos con URLs firmadas de
expiración corta:

```ts
const { data } = await supabase.storage.from('propuestas')
  .createSignedUrl(path, 60 * 60)   // válida 1 hora
```
Y aplicar políticas de Storage que restrinjan lectura a usuarios que puedan ver ese deal.

---

## 🟡 MEDIO-1 — `notifications_insert_auth`: cualquiera notifica a cualquiera

**Dónde:** migración `add_features_v2.sql`.

```sql
create policy "notifications_insert_auth" on notifications
  for insert with check (auth.uid() is not null);
```

**Problema:** cualquier usuario autenticado puede insertar notificaciones para **cualquier
`user_id`**. Permite spam/phishing interno (notificaciones falsas "del sistema" a otros
empleados). Es un trade-off intencional (un gerente notifica a un ejecutivo), pero conviene
acotarlo a roles gestores o mover los inserts cruzados a server-side.

---

## 🟡 MEDIO-2 — `VERCEL_OIDC_TOKEN` versionado en `.env.local`

**Dónde:** `.env.local` (visto en el repo local).

**Problema:** el archivo contiene un token OIDC de Vercel. Verificar que `.env.local` esté en
`.gitignore` y **nunca** se haya commiteado. Si se subió alguna vez, rotar el token.

**Acción:** `git log --all --full-history -- .env.local` para confirmar que nunca entró al
historial. Las claves `NEXT_PUBLIC_*` son públicas por diseño (van al browser) — eso está
bien, siempre que la seguridad real esté en RLS (ver CRÍTICO-2).

---

## 🟡 MEDIO-3 — Endpoint `/api/cron/debug` expone usuarios de auth

**Dónde:** `api/cron/debug/route.ts`.

**Problema:** este endpoint **no valida `CRON_SECRET`** y devuelve la lista de usuarios de
`auth.admin.listUsers()` (emails de todo el equipo) usando la `service_role`. Cualquiera
que visite la URL obtiene el listado de cuentas. (El `/api/debug-notifs` ya fue eliminado;
este `debug` quedó del troubleshooting anterior.)

**Solución:** eliminar el endpoint, o protegerlo con `CRON_SECRET` igual que los demás cron.

---

## 🟢 Informativo / buenas prácticas ya presentes

- ✅ `proxy.ts` (middleware) protege rutas por sesión y rol antes de renderizar.
- ✅ Los cron `daily-tasks` y `task-reminders` sí validan `CRON_SECRET`.
- ✅ El webhook `lead` usa `service_role` solo en server-side (no expuesta al cliente).
- ✅ CORS del webhook `lead` está acotado a POST/OPTIONS.
- ✅ Las claves `service_role`/`SUPABASE_SECRET_KEY` solo se usan en rutas server.
- ✅ Headers de seguridad: conviene agregar CSP, `X-Frame-Options`, `Strict-Transport-Security`
  vía `next.config` o `vercel.json` (no presentes, recomendado).

---

## Prioridad de remediación

| # | Severidad | Hallazgo | Esfuerzo |
|---|-----------|----------|----------|
| 1 | 🔴 Crítico | Auto-promoción de rol (RLS profiles) | Medio |
| 2 | 🔴 Crítico | RLS no aísla datos por rol | Alto |
| 3 | 🟠 Alto | Webhook Meta sin firma | Bajo |
| 4 | 🟠 Alto | Webhook lead con token opcional | Bajo |
| 5 | 🟠 Alto | Bucket de propuestas público | Medio |
| 6 | 🟡 Medio | `/api/cron/debug` expone emails | Bajo (borrar) |
| 7 | 🟡 Medio | notifications insert abierto | Bajo |
| 8 | 🟡 Medio | Confirmar `.env.local` fuera de git | Bajo |

**Recomendación:** atacar 3, 4 y 6 de inmediato (son cambios pequeños y de alto valor), y
planificar 1 y 2 como un sprint de "endurecimiento RLS" — son los que realmente sostienen
la seguridad del modelo multi-rol. Hoy la separación por rol es **solo de interfaz**.
