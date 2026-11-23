import type { FastifyRequest } from 'fastify';
export function sessionToken(req:FastifyRequest){
 if(req.headers.authorization)return req.headers.authorization.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
 return req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('squid_session='))?.slice('squid_session='.length)??'';
}
