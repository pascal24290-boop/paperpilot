self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("push",event=>{
  let data={title:"PaperPilot — rappel",body:"Vous avez un rappel PaperPilot."};
  try{ if(event.data) data=Object.assign(data,event.data.json()); }catch(e){}
  event.waitUntil(self.registration.showNotification(data.title,{body:data.body,tag:"paperpilot-push"}));
});
