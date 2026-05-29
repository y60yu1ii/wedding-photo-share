

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export const imports = ["_app/immutable/nodes/0.DRs4UhHG.js","_app/immutable/chunks/BEM2-C0V.js","_app/immutable/chunks/BniqJBP0.js","_app/immutable/chunks/CBZYbOYn.js"];
export const stylesheets = ["_app/immutable/assets/0.v10EKxhH.css"];
export const fonts = [];
