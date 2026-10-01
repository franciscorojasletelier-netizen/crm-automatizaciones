// Tema claro/oscuro. La preferencia vive en localStorage ('sistema' por
// defecto); la clase .dark en <html> activa el bloque de modo oscuro de
// globals.css.
export type ThemeChoice = 'sistema' | 'claro' | 'oscuro'
export const THEME_STORAGE_KEY = 'tema'

/**
 * Para <head>: aplica el tema antes del primer pintado (sin destello).
 * Al imprimir quita .dark para que el papel salga siempre en claro.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var h=document.documentElement;var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'sistema';var d=t==='oscuro'||(t==='sistema'&&window.matchMedia('(prefers-color-scheme: dark)').matches);h.classList.toggle('dark',d);var was=false;window.addEventListener('beforeprint',function(){was=h.classList.contains('dark');h.classList.remove('dark')});window.addEventListener('afterprint',function(){if(was)h.classList.add('dark')})}catch(e){}})()`
