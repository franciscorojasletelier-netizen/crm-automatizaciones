// Tema claro/oscuro. La preferencia vive en localStorage ('sistema' por
// defecto); la clase .dark en <html> activa el bloque de modo oscuro de
// globals.css.
export type ThemeChoice = 'sistema' | 'claro' | 'oscuro'
export const THEME_STORAGE_KEY = 'tema'

/** Para <head>: aplica el tema antes del primer pintado (sin destello). */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'sistema';var d=t==='oscuro'||(t==='sistema'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`
