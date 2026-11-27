import {copyFile, mkdir} from 'node:fs/promises';

const destination = new URL('./public/fonts/', import.meta.url);
await mkdir(destination, {recursive: true});
await Promise.all([
  copyFile(new URL('./src/overview-material-symbols.woff2', import.meta.url), new URL('stitch-material-symbols.woff2', destination)),
  copyFile(new URL('./node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', import.meta.url), new URL('inter-latin.woff2', destination)),
  copyFile(new URL('./MATERIAL-SYMBOLS-LICENSE.txt', import.meta.url), new URL('material-symbols-license.txt', destination)),
  copyFile(new URL('./node_modules/@fontsource-variable/inter/LICENSE', import.meta.url), new URL('inter-license.txt', destination)),
]);
