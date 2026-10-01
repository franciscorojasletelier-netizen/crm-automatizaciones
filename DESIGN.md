---
name: CRM Automatizaciones
description: CRM comercial B2B multi-organización — estándar SaaS sobrio (Linear/Attio/HubSpot) ejecutado con oficio.
colors:
  accent-50: "oklch(0.97 0.014 258)"
  accent-100: "oklch(0.94 0.03 258)"
  accent-500: "oklch(0.585 0.19 258)"
  accent-600: "oklch(0.515 0.2 258)"
  accent-700: "oklch(0.45 0.18 258)"
  accent-800: "oklch(0.385 0.145 258)"
  background: "oklch(0.985 0.002 255)"
  surface: "oklch(1 0 0)"
  sidebar: "oklch(0.975 0.003 255)"
  border: "oklch(0.925 0.005 255)"
  input-border: "oklch(0.87 0.008 255)"
  text: "oklch(0.2 0.01 255)"
  text-strong: "oklch(0.275 0.011 255)"
  text-secondary: "oklch(0.52 0.014 255)"
  text-tertiary: "oklch(0.6 0.013 255)"
  ink-inverse: "oklch(0.2 0.01 255)"
  danger: "#b91c1c"
  danger-soft: "#fef2f2"
  warning: "#b45309"
  success: "#047857"
typography:
  page-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  stat-value:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  panel-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  ui:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  meta:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  micro:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  2xl: "11px"
spacing:
  gutter-mobile: "16px"
  gutter-desktop: "32px"
  panel-padding: "16px"
  stack: "16px"
components:
  button-primary:
    backgroundColor: "{colors.accent-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  button-primary-hover:
    backgroundColor: "{colors.accent-700}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "0 12px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-item-active:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "32px"
---

# Sistema de diseño — CRM Automatizaciones

## Overview

Herramienta de trabajo para gerencia, finanzas y ejecutivos de una pyme de servicios B2B en Chile, usada en notebook con luz de oficina diurna y a ratos en el celular. El sistema es deliberadamente el estándar de la categoría (Linear, Attio, HubSpot) ejecutado con precisión: fondo casi blanco, superficies blancas con borde de 1 px, **un solo acento azul** para acción y selección, y color semántico (verde, ámbar, rojo) únicamente para estado. La personalidad vive en el detalle: cifras tabulares, jerarquía por peso y tamaño, estados claros, cero ornamento.

Fuente de verdad de los tokens: `src/app/globals.css`. Primitivas de página: `src/components/ui/page.tsx`.

## Colors

- **Acento (`accent-*`)**: acción primaria, selección, enlaces, foco. Las escalas `indigo`, `violet` y `purple` de Tailwind están redefinidas al acento, así que el código heredado que las usa ya es coherente; en código nuevo usar `accent-*` directamente.
- **Neutro (`slate-*`)**: redefinido a bajo croma (matiz 255). `slate-400` y `slate-500` están oscurecidos respecto del default para que el texto secundario alcance contraste AA sobre blanco. Texto principal `slate-900`, secundario `slate-500`, terciario/placeholder `slate-400`.
- **Semánticos**: rojo = mora, error o destrucción; ámbar = por vencer/advertencia; verde = pagado, ganado, éxito. El rojo nunca es decorativo: si todo es rojo, nada es urgente.
- **Excepciones documentadas**: el chat de WhatsApp conserva los verdes de la marca WhatsApp (`#075e54`, `#128c7e`, `#25d366`) para que se reconozca el canal; los correos HTML (`src/app/api/**`) llevan colores y radios en línea porque los clientes de correo no leen los tokens CSS.
- **Modo oscuro**: clase `.dark` en `<html>` (preferencia en `localStorage['tema']`: sistema/claro/oscuro, aplicada antes del primer pintado por `THEME_BOOT_SCRIPT` en `src/lib/theme.ts`; selector en la barra lateral). El bloque `html.dark` de `globals.css` espeja la escala `slate` completa y los extremos (50–300 ↔ 700–950) del acento y los semánticos, de modo que el código escrito con clases de modo claro funciona sin variantes `dark:`. Las superficies `bg-white` pasan a `--card`; los velos de modal a negro 60 %. En código nuevo usar `bg-card` para superficies.
- **Etapas del pipeline**: su color es configuración por organización (`src/lib/stages.ts`, paleta `STAGE_COLORS`); se usan como punto de 6 px o chip suave, nunca como fondo de página.

