# Auditoría del CRM — 09 junio 2026

> **Fase 2 (mismo día):** mejoras nivel pro-CRM, inspiradas en los patrones de
> Pipedrive, Attio y Twenty CRM. Ver sección "Fase 2" al final.

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

---

## 🚀 FASE 2 — Mejoras nivel pro-CRM (verificadas en producción)

### 10. Pipeline rediseñado (patrón Pipedrive)
La investigación confirmó la mejor práctica de Pipedrive: los deals ganados/perdidos
**no deben ser columnas del kanban**. Cambios:
- Solo las **7 etapas activas** son columnas — ahora llenan todo el ancho sin scroll horizontal.
- **Bandeja de cierre**: al arrastrar una tarjeta aparece desde abajo una barra con
  4 zonas grandes (🏆 GANADO / ✕ PERDIDO / ⊘ NO CALIFICADO / ❄️ FRÍO). Sueltas ahí
  para cerrar el deal — igual que Pipedrive.
- **Cerrados recientes**: sección colapsable al pie con chips de los deals cerrados.
  Se pueden **arrastrar de vuelta** a una columna para reabrirlos (el status vuelve
  a "open" automáticamente).

### 11. Acciones masivas en Leads (bulk actions)
Checkboxes en cada fila + "seleccionar todo". Al seleccionar aparece una barra
flotante oscura: "N seleccionados — Reasignar a: [equipo]". Un solo update masivo
+ notificación resumida al nuevo responsable. Solo visible para gerente/admin.

### 12. Importación CSV de leads
Botón "Importar CSV" junto a "Nuevo lead":
- Parser propio: soporta separador coma o punto y coma, y comillas.
- Detección automática de columnas en español o inglés (Empresa/Company,
  Contacto/Name, Email, Teléfono/Phone, Industria, Fuente/Source, Valor/Value...).
- Deduplicación por email (omite contactos ya registrados).
- Vista previa antes de importar + plantilla de ejemplo descargable.
- Resumen final: importados / duplicados omitidos / errores.

### 13. Forecast ponderado (Reportes)
Nueva KPI que reemplaza el conteo simple de pipeline:
`Forecast = Σ (valor estimado × probabilidad)` de los deals abiertos.
Si un deal no tiene probabilidad asignada se usa la estándar por etapa
(Nuevo Lead 10% → Negociación 80%). Es la métrica de proyección de ingresos
que usan Salesforce y HubSpot.

### 14. Leyenda del donut compacta (Dashboard)
La leyenda pasó de una lista vertical de ancho completo a una **grilla de 2
columnas** compacta — se eliminó el aire muerto a la derecha del gráfico.

### Referencias usadas
- Pipedrive: patrón de bandeja de cierre y "deal rotting"
  (https://www.pipedrive.com/en/features/pipeline-management)
- Twenty CRM (CRM open-source más popular de GitHub): densidad de tablas y diseño
  (https://github.com/twentyhq/twenty)
- Attio: barra de acciones masivas flotante

---

## 🏆 FASE 3 — Patrones de los 3 líderes del mercado (verificados en producción)

Análisis de Salesforce, HubSpot y Attio. Se implementó la feature distintiva de cada uno:

### 15. Vista dual del pipeline — patrón HubSpot
HubSpot estructura su pipeline en dos vistas sincronizadas: kanban + lista filtrable.
Ahora el pipeline tiene un toggle **Tablero | Lista**:
- Tablero: el kanban con drag & drop.
- Lista: tabla densa con los mismos deals ordenados por valor — Empresa, Etapa,
  Valor, Score, Responsable, Próxima acción y **Últ. contacto** con semáforo de
  color (gris < 3 días, ámbar 3-6, rojo 7+).

### 16. Detección de deals estancados — patrón Salesforce Pipeline Inspection
Salesforce marca oportunidades "que necesitan atención" cuando llevan demasiado
tiempo sin actividad. Implementado:
- Deal con **7+ días sin contacto** → barra superior roja + 🔥 en la tarjeta del kanban.
- Contador **"🔥 N estancados (7d+ sin contacto)"** en la barra del pipeline.
- En la vista lista, columna de último contacto con semáforo.

### 17. Command palette con acciones — patrón Attio
Attio se distingue por su command palette y shortcuts. El buscador global (Ctrl+K)
ahora es un **palette de comandos**: al abrirlo muestra "Acciones rápidas" (Crear
nuevo lead, Ir a Dashboard / Pipeline / Reportes / Equipo, etc.) filtrables por
texto y navegables con flechas + Enter, además de la búsqueda de empresas,
contactos y leads.

### Fuentes del análisis de mercado
- HubSpot pipeline management: https://www.hubspot.com/products/crm/pipeline-management
- HubSpot, propiedades obligatorias por etapa: https://salesdorado.com/en/crm/crm-software/sales-pipeline-hubspot-crm/
- Salesforce Pipeline Inspection: https://www.salesforceben.com/ultimate-guide-to-salesforce-pipeline-inspection/
- Salesforce deal health: https://trailhead.salesforce.com/content/learn/modules/sell-smarter-with-pipeline-inspection/understand-deal-health-with-insights-and-scores
- Attio UX review: https://crm.org/news/attio-review
- Pipedrive deal scoring: https://www.processculture.com.au/articles/pipedrive-new-deal-scoring-feature-explained

### Qué tienen los líderes que aún NO está (requiere decisión/credenciales del dueño)
1. **Email integrado** (HubSpot/Attio): enviar y registrar correos desde el CRM con
   Gmail/Outlook OAuth. Es la feature #1 que falta — requiere configurar OAuth.
2. **IA predictiva** (Salesforce Einstein, HubSpot Breeze): scoring predictivo y
   resúmenes automáticos. Requiere conectar una API de IA (ej. Claude) — factible
   como siguiente fase si se desea.
3. **Enriquecimiento de datos** (Attio): autocompletar datos de empresas desde
   fuentes externas. Requiere API de terceros de pago.
