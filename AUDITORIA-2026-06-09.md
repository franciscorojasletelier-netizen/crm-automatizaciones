# Auditoría del CRM — 09 junio 2026

Análisis completo de backend, frontend y experiencia de usuario.
Todo lo listado como "corregido" quedó implementado en este commit.

---

## 🔴 Bugs críticos corregidos

### 1. Escalada de privilegios en `/api/admin/fix-role` — ELIMINADO
**Problema:** la API temporal que se usó para cambiar el rol de Carlos Mendoza permitía
que cualquier **gerente** asignara el rol `super_admin` a cualquier usuario, saltándose
la regla de la UI (un gerente solo puede asignar comercial/producción/soporte).
**Solución:** se eliminó el endpoint completo. Los cambios de rol se hacen ahora solo
desde `/admin/usuarios`, que respeta la jerarquía de permisos.

### 2. Leads creados manualmente quedaban sin responsable
**Problema:** el formulario "Nuevo lead" no guardaba `owner_id`. Consecuencia real:
un **comercial creaba un lead y desaparecía de su vista** (el filtro de visibilidad
muestra solo deals donde es owner o miembro). Solo el gerente lo veía.
**Solución:** `NuevoLeadForm.tsx` ahora asigna automáticamente el lead a quien lo crea.

### 3. Tareas creadas sin asignar (`assigned_to` null)
**Problema:** ni el botón "Nueva tarea" (página Tareas) ni el formulario de tareas del
detalle del lead guardaban `assigned_to`. Consecuencia: esas tareas **nunca generaban
notificaciones de vencimiento** ni aparecían en los recordatorios por correo (todos
filtran por `assigned_to`).
**Solución:** ambos formularios asignan ahora `assigned_to` y `created_by` al creador.

### 4. `last_contacted_at` nunca se actualizaba
**Problema:** la columna existía en la BD pero ningún código la escribía, así que
cualquier métrica de "último contacto" estaba siempre vacía.
**Solución:** al registrar una interacción (llamada, email, reunión, nota) en el deal,
se actualiza `deals.last_contacted_at` automáticamente.

---

## 🟠 Webhook de leads (`/api/webhooks/lead`) — 3 mejoras

### 5. Deduplicación de contactos y empresas
**Antes:** cada submit del formulario web creaba empresa + contacto + deal nuevos,
aunque la misma persona escribiera 5 veces → datos duplicados por todos lados.
**Ahora:**
- Si llega un email ya registrado **con un deal abierto**: no crea nada nuevo,
  registra una interacción "🔁 El lead volvió a contactar" en el deal existente.
- Si el contacto existe pero sin deal abierto: reutiliza contacto y empresa, crea solo el deal.
- Si la empresa existe por nombre: la reutiliza.

### 6. Asignación automática round-robin (feature de CRM profesional)
**Antes:** los leads del webhook quedaban **sin responsable** → invisibles para los
comerciales, nadie los trabajaba.
**Ahora:** cada lead entrante se asigna automáticamente al **comercial activo con menos
deals abiertos** (balanceo de carga). Equivalente al "lead routing" de HubSpot/Salesforce.

### 7. Notificaciones in-app al recibir un lead
**Antes:** solo se enviaba email a la casilla de la empresa.
**Ahora:** además, el comercial asignado recibe la notificación
"🆕 Nuevo lead asignado" y los gerentes "📥 Lead entrante" — visibles al instante
en la campana del sidebar (Realtime).

---

## 🟡 Rendimiento

### 8. Página de notificaciones: de ~30 queries a 4
**Antes:** por cada tarea vencida/de hoy se hacía una query de verificación de duplicado
y un insert individual (secuencial) → hasta 30 round-trips a Supabase por visita.
**Ahora:** 3 queries en paralelo (tareas vencidas + tareas de hoy + notifs ya emitidas)
y **un solo insert masivo**. También se eliminó la duplicación tarea vencida/de hoy
(antes una tarea que vencía hoy más temprano podía generar ambas notificaciones).

---

## 🟢 Mejora pro-CRM: indicador de leads desatendidos (lead aging)

### 9. Badge "Xd sin contacto" en la lista de leads
Como en Pipedrive ("rotting deals"), cada lead activo muestra cuántos días lleva sin
contacto registrado:
- ⏳ **ámbar** desde 3 días sin contacto
- 🔥 **rojo** desde 7 días
Se calcula sobre `last_contacted_at` (o `created_at` si nunca se contactó), que ahora
sí se actualiza (ver punto 4). Visible en desktop y móvil. Los deals cerrados no lo muestran.

---

## 📋 Recomendaciones pendientes (no implementadas — requieren decisión)

1. **`WEBHOOK_SECRET_TOKEN`**: si esta variable de entorno no está configurada en Vercel,
   el webhook acepta cualquier petición sin autenticación (cualquiera podría inyectar
   leads falsos). Verificar que esté configurada en Vercel → Settings → Environment Variables.
2. **RLS como única defensa**: la visibilidad por rol se aplica en código de aplicación
   (`visibility.ts`). Si las políticas RLS de Supabase son permisivas, un usuario técnico
   podría consultar la API de Supabase directamente y ver deals ajenos. Vale la pena
   revisar que las políticas RLS repliquen las mismas reglas.
3. **Emails de webhook hardcodeados**: el destino `autopilotspa@gmail.com` y el dominio
   `autopilotspa.cl` están en el código. Si cambia el dominio, moverlos a variables de entorno.
4. **Zona horaria**: los cálculos de "hoy" usan UTC del servidor. Para Chile (UTC-3/-4)
   una tarea de las 23:00 puede contar como "mañana". Si esto molesta, normalizar con
   `America/Santiago`.
