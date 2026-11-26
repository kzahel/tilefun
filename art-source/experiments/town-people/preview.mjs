import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";
import { PNG } from "pngjs";
const out=resolve("public/demos/town-people-3d/v1"), frames=resolve("data/experiments/town-people");
await mkdir(frames,{recursive:true});
const bundle=await build({entryPoints:[join(import.meta.dirname,"viewer.js")],bundle:true,minify:true,write:false});
const roster=[];
for(const id of [4,10,20]){
  const sprite=PNG.sync.read(await readFile(`public/assets/sprites/person${id}.png`));
  const first=new PNG({width:16,height:32});
  PNG.bitblt(sprite,first,0,0,16,32,0,0);
  roster.push(`<button data-id="${id}"><img alt="" src="data:image/png;base64,${PNG.sync.write(first).toString("base64")}">Person ${id}</button>`);
}
const html=(await readFile(join(import.meta.dirname,"viewer.html"),"utf8")).replace("__ROSTER__",roster.join(""))
  .replace("__JS__",()=>bundle.outputFiles[0].text.replaceAll("</script","<\\/script"));
await writeFile(join(out,"index.html"),html);
const server=createServer(async(req,res)=>{
  const file=req.url.split("?")[0].slice(1)||"index.html";
  if(!["index.html","person4.glb","person10.glb","person20.glb"].includes(file)){res.writeHead(404).end();return;}
  res.setHeader("Content-Type",file.endsWith(".html")?"text/html":"model/gltf-binary");
  res.end(await readFile(join(out,file)));
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
let browser;
try{
  browser=await chromium.launch({channel:"chromium",args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:940,height:456}});
  page.on("pageerror",console.error);
  const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url+"#capture");
  await page.waitForFunction(()=>window.still);
  async function shot(name,id,angle,elev,action,time){
    const raw=await page.evaluate(o=>window.still(o),{id,angle,elev,action,time});
    await writeFile(join(frames,name+".png"),Buffer.from(raw,"base64"));
  }
  for(const [name,angle,elev] of [["front",0,4],["three-quarter",26,8],["profile",90,6],["back",180,7],["above",24,44]])
    await shot(name,0,angle,elev,"Idle",0);
  if(!process.argv.includes("--stills"))
    for(let i=0;i<192;i++)await shot("turn-"+String(i).padStart(3,"0"),0,26+i*360/192,10+8*Math.sin(i*Math.PI/192)**2,"Walk",i/24);
  await page.goto(url+"?person=20");
  await page.waitForSelector('#loading',{state:"hidden"});
  if(await page.locator('[data-id="20"]').getAttribute("aria-pressed")!=="true")throw Error("Deep link failed");
  await page.getByRole("button",{name:"Person 4",exact:true}).click();
  await page.getByRole("button",{name:"Walk",exact:true}).click();
  if(await page.locator("#files a").first().getAttribute("href")!=="person4.glb")throw Error("Wrong download");
}finally{await browser?.close();server.close();}
