import type {FastifyInstance} from 'fastify';
import {readFile} from 'node:fs/promises';

export function buyerStatic(app:FastifyInstance){
  const files = [
    ['', 'index.html','text/html; charset=utf-8'],
    ['app.js','app.js','text/javascript; charset=utf-8'],
    ['app.css','app.css','text/css; charset=utf-8'],
    ['mlbb.webp','mlbb.webp','image/webp'],
    ['free-fire.webp','free-fire.webp','image/webp'],
  ] as const;
  for(const [route,file,mime] of files){
    app.get('/buyer/'+route,{config:{customerRoute:true}},async (_request,reply)=>{
      const content=await readFile(new URL('../buyer-ui/'+file,import.meta.url));
      return reply.header('Cache-Control','no-cache').header('X-Content-Type-Options','nosniff')
        .header('Referrer-Policy','no-referrer')
        .header('Content-Security-Policy',"default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        .type(mime).send(content);
    });
  }
}
