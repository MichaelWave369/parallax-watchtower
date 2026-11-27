import http from 'node:http';
// Keep localhost direct while tunnelling live HTTPS through the execution
// environment's managed proxy. Browser TLS and CORS remain fully enabled.
export async function browserNetwork() {
 if(!process.env.HTTPS_PROXY) return {proxy:undefined,close:()=>{}};
 const upstream=new URL(process.env.HTTPS_PROXY), sockets=new Set();
 const proxy=http.createServer((req,res)=>{
  const target=new URL(req.url);
  const local=['127.0.0.1','localhost'].includes(target.hostname);
  const next=http.request(local?target:{hostname:upstream.hostname,port:upstream.port,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  next.on('error',()=>{res.writeHead(502);res.end('Proxy connection failed');});req.pipe(next);
 });
 proxy.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
 proxy.on('connect',(req,client,head)=>{
  const tunnel=http.request({hostname:upstream.hostname,port:upstream.port,method:'CONNECT',path:req.url,headers:{host:req.url}});
  tunnel.on('connect',(response,remote,extra)=>{
   if(response.statusCode!==200){client.destroy();remote.destroy();return;}
   sockets.add(remote);remote.on('close',()=>sockets.delete(remote));client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
   if(head.length)remote.write(head);if(extra.length)client.write(extra);remote.pipe(client);client.pipe(remote);
   client.on('error',()=>remote.destroy());remote.on('error',()=>client.destroy());
  });tunnel.on('error',()=>client.destroy());tunnel.end();
 });
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));
 return {proxy:{server:`http://127.0.0.1:${proxy.address().port}`},close:()=>{for(const s of sockets)s.destroy();proxy.close();}};
}
