import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'/admin-app/',build:{outDir:'dist',emptyOutDir:true},server:{host:'127.0.0.1',proxy:{'/admin/v1':'http://127.0.0.1:3000'}}});
