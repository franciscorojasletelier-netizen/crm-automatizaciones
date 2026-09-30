---
version: 1
slug: "src-app-dashboard-layout-tsx"
primary_target: "src/app/(dashboard)/layout.tsx"
related_targets: ["src/app/(dashboard)/cobranza/page.tsx"]
---

## Scope

Toda la app autenticada del CRM (shell + dashboard + módulos). Visitor mode: Operate. Primer surface nuevo: Cobranza; luego Dashboard y el resto hereda el sistema.

## Audience & job

Gerencia, finanzas y ejecutivos de una pyme de servicios B2B chilena, en notebook con luz de oficina diurna (ejecutivos también en celular). Tarea: ver qué requiere acción hoy (vencido, estancado, por cobrar) y ejecutarla sin fricción.

## Direction contract

THESIS: El estándar de la categoría (CRM SaaS neutro tipo Linear/Attio/HubSpot) ejecutado con máximo oficio; rechaza el dashboard de degradés índigo-violeta, tarjetas redondas con íconos de colores y emojis como íconos.

OWN-WORLD: Fondo casi blanco neutro, superficies blancas con borde de 1px y sombra mínima, un solo acento azul para acción/selección, semánticos (verde/ámbar/rojo) solo para estado. Barra lateral clara con navegación tipográfica. Geist con cifras tabulares; radios contenidos (6–10px).

STORY: Al entrar, el usuario entiende en una lectura qué está en riesgo (vencido, estancado) y cuánto hay en juego (pipeline, por cobrar); cada cifra lleva a las filas que la componen.

FIRST VIEWPORT: Cobranza: encabezado con título y acción primaria "Nuevo documento" a la derecha; franja de 4 indicadores (Por cobrar, Vencido, Vence en 7 días, Cobrado este mes) con valor y contexto; barra de antigüedad de deuda a todo el ancho; tabla densa de documentos con filtros por estado.

FORM: Canon (estándar de la categoría), elegido por el usuario sobre la dirección asignada; seed key b47175f0.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
