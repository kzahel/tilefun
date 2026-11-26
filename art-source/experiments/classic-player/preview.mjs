import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const output = resolve(process.argv[2] ?? "public/demos/classic-player-3d/v1");
const frames = resolve(process.argv[3] ?? "data/experiments/classic-player");
const here = import.meta.dirname;
const bundle = await build({entryPoints:[join(here,"viewer.js")],bundle:true,minify:true,write:false,format:"iife"});
const html = (await readFile(join(here,"viewer.html"),"utf8"))
  .replace("__MODEL__",(await readFile(join(output,"classic-player.glb"))).toString("base64"))
  .replace("__SPRITE__","data:image/png;base64,"+(await readFile("public/assets/sprites/player.png")).toString("base64"))
  .replace("__VIEWER__",() => bundle.outputFiles[0].text.replaceAll("</script","<\\/script"));
const viewer = join(output,"index.html");
await writeFile(viewer,html);
await mkdir(frames,{recursive:true});
const browser = await chromium.launch({channel:"chromium",args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try {
  const page = await browser.newPage({viewport:{width:768,height:640}});
  page.on("pageerror",console.error);
  page.on("console", msg => {if(msg.type()==="error")console.error(msg.text());});
  await page.goto(pathToFileURL(viewer).href+"#capture");
  await page.waitForFunction(() => window.previewFrame);
  async function shot(name,angle,elevation,clip="Idle",time=0) {
    const result = await page.evaluate(options => window.previewFrame(options),{angle,elevation,clip,time});
    await writeFile(join(frames,name+".png"),Buffer.from(result,"base64"));
  }
  for (const [name,angle,elev] of [["front",0,4],["hero",29,12],["side",90,5],["back",180,8],["above",32,48]]) {
    await shot(name,angle,elev);
  }
  if (!process.argv.includes("--stills")) {
    await page.setViewportSize({width:768,height:640});
    const fps = 24, duration = 8;
    for (let i=0;i<fps*duration;i++) {
      await shot("orbit-"+String(i).padStart(3,"0"),29+360*i/(fps*duration),
        14+10*Math.sin(i/(fps*duration)*Math.PI)**2,"Walk",i/fps);
    }
  }
  await page.goto(pathToFileURL(viewer).href);
  await page.getByRole("button",{name:"Walk",exact:true}).click();
  await page.getByRole("button",{name:"Back",exact:true}).click();
  if (await page.locator('[data-view="Back"]').getAttribute("aria-pressed") !== "true" ||
      await page.locator('[data-clip="Walk"]').getAttribute("aria-pressed") !== "true") throw Error("Viewer controls failed");
} finally {await browser.close();}
