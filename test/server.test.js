// Server check: 3-player room, relay with seat numbers, rank points by placement.
// Run against a throwaway server:  PORT=3111 DATA_DIR=/tmp/cd-test node server.js   then   node test/server.test.js 3111
const WebSocket=require("ws"),assert=require("assert"),port=process.argv[2]||3111;
const mk=(id,name)=>new Promise(res=>{ const ws=new WebSocket("ws://localhost:"+port+"/ws");ws.q=[];ws.on("message",d=>ws.q.push(JSON.parse(d)));
  ws.on("open",()=>{ws.send(JSON.stringify({t:"hello",id,name}));res(ws);}); });
const wait=ms=>new Promise(r=>setTimeout(r,ms)),get=(ws,t)=>ws.q.filter(m=>m.t===t).pop(),tx=(ws,o)=>ws.send(JSON.stringify(o));
(async()=>{
  const h=await mk("a".repeat(32),"Host<b>"),g1=await mk("b".repeat(32),"Guest One"),g2=await mk("c".repeat(32),"");
  tx(h,{t:"host",max:5});await wait(100);const code=get(h,"room").code;
  tx(g1,{t:"join",code});await wait(50);tx(g2,{t:"join",code});await wait(100);
  assert.deepStrictEqual([get(g1,"joined").n,get(g2,"joined").n],[1,2]);
  assert.strictEqual(h.q.filter(m=>m.t==="peer").length,2);
  tx(g2,{t:"i",h:3,e:"p"});await wait(50);assert.strictEqual(get(h,"i").n,2);          // guest input reaches host with its seat
  tx(h,{t:"start",rum:1});await wait(50);assert.ok(get(g1,"start")&&get(g2,"start"));   // host traffic reaches every guest
  const late=await mk("d".repeat(32),"Late");tx(late,{t:"join",code});await wait(50);assert.ok(get(late,"err"));
  await wait(15200);
  tx(h,{t:"res",w:1,pl:[1,0,2]});await wait(150);                                      // g1 first, host second, g2 last
  assert.deepStrictEqual([get(g1,"rp").d,get(h,"rp").d,get(g2,"rp").d],[30,5,0]);       // last place is an Intern: no loss
  const lb=await (await fetch("http://localhost:"+port+"/api/lb?id="+"b".repeat(32))).json();
  assert.strictEqual(lb.top[0].n,"Guest One");assert.strictEqual(lb.me.rank,1);assert.strictEqual(lb.top[1].n,"Hostb");assert.strictEqual(lb.players,3);
  tx(h,{t:"start",rum:1});await wait(50);g2.close();await wait(100);                    // walking out = last place, recorded straight away
  const lb2=await (await fetch("http://localhost:"+port+"/api/lb?id="+"c".repeat(32))).json();assert.strictEqual(lb2.me.g,2);
  assert.strictEqual(get(h,"left").n,2);
  const day=new Date().toISOString().slice(0,10),post=b=>fetch("http://localhost:"+port+"/api/daily",{method:"POST",body:JSON.stringify(b)});
  const d1=await (await post({id:"f".repeat(32),name:"Daily Dev",day,score:1800})).json();assert.strictEqual(d1.best,1800);     // daily score is kept
  const d2=await (await post({id:"f".repeat(32),name:"Daily Dev",day,score:900})).json();assert.strictEqual(d2.best,1800);      // a worse run does not replace it
  assert.strictEqual((await post({id:"f".repeat(32),day,score:99999})).status,400);                                              // impossible scores are refused
  const lb3=await (await fetch("http://localhost:"+port+"/api/lb")).json();assert.strictEqual(lb3.daily[0].n,"Daily Dev");assert.strictEqual(lb3.players,3); // daily-only players stay off the rank table
  console.log("rank test OK");process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