## Typography

Geist (via `next/font`) con `font-feature-settings: "cv11", "ss01"`. Tablas y cualquier cifra comparable usan `tabular-nums` (global en `table`).

| Rol | Tamaño / peso |
|---|---|
| Título de página | 22 px / 600, tracking −0.01 em |
| Valor de indicador | 24 px / 600, tracking −0.02 em, tabular |
| Título de panel | 14 px / 600 |
| Cuerpo | 14 px / 400 |
| Controles, navegación, celdas | 13 px / 500 |
| Metadatos, encabezados de tabla | 12 px / 400–500, `slate-500` |
| Micro: contadores, chips, fechas en tarjetas densas | 11 px / 500 — **mínimo del sistema**, nada por debajo |

Jerarquía por peso y tamaño, no por mayúsculas espaciadas.

## Layout

- Contenedor de página `PageContainer`: ancho máximo 1280 px (1600 en `wide`), márgenes 16 px móvil / 32 px escritorio.
- Encabezado `PageHeader`: título + descripción a la izquierda, acciones a la derecha; enlace de regreso opcional encima.
- Barra lateral fija de 240 px en escritorio; en móvil, encabezado de 52 px arriba y navegación inferior de 4 accesos + "Más".
- Detalle de registro: columna principal fluida + columna lateral de 320 px (`lg:grid-cols-[minmax(0,1fr)_320px]`).
- Ritmo vertical: 16 px entre bloques de una página.

## Elevation & Depth

Profundidad mínima y con desplazamiento real (tokens `--shadow-*` en `globals.css`, tinte neutro): `shadow-xs` en paneles y controles, `shadow-2xl` solo en capas que flotan (diálogos, panel lateral de formulario, paleta de comandos). Los velos de modal son `slate-900/30–40` sin desenfoque decorativo.

## Shapes

`--radius: 0.5rem`. Botones e inputs 6 px, paneles 8 px, diálogos 8–10 px, chips y contadores completamente redondeados. Nada de bordes gruesos de color a un lado de tarjetas o alertas.

## Components

- **Panel** (`Panel`): superficie blanca, borde 1 px, título + descripción + acciones en una cabecera separada por regla fina.
- **Franja de indicadores** (`StatStrip` + `Stat`): celdas unidas por reglas de 1 px (gap sobre fondo `slate-200`); cada `Stat` lleva etiqueta, valor y contexto, y con `href` abre las filas que componen la cifra. Tonos `danger/warning/success` solo cuando el valor lo amerita.
- **Botones** (`buttonClass`): `primary` (acento sólido), `secondary` (borde), `ghost`, `danger` (borde rojo). Altura 32 px; 36 px en formularios de acceso.
- **Inputs** (`inputClass`, `labelClass`): borde `slate-300`, foco con borde acento + anillo `accent-100`.
- **Chips de estado**: fondo suave del semántico + punto de 6 px + etiqueta (ver `STATUS_META` en `src/lib/cobranza.ts`).
- **Tablas**: encabezado 12 px `slate-500`, filas 13 px con separador `slate-100`, hover `slate-50`, montos alineados a la derecha y tabulares, pie con total cuando la tabla es de montos.
- **Filtros por pestaña**: segmento activo en `slate-900` con texto blanco y conteo tabular.
- **Formularios de creación**: panel lateral derecho (hoja) con cabecera, cuerpo desplazable y pie fijo de acciones.
- **Estado vacío** (`EmptyState`): ícono en círculo neutro, título, explicación y acción.
- **Íconos**: Lucide, trazo único, 14–16 px en interfaz.
- **Zona táctil**: en punteros gruesos (`pointer: coarse`) todo botón o enlace de solo ícono amplía su área a 44 px con un `::after` invisible, sin cambiar el tamaño visual.
- **Móvil**: las tablas anchas ocultan columnas secundarias o pasan a lista de tarjetas por debajo de `md`.

## Do's and Don'ts

- **Sí**: un acento, semánticos solo para estado, cifras tabulares, cada total enlazado a su detalle, errores que dicen el problema y la salida, textos en tuteo chileno.
- **No**: degradés (en fondos, botones o texto), brillos o blur decorativo, emojis como íconos, etiquetas "eyebrow" sobre títulos, tarjetas idénticas de ícono + título como estructura de página, rojo decorativo, voseo rioplatense.
