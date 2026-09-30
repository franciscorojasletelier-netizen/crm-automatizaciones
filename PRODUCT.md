# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Equipo de Autopilot SpA** (empresa chilena de automatizaciones, `autopilotspa.cl`): lo usa a diario para su propia venta — captar leads, mover el pipeline, cotizar, traspasar ventas ganadas a proyectos y cobrarlas.
- **Empresas clientes (SaaS):** Autopilot vende la plataforma a otras organizaciones; cada una opera su propio CRM aislado (pipeline, campos, usuarios, integraciones). Hoy existen "Autopilot SpA" e "Inmobiliaria Prueba QA".
- **Roles dentro de cada organización:** Super Admin, Gerente, Ejecutivo de Ventas (comercial), Producción, Soporte/Analista y **Finanzas** (administración dedicada que opera la cobranza).
- **Dueño de la plataforma:** administra las organizaciones desde `/plataforma`.

## Product Purpose

CRM comercial end-to-end para empresas de servicios B2B en Chile: lead → pipeline → cotización con firma simple → deal ganado → proyecto → cobranza. El éxito es que una venta no se pierda entre etapas ni entre áreas (comercial, producción, finanzas) y que gerencia vea el estado real del negocio sin armar reportes a mano.

## Positioning

Un CRM hecho para el flujo real de una empresa de servicios chilena, no un CRM genérico traducido: montos en CLP, IVA 19 %, hora de Chile, WhatsApp Business y Meta Lead Ads integrados, traspaso automático de venta ganada a proyecto y cobranza en el mismo lugar. Multi-organización desde el diseño, con aislamiento de datos probado por tests contra la base.

## Operating Context

- Uso principal en escritorio (gerencia, finanzas, ejecutivos en oficina); ejecutivos también desde el celular (navegación inferior móvil, kanban con selector de etapa móvil).
- Leads entran por formulario web, Meta Lead Ads y WhatsApp; correo bidireccional Gmail/Outlook; avisos por email (Resend) y notificaciones internas.
- Crons diarios (pg_cron en Supabase) para recordatorios de tareas, secuencias de seguimiento, automatizaciones y cobranza.
- Clientes finales aceptan o rechazan cotizaciones desde un enlace público sin cuenta.

## Capabilities and Constraints

- Stack existente: Next.js 16 (App Router, `proxy.ts` en vez de middleware), React 19, Tailwind 4, Supabase (Postgres + RLS + Auth con 2FA + Storage), Vercel. Idioma de la interfaz: español de Chile.
- Todo dato de negocio aislado por organización con RLS; permisos en tres niveles: módulo de la organización > rol > acceso por sección del usuario.
- Etapas del pipeline, campos personalizados y módulos son configurables por organización; nada de eso se hardcodea.
- Moneda CLP sin decimales; fechas en `America/Santiago`; columnas `date` se muestran sin corrimiento de zona.
- Terminología de dominio: Lead, Deal, Pipeline, Etapa, Cotización, Proyecto, Cobranza, Documento por cobrar, Abono, Gestión de cobranza, Compromiso de pago.

## Brand Commitments

- Nombre de la empresa: Autopilot SpA. La marca de cada organización cliente (nombre visible, datos de contacto) aparece en correos, cotizaciones y documentos que ven sus clientes.
- El usuario pidió un **rediseño completo** de la interfaz hacia un nivel ejecutivo: la estética actual (índigo/violeta, degradés, sidebar oscuro) es evidencia, no compromiso.

## Evidence on Hand

- Datos reales en producción: 2 organizaciones, 3 usuarios, pocos deals. No hay testimonios, casos de éxito ni métricas de clientes publicables: no inventarlos.

## Product Principles

1. **Una venta no se cae entre áreas:** cada traspaso (comercial → producción → finanzas) es explícito, trazable y avisa a quien corresponde.
2. **La base garantiza las reglas:** saldos, estados, aislamiento y permisos se imponen en Postgres, no solo en la UI.
3. **Gerencia ve la verdad sin pedirla:** los tableros muestran lo accionable (vencido, estancado, en riesgo) antes que lo decorativo.
4. **Configurable por organización, no por código:** lo que difiere entre clientes vive en datos.
5. **Chile primero:** CLP, IVA, hora local, WhatsApp.
