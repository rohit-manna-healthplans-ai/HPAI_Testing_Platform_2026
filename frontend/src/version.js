// Injected at build time from frontend/package.json (see vite.config.js).
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
