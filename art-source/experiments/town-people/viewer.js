import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

async function start() {
  const canvas = document.querySelector("canvas");
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio));
  renderer.setClearColor(0xdbe5df);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-4,4,1.55,-1.55,.01,50);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enablePan = false;
  orbit.minZoom = .65;
  orbit.maxZoom = 2.8;
  orbit.maxPolarAngle = .54*Math.PI;
  orbit.target.set(0,1.13,0);
  const light = new THREE.DirectionalLight(0xfffbef,1.23);
  light.position.set(-3,6,5);
  scene.add(light,new THREE.HemisphereLight(0xfffdf4,0xe1ddeb,2.30));
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width=shadowCanvas.height=128;
  const ctx=shadowCanvas.getContext("2d");
  const radial=ctx.createRadialGradient(64,64,1,64,64,64);
  radial.addColorStop(0,"rgba(39,51,62,.33)");
  radial.addColorStop(.54,"rgba(39,51,62,.15)");
  radial.addColorStop(1,"rgba(39,51,62,0)");
  ctx.fillStyle=radial;ctx.fillRect(0,0,128,128);
  const shadowMap=new THREE.CanvasTexture(shadowCanvas);
  shadowMap.colorSpace=THREE.SRGBColorSpace;
  const shadowMat=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false});
  const people=await Promise.all([4,10,20].map(async id=>{
    const model=await new GLTFLoader().loadAsync(`person${id}.glb`);
    const group=new THREE.Group();
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.15,1.3),shadowMat);
    shadow.rotation.x=-Math.PI/2;
    group.add(model.scene,shadow);
    scene.add(group);
    const mixer=new THREE.AnimationMixer(model.scene);
    return {id,group,mixer,actions:Object.fromEntries(model.animations.map(a=>[a.name,mixer.clipAction(a)]))};
  }));
  let focus,clip,previous=performance.now();
  function view(angle,elev=9){
    const a=angle*Math.PI/180,e=elev*Math.PI/180;
    camera.position.set(8*Math.sin(a)*Math.cos(e),1.13+8*Math.sin(e),8*Math.cos(a)*Math.cos(e));
    orbit.update();
  }
  function size(){
    const w=canvas.clientWidth,h=canvas.clientHeight;
    renderer.setSize(w,h,false);
    const half=Math.max(1.5,(focus?1.11:3.08)*h/w);
    camera.top=half;camera.bottom=-half;camera.right=half*w/h;camera.left=-camera.right;
    camera.updateProjectionMatrix();
  }
  function choose(id){
    focus=people.some(p=>p.id===id)?id:0;
    for(const p of people)p.group.visible=!focus||focus===p.id;
    document.querySelectorAll("[data-id]").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.id)===focus)));
    const links=document.querySelector("#files");
    links.hidden=!focus;
    if(focus){
      links.children[0].href=`person${focus}.glb`;
      links.children[1].href=`person${focus}.blend`;
    }
    camera.zoom=1;
    size();
  }
  function motion(name){
    if(clip!==name)for(const p of people){p.mixer.stopAllAction();p.actions[name].reset().play();}
    clip=name;
    document.querySelectorAll("[data-motion]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.motion===clip)));
  }
  function draw(){
    // Keep separate turntable centers side by side while inspecting the group.
    const theta=orbit.getAzimuthalAngle();
    people.forEach((p,i)=>{
      const x=focus?0:(i-1)*2;
      p.group.position.set(x*Math.cos(theta),0,-x*Math.sin(theta));
    });
    renderer.render(scene,camera);
  }
  document.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>choose(Number(b.dataset.id)));
  document.querySelectorAll("[data-motion]").forEach(b=>b.onclick=()=>motion(b.dataset.motion));
  document.querySelectorAll("[data-angle]").forEach(b=>b.onclick=()=>view(Number(b.dataset.angle),Number(b.dataset.elevation??8)));
  new ResizeObserver(size).observe(canvas);
  motion("Idle");
  view(20);
  choose(Number(new URLSearchParams(location.search).get("person")));
  if(location.hash==="#capture"){
    window.still=({id,angle,elev,time,action})=>{
      if(focus!==id)choose(id);
      motion(action);view(angle,elev);
      people.forEach((p,i)=>p.mixer.setTime(time+(action==="Walk"&&id===0?i*.16:0)));
      draw();
      return canvas.toDataURL().split(",")[1];
    };
  }else{
    renderer.setAnimationLoop(now=>{
      const dt=Math.min(.1,(now-previous)/1000);
      for(const p of people)p.mixer.update(dt);
      previous=now;
      draw();
    });
  }
  document.querySelector("#loading").hidden=true;
}
start().catch(error=>{console.error(error);document.querySelector("#loading").textContent="Open the angle sheet or turntable below to see the models.";});
