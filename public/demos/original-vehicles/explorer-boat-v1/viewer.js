var Ld=0,gc=1,Fd=2;var as=1,Nd=2,mr=3,Pn=0,Yt=1,Qt=2,ln=0,gr=1,vc=2,_c=3,bc=4,Dd=5;var Ci=100,Ud=101,Od=102,Bd=103,zd=104,kd=200,Hd=201,Vd=202,Gd=203,xc=204,yc=205,Wd=206,Xd=207,Yd=208,qd=209,Zd=210,Kd=211,Jd=212,$d=213,jd=214,js=0,Qs=1,ea=2,ji=3,ta=4,na=5,ia=6,ra=7,Mc=0,Qd=1,eh=2,rn=0,Sc=1,wc=2,Tc=3,Ac=4,Ec=5,Rc=6,Cc=7,rc="attached",th="detached",Ic=300,fi=301,Ii=302,Sa=303,wa=304,os=306,ci=1e3,cn=1001,Qi=1002,st=1003,Ta=1004;var Pi=1005;var vt=1006,vr=1007;var xn=1008;var en=1009,Pc=1010,Lc=1011,_r=1012,Aa=1013,yn=1014,qt=1015,Mn=1016,Ea=1017,Ra=1018,br=1020,Fc=35902,Nc=35899,Dc=1021,Uc=1022,sn=1023,En=1026,ui=1027,Ca=1028,Ia=1029,pi=1030,Pa=1031;var La=1033,cs=33776,ls=33777,ds=33778,hs=33779,Fa=35840,Na=35841,Da=35842,Ua=35843,Oa=36196,Ba=37492,za=37496,ka=37488,Ha=37489,fs=37490,Va=37491,Ga=37808,Wa=37809,Xa=37810,Ya=37811,qa=37812,Za=37813,Ka=37814,Ja=37815,$a=37816,ja=37817,Qa=37818,eo=37819,to=37820,no=37821,io=36492,ro=36494,so=36495,ao=36283,oo=36284,us=36285,co=36286;var Mi=2300,Si=2301,Ks=2302,sc=2303,ac=2400,oc=2401,cc=2402,nh=2500;var Oc=0,ps=1,xr=2,ih=3200;var lo=0,rh=1,Jn="",ht="srgb",Vt="srgb-linear",Or="linear",je="srgb";var Js=7680;var sh=519,ah=512,oh=513,ch=514,ho=515,lh=516,dh=517,fo=518,hh=519,Bc=35044;var zc="300 es",vn=2e3,er=2001;function Af(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function Ef(i){return ArrayBuffer.isView(i)&&!(i instanceof DataView)}function tr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function fh(){let i=tr("canvas");return i.style.display="block",i}var Kl={},nr=null;function Br(...i){let e="THREE."+i.shift();nr?nr("log",e,...i):console.log(e,...i)}function uh(i){let e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Me(...i){i=uh(i);let e="THREE."+i.shift();if(nr)nr("warn",e,...i);else{let t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function Ie(...i){i=uh(i);let e="THREE."+i.shift();if(nr)nr("error",e,...i);else{let t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function yi(...i){let e=i.join(" ");e in Kl||(Kl[e]=!0,Me(...i))}function ph(i,e,t){return new Promise(function(n,r){function s(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:r();break;case i.TIMEOUT_EXPIRED:setTimeout(s,t);break;default:n()}}setTimeout(s,t)})}var mh={[js]:Qs,[ea]:ia,[ta]:ra,[ji]:na,[Qs]:js,[ia]:ea,[ra]:ta,[na]:ji},Rn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let s=r.indexOf(t);s!==-1&&r.splice(s,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let r=n.slice(0);for(let s=0,a=r.length;s<a;s++)r[s].call(this,e);e.target=null}}},Dt=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Jl=1234567,Dr=Math.PI/180,wi=180/Math.PI;function _n(){let i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Dt[i&255]+Dt[i>>8&255]+Dt[i>>16&255]+Dt[i>>24&255]+"-"+Dt[e&255]+Dt[e>>8&255]+"-"+Dt[e>>16&15|64]+Dt[e>>24&255]+"-"+Dt[t&63|128]+Dt[t>>8&255]+"-"+Dt[t>>16&255]+Dt[t>>24&255]+Dt[n&255]+Dt[n>>8&255]+Dt[n>>16&255]+Dt[n>>24&255]).toLowerCase()}function Ge(i,e,t){return Math.max(e,Math.min(t,i))}function kc(i,e){return(i%e+e)%e}function Rf(i,e,t,n,r){return n+(i-e)*(r-n)/(t-e)}function Cf(i,e,t){return i!==e?(t-i)/(e-i):0}function Ur(i,e,t){return(1-t)*i+t*e}function If(i,e,t,n){return Ur(i,e,1-Math.exp(-t*n))}function Pf(i,e=1){return e-Math.abs(kc(i,e*2)-e)}function Lf(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*(3-2*i))}function Ff(i,e,t){return i<=e?0:i>=t?1:(i=(i-e)/(t-e),i*i*i*(i*(i*6-15)+10))}function Nf(i,e){return i+Math.floor(Math.random()*(e-i+1))}function Df(i,e){return i+Math.random()*(e-i)}function Uf(i){return i*(.5-Math.random())}function Of(i){i!==void 0&&(Jl=i);let e=Jl+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Bf(i){return i*Dr}function zf(i){return i*wi}function kf(i){return i>0&&Number.isInteger(i)&&2**Math.round(Math.log2(i))===i}function Hf(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function Vf(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Gf(i,e,t,n,r){let s=Math.cos,a=Math.sin,o=s(t/2),l=a(t/2),c=s((e+n)/2),d=a((e+n)/2),f=s((e-n)/2),h=a((e-n)/2),u=s((n-e)/2),g=a((n-e)/2);switch(r){case"XYX":i.set(o*d,l*f,l*h,o*c);break;case"YZY":i.set(l*h,o*d,l*f,o*c);break;case"ZXZ":i.set(l*f,l*h,o*d,o*c);break;case"XZX":i.set(o*d,l*g,l*u,o*c);break;case"YXY":i.set(l*u,o*d,l*g,o*c);break;case"ZYZ":i.set(l*g,l*u,o*d,o*c);break;default:Me("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+r)}}function gn(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function et(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Hc={DEG2RAD:Dr,RAD2DEG:wi,generateUUID:_n,clamp:Ge,euclideanModulo:kc,mapLinear:Rf,inverseLerp:Cf,lerp:Ur,damp:If,pingpong:Pf,smoothstep:Lf,smootherstep:Ff,randInt:Nf,randFloat:Df,randFloatSpread:Uf,seededRandom:Of,degToRad:Bf,radToDeg:zf,isPowerOfTwo:kf,ceilPowerOfTwo:Hf,floorPowerOfTwo:Vf,setQuaternionFromProperEuler:Gf,normalize:et,denormalize:gn},De=class i{static{i.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),s=this.x-e.x,a=this.y-e.y;return this.x=s*n-a*r+e.x,this.y=s*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},Gt=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,s,a,o){let l=n[r+0],c=n[r+1],d=n[r+2],f=n[r+3],h=s[a+0],u=s[a+1],g=s[a+2],x=s[a+3];if(f!==x||l!==h||c!==u||d!==g){let m=l*h+c*u+d*g+f*x;m<0&&(h=-h,u=-u,g=-g,x=-x,m=-m);let p=1-o;if(m<.9995){let T=Math.acos(m),R=Math.sin(T);p=Math.sin(p*T)/R,o=Math.sin(o*T)/R,l=l*p+h*o,c=c*p+u*o,d=d*p+g*o,f=f*p+x*o}else{l=l*p+h*o,c=c*p+u*o,d=d*p+g*o,f=f*p+x*o;let T=1/Math.sqrt(l*l+c*c+d*d+f*f);l*=T,c*=T,d*=T,f*=T}}e[t]=l,e[t+1]=c,e[t+2]=d,e[t+3]=f}static multiplyQuaternionsFlat(e,t,n,r,s,a){let o=n[r],l=n[r+1],c=n[r+2],d=n[r+3],f=s[a],h=s[a+1],u=s[a+2],g=s[a+3];return e[t]=o*g+d*f+l*u-c*h,e[t+1]=l*g+d*h+c*f-o*u,e[t+2]=c*g+d*u+o*h-l*f,e[t+3]=d*g-o*f-l*h-c*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,s=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),d=o(r/2),f=o(s/2),h=l(n/2),u=l(r/2),g=l(s/2);switch(a){case"XYZ":this._x=h*d*f+c*u*g,this._y=c*u*f-h*d*g,this._z=c*d*g+h*u*f,this._w=c*d*f-h*u*g;break;case"YXZ":this._x=h*d*f+c*u*g,this._y=c*u*f-h*d*g,this._z=c*d*g-h*u*f,this._w=c*d*f+h*u*g;break;case"ZXY":this._x=h*d*f-c*u*g,this._y=c*u*f+h*d*g,this._z=c*d*g+h*u*f,this._w=c*d*f-h*u*g;break;case"ZYX":this._x=h*d*f-c*u*g,this._y=c*u*f+h*d*g,this._z=c*d*g-h*u*f,this._w=c*d*f+h*u*g;break;case"YZX":this._x=h*d*f+c*u*g,this._y=c*u*f+h*d*g,this._z=c*d*g-h*u*f,this._w=c*d*f-h*u*g;break;case"XZY":this._x=h*d*f-c*u*g,this._y=c*u*f-h*d*g,this._z=c*d*g+h*u*f,this._w=c*d*f+h*u*g;break;default:Me("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],s=t[8],a=t[1],o=t[5],l=t[9],c=t[2],d=t[6],f=t[10],h=n+o+f;if(h>0){let u=.5/Math.sqrt(h+1);this._w=.25/u,this._x=(d-l)*u,this._y=(s-c)*u,this._z=(a-r)*u}else if(n>o&&n>f){let u=2*Math.sqrt(1+n-o-f);this._w=(d-l)/u,this._x=.25*u,this._y=(r+a)/u,this._z=(s+c)/u}else if(o>f){let u=2*Math.sqrt(1+o-n-f);this._w=(s-c)/u,this._x=(r+a)/u,this._y=.25*u,this._z=(l+d)/u}else{let u=2*Math.sqrt(1+f-n-o);this._w=(a-r)/u,this._x=(s+c)/u,this._y=(l+d)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Ge(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,s=e._z,a=e._w,o=t._x,l=t._y,c=t._z,d=t._w;return this._x=n*d+a*o+r*c-s*l,this._y=r*d+a*l+s*o-n*c,this._z=s*d+a*c+n*l-r*o,this._w=a*d-n*o-r*l-s*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,s=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,s=-s,a=-a,o=-o);let l=1-t;if(o<.9995){let c=Math.acos(o),d=Math.sin(c);l=Math.sin(l*c)/d,t=Math.sin(t*c)/d,this._x=this._x*l+n*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+r*t,this._z=this._z*l+s*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),s*Math.sin(t),s*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},N=class i{static{i.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion($l.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion($l.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6]*r,this.y=s[1]*t+s[4]*n+s[7]*r,this.z=s[2]*t+s[5]*n+s[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,s=e.elements,a=1/(s[3]*t+s[7]*n+s[11]*r+s[15]);return this.x=(s[0]*t+s[4]*n+s[8]*r+s[12])*a,this.y=(s[1]*t+s[5]*n+s[9]*r+s[13])*a,this.z=(s[2]*t+s[6]*n+s[10]*r+s[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,s=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*r-o*n),d=2*(o*t-s*r),f=2*(s*n-a*t);return this.x=t+l*c+a*f-o*d,this.y=n+l*d+o*c-s*f,this.z=r+l*f+s*d-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,s=e.elements;return this.x=s[0]*t+s[4]*n+s[8]*r,this.y=s[1]*t+s[5]*n+s[9]*r,this.z=s[2]*t+s[6]*n+s[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,s=e.z,a=t.x,o=t.y,l=t.z;return this.x=r*l-s*o,this.y=s*a-n*l,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return No.copy(this).projectOnVector(e),this.sub(No)}reflect(e){return this.sub(No.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Ge(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},No=new N,$l=new Gt,Pe=class i{static{i.prototype.isMatrix3=!0}constructor(e,t,n,r,s,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,a,o,l,c)}set(e,t,n,r,s,a,o,l,c){let d=this.elements;return d[0]=e,d[1]=r,d[2]=o,d[3]=t,d[4]=s,d[5]=l,d[6]=n,d[7]=a,d[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,s=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],d=n[4],f=n[7],h=n[2],u=n[5],g=n[8],x=r[0],m=r[3],p=r[6],T=r[1],R=r[4],y=r[7],M=r[2],S=r[5],E=r[8];return s[0]=a*x+o*T+l*M,s[3]=a*m+o*R+l*S,s[6]=a*p+o*y+l*E,s[1]=c*x+d*T+f*M,s[4]=c*m+d*R+f*S,s[7]=c*p+d*y+f*E,s[2]=h*x+u*T+g*M,s[5]=h*m+u*R+g*S,s[8]=h*p+u*y+g*E,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8];return t*a*d-t*o*c-n*s*d+n*o*l+r*s*c-r*a*l}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],f=d*a-o*c,h=o*l-d*s,u=c*s-a*l,g=t*f+n*h+r*u;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/g;return e[0]=f*x,e[1]=(r*c-d*n)*x,e[2]=(o*n-r*a)*x,e[3]=h*x,e[4]=(d*t-r*l)*x,e[5]=(r*s-o*t)*x,e[6]=u*x,e[7]=(n*l-c*t)*x,e[8]=(a*t-n*s)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,s,a,o){let l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-r*c,r*l,-r*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return yi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Do.makeScale(e,t)),this}rotate(e){return yi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Do.makeRotation(-e)),this}translate(e,t){return yi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Do.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<9;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},Do=new Pe,jl=new Pe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ql=new Pe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Wf(){let i={enabled:!0,workingColorSpace:Vt,spaces:{},convert:function(r,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer===je&&(r.r=Hn(r.r),r.g=Hn(r.g),r.b=Hn(r.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(r.applyMatrix3(this.spaces[s].toXYZ),r.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===je&&(r.r=$i(r.r),r.g=$i(r.g),r.b=$i(r.b))),r},workingToColorSpace:function(r,s){return this.convert(r,this.workingColorSpace,s)},colorSpaceToWorking:function(r,s){return this.convert(r,s,this.workingColorSpace)},getPrimaries:function(r){return this.spaces[r].primaries},getTransfer:function(r){return r===Jn?Or:this.spaces[r].transfer},getToneMappingMode:function(r){return this.spaces[r].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(r,s=this.workingColorSpace){return r.fromArray(this.spaces[s].luminanceCoefficients)},define:function(r){Object.assign(this.spaces,r)},_getMatrix:function(r,s,a){return r.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(r){return this.spaces[r].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(r=this.workingColorSpace){return this.spaces[r].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(r,s){return yi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(r,s)},toWorkingColorSpace:function(r,s){return yi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(r,s)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[Vt]:{primaries:e,whitePoint:n,transfer:Or,toXYZ:jl,fromXYZ:Ql,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:ht},outputColorSpaceConfig:{drawingBufferColorSpace:ht}},[ht]:{primaries:e,whitePoint:n,transfer:je,toXYZ:jl,fromXYZ:Ql,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:ht}}}),i}var Be=Wf();function Hn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function $i(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}var Oi,sa=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Oi===void 0&&(Oi=tr("canvas")),Oi.width=e.width,Oi.height=e.height;let r=Oi.getContext("2d");e instanceof ImageData?r.putImageData(e,0,0):r.drawImage(e,0,0,e.width,e.height),n=Oi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=tr("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),s=r.data;for(let a=0;a<s.length;a++)s[a]=Hn(s[a]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Hn(t[n]/255)*255):t[n]=Hn(t[n]);return{data:t,width:e.width,height:e.height}}else return Me("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Xf=0,ir=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Xf++}),this.uuid=_n(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},r=this.data;if(r!==null){let s;if(Array.isArray(r)){s=[];for(let a=0,o=r.length;a<o;a++)r[a].isDataTexture?s.push(Uo(r[a].image)):s.push(Uo(r[a]))}else s=Uo(r);n.url=s}return t||(e.images[this.uuid]=n),n}};function Uo(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?sa.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Me("Texture: Unable to serialize Texture."),{})}var Yf=0,Oo=new N,Mt=class i extends Rn{constructor(e=i.DEFAULT_IMAGE,t=i.DEFAULT_MAPPING,n=cn,r=cn,s=vt,a=xn,o=sn,l=en,c=i.DEFAULT_ANISOTROPY,d=Jn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Yf++}),this.uuid=_n(),this.name="",this.source=new ir(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=r,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new De(0,0),this.repeat=new De(1,1),this.center=new De(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Pe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=d,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Oo).x}get height(){return this.source.getSize(Oo).y}get depth(){return this.source.getSize(Oo).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){Me(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Me(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Ic)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ci:e.x=e.x-Math.floor(e.x);break;case cn:e.x=e.x<0?0:1;break;case Qi:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ci:e.y=e.y-Math.floor(e.y);break;case cn:e.y=e.y<0?0:1;break;case Qi:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Mt.DEFAULT_IMAGE=null;Mt.DEFAULT_MAPPING=Ic;Mt.DEFAULT_ANISOTROPY=1;var tt=class i{static{i.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,s=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*s,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*s,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*s,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*s,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,s,l=e.elements,c=l[0],d=l[4],f=l[8],h=l[1],u=l[5],g=l[9],x=l[2],m=l[6],p=l[10];if(Math.abs(d-h)<.01&&Math.abs(f-x)<.01&&Math.abs(g-m)<.01){if(Math.abs(d+h)<.1&&Math.abs(f+x)<.1&&Math.abs(g+m)<.1&&Math.abs(c+u+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let R=(c+1)/2,y=(u+1)/2,M=(p+1)/2,S=(d+h)/4,E=(f+x)/4,_=(g+m)/4;return R>y&&R>M?R<.01?(n=0,r=.707106781,s=.707106781):(n=Math.sqrt(R),r=S/n,s=E/n):y>M?y<.01?(n=.707106781,r=0,s=.707106781):(r=Math.sqrt(y),n=S/r,s=_/r):M<.01?(n=.707106781,r=.707106781,s=0):(s=Math.sqrt(M),n=E/s,r=_/s),this.set(n,r,s,t),this}let T=Math.sqrt((m-g)*(m-g)+(f-x)*(f-x)+(h-d)*(h-d));return Math.abs(T)<.001&&(T=1),this.x=(m-g)/T,this.y=(f-x)/T,this.z=(h-d)/T,this.w=Math.acos((c+u+p-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Ge(this.x,e.x,t.x),this.y=Ge(this.y,e.y,t.y),this.z=Ge(this.z,e.z,t.z),this.w=Ge(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Ge(this.x,e,t),this.y=Ge(this.y,e,t),this.z=Ge(this.z,e,t),this.w=Ge(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Ge(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},aa=class extends Rn{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:vt,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new tt(0,0,e,t),this.scissorTest=!1,this.viewport=new tt(0,0,e,t),this.textures=[];let r={width:e,height:t,depth:n.depth},s=new Mt(r),a=n.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:vt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,s=this.textures.length;r<s;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let r=Object.assign({},e.textures[t].image);this.textures[t].source=new ir(r)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},Pt=class extends aa{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},zr=class extends Mt{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=st,this.minFilter=st,this.wrapR=cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var oa=class extends Mt{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=st,this.minFilter=st,this.wrapR=cn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var Fe=class i{static{i.prototype.isMatrix4=!0}constructor(e,t,n,r,s,a,o,l,c,d,f,h,u,g,x,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,s,a,o,l,c,d,f,h,u,g,x,m)}set(e,t,n,r,s,a,o,l,c,d,f,h,u,g,x,m){let p=this.elements;return p[0]=e,p[4]=t,p[8]=n,p[12]=r,p[1]=s,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=d,p[10]=f,p[14]=h,p[3]=u,p[7]=g,p[11]=x,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new i().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Bi.setFromMatrixColumn(e,0).length(),s=1/Bi.setFromMatrixColumn(e,1).length(),a=1/Bi.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*s,t[5]=n[5]*s,t[6]=n[6]*s,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,s=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(r),c=Math.sin(r),d=Math.cos(s),f=Math.sin(s);if(e.order==="XYZ"){let h=a*d,u=a*f,g=o*d,x=o*f;t[0]=l*d,t[4]=-l*f,t[8]=c,t[1]=u+g*c,t[5]=h-x*c,t[9]=-o*l,t[2]=x-h*c,t[6]=g+u*c,t[10]=a*l}else if(e.order==="YXZ"){let h=l*d,u=l*f,g=c*d,x=c*f;t[0]=h+x*o,t[4]=g*o-u,t[8]=a*c,t[1]=a*f,t[5]=a*d,t[9]=-o,t[2]=u*o-g,t[6]=x+h*o,t[10]=a*l}else if(e.order==="ZXY"){let h=l*d,u=l*f,g=c*d,x=c*f;t[0]=h-x*o,t[4]=-a*f,t[8]=g+u*o,t[1]=u+g*o,t[5]=a*d,t[9]=x-h*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){let h=a*d,u=a*f,g=o*d,x=o*f;t[0]=l*d,t[4]=g*c-u,t[8]=h*c+x,t[1]=l*f,t[5]=x*c+h,t[9]=u*c-g,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){let h=a*l,u=a*c,g=o*l,x=o*c;t[0]=l*d,t[4]=x-h*f,t[8]=g*f+u,t[1]=f,t[5]=a*d,t[9]=-o*d,t[2]=-c*d,t[6]=u*f+g,t[10]=h-x*f}else if(e.order==="XZY"){let h=a*l,u=a*c,g=o*l,x=o*c;t[0]=l*d,t[4]=-f,t[8]=c*d,t[1]=h*f+x,t[5]=a*d,t[9]=u*f-g,t[2]=g*f-u,t[6]=o*d,t[10]=x*f+h}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(qf,e,Zf)}lookAt(e,t,n){let r=this.elements;return tn.subVectors(e,t),tn.lengthSq()===0&&(tn.z=1),tn.normalize(),ti.crossVectors(n,tn),ti.lengthSq()===0&&(Math.abs(n.z)===1?tn.x+=1e-4:tn.z+=1e-4,tn.normalize(),ti.crossVectors(n,tn)),ti.normalize(),ws.crossVectors(tn,ti),r[0]=ti.x,r[4]=ws.x,r[8]=tn.x,r[1]=ti.y,r[5]=ws.y,r[9]=tn.y,r[2]=ti.z,r[6]=ws.z,r[10]=tn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,s=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],d=n[1],f=n[5],h=n[9],u=n[13],g=n[2],x=n[6],m=n[10],p=n[14],T=n[3],R=n[7],y=n[11],M=n[15],S=r[0],E=r[4],_=r[8],A=r[12],L=r[1],D=r[5],k=r[9],G=r[13],F=r[2],H=r[6],K=r[10],Z=r[14],ne=r[3],X=r[7],Q=r[11],te=r[15];return s[0]=a*S+o*L+l*F+c*ne,s[4]=a*E+o*D+l*H+c*X,s[8]=a*_+o*k+l*K+c*Q,s[12]=a*A+o*G+l*Z+c*te,s[1]=d*S+f*L+h*F+u*ne,s[5]=d*E+f*D+h*H+u*X,s[9]=d*_+f*k+h*K+u*Q,s[13]=d*A+f*G+h*Z+u*te,s[2]=g*S+x*L+m*F+p*ne,s[6]=g*E+x*D+m*H+p*X,s[10]=g*_+x*k+m*K+p*Q,s[14]=g*A+x*G+m*Z+p*te,s[3]=T*S+R*L+y*F+M*ne,s[7]=T*E+R*D+y*H+M*X,s[11]=T*_+R*k+y*K+M*Q,s[15]=T*A+R*G+y*Z+M*te,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],s=e[12],a=e[1],o=e[5],l=e[9],c=e[13],d=e[2],f=e[6],h=e[10],u=e[14],g=e[3],x=e[7],m=e[11],p=e[15],T=l*u-c*h,R=o*u-c*f,y=o*h-l*f,M=a*u-c*d,S=a*h-l*d,E=a*f-o*d;return t*(x*T-m*R+p*y)-n*(g*T-m*M+p*S)+r*(g*R-x*M+p*E)-s*(g*y-x*S+m*E)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],r=e[8],s=e[1],a=e[5],o=e[9],l=e[2],c=e[6],d=e[10];return t*(a*d-o*c)-n*(s*d-o*l)+r*(s*c-a*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],s=e[3],a=e[4],o=e[5],l=e[6],c=e[7],d=e[8],f=e[9],h=e[10],u=e[11],g=e[12],x=e[13],m=e[14],p=e[15],T=t*o-n*a,R=t*l-r*a,y=t*c-s*a,M=n*l-r*o,S=n*c-s*o,E=r*c-s*l,_=d*x-f*g,A=d*m-h*g,L=d*p-u*g,D=f*m-h*x,k=f*p-u*x,G=h*p-u*m,F=T*G-R*k+y*D+M*L-S*A+E*_;if(F===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let H=1/F;return e[0]=(o*G-l*k+c*D)*H,e[1]=(r*k-n*G-s*D)*H,e[2]=(x*E-m*S+p*M)*H,e[3]=(h*S-f*E-u*M)*H,e[4]=(l*L-a*G-c*A)*H,e[5]=(t*G-r*L+s*A)*H,e[6]=(m*y-g*E-p*R)*H,e[7]=(d*E-h*y+u*R)*H,e[8]=(a*k-o*L+c*_)*H,e[9]=(n*L-t*k-s*_)*H,e[10]=(g*S-x*y+p*T)*H,e[11]=(f*y-d*S-u*T)*H,e[12]=(o*A-a*D-l*_)*H,e[13]=(t*D-n*A+r*_)*H,e[14]=(x*R-g*M-m*T)*H,e[15]=(d*M-f*R+h*T)*H,this}scale(e){let t=this.elements,n=e.x,r=e.y,s=e.z;return t[0]*=n,t[4]*=r,t[8]*=s,t[1]*=n,t[5]*=r,t[9]*=s,t[2]*=n,t[6]*=r,t[10]*=s,t[3]*=n,t[7]*=r,t[11]*=s,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),s=1-n,a=e.x,o=e.y,l=e.z,c=s*a,d=s*o;return this.set(c*a+n,c*o-r*l,c*l+r*o,0,c*o+r*l,d*o+n,d*l-r*a,0,c*l-r*o,d*l+r*a,s*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,s,a){return this.set(1,n,s,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,s=t._x,a=t._y,o=t._z,l=t._w,c=s+s,d=a+a,f=o+o,h=s*c,u=s*d,g=s*f,x=a*d,m=a*f,p=o*f,T=l*c,R=l*d,y=l*f,M=n.x,S=n.y,E=n.z;return r[0]=(1-(x+p))*M,r[1]=(u+y)*M,r[2]=(g-R)*M,r[3]=0,r[4]=(u-y)*S,r[5]=(1-(h+p))*S,r[6]=(m+T)*S,r[7]=0,r[8]=(g+R)*E,r[9]=(m-T)*E,r[10]=(1-(h+x))*E,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let s=this.determinantAffine();if(s===0)return n.set(1,1,1),t.identity(),this;let a=Bi.set(r[0],r[1],r[2]).length(),o=Bi.set(r[4],r[5],r[6]).length(),l=Bi.set(r[8],r[9],r[10]).length();s<0&&(a=-a),fn.copy(this);let c=1/a,d=1/o,f=1/l;return fn.elements[0]*=c,fn.elements[1]*=c,fn.elements[2]*=c,fn.elements[4]*=d,fn.elements[5]*=d,fn.elements[6]*=d,fn.elements[8]*=f,fn.elements[9]*=f,fn.elements[10]*=f,t.setFromRotationMatrix(fn),n.x=a,n.y=o,n.z=l,this}makePerspective(e,t,n,r,s,a,o=vn,l=!1){let c=this.elements,d=2*s/(t-e),f=2*s/(n-r),h=(t+e)/(t-e),u=(n+r)/(n-r),g,x;if(l)g=s/(a-s),x=a*s/(a-s);else if(o===vn)g=-(a+s)/(a-s),x=-2*a*s/(a-s);else if(o===er)g=-a/(a-s),x=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=h,c[12]=0,c[1]=0,c[5]=f,c[9]=u,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,s,a,o=vn,l=!1){let c=this.elements,d=2/(t-e),f=2/(n-r),h=-(t+e)/(t-e),u=-(n+r)/(n-r),g,x;if(l)g=1/(a-s),x=a/(a-s);else if(o===vn)g=-2/(a-s),x=-(a+s)/(a-s);else if(o===er)g=-1/(a-s),x=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=d,c[4]=0,c[8]=0,c[12]=h,c[1]=0,c[5]=f,c[9]=0,c[13]=u,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let r=0;r<16;r++)if(t[r]!==n[r])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Bi=new N,fn=new Fe,qf=new N(0,0,0),Zf=new N(1,1,1),ti=new N,ws=new N,tn=new N,ed=new Fe,td=new Gt,Vn=class i{constructor(e=0,t=0,n=0,r=i.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=r}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,s=r[0],a=r[4],o=r[8],l=r[1],c=r[5],d=r[9],f=r[2],h=r[6],u=r[10];switch(t){case"XYZ":this._y=Math.asin(Ge(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-d,u),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(h,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Ge(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(o,u),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,s),this._z=0);break;case"ZXY":this._x=Math.asin(Ge(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(-f,u),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Ge(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(h,u),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Ge(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-d,c),this._y=Math.atan2(-f,s)):(this._x=0,this._y=Math.atan2(o,u));break;case"XZY":this._z=Math.asin(-Ge(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(h,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-d,u),this._y=0);break;default:Me("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return ed.makeRotationFromQuaternion(e),this.setFromRotationMatrix(ed,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return td.setFromEuler(this),this.setFromQuaternion(td,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Vn.DEFAULT_ORDER="XYZ";var kr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},Kf=0,nd=new N,zi=new Gt,Dn=new Fe,Ts=new N,Er=new N,Jf=new N,$f=new Gt,id=new N(1,0,0),rd=new N(0,1,0),sd=new N(0,0,1),ad={type:"added"},jf={type:"removed"},ki={type:"childadded",child:null},Bo={type:"childremoved",child:null},mt=class i extends Rn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Kf++}),this.uuid=_n(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=i.DEFAULT_UP.clone();let e=new N,t=new Vn,n=new Gt,r=new N(1,1,1);function s(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(s),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:r},modelViewMatrix:{value:new Fe},normalMatrix:{value:new Pe}}),this.matrix=new Fe,this.matrixWorld=new Fe,this.matrixAutoUpdate=i.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=i.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new kr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return zi.setFromAxisAngle(e,t),this.quaternion.multiply(zi),this}rotateOnWorldAxis(e,t){return zi.setFromAxisAngle(e,t),this.quaternion.premultiply(zi),this}rotateX(e){return this.rotateOnAxis(id,e)}rotateY(e){return this.rotateOnAxis(rd,e)}rotateZ(e){return this.rotateOnAxis(sd,e)}translateOnAxis(e,t){return nd.copy(e).applyQuaternion(this.quaternion),this.position.add(nd.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(id,e)}translateY(e){return this.translateOnAxis(rd,e)}translateZ(e){return this.translateOnAxis(sd,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Dn.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Ts.copy(e):Ts.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),Er.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Dn.lookAt(Er,Ts,this.up):Dn.lookAt(Ts,Er,this.up),this.quaternion.setFromRotationMatrix(Dn),r&&(Dn.extractRotation(r.matrixWorld),zi.setFromRotationMatrix(Dn),this.quaternion.premultiply(zi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ie("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(ad),ki.child=e,this.dispatchEvent(ki),ki.child=null):Ie("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(jf),Bo.child=e,this.dispatchEvent(Bo),Bo.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Dn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Dn.multiply(e.parent.matrixWorld)),e.applyMatrix4(Dn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(ad),ki.child=e,this.dispatchEvent(ki),ki.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let s=0,a=r.length;s<a;s++)r[s].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Er,e,Jf),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Er,$f,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,s=this.matrix.elements;s[12]+=t-s[0]*t-s[4]*n-s[8]*r,s[13]+=n-s[1]*t-s[5]*n-s[9]*r,s[14]+=r-s[2]*t-s[6]*n-s[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let r=this.parent;if(e===!0&&r!==null&&r.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let s=this.children;for(let a=0,o=s.length;a<o;a++)s[a].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let r={};r.uuid=this.uuid,r.type=this.type,r.name=this.name,r.castShadow=this.castShadow,r.receiveShadow=this.receiveShadow,r.visible=this.visible,r.frustumCulled=this.frustumCulled,r.renderOrder=this.renderOrder,r.static=this.static,r.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type="InstancedMesh",r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type="BatchedMesh",r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(o=>({...o})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=s(e.geometries,this.geometry);let o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){let l=o.shapes;if(Array.isArray(l))for(let c=0,d=l.length;c<d;c++){let f=l[c];s(e.shapes,f)}else s(e.shapes,l)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(e.materials,this.material[l]));r.material=o}else r.material=s(e.materials,this.material);if(this.children.length>0){r.children=[];for(let o=0;o<this.children.length;o++)r.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let o=0;o<this.animations.length;o++){let l=this.animations[o];r.animations.push(s(e.animations,l))}}if(t){let o=a(e.geometries),l=a(e.materials),c=a(e.textures),d=a(e.images),f=a(e.shapes),h=a(e.skeletons),u=a(e.animations),g=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),d.length>0&&(n.images=d),f.length>0&&(n.shapes=f),h.length>0&&(n.skeletons=h),u.length>0&&(n.animations=u),g.length>0&&(n.nodes=g)}return n.object=r,n;function a(o){let l=[];for(let c in o){let d=o[c];delete d.metadata,l.push(d)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let r=e.children[n];this.add(r.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};mt.DEFAULT_UP=new N(0,1,0);mt.DEFAULT_MATRIX_AUTO_UPDATE=!0;mt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Ht=class extends mt{constructor(){super(),this.isGroup=!0,this.type="Group"}},Qf={type:"move"},rr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Ht,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Ht,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new N,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new N),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Ht,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new N,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new N,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,s=null,a=null,o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(let x of e.hand.values()){let m=t.getJointPose(x,n),p=this._getHandJoint(c,x);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}let d=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],h=d.position.distanceTo(f.position),u=.02,g=.005;c.inputState.pinching&&h>u+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&h<=u-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(s=t.getPose(e.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&s!==null&&(r=s),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Qf)))}return o!==null&&(o.visible=r!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Ht;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},gh={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},ni={h:0,s:0,l:0},As={h:0,s:0,l:0};function zo(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}var Ce=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let r=e;r&&r.isColor?this.copy(r):typeof r=="number"?this.setHex(r):typeof r=="string"&&this.setStyle(r)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=ht){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Be.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=Be.workingColorSpace){return this.r=e,this.g=t,this.b=n,Be.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=Be.workingColorSpace){if(e=kc(e,1),t=Ge(t,0,1),n=Ge(n,0,1),t===0)this.r=this.g=this.b=n;else{let s=n<=.5?n*(1+t):n+t-n*t,a=2*n-s;this.r=zo(a,s,e+1/3),this.g=zo(a,s,e),this.b=zo(a,s,e-1/3)}return Be.colorSpaceToWorking(this,r),this}setStyle(e,t=ht){function n(s){s!==void 0&&parseFloat(s)<1&&Me("Color: Alpha component of "+e+" will be ignored.")}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let s,a=r[1],o=r[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,t);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,t);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,t);break;default:Me("Color: Unknown color model "+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let s=r[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(s,16),t);Me("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=ht){let n=gh[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Me("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Hn(e.r),this.g=Hn(e.g),this.b=Hn(e.b),this}copyLinearToSRGB(e){return this.r=$i(e.r),this.g=$i(e.g),this.b=$i(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=ht){return Be.workingToColorSpace(Ut.copy(this),e),Math.round(Ge(Ut.r*255,0,255))*65536+Math.round(Ge(Ut.g*255,0,255))*256+Math.round(Ge(Ut.b*255,0,255))}getHexString(e=ht){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Be.workingColorSpace){Be.workingToColorSpace(Ut.copy(this),t);let n=Ut.r,r=Ut.g,s=Ut.b,a=Math.max(n,r,s),o=Math.min(n,r,s),l,c,d=(o+a)/2;if(o===a)l=0,c=0;else{let f=a-o;switch(c=d<=.5?f/(a+o):f/(2-a-o),a){case n:l=(r-s)/f+(r<s?6:0);break;case r:l=(s-n)/f+2;break;case s:l=(n-r)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=d,e}getRGB(e,t=Be.workingColorSpace){return Be.workingToColorSpace(Ut.copy(this),t),e.r=Ut.r,e.g=Ut.g,e.b=Ut.b,e}getStyle(e=ht){Be.workingToColorSpace(Ut.copy(this),e);let t=Ut.r,n=Ut.g,r=Ut.b;return e!==ht?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`}offsetHSL(e,t,n){return this.getHSL(ni),this.setHSL(ni.h+e,ni.s+t,ni.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(ni),e.getHSL(As);let n=Ur(ni.h,As.h,t),r=Ur(ni.s,As.s,t),s=Ur(ni.l,As.l,t);return this.setHSL(n,r,s),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,s=e.elements;return this.r=s[0]*t+s[3]*n+s[6]*r,this.g=s[1]*t+s[4]*n+s[7]*r,this.b=s[2]*t+s[5]*n+s[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ut=new Ce;Ce.NAMES=gh;var Ti=class extends mt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Vn,this.environmentIntensity=1,this.environmentRotation=new Vn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},un=new N,Un=new N,ko=new N,On=new N,Hi=new N,Vi=new N,od=new N,Ho=new N,Vo=new N,Go=new N,Wo=new tt,Xo=new tt,Yo=new tt,oi=class i{constructor(e=new N,t=new N,n=new N){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),un.subVectors(e,t),r.cross(un);let s=r.lengthSq();return s>0?r.multiplyScalar(1/Math.sqrt(s)):r.set(0,0,0)}static getBarycoord(e,t,n,r,s){un.subVectors(r,t),Un.subVectors(n,t),ko.subVectors(e,t);let a=un.dot(un),o=un.dot(Un),l=un.dot(ko),c=Un.dot(Un),d=Un.dot(ko),f=a*c-o*o;if(f===0)return s.set(0,0,0),null;let h=1/f,u=(c*l-o*d)*h,g=(a*d-o*l)*h;return s.set(1-u-g,g,u)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,On)===null?!1:On.x>=0&&On.y>=0&&On.x+On.y<=1}static getInterpolation(e,t,n,r,s,a,o,l){return this.getBarycoord(e,t,n,r,On)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,On.x),l.addScaledVector(a,On.y),l.addScaledVector(o,On.z),l)}static getInterpolatedAttribute(e,t,n,r,s,a){return Wo.setScalar(0),Xo.setScalar(0),Yo.setScalar(0),Wo.fromBufferAttribute(e,t),Xo.fromBufferAttribute(e,n),Yo.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(Wo,s.x),a.addScaledVector(Xo,s.y),a.addScaledVector(Yo,s.z),a}static isFrontFacing(e,t,n,r){return un.subVectors(n,t),Un.subVectors(e,t),un.cross(Un).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return un.subVectors(this.c,this.b),Un.subVectors(this.a,this.b),un.cross(Un).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return i.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return i.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,r,s){return i.getInterpolation(e,this.a,this.b,this.c,t,n,r,s)}containsPoint(e){return i.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return i.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,s=this.c,a,o;Hi.subVectors(r,n),Vi.subVectors(s,n),Ho.subVectors(e,n);let l=Hi.dot(Ho),c=Vi.dot(Ho);if(l<=0&&c<=0)return t.copy(n);Vo.subVectors(e,r);let d=Hi.dot(Vo),f=Vi.dot(Vo);if(d>=0&&f<=d)return t.copy(r);let h=l*f-d*c;if(h<=0&&l>=0&&d<=0)return a=l/(l-d),t.copy(n).addScaledVector(Hi,a);Go.subVectors(e,s);let u=Hi.dot(Go),g=Vi.dot(Go);if(g>=0&&u<=g)return t.copy(s);let x=u*c-l*g;if(x<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(Vi,o);let m=d*g-u*f;if(m<=0&&f-d>=0&&u-g>=0)return od.subVectors(s,r),o=(f-d)/(f-d+(u-g)),t.copy(r).addScaledVector(od,o);let p=1/(m+x+h);return a=x*p,o=h*p,t.copy(n).addScaledVector(Hi,a).addScaledVector(Vi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Wt=class{constructor(e=new N(1/0,1/0,1/0),t=new N(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(pn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(pn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=pn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let s=n.getAttribute("position");if(t===!0&&s!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,pn):pn.fromBufferAttribute(s,a),pn.applyMatrix4(e.matrixWorld),this.expandByPoint(pn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Es.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Es.copy(n.boundingBox)),Es.applyMatrix4(e.matrixWorld),this.union(Es)}let r=e.children;for(let s=0,a=r.length;s<a;s++)this.expandByObject(r[s],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,pn),pn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Rr),Rs.subVectors(this.max,Rr),Gi.subVectors(e.a,Rr),Wi.subVectors(e.b,Rr),Xi.subVectors(e.c,Rr),ii.subVectors(Wi,Gi),ri.subVectors(Xi,Wi),vi.subVectors(Gi,Xi);let t=[0,-ii.z,ii.y,0,-ri.z,ri.y,0,-vi.z,vi.y,ii.z,0,-ii.x,ri.z,0,-ri.x,vi.z,0,-vi.x,-ii.y,ii.x,0,-ri.y,ri.x,0,-vi.y,vi.x,0];return!qo(t,Gi,Wi,Xi,Rs)||(t=[1,0,0,0,1,0,0,0,1],!qo(t,Gi,Wi,Xi,Rs))?!1:(Cs.crossVectors(ii,ri),t=[Cs.x,Cs.y,Cs.z],qo(t,Gi,Wi,Xi,Rs))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,pn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(pn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Bn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Bn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Bn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Bn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Bn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Bn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Bn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Bn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Bn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},Bn=[new N,new N,new N,new N,new N,new N,new N,new N],pn=new N,Es=new Wt,Gi=new N,Wi=new N,Xi=new N,ii=new N,ri=new N,vi=new N,Rr=new N,Rs=new N,Cs=new N,_i=new N;function qo(i,e,t,n,r){for(let s=0,a=i.length-3;s<=a;s+=3){_i.fromArray(i,s);let o=r.x*Math.abs(_i.x)+r.y*Math.abs(_i.y)+r.z*Math.abs(_i.z),l=e.dot(_i),c=t.dot(_i),d=n.dot(_i);if(Math.max(-Math.max(l,c,d),Math.min(l,c,d))>o)return!1}return!0}var yt=new N,Is=new De,eu=0,pt=class extends Rn{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:eu++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Bc,this.updateRanges=[],this.gpuType=qt,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,s=this.itemSize;r<s;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Is.fromBufferAttribute(this,t),Is.applyMatrix3(e),this.setXY(t,Is.x,Is.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)yt.fromBufferAttribute(this,t),yt.applyMatrix3(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)yt.fromBufferAttribute(this,t),yt.applyMatrix4(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)yt.fromBufferAttribute(this,t),yt.applyNormalMatrix(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)yt.fromBufferAttribute(this,t),yt.transformDirection(e),this.setXYZ(t,yt.x,yt.y,yt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=gn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=et(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=gn(t,this.array)),t}setX(e,t){return this.normalized&&(t=et(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=gn(t,this.array)),t}setY(e,t){return this.normalized&&(t=et(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=gn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=et(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=gn(t,this.array)),t}setW(e,t){return this.normalized&&(t=et(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=et(t,this.array),n=et(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=et(t,this.array),n=et(n,this.array),r=et(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,s){return e*=this.itemSize,this.normalized&&(t=et(t,this.array),n=et(n,this.array),r=et(r,this.array),s=et(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=s,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}};var Hr=class extends pt{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Vr=class extends pt{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var It=class extends pt{constructor(e,t,n){super(new Float32Array(e),t,n)}},tu=new Wt,Cr=new N,Zo=new N,Kt=class{constructor(e=new N,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):tu.setFromPoints(e).getCenter(n);let r=0;for(let s=0,a=e.length;s<a;s++)r=Math.max(r,n.distanceToSquared(e[s]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Cr.subVectors(e,this.center);let t=Cr.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),r=(n-this.radius)*.5;this.center.addScaledVector(Cr,r/n),this.radius+=r}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Zo.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Cr.copy(e.center).add(Zo)),this.expandByPoint(Cr.copy(e.center).sub(Zo))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},nu=0,on=new Fe,Ko=new mt,Yi=new N,nn=new Wt,Ir=new Wt,Rt=new N,wt=class i extends Rn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:nu++}),this.uuid=_n(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Af(e)?Vr:Hr)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let s=new Pe().getNormalMatrix(e);n.applyNormalMatrix(s),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return on.makeRotationFromQuaternion(e),this.applyMatrix4(on),this}rotateX(e){return on.makeRotationX(e),this.applyMatrix4(on),this}rotateY(e){return on.makeRotationY(e),this.applyMatrix4(on),this}rotateZ(e){return on.makeRotationZ(e),this.applyMatrix4(on),this}translate(e,t,n){return on.makeTranslation(e,t,n),this.applyMatrix4(on),this}scale(e,t,n){return on.makeScale(e,t,n),this.applyMatrix4(on),this}lookAt(e){return Ko.lookAt(e),Ko.updateMatrix(),this.applyMatrix4(Ko.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Yi).negate(),this.translate(Yi.x,Yi.y,Yi.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let r=0,s=e.length;r<s;r++){let a=e[r];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new It(n,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let s=e[r];t.setXYZ(r,s.x,s.y,s.z||0)}e.length>t.count&&Me("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Wt);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ie("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new N(-1/0,-1/0,-1/0),new N(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,r=t.length;n<r;n++){let s=t[n];nn.setFromBufferAttribute(s),this.morphTargetsRelative?(Rt.addVectors(this.boundingBox.min,nn.min),this.boundingBox.expandByPoint(Rt),Rt.addVectors(this.boundingBox.max,nn.max),this.boundingBox.expandByPoint(Rt)):(this.boundingBox.expandByPoint(nn.min),this.boundingBox.expandByPoint(nn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ie('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Kt);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ie("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new N,1/0);return}if(e){let n=this.boundingSphere.center;if(nn.setFromBufferAttribute(e),t)for(let s=0,a=t.length;s<a;s++){let o=t[s];Ir.setFromBufferAttribute(o),this.morphTargetsRelative?(Rt.addVectors(nn.min,Ir.min),nn.expandByPoint(Rt),Rt.addVectors(nn.max,Ir.max),nn.expandByPoint(Rt)):(nn.expandByPoint(Ir.min),nn.expandByPoint(Ir.max))}nn.getCenter(n);let r=0;for(let s=0,a=e.count;s<a;s++)Rt.fromBufferAttribute(e,s),r=Math.max(r,n.distanceToSquared(Rt));if(t)for(let s=0,a=t.length;s<a;s++){let o=t[s],l=this.morphTargetsRelative;for(let c=0,d=o.count;c<d;c++)Rt.fromBufferAttribute(o,c),l&&(Yi.fromBufferAttribute(e,c),Rt.add(Yi)),r=Math.max(r,n.distanceToSquared(Rt))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&Ie('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ie("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,r=t.normal,s=t.uv,a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new pt(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));let o=[],l=[];for(let _=0;_<n.count;_++)o[_]=new N,l[_]=new N;let c=new N,d=new N,f=new N,h=new De,u=new De,g=new De,x=new N,m=new N;function p(_,A,L){c.fromBufferAttribute(n,_),d.fromBufferAttribute(n,A),f.fromBufferAttribute(n,L),h.fromBufferAttribute(s,_),u.fromBufferAttribute(s,A),g.fromBufferAttribute(s,L),d.sub(c),f.sub(c),u.sub(h),g.sub(h);let D=1/(u.x*g.y-g.x*u.y);isFinite(D)&&(x.copy(d).multiplyScalar(g.y).addScaledVector(f,-u.y).multiplyScalar(D),m.copy(f).multiplyScalar(u.x).addScaledVector(d,-g.x).multiplyScalar(D),o[_].add(x),o[A].add(x),o[L].add(x),l[_].add(m),l[A].add(m),l[L].add(m))}let T=this.groups;T.length===0&&(T=[{start:0,count:e.count}]);for(let _=0,A=T.length;_<A;++_){let L=T[_],D=L.start,k=L.count;for(let G=D,F=D+k;G<F;G+=3)p(e.getX(G+0),e.getX(G+1),e.getX(G+2))}let R=new N,y=new N,M=new N,S=new N;function E(_){M.fromBufferAttribute(r,_),S.copy(M);let A=o[_];R.copy(A),R.sub(M.multiplyScalar(M.dot(A))).normalize(),y.crossVectors(S,A);let D=y.dot(l[_])<0?-1:1;a.setXYZW(_,R.x,R.y,R.z,D)}for(let _=0,A=T.length;_<A;++_){let L=T[_],D=L.start,k=L.count;for(let G=D,F=D+k;G<F;G+=3)E(e.getX(G+0)),E(e.getX(G+1)),E(e.getX(G+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new pt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let h=0,u=n.count;h<u;h++)n.setXYZ(h,0,0,0);let r=new N,s=new N,a=new N,o=new N,l=new N,c=new N,d=new N,f=new N;if(e)for(let h=0,u=e.count;h<u;h+=3){let g=e.getX(h+0),x=e.getX(h+1),m=e.getX(h+2);r.fromBufferAttribute(t,g),s.fromBufferAttribute(t,x),a.fromBufferAttribute(t,m),d.subVectors(a,s),f.subVectors(r,s),d.cross(f),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,m),o.add(d),l.add(d),c.add(d),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let h=0,u=t.count;h<u;h+=3)r.fromBufferAttribute(t,h+0),s.fromBufferAttribute(t,h+1),a.fromBufferAttribute(t,h+2),d.subVectors(a,s),f.subVectors(r,s),d.cross(f),n.setXYZ(h+0,d.x,d.y,d.z),n.setXYZ(h+1,d.x,d.y,d.z),n.setXYZ(h+2,d.x,d.y,d.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Rt.fromBufferAttribute(e,t),Rt.normalize(),e.setXYZ(t,Rt.x,Rt.y,Rt.z)}toNonIndexed(){function e(o,l){let c=o.array,d=o.itemSize,f=o.normalized,h=new c.constructor(l.length*d),u=0,g=0;for(let x=0,m=l.length;x<m;x++){o.isInterleavedBufferAttribute?u=l[x]*o.data.stride+o.offset:u=l[x]*d;for(let p=0;p<d;p++)h[g++]=c[u++]}return new pt(h,d,f)}if(this.index===null)return Me("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new i,n=this.index.array,r=this.attributes;for(let o in r){let l=r[o],c=e(l,n);t.setAttribute(o,c)}let s=this.morphAttributes;for(let o in s){let l=[],c=s[o];for(let d=0,f=c.length;d<f;d++){let h=c[d],u=e(h,n);l.push(u)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;let a=this.groups;for(let o=0,l=a.length;o<l;o++){let c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let r={},s=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],d=[];for(let f=0,h=c.length;f<h;f++){let u=c[f];d.push(u.toJSON(e.data))}d.length>0&&(r[l]=d,s=!0)}s&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let c in r){let d=r[c];this.setAttribute(c,d.clone(t))}let s=e.morphAttributes;for(let c in s){let d=[],f=s[c];for(let h=0,u=f.length;h<u;h++)d.push(f[h].clone(t));this.morphAttributes[c]=d}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let c=0,d=a.length;c<d;c++){let f=a[c];this.addGroup(f.start,f.count,f.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},sr=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=Bc,this.updateRanges=[],this.version=0,this.uuid=_n()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let r=0,s=this.stride;r<s;r++)this.array[e+r]=t.array[n+r];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=_n()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=_n()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer)));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}},kt=new N,Gn=class i{constructor(e,t,n,r=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=r}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)kt.fromBufferAttribute(this,t),kt.applyMatrix4(e),this.setXYZ(t,kt.x,kt.y,kt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)kt.fromBufferAttribute(this,t),kt.applyNormalMatrix(e),this.setXYZ(t,kt.x,kt.y,kt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)kt.fromBufferAttribute(this,t),kt.transformDirection(e),this.setXYZ(t,kt.x,kt.y,kt.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=gn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=et(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=et(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=et(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=et(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=et(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=gn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=gn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=gn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=gn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=et(t,this.array),n=et(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=et(t,this.array),n=et(n,this.array),r=et(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this}setXYZW(e,t,n,r,s){return e=e*this.data.stride+this.offset,this.normalized&&(t=et(t,this.array),n=et(n,this.array),r=et(r,this.array),s=et(s,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=r,this.data.array[e+3]=s,this}clone(e){if(e===void 0){Br("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let r=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return new pt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new i(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Br("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let r=n*this.data.stride+this.offset;for(let s=0;s<this.itemSize;s++)t.push(this.data.array[r+s])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},Jo=new N,iu=new N,ru=new Pe,mn=class{constructor(e=new N(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=Jo.subVectors(n,t).cross(iu.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(Jo),s=this.normal.dot(r);if(s===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/s;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||ru.getNormalMatrix(e),r=this.coplanarPoint(Jo).applyMatrix4(e),s=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(s),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},su=0,Jt=class extends Rn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:su++}),this.uuid=_n(),this.name="",this.type="Material",this.blending=gr,this.side=Pn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=xc,this.blendDst=yc,this.blendEquation=Ci,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ce(0,0,0),this.blendAlpha=0,this.depthFunc=ji,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=sh,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Js,this.stencilZFail=Js,this.stencilZPass=Js,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){Me(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){Me(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector2&&n&&n.isVector2||r&&r.isEuler&&n&&n.isEuler||r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(s=>s.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(s){let a=[];for(let o in s){let l=s[o];delete l.metadata,a.push(l)}return a}if(t){let s=r(e.textures),a=r(e.images);s.length>0&&(n.textures=s),a.length>0&&(n.images=a)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Ce().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new mn().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new De().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new De().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let r=t.length;n=new Array(r);for(let s=0;s!==r;++s)n[s]=t[s].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}};var zn=new N,$o=new N,Ps=new N,Ls=new N,Ai=class{constructor(e=new N,t=new N(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,zn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=zn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(zn.copy(this.origin).addScaledVector(this.direction,t),zn.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){$o.copy(e).add(t).multiplyScalar(.5),Ps.copy(t).sub(e).normalize(),Ls.copy(this.origin).sub($o);let s=e.distanceTo(t)*.5,a=-this.direction.dot(Ps),o=Ls.dot(this.direction),l=-Ls.dot(Ps),c=Ls.lengthSq(),d=Math.abs(1-a*a),f,h,u,g;if(d>0)if(f=a*l-o,h=a*o-l,g=s*d,f>=0)if(h>=-g)if(h<=g){let x=1/d;f*=x,h*=x,u=f*(f+a*h+2*o)+h*(a*f+h+2*l)+c}else h=s,f=Math.max(0,-(a*h+o)),u=-f*f+h*(h+2*l)+c;else h=-s,f=Math.max(0,-(a*h+o)),u=-f*f+h*(h+2*l)+c;else h<=-g?(f=Math.max(0,-(-a*s+o)),h=f>0?-s:Math.min(Math.max(-s,-l),s),u=-f*f+h*(h+2*l)+c):h<=g?(f=0,h=Math.min(Math.max(-s,-l),s),u=h*(h+2*l)+c):(f=Math.max(0,-(a*s+o)),h=f>0?s:Math.min(Math.max(-s,-l),s),u=-f*f+h*(h+2*l)+c);else h=a>0?-s:s,f=Math.max(0,-(a*h+o)),u=-f*f+h*(h+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,f),r&&r.copy($o).addScaledVector(Ps,h),u}intersectSphere(e,t){if(e.radius<0)return null;zn.subVectors(e.center,this.origin);let n=zn.dot(this.direction),r=zn.dot(zn)-n*n,s=e.radius*e.radius;if(r>s)return null;let a=Math.sqrt(s-r),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,s,a,o,l,c=1/this.direction.x,d=1/this.direction.y,f=1/this.direction.z,h=this.origin;return c>=0?(n=(e.min.x-h.x)*c,r=(e.max.x-h.x)*c):(n=(e.max.x-h.x)*c,r=(e.min.x-h.x)*c),d>=0?(s=(e.min.y-h.y)*d,a=(e.max.y-h.y)*d):(s=(e.max.y-h.y)*d,a=(e.min.y-h.y)*d),n>a||s>r||((s>n||isNaN(n))&&(n=s),(a<r||isNaN(r))&&(r=a),f>=0?(o=(e.min.z-h.z)*f,l=(e.max.z-h.z)*f):(o=(e.max.z-h.z)*f,l=(e.min.z-h.z)*f),n>l||o>r)||((o>n||n!==n)&&(n=o),(l<r||r!==r)&&(r=l),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,zn)!==null}intersectTriangle(e,t,n,r,s){let a=this.origin,o=this.direction,l=o.x,c=o.y,d=o.z,f=e.x-a.x,h=e.y-a.y,u=e.z-a.z,g=t.x-a.x,x=t.y-a.y,m=t.z-a.z,p=n.x-a.x,T=n.y-a.y,R=n.z-a.z,y=Math.abs(l),M=Math.abs(c),S=Math.abs(d),E,_,A,L,D,k,G,F,H,K,Z,ne;if(y>=M&&y>=S?(A=l,k=f,H=g,ne=p,l>=0?(E=c,_=d,L=h,D=u,G=x,F=m,K=T,Z=R):(E=d,_=c,L=u,D=h,G=m,F=x,K=R,Z=T)):M>=S?(A=c,k=h,H=x,ne=T,c>=0?(E=d,_=l,L=u,D=f,G=m,F=g,K=R,Z=p):(E=l,_=d,L=f,D=u,G=g,F=m,K=p,Z=R)):(A=d,k=u,H=m,ne=R,d>=0?(E=l,_=c,L=f,D=h,G=g,F=x,K=p,Z=T):(E=c,_=l,L=h,D=f,G=x,F=g,K=T,Z=p)),A===0)return null;let X=E/A,Q=_/A,te=1/A,Ee=L-X*k,Te=D-Q*k,at=G-X*H,Xe=F-Q*H,Ze=K-X*ne,Y=Z-Q*ne,j=Ze*Xe-Y*at,ve=Ee*Y-Te*Ze,Le=at*Te-Xe*Ee;if(r){if(j<0||ve<0||Le<0)return null}else if((j<0||ve<0||Le<0)&&(j>0||ve>0||Le>0))return null;let me=j+ve+Le;if(me===0)return null;let ze=te*(j*k+ve*H+Le*ne);return(me>0?ze<0:ze>0)?null:this.at(ze/me,s)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Lt=class extends Jt{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ce(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Vn,this.combine=Mc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},cd=new Fe,bi=new Ai,Fs=new Kt,ld=new N,Ns=new N,Ds=new N,Us=new N,jo=new N,Os=new N,dd=new N,Bs=new N,Ke=class extends mt{constructor(e=new wt,t=new Lt){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){let o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,s=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(s&&o){Os.set(0,0,0);for(let l=0,c=s.length;l<c;l++){let d=o[l],f=s[l];d!==0&&(jo.fromBufferAttribute(f,e),a?Os.addScaledVector(jo,d):Os.addScaledVector(jo.sub(t),d))}t.add(Os)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.material,s=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Fs.copy(n.boundingSphere),Fs.applyMatrix4(s),bi.copy(e.ray).recast(e.near),!(Fs.containsPoint(bi.origin)===!1&&(bi.intersectSphere(Fs,ld)===null||bi.origin.distanceToSquared(ld)>(e.far-e.near)**2))&&(cd.copy(s).invert(),bi.copy(e.ray).applyMatrix4(cd),!(n.boundingBox!==null&&bi.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,bi)))}_computeIntersections(e,t,n){let r,s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,d=s.attributes.uv1,f=s.attributes.normal,h=s.groups,u=s.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,x=h.length;g<x;g++){let m=h[g],p=a[m.materialIndex],T=Math.max(m.start,u.start),R=Math.min(o.count,Math.min(m.start+m.count,u.start+u.count));for(let y=T,M=R;y<M;y+=3){let S=o.getX(y),E=o.getX(y+1),_=o.getX(y+2);r=zs(this,p,e,n,c,d,f,S,E,_),r&&(r.faceIndex=Math.floor(y/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{let g=Math.max(0,u.start),x=Math.min(o.count,u.start+u.count);for(let m=g,p=x;m<p;m+=3){let T=o.getX(m),R=o.getX(m+1),y=o.getX(m+2);r=zs(this,a,e,n,c,d,f,T,R,y),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,x=h.length;g<x;g++){let m=h[g],p=a[m.materialIndex],T=Math.max(m.start,u.start),R=Math.min(l.count,Math.min(m.start+m.count,u.start+u.count));for(let y=T,M=R;y<M;y+=3){let S=y,E=y+1,_=y+2;r=zs(this,p,e,n,c,d,f,S,E,_),r&&(r.faceIndex=Math.floor(y/3),r.face.materialIndex=m.materialIndex,t.push(r))}}else{let g=Math.max(0,u.start),x=Math.min(l.count,u.start+u.count);for(let m=g,p=x;m<p;m+=3){let T=m,R=m+1,y=m+2;r=zs(this,a,e,n,c,d,f,T,R,y),r&&(r.faceIndex=Math.floor(m/3),t.push(r))}}}};function au(i,e,t,n,r,s,a,o){let l;if(e.side===Yt?l=n.intersectTriangle(a,s,r,!0,o):l=n.intersectTriangle(r,s,a,e.side===Pn,o),l===null)return null;Bs.copy(o),Bs.applyMatrix4(i.matrixWorld);let c=t.ray.origin.distanceTo(Bs);return c<t.near||c>t.far?null:{distance:c,point:Bs.clone(),object:i}}function zs(i,e,t,n,r,s,a,o,l,c){i.getVertexPosition(o,Ns),i.getVertexPosition(l,Ds),i.getVertexPosition(c,Us);let d=au(i,e,t,n,Ns,Ds,Us,dd);if(d){let f=new N;oi.getBarycoord(dd,Ns,Ds,Us,f),r&&(d.uv=oi.getInterpolatedAttribute(r,o,l,c,f,new De)),s&&(d.uv1=oi.getInterpolatedAttribute(s,o,l,c,f,new De)),a&&(d.normal=oi.getInterpolatedAttribute(a,o,l,c,f,new N),d.normal.dot(n.direction)>0&&d.normal.multiplyScalar(-1));let h={a:o,b:l,c,normal:new N,materialIndex:0};oi.getNormal(Ns,Ds,Us,h.normal),d.face=h,d.barycoord=f}return d}var Pr=new tt,hd=new tt,fd=new tt,ou=new tt,ud=new Fe,ks=new N,Qo=new Kt,pd=new Fe,ec=new Ai,Gr=class extends Ke{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=rc,this.bindMatrix=new Fe,this.bindMatrixInverse=new Fe,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new Wt),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ks),this.boundingBox.expandByPoint(ks)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new Kt),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,ks),this.boundingSphere.expandByPoint(ks)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let n=this.material,r=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Qo.copy(this.boundingSphere),Qo.applyMatrix4(r),e.ray.intersectsSphere(Qo)!==!1&&(pd.copy(r).invert(),ec.copy(e.ray).applyMatrix4(pd),!(this.boundingBox!==null&&ec.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,ec)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new tt,t=this.geometry.attributes.skinWeight;for(let n=0,r=t.count;n<r;n++){e.fromBufferAttribute(t,n);let s=1/e.manhattanLength();s!==1/0?e.multiplyScalar(s):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===rc?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===th?this.bindMatrixInverse.copy(this.bindMatrix).invert():Me("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,r=this.geometry;hd.fromBufferAttribute(r.attributes.skinIndex,e),fd.fromBufferAttribute(r.attributes.skinWeight,e),t.isVector4?(Pr.copy(t),t.set(0,0,0,0)):(Pr.set(...t,1),t.set(0,0,0)),Pr.applyMatrix4(this.bindMatrix);for(let s=0;s<4;s++){let a=fd.getComponent(s);if(a!==0){let o=hd.getComponent(s);ud.multiplyMatrices(n.bones[o].matrixWorld,n.boneInverses[o]),t.addScaledVector(ou.copy(Pr).applyMatrix4(ud),a)}}return t.isVector4&&(t.w=Pr.w),t.applyMatrix4(this.bindMatrixInverse)}},ar=class extends mt{constructor(){super(),this.isBone=!0,this.type="Bone"}},or=class extends Mt{constructor(e=null,t=1,n=1,r,s,a,o,l,c=st,d=st,f,h){super(null,a,o,l,c,d,r,s,f,h),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},md=new Fe,cu=new Fe,Wr=class i{constructor(e=[],t=[]){this.uuid=_n(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){Me("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,r=this.bones.length;n<r;n++)this.boneInverses.push(new Fe)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let n=new Fe;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,r=this.boneTexture;for(let s=0,a=e.length;s<a;s++){let o=e[s]?e[s].matrixWorld:cu;md.multiplyMatrices(o,t[s]),md.toArray(n,s*16)}r!==null&&(r.needsUpdate=!0)}clone(){return new i(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new or(t,e,e,sn,qt);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let r=this.bones[t];if(r.name===e)return r}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,r=e.bones.length;n<r;n++){let s=e.bones[n],a=t[s];a===void 0&&(Me("Skeleton: No bone found with UUID:",s),a=new ar),this.bones.push(a),this.boneInverses.push(new Fe().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let r=0,s=t.length;r<s;r++){let a=t[r];e.bones.push(a.uuid);let o=n[r];e.boneInverses.push(o.toArray())}return e}},bn=class extends pt{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},qi=new Fe,gd=new Fe,Hs=[],vd=new Wt,lu=new Fe,Lr=new Ke,Fr=new Kt,Xr=class extends Ke{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new bn(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let r=0;r<n;r++)this.setMatrixAt(r,lu)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Wt),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,qi),vd.copy(e.boundingBox).applyMatrix4(qi),this.boundingBox.union(vd)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Kt),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,qi),Fr.copy(e.boundingSphere).applyMatrix4(qi),this.boundingSphere.union(Fr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,s=n.length+1,a=e*s+1;for(let o=0;o<n.length;o++)n[o]=r[a+o]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(Lr.geometry=this.geometry,Lr.material=this.material,Lr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Fr.copy(this.boundingSphere),Fr.applyMatrix4(n),e.ray.intersectsSphere(Fr)!==!1))for(let s=0;s<r;s++){this.getMatrixAt(s,qi),gd.multiplyMatrices(n,qi),Lr.matrixWorld=gd,Lr.raycast(e,Hs);for(let a=0,o=Hs.length;a<o;a++){let l=Hs[a];l.instanceId=s,l.object=this,t.push(l)}Hs.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new bn(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new or(new Float32Array(r*this.count),r,this.count,Ca,qt));let s=this.morphTexture.source.data.data,a=0;for(let c=0;c<n.length;c++)a+=n[c];let o=this.geometry.morphTargetsRelative?1:1-a,l=r*e;return s[l]=o,s.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},xi=new Kt,du=new De(.5,.5),Vs=new N,cr=class{constructor(e=new mn,t=new mn,n=new mn,r=new mn,s=new mn,a=new mn){this.planes=[e,t,n,r,s,a]}set(e,t,n,r,s,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(s),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=vn,n=!1){let r=this.planes,s=e.elements,a=s[0],o=s[1],l=s[2],c=s[3],d=s[4],f=s[5],h=s[6],u=s[7],g=s[8],x=s[9],m=s[10],p=s[11],T=s[12],R=s[13],y=s[14],M=s[15];if(r[0].setComponents(c-a,u-d,p-g,M-T).normalize(),r[1].setComponents(c+a,u+d,p+g,M+T).normalize(),r[2].setComponents(c+o,u+f,p+x,M+R).normalize(),r[3].setComponents(c-o,u-f,p-x,M-R).normalize(),n)r[4].setComponents(l,h,m,y).normalize(),r[5].setComponents(c-l,u-h,p-m,M-y).normalize();else if(r[4].setComponents(c-l,u-h,p-m,M-y).normalize(),t===vn)r[5].setComponents(c+l,u+h,p+m,M+y).normalize();else if(t===er)r[5].setComponents(l,h,m,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),xi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),xi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(xi)}intersectsSprite(e){xi.center.set(0,0,0);let t=du.distanceTo(e.center);return xi.radius=.7071067811865476+t,xi.applyMatrix4(e.matrixWorld),this.intersectsSphere(xi)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let s=0;s<6;s++)if(t[s].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(Vs.x=r.normal.x>0?e.max.x:e.min.x,Vs.y=r.normal.y>0?e.max.y:e.min.y,Vs.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Vs)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var lr=class extends Jt{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ce(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},ca=new N,la=new N,_d=new Fe,Nr=new Ai,Gs=new Kt,tc=new N,bd=new N,Ei=class extends mt{constructor(e=new wt,t=new lr){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let r=1,s=t.count;r<s;r++)ca.fromBufferAttribute(t,r-1),la.fromBufferAttribute(t,r),n[r]=n[r-1],n[r]+=ca.distanceTo(la);e.setAttribute("lineDistance",new It(n,1))}else Me("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,s=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Gs.copy(n.boundingSphere),Gs.applyMatrix4(r),Gs.radius+=s,e.ray.intersectsSphere(Gs)===!1)return;_d.copy(r).invert(),Nr.copy(e.ray).applyMatrix4(_d);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,d=n.index,h=n.attributes.position;if(d!==null){let u=Math.max(0,a.start),g=Math.min(d.count,a.start+a.count);for(let x=u,m=g-1;x<m;x+=c){let p=d.getX(x),T=d.getX(x+1),R=Ws(this,e,Nr,l,p,T,x);R&&t.push(R)}if(this.isLineLoop){let x=d.getX(g-1),m=d.getX(u),p=Ws(this,e,Nr,l,x,m,g-1);p&&t.push(p)}}else{let u=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let x=u,m=g-1;x<m;x+=c){let p=Ws(this,e,Nr,l,x,x+1,x);p&&t.push(p)}if(this.isLineLoop){let x=Ws(this,e,Nr,l,g-1,u,g-1);x&&t.push(x)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){let o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}};function Ws(i,e,t,n,r,s,a){let o=i.geometry.attributes.position;if(ca.fromBufferAttribute(o,r),la.fromBufferAttribute(o,s),t.distanceSqToSegment(ca,la,tc,bd)>n)return;tc.applyMatrix4(i.matrixWorld);let c=e.ray.origin.distanceTo(tc);if(!(c<e.near||c>e.far))return{distance:c,point:bd.clone().applyMatrix4(i.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:i}}var xd=new N,yd=new N,Yr=class extends Ei{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let r=0,s=t.count;r<s;r+=2)xd.fromBufferAttribute(t,r),yd.fromBufferAttribute(t,r+1),n[r]=r===0?0:n[r-1],n[r+1]=n[r]+xd.distanceTo(yd);e.setAttribute("lineDistance",new It(n,1))}else Me("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},qr=class extends Ei{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},dr=class extends Jt{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ce(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Md=new Fe,lc=new Ai,Xs=new Kt,Ys=new N,Zr=class extends mt{constructor(e=new wt,t=new dr){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,r=this.matrixWorld,s=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Xs.copy(n.boundingSphere),Xs.applyMatrix4(r),Xs.radius+=s,e.ray.intersectsSphere(Xs)===!1)return;Md.copy(r).invert(),lc.copy(e.ray).applyMatrix4(Md);let o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,f=n.attributes.position;if(c!==null){let h=Math.max(0,a.start),u=Math.min(c.count,a.start+a.count);for(let g=h,x=u;g<x;g++){let m=c.getX(g);Ys.fromBufferAttribute(f,m),Sd(Ys,m,l,r,e,t,this)}}else{let h=Math.max(0,a.start),u=Math.min(f.count,a.start+a.count);for(let g=h,x=u;g<x;g++)Ys.fromBufferAttribute(f,g),Sd(Ys,g,l,r,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let r=t[n[0]];if(r!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=r.length;s<a;s++){let o=r[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}};function Sd(i,e,t,n,r,s,a){let o=lc.distanceSqToPoint(i);if(o<t){let l=new N;lc.closestPointToPoint(i,l),l.applyMatrix4(n);let c=r.ray.origin.distanceTo(l);if(c<r.near||c>r.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}var Kr=class extends Mt{constructor(e=[],t=fi,n,r,s,a,o,l,c,d){super(e,t,n,r,s,a,o,l,c,d),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}};var li=class extends Mt{constructor(e,t,n=yn,r,s,a,o=st,l=st,c,d=En,f=1){if(d!==En&&d!==ui)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let h={width:e,height:t,depth:f};super(h,r,s,a,o,l,d,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new ir(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},da=class extends li{constructor(e,t=yn,n=fi,r,s,a=st,o=st,l,c=En){let d={width:e,height:e,depth:1},f=[d,d,d,d,d,d];super(e,e,t,n,r,s,a,o,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},Jr=class extends Mt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},hr=class i extends wt{constructor(e=1,t=1,n=1,r=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:s,depthSegments:a};let o=this;r=Math.floor(r),s=Math.floor(s),a=Math.floor(a);let l=[],c=[],d=[],f=[],h=0,u=0;g("z","y","x",-1,-1,n,t,e,a,s,0),g("z","y","x",1,-1,n,t,-e,a,s,1),g("x","z","y",1,1,e,n,t,r,a,2),g("x","z","y",1,-1,e,n,-t,r,a,3),g("x","y","z",1,-1,e,t,n,r,s,4),g("x","y","z",-1,-1,e,t,-n,r,s,5),this.setIndex(l),this.setAttribute("position",new It(c,3)),this.setAttribute("normal",new It(d,3)),this.setAttribute("uv",new It(f,2));function g(x,m,p,T,R,y,M,S,E,_,A){let L=y/E,D=M/_,k=y/2,G=M/2,F=S/2,H=E+1,K=_+1,Z=0,ne=0,X=new N;for(let Q=0;Q<K;Q++){let te=Q*D-G;for(let Ee=0;Ee<H;Ee++){let Te=Ee*L-k;X[x]=Te*T,X[m]=te*R,X[p]=F,c.push(X.x,X.y,X.z),X[x]=0,X[m]=0,X[p]=S>0?1:-1,d.push(X.x,X.y,X.z),f.push(Ee/E),f.push(1-Q/_),Z+=1}}for(let Q=0;Q<_;Q++)for(let te=0;te<E;te++){let Ee=h+te+H*Q,Te=h+te+H*(Q+1),at=h+(te+1)+H*(Q+1),Xe=h+(te+1)+H*Q;l.push(Ee,Te,Xe),l.push(Te,at,Xe),ne+=6}o.addGroup(u,ne,A),u+=ne,h+=Z}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var $r=class i extends wt{constructor(e=1,t=32,n=0,r=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:r},t=Math.max(3,t);let s=[],a=[],o=[],l=[],c=new N,d=new De;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let f=0,h=3;f<=t;f++,h+=3){let u=n+f/t*r;c.x=e*Math.cos(u),c.y=e*Math.sin(u),a.push(c.x,c.y,c.z),o.push(0,0,1),d.x=(a[h]/e+1)/2,d.y=(a[h+1]/e+1)/2,l.push(d.x,d.y)}for(let f=1;f<=t;f++)s.push(f,f+1,0);this.setIndex(s),this.setAttribute("position",new It(a,3)),this.setAttribute("normal",new It(o,3)),this.setAttribute("uv",new It(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.radius,e.segments,e.thetaStart,e.thetaLength)}};var Ri=class i extends wt{constructor(e=1,t=1,n=1,r=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let s=e/2,a=t/2,o=Math.floor(n),l=Math.floor(r),c=o+1,d=l+1,f=e/o,h=t/l,u=[],g=[],x=[],m=[];for(let p=0;p<d;p++){let T=p*h-a;for(let R=0;R<c;R++){let y=R*f-s;g.push(y,-T,0),x.push(0,0,1),m.push(R/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let T=0;T<o;T++){let R=T+c*p,y=T+c*(p+1),M=T+1+c*(p+1),S=T+1+c*p;u.push(R,y,S),u.push(y,M,S)}this.setIndex(u),this.setAttribute("position",new It(g,3)),this.setAttribute("normal",new It(x,3)),this.setAttribute("uv",new It(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new i(e.width,e.height,e.widthSegments,e.heightSegments)}};function Li(i){let e={};for(let t in i){e[t]={};for(let n in i[t]){let r=i[t][n];if(wd(r))r.isRenderTargetTexture?(Me("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=r.clone();else if(Array.isArray(r))if(wd(r[0])){let s=[];for(let a=0,o=r.length;a<o;a++)s[a]=r[a].clone();e[t][n]=s}else e[t][n]=r.slice();else e[t][n]=r}}return e}function Bt(i){let e={};for(let t=0;t<i.length;t++){let n=Li(i[t]);for(let r in n)e[r]=n[r]}return e}function wd(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function hu(i){let e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Vc(i){let e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Be.workingColorSpace}var vh={clone:Li,merge:Bt},fu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,uu=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,Xt=class extends Jt{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=fu,this.fragmentShader=uu,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Li(e.uniforms),this.uniformsGroups=hu(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let r in this.uniforms){let a=this.uniforms[r].value;a&&a.isTexture?t.uniforms[r]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[r]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[r]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[r]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[r]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[r]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[r]={type:"m4",value:a.toArray()}:t.uniforms[r]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let r in this.extensions)this.extensions[r]===!0&&(n[r]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let r=e.uniforms[n];switch(this.uniforms[n]={},r.type){case"t":this.uniforms[n].value=t[r.value]||null;break;case"c":this.uniforms[n].value=new Ce().setHex(r.value);break;case"v2":this.uniforms[n].value=new De().fromArray(r.value);break;case"v3":this.uniforms[n].value=new N().fromArray(r.value);break;case"v4":this.uniforms[n].value=new tt().fromArray(r.value);break;case"m3":this.uniforms[n].value=new Pe().fromArray(r.value);break;case"m4":this.uniforms[n].value=new Fe().fromArray(r.value);break;default:this.uniforms[n].value=r.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},ha=class extends Xt{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},$t=class extends Jt{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ce(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ce(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=lo,this.normalScale=new De(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Vn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},Ot=class extends $t{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new De(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Ge(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ce(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ce(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ce(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(e){this._retroreflectivity>0!=e>0&&this.version++,this._retroreflectivity=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.retroreflectivity=e.retroreflectivity,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var fa=class extends Jt{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=ih,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},ua=class extends Jt{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function ai(i,e){return!i||i.constructor===e?i:typeof e.BYTES_PER_ELEMENT=="number"?new e(i):Array.prototype.slice.call(i)}function $s(i){return i!==void 0&&i.inTangents!==void 0&&i.outTangents!==void 0}function pu(i){function e(r,s){return i[r]-i[s]}let t=i.length,n=new Array(t);for(let r=0;r!==t;++r)n[r]=r;return n.sort(e),n}function Td(i,e,t){let n=i.length,r=new i.constructor(n);for(let s=0,a=0;a!==n;++s){let o=t[s]*e;for(let l=0;l!==e;++l)r[a++]=i[o+l]}return r}function mu(i,e,t,n){let r=1,s=i[0];for(;s!==void 0&&s[n]===void 0;)s=i[r++];if(s===void 0)return;let a=s[n];if(a!==void 0)if(Array.isArray(a))do a=s[n],a!==void 0&&(e.push(s.time),t.push(...a)),s=i[r++];while(s!==void 0);else if(a.toArray!==void 0)do a=s[n],a!==void 0&&(e.push(s.time),a.toArray(t,t.length)),s=i[r++];while(s!==void 0);else do a=s[n],a!==void 0&&(e.push(s.time),t.push(a)),s=i[r++];while(s!==void 0)}var Cn=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r!==void 0?r:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],s=t[n-1];n:{e:{let a;t:{i:if(!(e<r)){for(let o=n+2;;){if(r===void 0){if(e<s)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===o)break;if(s=r,r=t[++n],e<r)break e}a=t.length;break t}if(!(e>=s)){let o=t[1];e<o&&(n=2,s=o);for(let l=n-2;;){if(s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(r=s,s=t[--n-1],e>=s)break e}a=n,n=0;break t}break n}for(;n<a;){let o=n+a>>>1;e<t[o]?a=o:n=o+1}if(r=t[n],s=t[n-1],s===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,s,r)}return this.interpolate_(n,s,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,s=e*r;for(let a=0;a!==r;++a)t[a]=n[s+a];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},pa=class extends Cn{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:ac,endingEnd:ac}}intervalChanged_(e,t,n){let r=this.parameterPositions,s=e-2,a=e+1,o=r[s],l=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case oc:s=e,o=2*t-n;break;case cc:s=r.length-2,o=t+r[s]-r[s+1];break;default:s=e,o=n}if(l===void 0)switch(this.getSettings_().endingEnd){case oc:a=e,l=2*n-t;break;case cc:a=1,l=n+r[1]-r[0];break;default:a=e-1,l=t}let c=(n-t)*.5,d=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(l-n),this._offsetPrev=s*d,this._offsetNext=a*d}interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,d=this._offsetPrev,f=this._offsetNext,h=this._weightPrev,u=this._weightNext,g=(n-t)/(r-t),x=g*g,m=x*g,p=-h*m+2*h*x-h*g,T=(1+h)*m+(-1.5-2*h)*x+(-.5+h)*g+1,R=(-1-u)*m+(1.5+u)*x+.5*g,y=u*m-u*x;for(let M=0;M!==o;++M)s[M]=p*a[d+M]+T*a[c+M]+R*a[l+M]+y*a[f+M];return s}},ma=class extends Cn{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,d=(n-t)/(r-t),f=1-d;for(let h=0;h!==o;++h)s[h]=a[c+h]*f+a[l+h]*d;return s}},ga=class extends Cn{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},va=class extends Cn{interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=e*o,c=l-o,d=this.inTangents,f=this.outTangents;if(!d||!f){let g=(n-t)/(r-t),x=1-g;for(let m=0;m!==o;++m)s[m]=a[c+m]*x+a[l+m]*g;return s}let h=o*2,u=e-1;for(let g=0;g!==o;++g){let x=a[c+g],m=a[l+g],p=u*h+g*2,T=f[p],R=f[p+1],y=e*h+g*2,M=d[y],S=d[y+1],E=vu(n,t,T,M,r);s[g]=_h(E,x,R,S,m)}return s}};function _h(i,e,t,n,r){let s=1-i;return s*s*s*e+3*s*s*i*t+3*s*i*i*n+i*i*i*r}function gu(i,e,t,n,r){let s=1-i;return 3*s*s*(t-e)+6*s*i*(n-t)+3*i*i*(r-n)}function vu(i,e,t,n,r){let s=(i-e)/(r-e);for(let a=0;a<8;a++){let o=_h(s,e,t,n,r)-i;if(Math.abs(o)<1e-10)break;let l=gu(s,e,t,n,r);if(Math.abs(l)<1e-10)break;s=Math.max(0,Math.min(1,s-o/l))}return s}var jt=class{constructor(e,t,n,r){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=ai(t,this.TimeBufferType),this.values=ai(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:ai(e.times,Array),values:ai(e.values,Array)};let r=e.getInterpolation();r!==e.DefaultInterpolation&&(n.interpolation=r),$s(e.settings)&&(n.settings={inTangents:ai(e.settings.inTangents,Array),outTangents:ai(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new ga(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new ma(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new pa(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new va(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case Mi:t=this.InterpolantFactoryMethodDiscrete;break;case Si:t=this.InterpolantFactoryMethodLinear;break;case Ks:t=this.InterpolantFactoryMethodSmooth;break;case sc:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Me("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return Mi;case this.InterpolantFactoryMethodLinear:return Si;case this.InterpolantFactoryMethodSmooth:return Ks;case this.InterpolantFactoryMethodBezier:return sc}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e;$s(this.settings)&&(Ad(this.settings.inTangents,e),Ad(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,r=n.length,s=0,a=r-1;for(;s!==r&&n[s]<e;)++s;for(;a!==-1&&n[a]>t;)--a;if(++a,s!==0||a!==r){s>=a&&(a=Math.max(a,1),s=a-1);let o=this.getValueSize();this.times=n.slice(s,a),this.values=this.values.slice(s*o,a*o)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ie("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,r=this.values,s=n.length;s===0&&(Ie("KeyframeTrack: Track is empty.",this),e=!1);let a=null;for(let o=0;o!==s;o++){let l=n[o];if(typeof l=="number"&&isNaN(l)){Ie("KeyframeTrack: Time is not a valid number.",this,o,l),e=!1;break}if(a!==null&&a>l){Ie("KeyframeTrack: Out of order keys.",this,o,l,a),e=!1;break}a=l}if(r!==void 0&&Ef(r))for(let o=0,l=r.length;o!==l;++o){let c=r[o];if(isNaN(c)){Ie("KeyframeTrack: Value is not a valid number.",this,o,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===Ks,s=e.length-1,a=1;for(let o=1;o<s;++o){let l=!1,c=e[o],d=e[o+1];if(c!==d&&(o!==1||c!==e[0]))if(r)l=!0;else{let f=o*n,h=f-n,u=f+n;for(let g=0;g!==n;++g){let x=t[f+g];if(x!==t[h+g]||x!==t[u+g]){l=!0;break}}}if(l){if(o!==a){e[a]=e[o];let f=o*n,h=a*n;for(let u=0;u!==n;++u)t[h+u]=t[f+u]}++a}}if(s>0){e[a]=e[s];for(let o=s*n,l=a*n,c=0;c!==n;++c)t[l+c]=t[o+c];++a}return a!==e.length?(this.times=e.slice(0,a),this.values=t.slice(0,a*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,$s(this.settings)&&(r.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),r}};function Ad(i,e){for(let t=0,n=i.length;t!==n;t+=2)i[t]*=e}jt.prototype.ValueTypeName="";jt.prototype.TimeBufferType=Float32Array;jt.prototype.ValueBufferType=Float32Array;jt.prototype.DefaultInterpolation=Si;var Wn=class extends jt{constructor(e,t,n){super(e,t,n)}};Wn.prototype.ValueTypeName="bool";Wn.prototype.ValueBufferType=Array;Wn.prototype.DefaultInterpolation=Mi;Wn.prototype.InterpolantFactoryMethodLinear=void 0;Wn.prototype.InterpolantFactoryMethodSmooth=void 0;var jr=class extends jt{constructor(e,t,n,r){super(e,t,n,r)}};jr.prototype.ValueTypeName="color";var Xn=class extends jt{constructor(e,t,n,r){super(e,t,n,r)}};Xn.prototype.ValueTypeName="number";var _a=class extends Cn{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=(n-t)/(r-t),c=e*o;for(let d=c+o;c!==d;c+=4)Gt.slerpFlat(s,0,a,c-o,a,c,l);return s}},Yn=class extends jt{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new _a(this.times,this.values,this.getValueSize(),e)}};Yn.prototype.ValueTypeName="quaternion";Yn.prototype.InterpolantFactoryMethodSmooth=void 0;var qn=class extends jt{constructor(e,t,n){super(e,t,n)}};qn.prototype.ValueTypeName="string";qn.prototype.ValueBufferType=Array;qn.prototype.DefaultInterpolation=Mi;qn.prototype.InterpolantFactoryMethodLinear=void 0;qn.prototype.InterpolantFactoryMethodSmooth=void 0;var di=class extends jt{constructor(e,t,n,r){super(e,t,n,r)}};di.prototype.ValueTypeName="vector";var Qr=class{constructor(e="",t=-1,n=[],r=nh){this.name=e,this.tracks=n,this.duration=t,this.blendMode=r,this.uuid=_n(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,r=1/(e.fps||1);for(let a=0,o=n.length;a!==o;++a)t.push(bu(n[a]).scale(r));let s=new this(e.name,e.duration,t,e.blendMode);return s.uuid=e.uuid,s.userData=JSON.parse(e.userData||"{}"),s}static toJSON(e){let t=[],n=e.tracks,r={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let s=0,a=n.length;s!==a;++s)t.push(jt.toJSON(n[s]));return r}static CreateFromMorphTargetSequence(e,t,n,r){let s=t.length,a=[];for(let o=0;o<s;o++){let l=[],c=[];l.push((o+s-1)%s,o,(o+1)%s),c.push(0,1,0);let d=pu(l);l=Td(l,1,d),c=Td(c,1,d),!r&&l[0]===0&&(l.push(s),c.push(c[0])),a.push(new Xn(".morphTargetInfluences["+t[o].name+"]",l,c).scale(1/n))}return new this(e,-1,a)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let r=e;n=r.geometry&&r.geometry.animations||r.animations}for(let r=0;r<n.length;r++)if(n[r].name===t)return n[r];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let r={},s=/^([\w-]*?)([\d]+)$/;for(let o=0,l=e.length;o<l;o++){let c=e[o],d=c.name.match(s);if(d&&d.length>1){let f=d[1],h=r[f];h||(r[f]=h=[]),h.push(c)}}let a=[];for(let o in r)a.push(this.CreateFromMorphTargetSequence(o,r[o],t,n));return a}resetDuration(){let e=this.tracks,t=0;for(let n=0,r=e.length;n!==r;++n){let s=this.tracks[n];t=Math.max(t,s.times[s.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let n=0;n<this.tracks.length;n++)e.push(this.tracks[n].clone());let t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}};function _u(i){switch(i.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return Xn;case"vector":case"vector2":case"vector3":case"vector4":return di;case"color":return jr;case"quaternion":return Yn;case"bool":case"boolean":return Wn;case"string":return qn}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+i)}function bu(i){if(i.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=_u(i.type);if(i.times===void 0){let n=[],r=[];mu(i.keys,n,r,"value"),i.times=n,i.values=r}let t;return e.parse!==void 0?t=e.parse(i):t=new e(i.name,i.times,i.values,i.interpolation),$s(i.settings)&&(t.settings={inTangents:ai(i.settings.inTangents,Float32Array),outTangents:ai(i.settings.outTangents,Float32Array)}),t}var An={enabled:!1,files:{},add:function(i,e){this.enabled!==!1&&(Ed(i)||(this.files[i]=e))},get:function(i){if(this.enabled!==!1&&!Ed(i))return this.files[i]},remove:function(i){delete this.files[i]},clear:function(){this.files={}}};function Ed(i){try{let e=i.slice(i.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var ba=class{constructor(e,t,n){let r=this,s=!1,a=0,o=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(d){o++,s===!1&&r.onStart!==void 0&&r.onStart(d,a,o),s=!0},this.itemEnd=function(d){a++,r.onProgress!==void 0&&r.onProgress(d,a,o),a===o&&(s=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(d){r.onError!==void 0&&r.onError(d)},this.resolveURL=function(d){return d=d.normalize("NFC"),l?l(d):d},this.setURLModifier=function(d){return l=d,this},this.addHandler=function(d,f){return c.push(d,f),this},this.removeHandler=function(d){let f=c.indexOf(d);return f!==-1&&c.splice(f,2),this},this.getHandler=function(d){for(let f=0,h=c.length;f<h;f+=2){let u=c[f],g=c[f+1];if(u.global&&(u.lastIndex=0),u.test(d))return g}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},bh=new ba,In=class{constructor(e){this.manager=e!==void 0?e:bh,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,s){n.load(e,r,t,s)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};In.DEFAULT_MATERIAL_NAME="__DEFAULT";var kn={},dc=class extends Error{constructor(e,t){super(e),this.response=t}},fr=class extends In{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=An.get(`file:${e}`);if(s!==void 0){this.manager.itemStart(e),setTimeout(()=>{t&&t(s),this.manager.itemEnd(e)},0);return}if(kn[e]!==void 0){kn[e].push({onLoad:t,onProgress:n,onError:r});return}kn[e]=[],kn[e].push({onLoad:t,onProgress:n,onError:r});let a=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),o=this.mimeType,l=this.responseType;fetch(a).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&Me("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let d=kn[e],f=c.body.getReader(),h=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),u=h?parseInt(h):0,g=u!==0,x=0,m=new ReadableStream({start(p){T();function T(){f.read().then(({done:R,value:y})=>{if(R)p.close();else{x+=y.byteLength;let M=new ProgressEvent("progress",{lengthComputable:g,loaded:x,total:u});for(let S=0,E=d.length;S<E;S++){let _=d[S];_.onProgress&&_.onProgress(M)}p.enqueue(y),T()}},R=>{p.error(R)})}}});return new Response(m)}else throw new dc(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(d=>new DOMParser().parseFromString(d,o));case"json":return c.json();default:if(o==="")return c.text();{let f=/charset="?([^;"\s]*)"?/i.exec(o),h=f&&f[1]?f[1].toLowerCase():void 0,u=new TextDecoder(h);return c.arrayBuffer().then(g=>u.decode(g))}}}).then(c=>{An.add(`file:${e}`,c);let d=kn[e];delete kn[e];for(let f=0,h=d.length;f<h;f++){let u=d[f];u.onLoad&&u.onLoad(c)}}).catch(c=>{let d=kn[e];if(d===void 0)throw this.manager.itemError(e),c;delete kn[e];for(let f=0,h=d.length;f<h;f++){let u=d[f];u.onError&&u.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Zi=new WeakMap,xa=class extends In{constructor(e){super(e)}load(e,t,n,r){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,a=An.get(`image:${e}`);if(a!==void 0){if(a.complete===!0)s.manager.itemStart(e),setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0);else{let f=Zi.get(a);f===void 0&&(f=[],Zi.set(a,f)),f.push({onLoad:t,onError:r})}return a}let o=tr("img");function l(){d(),t&&t(this);let f=Zi.get(this)||[];for(let h=0;h<f.length;h++){let u=f[h];u.onLoad&&u.onLoad(this)}Zi.delete(this),s.manager.itemEnd(e)}function c(f){d(),r&&r(f),An.remove(`image:${e}`);let h=Zi.get(this)||[];for(let u=0;u<h.length;u++){let g=h[u];g.onError&&g.onError(f)}Zi.delete(this),s.manager.itemError(e),s.manager.itemEnd(e)}function d(){o.removeEventListener("load",l,!1),o.removeEventListener("error",c,!1)}return o.addEventListener("load",l,!1),o.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(o.crossOrigin=this.crossOrigin),An.add(`image:${e}`,o),s.manager.itemStart(e),o.src=e,o}};var es=class extends In{constructor(e){super(e)}load(e,t,n,r){let s=new Mt,a=new xa(this.manager);return a.setCrossOrigin(this.crossOrigin),a.setPath(this.path),a.load(e,function(o){s.image=o,s.needsUpdate=!0,t!==void 0&&t(s)},n,r),s}},ur=class extends mt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ce(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}};var nc=new Fe,Rd=new N,Cd=new N,pr=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new De(512,512),this.mapType=en,this.map=null,this.mapPass=null,this.matrix=new Fe,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new cr,this._frameExtents=new De(1,1),this._viewportCount=1,this._viewports=[new tt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;Rd.setFromMatrixPosition(e.matrixWorld),t.position.copy(Rd),Cd.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Cd),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,r){nc.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(nc,e.coordinateSystem,e.reversedDepth);let s=this._frameExtents,a=r?r.z/s.x:1,o=r?r.w/s.y:1,l=r?r.x/s.x:0,c=r?r.y/s.y:0;e.coordinateSystem===er||e.reversedDepth?t.set(.5*a,0,0,.5*a+l,0,.5*o,0,.5*o+c,0,0,1,0,0,0,0,1):t.set(.5*a,0,0,.5*a+l,0,.5*o,0,.5*o+c,0,0,.5,.5,0,0,0,1),t.multiply(nc)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},qs=new N,Zs=new Gt,Tn=new N,Zn=class extends mt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Fe,this.projectionMatrix=new Fe,this.projectionMatrixInverse=new Fe,this.coordinateSystem=vn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(qs,Zs,Tn),Tn.x===1&&Tn.y===1&&Tn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(qs,Zs,Tn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(qs,Zs,Tn),Tn.x===1&&Tn.y===1&&Tn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(qs,Zs,Tn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},si=new N,Id=new De,Pd=new De,Ct=class extends Zn{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=wi*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Dr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return wi*2*Math.atan(Math.tan(Dr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){si.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(si.x,si.y).multiplyScalar(-e/si.z),si.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(si.x,si.y).multiplyScalar(-e/si.z)}getViewSize(e,t){return this.getViewBounds(e,Id,Pd),t.subVectors(Pd,Id)}setViewOffset(e,t,n,r,s,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Dr*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,s=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*r/l,t-=a.offsetY*n/c,r*=a.width/l,n*=a.height/c}let o=this.filmOffset;o!==0&&(s+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},hc=class extends pr{constructor(){super(new Ct(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){let t=this.camera,n=wi*2*e.angle*this.focus,r=this.mapSize.width/this.mapSize.height*this.aspect,s=e.distance||t.far;(n!==t.fov||r!==t.aspect||s!==t.far)&&(t.fov=n,t.aspect=r,t.far=s,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this.aspect=e.aspect,this}toJSON(){let e=super.toJSON();return e.focus=this.focus,e.aspect=this.aspect,e}},ts=class extends ur{constructor(e,t,n=0,r=Math.PI/3,s=0,a=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(mt.DEFAULT_UP),this.updateMatrix(),this.target=new mt,this.distance=n,this.angle=r,this.penumbra=s,this.decay=a,this.map=null,this.shadow=new hc}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},fc=class extends pr{constructor(){super(new Ct(90,1,.5,500)),this.isPointLightShadow=!0}},ns=class extends ur{constructor(e,t,n=0,r=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=r,this.shadow=new fc}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},hi=class extends Zn{constructor(e=-1,t=1,n=1,r=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,s=n-e,a=n+e,o=r+t,l=r-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,d=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=d*this.view.offsetY,l=o-d*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},uc=class extends pr{constructor(){super(new hi(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},is=class extends ur{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(mt.DEFAULT_UP),this.updateMatrix(),this.target=new mt,this.shadow=new uc}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}};var Kn=class{static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}},rs=class extends wt{constructor(){super(),this.isInstancedBufferGeometry=!0,this.type="InstancedBufferGeometry",this.instanceCount=1/0}copy(e){return super.copy(e),this.instanceCount=e.instanceCount,this}toJSON(){let e=super.toJSON();return e.instanceCount=this.instanceCount,e.isInstancedBufferGeometry=!0,e}};var ic=new WeakMap,ss=class extends In{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&Me("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&Me("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,n,r){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let s=this,a=An.get(`image-bitmap:${e}`);if(a!==void 0){if(s.manager.itemStart(e),a.then){a.then(c=>{ic.has(a)===!0?(r&&r(ic.get(a)),s.manager.itemError(e),s.manager.itemEnd(e)):(t&&t(c),s.manager.itemEnd(e))});return}setTimeout(function(){t&&t(a),s.manager.itemEnd(e)},0);return}let o={};o.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",o.headers=this.requestHeader,o.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;let l=fetch(e,o).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign({},s.options,{colorSpaceConversion:"none"}))}).then(function(c){return An.add(`image-bitmap:${e}`,c),t&&t(c),s.manager.itemEnd(e),c}).catch(function(c){r&&r(c),ic.set(l,c),An.remove(`image-bitmap:${e}`),s.manager.itemError(e),s.manager.itemEnd(e)});An.add(`image-bitmap:${e}`,l),s.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Ki=-90,Ji=1,ya=class extends mt{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Ct(Ki,Ji,e,t);r.layers=this.layers,this.add(r);let s=new Ct(Ki,Ji,e,t);s.layers=this.layers,this.add(s);let a=new Ct(Ki,Ji,e,t);a.layers=this.layers,this.add(a);let o=new Ct(Ki,Ji,e,t);o.layers=this.layers,this.add(o);let l=new Ct(Ki,Ji,e,t);l.layers=this.layers,this.add(l);let c=new Ct(Ki,Ji,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,s,a,o,l]=t;for(let c of t)this.remove(c);if(e===vn)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===er)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[s,a,o,l,c,d]=this.children,f=e.getRenderTarget(),h=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;let x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,1,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,r),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,d),e.setRenderTarget(f,h,u),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}},Ma=class extends Ct{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}};var Gc="\\[\\]\\.:\\/",xu=new RegExp("["+Gc+"]","g"),Wc="[^"+Gc+"]",yu="[^"+Gc.replace("\\.","")+"]",Mu=/((?:WC+[\/:])*)/.source.replace("WC",Wc),Su=/(WCOD+)?/.source.replace("WCOD",yu),wu=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",Wc),Tu=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",Wc),Au=new RegExp("^"+Mu+Su+wu+Tu+"$"),Eu=["material","materials","bones","map"],pc=class{constructor(e,t,n){let r=n||rt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,s=n.length;r!==s;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},rt=class i{constructor(e,t,n){this.path=t,this.parsedPath=n||i.parseTrackName(t),this.node=i.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new i.Composite(e,t,n):new i(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(xu,"")}static parseTrackName(e){let t=Au.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(".");if(r!==void 0&&r!==-1){let s=n.nodeName.substring(r+1);Eu.indexOf(s)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=s)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(s){for(let a=0;a<s.length;a++){let o=s[a];if(o.name===t||o.uuid===t)return o;let l=n(o.children);if(l)return l}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,s=n.length;r!==s;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,r=t.propertyName,s=t.propertyIndex;if(e||(e=i.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Me("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){Ie("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ie("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ie("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let d=0;d<e.length;d++)if(e[d].name===c){c=d;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ie("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ie("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Ie("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){Ie("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let a=e[r];if(a===void 0){let c=t.nodeName;Ie("PropertyBinding: Trying to update property for track: "+c+"."+r+" but it wasn't found.",e);return}let o=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?o=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(o=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(s!==void 0){if(r==="morphTargetInfluences"){if(!e.geometry){Ie("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ie("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[s]!==void 0&&(s=e.morphTargetDictionary[s])}l=this.BindingType.ArrayElement,this.resolvedProperty=a,this.propertyIndex=s}else a.fromArray!==void 0&&a.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=a):Array.isArray(a)?(l=this.BindingType.EntireArray,this.resolvedProperty=a):this.propertyName=r;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][o]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};rt.Composite=pc;rt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};rt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};rt.prototype.GetterByBindingType=[rt.prototype._getValue_direct,rt.prototype._getValue_array,rt.prototype._getValue_arrayElement,rt.prototype._getValue_toArray];rt.prototype.SetterByBindingTypeAndVersioning=[[rt.prototype._setValue_direct,rt.prototype._setValue_direct_setNeedsUpdate,rt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_array,rt.prototype._setValue_array_setNeedsUpdate,rt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_arrayElement,rt.prototype._setValue_arrayElement_setNeedsUpdate,rt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[rt.prototype._setValue_fromArray,rt.prototype._setValue_fromArray_setNeedsUpdate,rt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var Lv=new Float32Array(1);var mc=class i{static{i.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let s=this.elements;return s[0]=e,s[2]=t,s[1]=n,s[3]=r,this}};function Xc(i,e,t,n){let r=Ru(n);switch(t){case Dc:return i*e;case Ca:return i*e/r.components*r.byteLength;case Ia:return i*e/r.components*r.byteLength;case pi:return i*e*2/r.components*r.byteLength;case Pa:return i*e*2/r.components*r.byteLength;case Uc:return i*e*3/r.components*r.byteLength;case sn:return i*e*4/r.components*r.byteLength;case La:return i*e*4/r.components*r.byteLength;case cs:case ls:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case ds:case hs:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Na:case Ua:return Math.max(i,16)*Math.max(e,8)/4;case Fa:case Da:return Math.max(i,8)*Math.max(e,8)/2;case Oa:case Ba:case ka:case Ha:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case za:case fs:case Va:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Ga:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Wa:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Xa:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case Ya:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case qa:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Za:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case Ka:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Ja:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case $a:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case ja:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case Qa:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case eo:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case to:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case no:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case io:case ro:case so:return Math.ceil(i/4)*Math.ceil(e/4)*16;case ao:case oo:return Math.ceil(i/4)*Math.ceil(e/4)*8;case us:case co:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function Ru(i){switch(i){case en:case Pc:return{byteLength:1,components:1};case _r:case Lc:case Mn:return{byteLength:2,components:1};case Ea:case Ra:return{byteLength:2,components:4};case yn:case Aa:case qt:return{byteLength:4,components:1};case Fc:case Nc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?Me("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function Hh(){let i=null,e=!1,t=null,n=null;function r(s,a){n=i.requestAnimationFrame(r),t(s,a)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(r),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(s){t=s},setContext:function(s){i=s}}}function Iu(i){let e=new WeakMap;function t(o,l){let c=o.array,d=o.usage,f=c.byteLength,h=i.createBuffer();i.bindBuffer(l,h),i.bufferData(l,c,d),o.onUploadCallback();let u;if(c instanceof Float32Array)u=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)u=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?u=i.HALF_FLOAT:u=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)u=i.SHORT;else if(c instanceof Uint32Array)u=i.UNSIGNED_INT;else if(c instanceof Int32Array)u=i.INT;else if(c instanceof Int8Array)u=i.BYTE;else if(c instanceof Uint8Array)u=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)u=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:h,type:u,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:f}}function n(o,l,c){let d=l.array,f=l.updateRanges;if(i.bindBuffer(c,o),f.length===0)i.bufferSubData(c,0,d);else{f.sort((u,g)=>u.start-g.start);let h=0;for(let u=1;u<f.length;u++){let g=f[h],x=f[u];x.start<=g.start+g.count+1?g.count=Math.max(g.count,x.start+x.count-g.start):(++h,f[h]=x)}f.length=h+1;for(let u=0,g=f.length;u<g;u++){let x=f[u];i.bufferSubData(c,x.start*d.BYTES_PER_ELEMENT,d,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function r(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);let l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){let d=e.get(o);(!d||d.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}let c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:r,remove:s,update:a}}var Pu=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Lu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Fu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Nu=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Du=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Uu=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Ou=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Bu=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,zu=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,ku=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Hu=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Vu=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Gu=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Wu=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Xu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Yu=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,qu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Zu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Ku=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Ju=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,$u=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,ju=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Qu=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,ep=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,tp=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,np=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,ip=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,rp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,sp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,ap=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,op="gl_FragColor = linearToOutputTexel( gl_FragColor );",cp=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,lp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,dp=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,hp=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,fp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,up=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,pp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,mp=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,gp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,vp=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,_p=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,bp=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,xp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,yp=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Mp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,Sp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,wp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Tp=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Ap=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Ep=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Rp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Cp=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Ip=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Pp=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Lp=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Fp=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,Np=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Dp=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Up=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Op=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Bp=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,zp=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,kp=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Hp=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Vp=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Gp=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Wp=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Xp=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Yp=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,qp=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Zp=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Kp=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Jp=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,$p=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,jp=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Qp=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,em=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,tm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,nm=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,im=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,rm=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,sm=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,am=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,om=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,cm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,lm=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,hm=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,fm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,um=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,pm=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,mm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,gm=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,vm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,_m=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,bm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,xm=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,ym=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Mm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Sm=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,wm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Tm=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Am=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Em=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Rm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Cm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Im=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Pm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Lm=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Fm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Nm=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Dm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Um=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Om=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Bm=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,zm=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,km=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,Hm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Vm=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Gm=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Wm=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Xm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Ym=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,qm=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Zm=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Km=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Jm=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,$m=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,jm=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Qm=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,e0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,t0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,n0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,i0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,r0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,s0=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,a0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,o0=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,c0=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,l0=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,d0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Oe={alphahash_fragment:Pu,alphahash_pars_fragment:Lu,alphamap_fragment:Fu,alphamap_pars_fragment:Nu,alphatest_fragment:Du,alphatest_pars_fragment:Uu,aomap_fragment:Ou,aomap_pars_fragment:Bu,batching_pars_vertex:zu,batching_vertex:ku,begin_vertex:Hu,beginnormal_vertex:Vu,bsdfs:Gu,iridescence_fragment:Wu,bumpmap_pars_fragment:Xu,clipping_planes_fragment:Yu,clipping_planes_pars_fragment:qu,clipping_planes_pars_vertex:Zu,clipping_planes_vertex:Ku,color_fragment:Ju,color_pars_fragment:$u,color_pars_vertex:ju,color_vertex:Qu,common:ep,cube_uv_reflection_fragment:tp,defaultnormal_vertex:np,displacementmap_pars_vertex:ip,displacementmap_vertex:rp,emissivemap_fragment:sp,emissivemap_pars_fragment:ap,colorspace_fragment:op,colorspace_pars_fragment:cp,envmap_fragment:lp,envmap_common_pars_fragment:dp,envmap_pars_fragment:hp,envmap_pars_vertex:fp,envmap_physical_pars_fragment:Sp,envmap_vertex:up,fog_vertex:pp,fog_pars_vertex:mp,fog_fragment:gp,fog_pars_fragment:vp,gradientmap_pars_fragment:_p,lightmap_pars_fragment:bp,lights_lambert_fragment:xp,lights_lambert_pars_fragment:yp,lights_pars_begin:Mp,lights_toon_fragment:wp,lights_toon_pars_fragment:Tp,lights_phong_fragment:Ap,lights_phong_pars_fragment:Ep,lights_physical_fragment:Rp,lights_physical_pars_fragment:Cp,lights_fragment_begin:Ip,lights_fragment_maps:Pp,lights_fragment_end:Lp,lightprobes_pars_fragment:Fp,logdepthbuf_fragment:Np,logdepthbuf_pars_fragment:Dp,logdepthbuf_pars_vertex:Up,logdepthbuf_vertex:Op,map_fragment:Bp,map_pars_fragment:zp,map_particle_fragment:kp,map_particle_pars_fragment:Hp,metalnessmap_fragment:Vp,metalnessmap_pars_fragment:Gp,morphinstance_vertex:Wp,morphcolor_vertex:Xp,morphnormal_vertex:Yp,morphtarget_pars_vertex:qp,morphtarget_vertex:Zp,normal_fragment_begin:Kp,normal_fragment_maps:Jp,normal_pars_fragment:$p,normal_pars_vertex:jp,normal_vertex:Qp,normalmap_pars_fragment:em,clearcoat_normal_fragment_begin:tm,clearcoat_normal_fragment_maps:nm,clearcoat_pars_fragment:im,iridescence_pars_fragment:rm,opaque_fragment:sm,packing:am,premultiplied_alpha_fragment:om,project_vertex:cm,dithering_fragment:lm,dithering_pars_fragment:dm,roughnessmap_fragment:hm,roughnessmap_pars_fragment:fm,shadowmap_pars_fragment:um,shadowmap_pars_vertex:pm,shadowmap_vertex:mm,shadowmask_pars_fragment:gm,skinbase_vertex:vm,skinning_pars_vertex:_m,skinning_vertex:bm,skinnormal_vertex:xm,specularmap_fragment:ym,specularmap_pars_fragment:Mm,tonemapping_fragment:Sm,tonemapping_pars_fragment:wm,transmission_fragment:Tm,transmission_pars_fragment:Am,uv_pars_fragment:Em,uv_pars_vertex:Rm,uv_vertex:Cm,worldpos_vertex:Im,background_vert:Pm,background_frag:Lm,backgroundCube_vert:Fm,backgroundCube_frag:Nm,cube_vert:Dm,cube_frag:Um,depth_vert:Om,depth_frag:Bm,distance_vert:zm,distance_frag:km,equirect_vert:Hm,equirect_frag:Vm,linedashed_vert:Gm,linedashed_frag:Wm,meshbasic_vert:Xm,meshbasic_frag:Ym,meshlambert_vert:qm,meshlambert_frag:Zm,meshmatcap_vert:Km,meshmatcap_frag:Jm,meshnormal_vert:$m,meshnormal_frag:jm,meshphong_vert:Qm,meshphong_frag:e0,meshphysical_vert:t0,meshphysical_frag:n0,meshtoon_vert:i0,meshtoon_frag:r0,points_vert:s0,points_frag:a0,shadow_vert:o0,shadow_frag:c0,sprite_vert:l0,sprite_frag:d0},de={common:{diffuse:{value:new Ce(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Pe},alphaMap:{value:null},alphaMapTransform:{value:new Pe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Pe}},envmap:{envMap:{value:null},envMapRotation:{value:new Pe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Pe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Pe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Pe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Pe},normalScale:{value:new De(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Pe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Pe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Pe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Pe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ce(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new N},probesMax:{value:new N},probesResolution:{value:new N}},points:{diffuse:{value:new Ce(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Pe},alphaTest:{value:0},uvTransform:{value:new Pe}},sprite:{diffuse:{value:new Ce(16777215)},opacity:{value:1},center:{value:new De(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Pe},alphaMap:{value:null},alphaMapTransform:{value:new Pe},alphaTest:{value:0}}},Fn={basic:{uniforms:Bt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.fog]),vertexShader:Oe.meshbasic_vert,fragmentShader:Oe.meshbasic_frag},lambert:{uniforms:Bt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new Ce(0)},envMapIntensity:{value:1}}]),vertexShader:Oe.meshlambert_vert,fragmentShader:Oe.meshlambert_frag},phong:{uniforms:Bt([de.common,de.specularmap,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.fog,de.lights,{emissive:{value:new Ce(0)},specular:{value:new Ce(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphong_vert,fragmentShader:Oe.meshphong_frag},standard:{uniforms:Bt([de.common,de.envmap,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.roughnessmap,de.metalnessmap,de.fog,de.lights,{emissive:{value:new Ce(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag},toon:{uniforms:Bt([de.common,de.aomap,de.lightmap,de.emissivemap,de.bumpmap,de.normalmap,de.displacementmap,de.gradientmap,de.fog,de.lights,{emissive:{value:new Ce(0)}}]),vertexShader:Oe.meshtoon_vert,fragmentShader:Oe.meshtoon_frag},matcap:{uniforms:Bt([de.common,de.bumpmap,de.normalmap,de.displacementmap,de.fog,{matcap:{value:null}}]),vertexShader:Oe.meshmatcap_vert,fragmentShader:Oe.meshmatcap_frag},points:{uniforms:Bt([de.points,de.fog]),vertexShader:Oe.points_vert,fragmentShader:Oe.points_frag},dashed:{uniforms:Bt([de.common,de.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Oe.linedashed_vert,fragmentShader:Oe.linedashed_frag},depth:{uniforms:Bt([de.common,de.displacementmap]),vertexShader:Oe.depth_vert,fragmentShader:Oe.depth_frag},normal:{uniforms:Bt([de.common,de.bumpmap,de.normalmap,de.displacementmap,{opacity:{value:1}}]),vertexShader:Oe.meshnormal_vert,fragmentShader:Oe.meshnormal_frag},sprite:{uniforms:Bt([de.sprite,de.fog]),vertexShader:Oe.sprite_vert,fragmentShader:Oe.sprite_frag},background:{uniforms:{uvTransform:{value:new Pe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Oe.background_vert,fragmentShader:Oe.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Pe}},vertexShader:Oe.backgroundCube_vert,fragmentShader:Oe.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Oe.cube_vert,fragmentShader:Oe.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Oe.equirect_vert,fragmentShader:Oe.equirect_frag},distance:{uniforms:Bt([de.common,de.displacementmap,{referencePosition:{value:new N},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Oe.distance_vert,fragmentShader:Oe.distance_frag},shadow:{uniforms:Bt([de.lights,de.fog,{color:{value:new Ce(0)},opacity:{value:1}}]),vertexShader:Oe.shadow_vert,fragmentShader:Oe.shadow_frag}};Fn.physical={uniforms:Bt([Fn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Pe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Pe},clearcoatNormalScale:{value:new De(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Pe},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Pe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Pe},sheen:{value:0},sheenColor:{value:new Ce(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Pe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Pe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Pe},transmissionSamplerSize:{value:new De},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Pe},attenuationDistance:{value:0},attenuationColor:{value:new Ce(0)},specularColor:{value:new Ce(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Pe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Pe},anisotropyVector:{value:new De},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Pe}}]),vertexShader:Oe.meshphysical_vert,fragmentShader:Oe.meshphysical_frag};var uo={r:0,b:0,g:0},h0=new Fe,Vh=new Pe;Vh.set(-1,0,0,0,1,0,0,0,1);function f0(i,e,t,n,r,s){let a=new Ce(0),o=r===!0?0:1,l,c,d=null,f=0,h=null;function u(T){let R=T.isScene===!0?T.background:null;if(R&&R.isTexture){let y=T.backgroundBlurriness>0;R=e.get(R,y)}return R}function g(T){let R=!1,y=u(T);y===null?m(a,o):y&&y.isColor&&(m(y,1),R=!0);let M=i.xr.getEnvironmentBlendMode();M==="additive"?t.buffers.color.setClear(0,0,0,1,s):M==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,s),(i.autoClear||R)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function x(T,R){let y=u(R);y&&(y.isCubeTexture||y.mapping===os)?(c===void 0&&(c=new Ke(new hr(1,1,1),new Xt({name:"BackgroundCubeMaterial",uniforms:Li(Fn.backgroundCube.uniforms),vertexShader:Fn.backgroundCube.vertexShader,fragmentShader:Fn.backgroundCube.fragmentShader,side:Yt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(M,S,E){this.matrixWorld.copyPosition(E.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=R.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=R.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(h0.makeRotationFromEuler(R.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Vh),c.material.toneMapped=Be.getTransfer(y.colorSpace)!==je,(d!==y||f!==y.version||h!==i.toneMapping)&&(c.material.needsUpdate=!0,d=y,f=y.version,h=i.toneMapping),c.layers.enableAll(),T.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new Ke(new Ri(2,2),new Xt({name:"BackgroundMaterial",uniforms:Li(Fn.background.uniforms),vertexShader:Fn.background.vertexShader,fragmentShader:Fn.background.fragmentShader,side:Pn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=R.backgroundIntensity,l.material.toneMapped=Be.getTransfer(y.colorSpace)!==je,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(d!==y||f!==y.version||h!==i.toneMapping)&&(l.material.needsUpdate=!0,d=y,f=y.version,h=i.toneMapping),l.layers.enableAll(),T.unshift(l,l.geometry,l.material,0,0,null))}function m(T,R){T.getRGB(uo,Vc(i)),t.buffers.color.setClear(uo.r,uo.g,uo.b,R,s)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(T,R=1){a.set(T),o=R,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(T){o=T,m(a,o)},render:g,addToRenderList:x,dispose:p}}function u0(i,e){let t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},r=h(null),s=r,a=!1;function o(D,k,G,F,H){let K=!1,Z=f(D,F,G,k);s!==Z&&(s=Z,c(s.object)),K=u(D,F,G,H),K&&g(D,F,G,H),H!==null&&e.update(H,i.ELEMENT_ARRAY_BUFFER),(K||a)&&(a=!1,y(D,k,G,F),H!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(H).buffer))}function l(){return i.createVertexArray()}function c(D){return i.bindVertexArray(D)}function d(D){return i.deleteVertexArray(D)}function f(D,k,G,F){let H=F.wireframe===!0,K=n[k.id];K===void 0&&(K={},n[k.id]=K);let Z=D.isInstancedMesh===!0?D.id:0,ne=K[Z];ne===void 0&&(ne={},K[Z]=ne);let X=ne[G.id];X===void 0&&(X={},ne[G.id]=X);let Q=X[H];return Q===void 0&&(Q=h(l()),X[H]=Q),Q}function h(D){let k=[],G=[],F=[];for(let H=0;H<t;H++)k[H]=0,G[H]=0,F[H]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:k,enabledAttributes:G,attributeDivisors:F,object:D,attributes:{},index:null}}function u(D,k,G,F){let H=s.attributes,K=k.attributes,Z=0,ne=G.getAttributes();for(let X in ne)if(ne[X].location>=0){let te=H[X],Ee=K[X];if(Ee===void 0&&(X==="instanceMatrix"&&D.instanceMatrix&&(Ee=D.instanceMatrix),X==="instanceColor"&&D.instanceColor&&(Ee=D.instanceColor)),te===void 0||te.attribute!==Ee||Ee&&te.data!==Ee.data)return!0;Z++}return s.attributesNum!==Z||s.index!==F}function g(D,k,G,F){let H={},K=k.attributes,Z=0,ne=G.getAttributes();for(let X in ne)if(ne[X].location>=0){let te=K[X];te===void 0&&(X==="instanceMatrix"&&D.instanceMatrix&&(te=D.instanceMatrix),X==="instanceColor"&&D.instanceColor&&(te=D.instanceColor));let Ee={};Ee.attribute=te,te&&te.data&&(Ee.data=te.data),H[X]=Ee,Z++}s.attributes=H,s.attributesNum=Z,s.index=F}function x(){let D=s.newAttributes;for(let k=0,G=D.length;k<G;k++)D[k]=0}function m(D){p(D,0)}function p(D,k){let G=s.newAttributes,F=s.enabledAttributes,H=s.attributeDivisors;G[D]=1,F[D]===0&&(i.enableVertexAttribArray(D),F[D]=1),H[D]!==k&&(i.vertexAttribDivisor(D,k),H[D]=k)}function T(){let D=s.newAttributes,k=s.enabledAttributes;for(let G=0,F=k.length;G<F;G++)k[G]!==D[G]&&(i.disableVertexAttribArray(G),k[G]=0)}function R(D,k,G,F,H,K,Z){Z===!0?i.vertexAttribIPointer(D,k,G,H,K):i.vertexAttribPointer(D,k,G,F,H,K)}function y(D,k,G,F){x();let H=F.attributes,K=G.getAttributes(),Z=k.defaultAttributeValues;for(let ne in K){let X=K[ne];if(X.location>=0){let Q=H[ne];if(Q===void 0&&(ne==="instanceMatrix"&&D.instanceMatrix&&(Q=D.instanceMatrix),ne==="instanceColor"&&D.instanceColor&&(Q=D.instanceColor)),Q!==void 0){let te=Q.normalized,Ee=Q.itemSize,Te=e.get(Q);if(Te===void 0)continue;let at=Te.buffer,Xe=Te.type,Ze=Te.bytesPerElement,Y=Xe===i.INT||Xe===i.UNSIGNED_INT||Q.gpuType===Aa;if(Q.isInterleavedBufferAttribute){let j=Q.data,ve=j.stride,Le=Q.offset;if(j.isInstancedInterleavedBuffer){for(let me=0;me<X.locationSize;me++)p(X.location+me,j.meshPerAttribute);D.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let me=0;me<X.locationSize;me++)m(X.location+me);i.bindBuffer(i.ARRAY_BUFFER,at);for(let me=0;me<X.locationSize;me++)R(X.location+me,Ee/X.locationSize,Xe,te,ve*Ze,(Le+Ee/X.locationSize*me)*Ze,Y)}else{if(Q.isInstancedBufferAttribute){for(let j=0;j<X.locationSize;j++)p(X.location+j,Q.meshPerAttribute);D.isInstancedMesh!==!0&&F._maxInstanceCount===void 0&&(F._maxInstanceCount=Q.meshPerAttribute*Q.count)}else for(let j=0;j<X.locationSize;j++)m(X.location+j);i.bindBuffer(i.ARRAY_BUFFER,at);for(let j=0;j<X.locationSize;j++)R(X.location+j,Ee/X.locationSize,Xe,te,Ee*Ze,Ee/X.locationSize*j*Ze,Y)}}else if(Z!==void 0){let te=Z[ne];if(te!==void 0)switch(te.length){case 2:i.vertexAttrib2fv(X.location,te);break;case 3:i.vertexAttrib3fv(X.location,te);break;case 4:i.vertexAttrib4fv(X.location,te);break;default:i.vertexAttrib1fv(X.location,te)}}}}T()}function M(){A();for(let D in n){let k=n[D];for(let G in k){let F=k[G];for(let H in F){let K=F[H];for(let Z in K)d(K[Z].object),delete K[Z];delete F[H]}}delete n[D]}}function S(D){if(n[D.id]===void 0)return;let k=n[D.id];for(let G in k){let F=k[G];for(let H in F){let K=F[H];for(let Z in K)d(K[Z].object),delete K[Z];delete F[H]}}delete n[D.id]}function E(D){for(let k in n){let G=n[k];for(let F in G){let H=G[F];if(H[D.id]===void 0)continue;let K=H[D.id];for(let Z in K)d(K[Z].object),delete K[Z];delete H[D.id]}}}function _(D){for(let k in n){let G=n[k],F=D.isInstancedMesh===!0?D.id:0,H=G[F];if(H!==void 0){for(let K in H){let Z=H[K];for(let ne in Z)d(Z[ne].object),delete Z[ne];delete H[K]}delete G[F],Object.keys(G).length===0&&delete n[k]}}}function A(){L(),a=!0,s!==r&&(s=r,c(s.object))}function L(){r.geometry=null,r.program=null,r.wireframe=!1}return{setup:o,reset:A,resetDefaultState:L,dispose:M,releaseStatesOfGeometry:S,releaseStatesOfObject:_,releaseStatesOfProgram:E,initAttributes:x,enableAttribute:m,disableUnusedAttributes:T}}function p0(i,e,t){let n;function r(l){n=l}function s(l,c){i.drawArrays(n,l,c),t.update(c,n,1)}function a(l,c,d){d!==0&&(i.drawArraysInstanced(n,l,c,d),t.update(c,n,d))}function o(l,c,d){if(d===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,d);let h=0;for(let u=0;u<d;u++)h+=c[u];t.update(h,n,1)}this.setMode=r,this.render=s,this.renderInstances=a,this.renderMultiDraw=o}function m0(i,e,t,n){let r;function s(){if(r!==void 0)return r;if(e.has("EXT_texture_filter_anisotropic")===!0){let E=e.get("EXT_texture_filter_anisotropic");r=i.getParameter(E.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else r=0;return r}function a(E){return!(E!==sn&&n.convert(E)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(E){let _=E===Mn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(E!==en&&E!==qt&&!_&&n.convert(E)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(E){if(E==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";E="mediump"}return E==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",d=l(c);d!==c&&(Me("WebGLRenderer:",c,"not supported, using",d,"instead."),c=d);let f=t.logarithmicDepthBuffer===!0,h=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&h===!1&&Me("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let u=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),T=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),R=i.getParameter(i.MAX_VARYING_VECTORS),y=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),M=i.getParameter(i.MAX_SAMPLES),S=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:h,maxTextures:u,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:T,maxVaryings:R,maxFragmentUniforms:y,maxSamples:M,samples:S}}function g0(i){let e=this,t=null,n=0,r=!1,s=!1,a=new mn,o=new Pe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,h){let u=f.length!==0||h||n!==0||r;return r=h,n=f.length,u},this.beginShadows=function(){s=!0,d(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(f,h){t=d(f,h,0)},this.setState=function(f,h,u){let g=f.clippingPlanes,x=f.clipIntersection,m=f.clipShadows,p=i.get(f);if(!r||g===null||g.length===0||s&&!m)s?d(null):c();else{let T=s?0:n,R=T*4,y=p.clippingState||null;l.value=y,y=d(g,h,R,u);for(let M=0;M!==R;++M)y[M]=t[M];p.clippingState=y,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=T}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function d(f,h,u,g){let x=f!==null?f.length:0,m=null;if(x!==0){if(m=l.value,g!==!0||m===null){let p=u+x*4,T=h.matrixWorldInverse;o.getNormalMatrix(T),(m===null||m.length<p)&&(m=new Float32Array(p));for(let R=0,y=u;R!==x;++R,y+=4)a.copy(f[R]).applyMatrix4(T,o),a.normal.toArray(m,y),m[y+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,m}}var Mr=4,v0=6,_0=20,b0=256,ms=new hi,xh=new Ce,Yc=null,qc=0,Zc=0,Kc=!1,x0=new N,Fi=new N,mo=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,s={}){let{size:a=256,position:o=x0}=s;Yc=this._renderer.getRenderTarget(),qc=this._renderer.getActiveCubeFace(),Zc=this._renderer.getActiveMipmapLevel(),Kc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,r,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Sh(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Mh(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Yc,qc,Zc),this._renderer.xr.enabled=Kc,e.scissorTest=!1,yr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===fi||e.mapping===Ii?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Yc=this._renderer.getRenderTarget(),qc=this._renderer.getActiveCubeFace(),Zc=this._renderer.getActiveMipmapLevel(),Kc=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:vt,minFilter:vt,generateMipmaps:!1,type:Mn,format:sn,colorSpace:Vt,depthBuffer:!1},r=yh(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=yh(e,t,n);let{_lodMax:s}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=y0(s)),this._blurMaterial=S0(s,e,t),this._ggxMaterial=M0(s,e,t)}return r}_compileMaterial(e){let t=new Ke(new wt,e);this._renderer.compile(t,ms)}_sceneToCubeUV(e,t,n,r,s){let l=new Ct(90,1,t,n),c=[1,-1,1,1,1,1],d=[1,1,1,-1,-1,-1],f=this._renderer,h=f.autoClear,u=f.toneMapping;f.getClearColor(xh),f.toneMapping=rn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(r),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Ke(new hr,new Lt({name:"PMREM.Background",side:Yt,depthWrite:!1,depthTest:!1})));let x=this._backgroundBox,m=x.material,p=!1,T=e.background;T?T.isColor&&(m.color.copy(T),e.background=null,p=!0):(m.color.copy(xh),p=!0);for(let R=0;R<6;R++){let y=R%3;y===0?(l.up.set(0,c[R],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+d[R],s.y,s.z)):y===1?(l.up.set(0,0,c[R]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+d[R],s.z)):(l.up.set(0,c[R],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+d[R]));let M=this._cubeSize;yr(r,y*M,R>2?M:0,M,M),f.setRenderTarget(r),p&&f.render(x,l),f.render(e,l)}f.toneMapping=u,f.autoClear=h,e.background=T}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===fi||e.mapping===Ii;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=Sh()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Mh());let s=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=s;let o=s.uniforms;o.envMap.value=e;let l=this._cubeSize;yr(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,ms)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let s=1;s<r;s++)this._applyGGXFilter(e,s-1,s);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,s=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let l=a.uniforms,c=n/(this._lodMeshes.length-1),d=t/(this._lodMeshes.length-1),f=Math.sqrt(c*c-d*d),h=c*1.25,u=f*h,{_lodMax:g}=this,x=this._sizeLods[n],m=3*x*(n>g-Mr?n-g+Mr:0),p=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=u,l.mipInt.value=g-t,yr(s,m,p,3*x,2*x),r.setRenderTarget(s),r.render(o,ms),l.envMap.value=s.texture,l.roughness.value=0,l.mipInt.value=g-n,yr(e,m,p,3*x,2*x),r.setRenderTarget(e),r.render(o,ms)}_blur(e,t,n,r){let s=this._pingPongRenderTarget,a=Math.min(r,Math.PI)/Math.SQRT2;this._blurPass(e,s,t,n,a),this._blurPass(s,e,n,n,a)}_blurPass(e,t,n,r,s){let a=this._renderer,o=this._blurMaterial,l=this._lodMeshes[r];l.material=o;let c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=s,c.mipInt.value=this._lodMax-n;let d=this._sizeLods[r],f=3*d*(r>this._lodMax-Mr?r-this._lodMax+Mr:0),h=4*(this._cubeSize-d);yr(t,f,h,3*d,2*d),a.setRenderTarget(t),a.render(l,ms)}};function y0(i){let e=[],t=[],n=i,r=i-Mr+1+v0;for(let s=0;s<r;s++){let a=Math.pow(2,n);e.push(a);let o=1/(a-2),l=-o,c=1+o,d=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,h=6,u=3,g=new Float32Array(u*h*f),x=new Float32Array(u*h*f);for(let p=0;p<f;p++){let T=p%3*2/3-1,R=p>2?0:-1,y=[T,R,0,T+2/3,R,0,T+2/3,R+1,0,T,R,0,T+2/3,R+1,0,T,R+1,0];g.set(y,u*h*p);for(let M=0;M<h;M++){let S=d[M*2]*2-1,E=d[M*2+1]*2-1;p===0?Fi.set(1,E,S):p===1?Fi.set(-S,1,-E):p===2?Fi.set(-S,E,1):p===3?Fi.set(-1,E,-S):p===4?Fi.set(-S,-1,E):Fi.set(S,E,-1),Fi.toArray(x,(p*h+M)*u)}}let m=new wt;m.setAttribute("position",new pt(g,u)),m.setAttribute("outputDirection",new pt(x,u)),t.push(new Ke(m,null)),n>Mr&&n--}return{lodMeshes:t,sizeLods:e}}function yh(i,e,t){let n=new Pt(i,e,t);return n.texture.mapping=os,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function yr(i,e,t,n,r){i.viewport.set(e,t,n,r),i.scissor.set(e,t,n,r)}function M0(i,e,t){return new Xt({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:b0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:_o(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:ln,depthTest:!1,depthWrite:!1})}function S0(i,e,t){return new Xt({name:"SphericalGaussianBlur",defines:{SAMPLES:_0,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:_o(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:ln,depthTest:!1,depthWrite:!1})}function Mh(){return new Xt({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:_o(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:ln,depthTest:!1,depthWrite:!1})}function Sh(){return new Xt({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:_o(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:ln,depthTest:!1,depthWrite:!1})}function _o(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var go=class extends Pt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new Kr(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new hr(5,5,5),s=new Xt({name:"CubemapFromEquirect",uniforms:Li(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Yt,blending:ln});s.uniforms.tEquirect.value=t;let a=new Ke(r,s),o=t.minFilter;return t.minFilter===xn&&(t.minFilter=vt),new ya(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let s=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,r);e.setRenderTarget(s)}};function w0(i){let e=new WeakMap,t=new WeakMap,n=null;function r(h,u=!1){return h==null?null:u?a(h):s(h)}function s(h){if(h&&h.isTexture){let u=h.mapping;if(u===Sa||u===wa)if(e.has(h)){let g=e.get(h).texture;return o(g,h.mapping)}else{let g=h.image;if(g&&g.height>0){let x=new go(g.height);return x.fromEquirectangularTexture(i,h),e.set(h,x),h.addEventListener("dispose",c),o(x.texture,h.mapping)}else return null}}return h}function a(h){if(h&&h.isTexture){let u=h.mapping,g=u===Sa||u===wa,x=u===fi||u===Ii;if(g||x){let m=t.get(h),p=m!==void 0?m.texture.pmremVersion:0;if(h.isRenderTargetTexture&&h.pmremVersion!==p)return n===null&&(n=new mo(i)),m=g?n.fromEquirectangular(h,m):n.fromCubemap(h,m),m.texture.pmremVersion=h.pmremVersion,t.set(h,m),m.texture;if(m!==void 0)return m.texture;{let T=h.image;return g&&T&&T.height>0||x&&T&&l(T)?(n===null&&(n=new mo(i)),m=g?n.fromEquirectangular(h):n.fromCubemap(h),m.texture.pmremVersion=h.pmremVersion,t.set(h,m),h.addEventListener("dispose",d),m.texture):null}}}return h}function o(h,u){return u===Sa?h.mapping=fi:u===wa&&(h.mapping=Ii),h}function l(h){let u=0,g=6;for(let x=0;x<g;x++)h[x]!==void 0&&u++;return u===g}function c(h){let u=h.target;u.removeEventListener("dispose",c);let g=e.get(u);g!==void 0&&(e.delete(u),g.dispose())}function d(h){let u=h.target;u.removeEventListener("dispose",d);let g=t.get(u);g!==void 0&&(t.delete(u),g.dispose())}function f(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:r,dispose:f}}function T0(i){let e={};function t(n){if(e[n]!==void 0)return e[n];let r=i.getExtension(n);return e[n]=r,r}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let r=t(n);return r===null&&yi("WebGLRenderer: "+n+" extension not supported."),r}}}function A0(i,e,t,n){let r={},s=new WeakMap;function a(f){let h=f.target;h.index!==null&&e.remove(h.index);for(let g in h.attributes)e.remove(h.attributes[g]);h.removeEventListener("dispose",a),delete r[h.id];let u=s.get(h);u&&(e.remove(u),s.delete(h)),n.releaseStatesOfGeometry(h),h.isInstancedBufferGeometry===!0&&delete h._maxInstanceCount,t.memory.geometries--}function o(f,h){return r[h.id]===!0||(h.addEventListener("dispose",a),r[h.id]=!0,t.memory.geometries++),h}function l(f){let h=f.attributes;for(let u in h)e.update(h[u],i.ARRAY_BUFFER)}function c(f){let h=[],u=f.index,g=f.attributes.position,x=0;if(g===void 0)return;if(u!==null){let T=u.array;x=u.version;for(let R=0,y=T.length;R<y;R+=3){let M=T[R+0],S=T[R+1],E=T[R+2];h.push(M,S,S,E,E,M)}}else{let T=g.array;x=g.version;for(let R=0,y=T.length/3-1;R<y;R+=3){let M=R+0,S=R+1,E=R+2;h.push(M,S,S,E,E,M)}}let m=new(g.count>=65535?Vr:Hr)(h,1);m.version=x;let p=s.get(f);p&&e.remove(p),s.set(f,m)}function d(f){let h=s.get(f);if(h){let u=f.index;u!==null&&h.version<u.version&&c(f)}else c(f);return s.get(f)}return{get:o,update:l,getWireframeAttribute:d}}function E0(i,e,t){let n;function r(f){n=f}let s,a;function o(f){s=f.type,a=f.bytesPerElement}function l(f,h){i.drawElements(n,h,s,f*a),t.update(h,n,1)}function c(f,h,u){u!==0&&(i.drawElementsInstanced(n,h,s,f*a,u),t.update(h,n,u))}function d(f,h,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,h,0,s,f,0,u);let x=0;for(let m=0;m<u;m++)x+=h[m];t.update(x,n,1)}this.setMode=r,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=d}function R0(i){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(s/3);break;case i.LINES:t.lines+=o*(s/2);break;case i.LINE_STRIP:t.lines+=o*(s-1);break;case i.LINE_LOOP:t.lines+=o*s;break;case i.POINTS:t.points+=o*s;break;default:Ie("WebGLInfo: Unknown draw mode:",a);break}}function r(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:r,update:n}}function C0(i,e,t){let n=new WeakMap,r=new tt;function s(a,o,l){let c=a.morphTargetInfluences,d=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,f=d!==void 0?d.length:0,h=n.get(o);if(h===void 0||h.count!==f){let A=function(){E.dispose(),n.delete(o),o.removeEventListener("dispose",A)};h!==void 0&&h.texture.dispose();let u=o.morphAttributes.position!==void 0,g=o.morphAttributes.normal!==void 0,x=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],T=o.morphAttributes.color||[],R=0;u===!0&&(R=1),g===!0&&(R=2),x===!0&&(R=3);let y=o.attributes.position.count*R,M=1;y>e.maxTextureSize&&(M=Math.ceil(y/e.maxTextureSize),y=e.maxTextureSize);let S=new Float32Array(y*M*4*f),E=new zr(S,y,M,f);E.type=qt,E.needsUpdate=!0;let _=R*4;for(let L=0;L<f;L++){let D=m[L],k=p[L],G=T[L],F=y*M*4*L;for(let H=0;H<D.count;H++){let K=H*_;u===!0&&(r.fromBufferAttribute(D,H),S[F+K+0]=r.x,S[F+K+1]=r.y,S[F+K+2]=r.z,S[F+K+3]=0),g===!0&&(r.fromBufferAttribute(k,H),S[F+K+4]=r.x,S[F+K+5]=r.y,S[F+K+6]=r.z,S[F+K+7]=0),x===!0&&(r.fromBufferAttribute(G,H),S[F+K+8]=r.x,S[F+K+9]=r.y,S[F+K+10]=r.z,S[F+K+11]=G.itemSize===4?r.w:1)}}h={count:f,texture:E,size:new De(y,M)},n.set(o,h),o.addEventListener("dispose",A)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let u=0;for(let x=0;x<c.length;x++)u+=c[x];let g=o.morphTargetsRelative?1:1-u;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",h.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",h.size)}return{update:s}}function I0(i,e,t,n,r){let s=new WeakMap;function a(c){let d=r.render.frame,f=c.geometry,h=e.get(c,f);if(s.get(h)!==d&&(e.update(h),s.set(h,d)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),s.get(c)!==d&&(t.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,i.ARRAY_BUFFER),s.set(c,d))),c.isSkinnedMesh){let u=c.skeleton;s.get(u)!==d&&(u.update(),s.set(u,d))}return h}function o(){s=new WeakMap}function l(c){let d=c.target;d.removeEventListener("dispose",l),n.releaseStatesOfObject(d),t.remove(d.instanceMatrix),d.instanceColor!==null&&t.remove(d.instanceColor)}return{update:a,dispose:o}}var P0={[Sc]:"LINEAR_TONE_MAPPING",[wc]:"REINHARD_TONE_MAPPING",[Tc]:"CINEON_TONE_MAPPING",[Ac]:"ACES_FILMIC_TONE_MAPPING",[Rc]:"AGX_TONE_MAPPING",[Cc]:"NEUTRAL_TONE_MAPPING",[Ec]:"CUSTOM_TONE_MAPPING"};function L0(i,e,t,n,r,s){let a=new Pt(e,t,{type:i,depthBuffer:r,stencilBuffer:s,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),o=null,l=null,c=new wt;c.setAttribute("position",new It([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new It([0,2,0,0,2,0],2));let d=new ha({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),f=new Ke(c,d),h=new hi(-1,1,1,-1,0,1),u=null,g=null,x=!1,m,p=null,T=[],R=!1;this.setSize=function(y,M){a.setSize(y,M),o!==null&&o.setSize(y,M),l!==null&&l.setSize(y,M);for(let S=0;S<T.length;S++){let E=T[S];E.setSize&&E.setSize(y,M)}},this.setEffects=function(y){T=y,R=T.length>0&&T[0].isRenderPass===!0;let M=a.width,S=a.height;T.length>0&&o===null&&(o=new Pt(M,S,{type:Mn,depthBuffer:!1,stencilBuffer:!1}),l=new Pt(M,S,{type:Mn,depthBuffer:!1,stencilBuffer:!1}));for(let E=0;E<T.length;E++){let _=T[E];_.setSize&&_.setSize(M,S)}},this.begin=function(y,M){if(x||y.toneMapping===rn&&T.length===0)return!1;if(p=M,M!==null){let S=M.width,E=M.height;(a.width!==S||a.height!==E)&&this.setSize(S,E)}return R===!1&&y.setRenderTarget(a),m=y.toneMapping,y.toneMapping=rn,!0},this.hasRenderPass=function(){return R},this.end=function(y,M){y.toneMapping=m,x=!0;let S=a,E=o;for(let _=0;_<T.length;_++){let A=T[_];A.enabled!==!1&&(A.render(y,E,S,M),A.needsSwap!==!1&&(S=E,E=E===o?l:o))}if(u!==y.outputColorSpace||g!==y.toneMapping){u=y.outputColorSpace,g=y.toneMapping,d.defines={},Be.getTransfer(u)===je&&(d.defines.SRGB_TRANSFER="");let _=P0[g];_&&(d.defines[_]=""),d.needsUpdate=!0}d.uniforms.tDiffuse.value=S.texture,y.setRenderTarget(p),y.render(f,h),p=null,x=!1},this.isCompositing=function(){return x},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),l!==null&&l.dispose(),c.dispose(),d.dispose()}}var Gh=new Mt,jc=new li(1,1),Wh=new zr,Xh=new oa,Yh=new Kr,wh=[],Th=[],Ah=new Float32Array(16),Eh=new Float32Array(9),Rh=new Float32Array(4);function wr(i,e,t){let n=i[0];if(n<=0||n>0)return i;let r=e*t,s=wh[r];if(s===void 0&&(s=new Float32Array(r),wh[r]=s),e!==0){n.toArray(s,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(s,o)}return s}function Tt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function At(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function bo(i,e){let t=Th[e];t===void 0&&(t=new Int32Array(e),Th[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function F0(i,e){let t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function N0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Tt(t,e))return;i.uniform2fv(this.addr,e),At(t,e)}}function D0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Tt(t,e))return;i.uniform3fv(this.addr,e),At(t,e)}}function U0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Tt(t,e))return;i.uniform4fv(this.addr,e),At(t,e)}}function O0(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(Tt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),At(t,e)}else{if(Tt(t,n))return;Rh.set(n),i.uniformMatrix2fv(this.addr,!1,Rh),At(t,n)}}function B0(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(Tt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),At(t,e)}else{if(Tt(t,n))return;Eh.set(n),i.uniformMatrix3fv(this.addr,!1,Eh),At(t,n)}}function z0(i,e){let t=this.cache,n=e.elements;if(n===void 0){if(Tt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),At(t,e)}else{if(Tt(t,n))return;Ah.set(n),i.uniformMatrix4fv(this.addr,!1,Ah),At(t,n)}}function k0(i,e){let t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function H0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Tt(t,e))return;i.uniform2iv(this.addr,e),At(t,e)}}function V0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Tt(t,e))return;i.uniform3iv(this.addr,e),At(t,e)}}function G0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Tt(t,e))return;i.uniform4iv(this.addr,e),At(t,e)}}function W0(i,e){let t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function X0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Tt(t,e))return;i.uniform2uiv(this.addr,e),At(t,e)}}function Y0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Tt(t,e))return;i.uniform3uiv(this.addr,e),At(t,e)}}function q0(i,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Tt(t,e))return;i.uniform4uiv(this.addr,e),At(t,e)}}function Z0(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r);let s;this.type===i.SAMPLER_2D_SHADOW?(jc.compareFunction=t.isReversedDepthBuffer()?fo:ho,s=jc):s=Gh,t.setTexture2D(e||s,r)}function K0(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture3D(e||Xh,r)}function J0(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTextureCube(e||Yh,r)}function $0(i,e,t){let n=this.cache,r=t.allocateTextureUnit();n[0]!==r&&(i.uniform1i(this.addr,r),n[0]=r),t.setTexture2DArray(e||Wh,r)}function j0(i){switch(i){case 5126:return F0;case 35664:return N0;case 35665:return D0;case 35666:return U0;case 35674:return O0;case 35675:return B0;case 35676:return z0;case 5124:case 35670:return k0;case 35667:case 35671:return H0;case 35668:case 35672:return V0;case 35669:case 35673:return G0;case 5125:return W0;case 36294:return X0;case 36295:return Y0;case 36296:return q0;case 35678:case 36198:case 36298:case 36306:case 35682:return Z0;case 35679:case 36299:case 36307:return K0;case 35680:case 36300:case 36308:case 36293:return J0;case 36289:case 36303:case 36311:case 36292:return $0}}function Q0(i,e){i.uniform1fv(this.addr,e)}function eg(i,e){let t=wr(e,this.size,2);i.uniform2fv(this.addr,t)}function tg(i,e){let t=wr(e,this.size,3);i.uniform3fv(this.addr,t)}function ng(i,e){let t=wr(e,this.size,4);i.uniform4fv(this.addr,t)}function ig(i,e){let t=wr(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function rg(i,e){let t=wr(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function sg(i,e){let t=wr(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function ag(i,e){i.uniform1iv(this.addr,e)}function og(i,e){i.uniform2iv(this.addr,e)}function cg(i,e){i.uniform3iv(this.addr,e)}function lg(i,e){i.uniform4iv(this.addr,e)}function dg(i,e){i.uniform1uiv(this.addr,e)}function hg(i,e){i.uniform2uiv(this.addr,e)}function fg(i,e){i.uniform3uiv(this.addr,e)}function ug(i,e){i.uniform4uiv(this.addr,e)}function pg(i,e,t){let n=this.cache,r=e.length,s=bo(t,r);Tt(n,s)||(i.uniform1iv(this.addr,s),At(n,s));let a;this.type===i.SAMPLER_2D_SHADOW?a=jc:a=Gh;for(let o=0;o!==r;++o)t.setTexture2D(e[o]||a,s[o])}function mg(i,e,t){let n=this.cache,r=e.length,s=bo(t,r);Tt(n,s)||(i.uniform1iv(this.addr,s),At(n,s));for(let a=0;a!==r;++a)t.setTexture3D(e[a]||Xh,s[a])}function gg(i,e,t){let n=this.cache,r=e.length,s=bo(t,r);Tt(n,s)||(i.uniform1iv(this.addr,s),At(n,s));for(let a=0;a!==r;++a)t.setTextureCube(e[a]||Yh,s[a])}function vg(i,e,t){let n=this.cache,r=e.length,s=bo(t,r);Tt(n,s)||(i.uniform1iv(this.addr,s),At(n,s));for(let a=0;a!==r;++a)t.setTexture2DArray(e[a]||Wh,s[a])}function _g(i){switch(i){case 5126:return Q0;case 35664:return eg;case 35665:return tg;case 35666:return ng;case 35674:return ig;case 35675:return rg;case 35676:return sg;case 5124:case 35670:return ag;case 35667:case 35671:return og;case 35668:case 35672:return cg;case 35669:case 35673:return lg;case 5125:return dg;case 36294:return hg;case 36295:return fg;case 36296:return ug;case 35678:case 36198:case 36298:case 36306:case 35682:return pg;case 35679:case 36299:case 36307:return mg;case 35680:case 36300:case 36308:case 36293:return gg;case 36289:case 36303:case 36311:case 36292:return vg}}var Qc=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=j0(t.type)}},el=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=_g(t.type)}},tl=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let s=0,a=r.length;s!==a;++s){let o=r[s];o.setValue(e,t[o.id],n)}}},Jc=/(\w+)(\])?(\[|\.)?/g;function Ch(i,e){i.seq.push(e),i.map[e.id]=e}function bg(i,e,t){let n=i.name,r=n.length;for(Jc.lastIndex=0;;){let s=Jc.exec(n),a=Jc.lastIndex,o=s[1],l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===r){Ch(t,c===void 0?new Qc(o,i,e):new el(o,i,e));break}else{let f=t.map[o];f===void 0&&(f=new tl(o),Ch(t,f)),t=f}}}var Sr=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){let o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);bg(o,l,this)}let r=[],s=[];for(let a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(a):s.push(a);r.length>0&&(this.seq=r.concat(s))}setValue(e,t,n,r){let s=this.map[t];s!==void 0&&s.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let s=0,a=t.length;s!==a;++s){let o=t[s],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,s=e.length;r!==s;++r){let a=e[r];a.id in t&&n.push(a)}return n}};function Ih(i,e,t){let n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}var xg=37297,yg=0;function Mg(i,e){let t=i.split(`
`),n=[],r=Math.max(e-6,0),s=Math.min(e+6,t.length);for(let a=r;a<s;a++){let o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}var Ph=new Pe;function Sg(i){Be._getMatrix(Ph,Be.workingColorSpace,i);let e=`mat3( ${Ph.elements.map(t=>t.toFixed(4))} )`;switch(Be.getTransfer(i)){case Or:return[e,"LinearTransferOETF"];case je:return[e,"sRGBTransferOETF"];default:return Me("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function Lh(i,e,t){let n=i.getShaderParameter(e,i.COMPILE_STATUS),s=(i.getShaderInfoLog(e)||"").trim();if(n&&s==="")return"";let a=/ERROR: 0:(\d+)/.exec(s);if(a){let o=parseInt(a[1]);return t.toUpperCase()+`

`+s+`

`+Mg(i.getShaderSource(e),o)}else return s}function wg(i,e){let t=Sg(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var Tg={[Sc]:"Linear",[wc]:"Reinhard",[Tc]:"Cineon",[Ac]:"ACESFilmic",[Rc]:"AgX",[Cc]:"Neutral",[Ec]:"Custom"};function Ag(i,e){let t=Tg[e];return t===void 0?(Me("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var po=new N;function Eg(){Be.getLuminanceCoefficients(po);let i=po.x.toFixed(4),e=po.y.toFixed(4),t=po.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Rg(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(vs).join(`
`)}function Cg(i){let e=[];for(let t in i){let n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function Ig(i,e){let t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let r=0;r<n;r++){let s=i.getActiveAttrib(e,r),a=s.name,o=1;s.type===i.FLOAT_MAT2&&(o=2),s.type===i.FLOAT_MAT3&&(o=3),s.type===i.FLOAT_MAT4&&(o=4),t[a]={type:s.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function vs(i){return i!==""}function Fh(i,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Nh(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var Pg=/^[ \t]*#include +<([\w\d./]+)>/gm;function nl(i){return i.replace(Pg,Fg)}var Lg=new Map;function Fg(i,e){let t=Oe[e];if(t===void 0){let n=Lg.get(e);if(n!==void 0)t=Oe[n],Me('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return nl(t)}var Ng=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Dh(i){return i.replace(Ng,Dg)}function Dg(i,e,t,n){let r="";for(let s=parseInt(e);s<parseInt(t);s++)r+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return r}function Uh(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var Ug={[as]:"SHADOWMAP_TYPE_PCF",[mr]:"SHADOWMAP_TYPE_VSM"};function Og(i){return Ug[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Bg={[fi]:"ENVMAP_TYPE_CUBE",[Ii]:"ENVMAP_TYPE_CUBE",[os]:"ENVMAP_TYPE_CUBE_UV"};function zg(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":Bg[i.envMapMode]||"ENVMAP_TYPE_CUBE"}var kg={[Ii]:"ENVMAP_MODE_REFRACTION"};function Hg(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":kg[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Vg={[Mc]:"ENVMAP_BLENDING_MULTIPLY",[Qd]:"ENVMAP_BLENDING_MIX",[eh]:"ENVMAP_BLENDING_ADD"};function Gg(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":Vg[i.combine]||"ENVMAP_BLENDING_NONE"}function Wg(i){let e=i.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function Xg(i,e,t,n){let r=i.getContext(),s=t.defines,a=t.vertexShader,o=t.fragmentShader,l=Og(t),c=zg(t),d=Hg(t),f=Gg(t),h=Wg(t),u=Rg(t),g=Cg(s),x=r.createProgram(),m,p,T=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(vs).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(vs).join(`
`),p.length>0&&(p+=`
`)):(m=[Uh(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+d:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(vs).join(`
`),p=[Uh(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+d:"",t.envMap?"#define "+f:"",h?"#define CUBEUV_TEXEL_WIDTH "+h.texelWidth:"",h?"#define CUBEUV_TEXEL_HEIGHT "+h.texelHeight:"",h?"#define CUBEUV_MAX_MIP "+h.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==rn?"#define TONE_MAPPING":"",t.toneMapping!==rn?Oe.tonemapping_pars_fragment:"",t.toneMapping!==rn?Ag("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Oe.colorspace_pars_fragment,wg("linearToOutputTexel",t.outputColorSpace),Eg(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(vs).join(`
`)),a=nl(a),a=Fh(a,t),a=Nh(a,t),o=nl(o),o=Fh(o,t),o=Nh(o,t),a=Dh(a),o=Dh(o),t.isRawShaderMaterial!==!0&&(T=`#version 300 es
`,m=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===zc?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===zc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);let R=T+m+a,y=T+p+o,M=Ih(r,r.VERTEX_SHADER,R),S=Ih(r,r.FRAGMENT_SHADER,y);r.attachShader(x,M),r.attachShader(x,S),t.index0AttributeName!==void 0?r.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&r.bindAttribLocation(x,0,"position"),r.linkProgram(x);function E(D){if(i.debug.checkShaderErrors){let k=r.getProgramInfoLog(x)||"",G=r.getShaderInfoLog(M)||"",F=r.getShaderInfoLog(S)||"",H=k.trim(),K=G.trim(),Z=F.trim(),ne=!0,X=!0;if(r.getProgramParameter(x,r.LINK_STATUS)===!1)if(ne=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(r,x,M,S);else{let Q=Lh(r,M,"vertex"),te=Lh(r,S,"fragment");Ie("WebGLProgram: Shader Error "+r.getError()+" - VALIDATE_STATUS "+r.getProgramParameter(x,r.VALIDATE_STATUS)+`

Material Name: `+D.name+`
Material Type: `+D.type+`

Program Info Log: `+H+`
`+Q+`
`+te)}else H!==""?Me("WebGLProgram: Program Info Log:",H):(K===""||Z==="")&&(X=!1);X&&(D.diagnostics={runnable:ne,programLog:H,vertexShader:{log:K,prefix:m},fragmentShader:{log:Z,prefix:p}})}r.deleteShader(M),r.deleteShader(S),_=new Sr(r,x),A=Ig(r,x)}let _;this.getUniforms=function(){return _===void 0&&E(this),_};let A;this.getAttributes=function(){return A===void 0&&E(this),A};let L=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return L===!1&&(L=r.getProgramParameter(x,xg)),L},this.destroy=function(){n.releaseStatesOfProgram(this),r.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=yg++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=M,this.fragmentShader=S,this}var Yg=0,il=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let r=this._getShaderCacheForMaterial(e);return r.has(t)===!1&&(r.add(t),t.usedTimes++),r.has(n)===!1&&(r.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new rl(e),t.set(e,n)),n}},rl=class{constructor(e){this.id=Yg++,this.code=e,this.usedTimes=0}};function qg(i){return i===pi||i===fs||i===us}function Zg(i,e,t,n,r,s){let a=new kr,o=new il,l=new Set,c=[],d=new Map,f=n.logarithmicDepthBuffer,h=n.precision,u={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(_){return l.add(_),_===0?"uv":`uv${_}`}function x(_,A,L,D,k,G){let F=D.fog,H=k.geometry,K=_.isMeshStandardMaterial||_.isMeshLambertMaterial||_.isMeshPhongMaterial?D.environment:null,Z=_.isMeshStandardMaterial||_.isMeshLambertMaterial&&!_.envMap||_.isMeshPhongMaterial&&!_.envMap,ne=e.get(_.envMap||K,Z),X=ne&&ne.mapping===os?ne.image.height:null,Q=u[_.type];_.precision!==null&&(h=n.getMaxPrecision(_.precision),h!==_.precision&&Me("WebGLProgram.getParameters:",_.precision,"not supported, using",h,"instead."));let te=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,Ee=te!==void 0?te.length:0,Te=0;H.morphAttributes.position!==void 0&&(Te=1),H.morphAttributes.normal!==void 0&&(Te=2),H.morphAttributes.color!==void 0&&(Te=3);let at,Xe,Ze,Y;if(Q){let ct=Fn[Q];at=ct.vertexShader,Xe=ct.fragmentShader}else{at=_.vertexShader,Xe=_.fragmentShader;let ct=o.getVertexShaderStage(_),Je=o.getFragmentShaderStage(_);o.update(_,ct,Je),Ze=ct.id,Y=Je.id}let j=i.getRenderTarget(),ve=i.state.buffers.depth.getReversed(),Le=k.isInstancedMesh===!0,me=k.isBatchedMesh===!0,ze=!!_.map,St=!!_.matcap,He=!!ne,qe=!!_.aoMap,ot=!!_.lightMap,We=!!_.bumpMap&&_.wireframe===!1,ft=!!_.normalMap,Et=!!_.displacementMap,Zt=!!_.emissiveMap,ut=!!_.metalnessMap,bt=!!_.roughnessMap,P=_.anisotropy>0,Ft=_.clearcoat>0,Qe=_.dispersion>0,w=_.retroreflectivity>0,v=_.iridescence>0,U=_.sheen>0,z=_.transmission>0,W=P&&!!_.anisotropyMap,ie=Ft&&!!_.clearcoatMap,re=Ft&&!!_.clearcoatNormalMap,q=Ft&&!!_.clearcoatRoughnessMap,$=v&&!!_.iridescenceMap,se=v&&!!_.iridescenceThicknessMap,Se=U&&!!_.sheenColorMap,le=U&&!!_.sheenRoughnessMap,ae=!!_.specularMap,we=!!_.specularColorMap,Re=!!_.specularIntensityMap,Ne=z&&!!_.transmissionMap,I=z&&!!_.thicknessMap,oe=!!_.gradientMap,J=!!_.alphaMap,ce=_.alphaTest>0,ue=!!_.alphaHash,ee=!!_.extensions,Ae=rn;_.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Ae=i.toneMapping);let xe={shaderID:Q,shaderType:_.type,shaderName:_.name,vertexShader:at,fragmentShader:Xe,defines:_.defines,customVertexShaderID:Ze,customFragmentShaderID:Y,isRawShaderMaterial:_.isRawShaderMaterial===!0,glslVersion:_.glslVersion,precision:h,batching:me,batchingColor:me&&k._colorsTexture!==null,instancing:Le,instancingColor:Le&&k.instanceColor!==null,instancingMorph:Le&&k.morphTexture!==null,outputColorSpace:j===null?i.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Be.workingColorSpace,alphaToCoverage:!!_.alphaToCoverage,map:ze,matcap:St,envMap:He,envMapMode:He&&ne.mapping,envMapCubeUVHeight:X,aoMap:qe,lightMap:ot,bumpMap:We,normalMap:ft,displacementMap:Et,emissiveMap:Zt,normalMapObjectSpace:ft&&_.normalMapType===rh,normalMapTangentSpace:ft&&_.normalMapType===lo,packedNormalMap:ft&&_.normalMapType===lo&&qg(_.normalMap.format),metalnessMap:ut,roughnessMap:bt,anisotropy:P,anisotropyMap:W,clearcoat:Ft,clearcoatMap:ie,clearcoatNormalMap:re,clearcoatRoughnessMap:q,dispersion:Qe,retroreflection:w,iridescence:v,iridescenceMap:$,iridescenceThicknessMap:se,sheen:U,sheenColorMap:Se,sheenRoughnessMap:le,specularMap:ae,specularColorMap:we,specularIntensityMap:Re,transmission:z,transmissionMap:Ne,thicknessMap:I,gradientMap:oe,opaque:_.transparent===!1&&_.blending===gr&&_.alphaToCoverage===!1,alphaMap:J,alphaTest:ce,alphaHash:ue,combine:_.combine,mapUv:ze&&g(_.map.channel),aoMapUv:qe&&g(_.aoMap.channel),lightMapUv:ot&&g(_.lightMap.channel),bumpMapUv:We&&g(_.bumpMap.channel),normalMapUv:ft&&g(_.normalMap.channel),displacementMapUv:Et&&g(_.displacementMap.channel),emissiveMapUv:Zt&&g(_.emissiveMap.channel),metalnessMapUv:ut&&g(_.metalnessMap.channel),roughnessMapUv:bt&&g(_.roughnessMap.channel),anisotropyMapUv:W&&g(_.anisotropyMap.channel),clearcoatMapUv:ie&&g(_.clearcoatMap.channel),clearcoatNormalMapUv:re&&g(_.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:q&&g(_.clearcoatRoughnessMap.channel),iridescenceMapUv:$&&g(_.iridescenceMap.channel),iridescenceThicknessMapUv:se&&g(_.iridescenceThicknessMap.channel),sheenColorMapUv:Se&&g(_.sheenColorMap.channel),sheenRoughnessMapUv:le&&g(_.sheenRoughnessMap.channel),specularMapUv:ae&&g(_.specularMap.channel),specularColorMapUv:we&&g(_.specularColorMap.channel),specularIntensityMapUv:Re&&g(_.specularIntensityMap.channel),transmissionMapUv:Ne&&g(_.transmissionMap.channel),thicknessMapUv:I&&g(_.thicknessMap.channel),alphaMapUv:J&&g(_.alphaMap.channel),vertexTangents:!!H.attributes.tangent&&(ft||P),vertexNormals:!!H.attributes.normal,vertexColors:_.vertexColors,vertexAlphas:_.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,pointsUvs:k.isPoints===!0&&!!H.attributes.uv&&(ze||J),fog:!!F,useFog:_.fog===!0,fogExp2:!!F&&F.isFogExp2,flatShading:_.wireframe===!1&&(_.flatShading===!0||H.attributes.normal===void 0&&ft===!1&&(_.isMeshLambertMaterial||_.isMeshPhongMaterial||_.isMeshStandardMaterial||_.isMeshPhysicalMaterial)),sizeAttenuation:_.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:ve,skinning:k.isSkinnedMesh===!0,hasPositionAttribute:H.attributes.position!==void 0,morphTargets:H.morphAttributes.position!==void 0,morphNormals:H.morphAttributes.normal!==void 0,morphColors:H.morphAttributes.color!==void 0,morphTargetsCount:Ee,morphTextureStride:Te,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:G.length,numClippingPlanes:s.numPlanes,numClipIntersection:s.numIntersection,dithering:_.dithering,shadowMapEnabled:i.shadowMap.enabled&&L.length>0,shadowMapType:i.shadowMap.type,toneMapping:Ae,decodeVideoTexture:ze&&_.map.isVideoTexture===!0&&Be.getTransfer(_.map.colorSpace)===je,decodeVideoTextureEmissive:Zt&&_.emissiveMap.isVideoTexture===!0&&Be.getTransfer(_.emissiveMap.colorSpace)===je,premultipliedAlpha:_.premultipliedAlpha,doubleSided:_.side===Qt,flipSided:_.side===Yt,useDepthPacking:_.depthPacking>=0,depthPacking:_.depthPacking||0,index0AttributeName:_.index0AttributeName,extensionClipCullDistance:ee&&_.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ee&&_.extensions.multiDraw===!0||me)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:_.customProgramCacheKey()};return xe.vertexUv1s=l.has(1),xe.vertexUv2s=l.has(2),xe.vertexUv3s=l.has(3),l.clear(),xe}function m(_){let A=[];if(_.shaderID?A.push(_.shaderID):(A.push(_.customVertexShaderID),A.push(_.customFragmentShaderID)),_.defines!==void 0)for(let L in _.defines)A.push(L),A.push(_.defines[L]);return _.isRawShaderMaterial===!1&&(p(A,_),T(A,_),A.push(i.outputColorSpace)),A.push(_.customProgramCacheKey),A.join()}function p(_,A){_.push(A.precision),_.push(A.outputColorSpace),_.push(A.envMapMode),_.push(A.envMapCubeUVHeight),_.push(A.mapUv),_.push(A.alphaMapUv),_.push(A.lightMapUv),_.push(A.aoMapUv),_.push(A.bumpMapUv),_.push(A.normalMapUv),_.push(A.displacementMapUv),_.push(A.emissiveMapUv),_.push(A.metalnessMapUv),_.push(A.roughnessMapUv),_.push(A.anisotropyMapUv),_.push(A.clearcoatMapUv),_.push(A.clearcoatNormalMapUv),_.push(A.clearcoatRoughnessMapUv),_.push(A.iridescenceMapUv),_.push(A.iridescenceThicknessMapUv),_.push(A.sheenColorMapUv),_.push(A.sheenRoughnessMapUv),_.push(A.specularMapUv),_.push(A.specularColorMapUv),_.push(A.specularIntensityMapUv),_.push(A.transmissionMapUv),_.push(A.thicknessMapUv),_.push(A.combine),_.push(A.fogExp2),_.push(A.sizeAttenuation),_.push(A.morphTargetsCount),_.push(A.morphAttributeCount),_.push(A.numSunLights),_.push(A.numDirLights),_.push(A.numPointLights),_.push(A.numSpotLights),_.push(A.numSpotLightMaps),_.push(A.numHemiLights),_.push(A.numRectAreaLights),_.push(A.numSunLightShadows),_.push(A.numDirLightShadows),_.push(A.numPointLightShadows),_.push(A.numSpotLightShadows),_.push(A.numSpotLightShadowsWithMaps),_.push(A.numLightProbes),_.push(A.shadowMapType),_.push(A.toneMapping),_.push(A.numClippingPlanes),_.push(A.numClipIntersection),_.push(A.depthPacking)}function T(_,A){a.disableAll(),A.instancing&&a.enable(0),A.instancingColor&&a.enable(1),A.instancingMorph&&a.enable(2),A.matcap&&a.enable(3),A.envMap&&a.enable(4),A.normalMapObjectSpace&&a.enable(5),A.normalMapTangentSpace&&a.enable(6),A.clearcoat&&a.enable(7),A.iridescence&&a.enable(8),A.alphaTest&&a.enable(9),A.vertexColors&&a.enable(10),A.vertexAlphas&&a.enable(11),A.vertexUv1s&&a.enable(12),A.vertexUv2s&&a.enable(13),A.vertexUv3s&&a.enable(14),A.vertexTangents&&a.enable(15),A.anisotropy&&a.enable(16),A.alphaHash&&a.enable(17),A.batching&&a.enable(18),A.dispersion&&a.enable(19),A.retroreflection&&a.enable(24),A.batchingColor&&a.enable(20),A.gradientMap&&a.enable(21),A.packedNormalMap&&a.enable(22),A.vertexNormals&&a.enable(23),_.push(a.mask),a.disableAll(),A.fog&&a.enable(0),A.useFog&&a.enable(1),A.flatShading&&a.enable(2),A.logarithmicDepthBuffer&&a.enable(3),A.reversedDepthBuffer&&a.enable(4),A.skinning&&a.enable(5),A.morphTargets&&a.enable(6),A.morphNormals&&a.enable(7),A.morphColors&&a.enable(8),A.premultipliedAlpha&&a.enable(9),A.shadowMapEnabled&&a.enable(10),A.doubleSided&&a.enable(11),A.flipSided&&a.enable(12),A.useDepthPacking&&a.enable(13),A.dithering&&a.enable(14),A.transmission&&a.enable(15),A.sheen&&a.enable(16),A.opaque&&a.enable(17),A.pointsUvs&&a.enable(18),A.decodeVideoTexture&&a.enable(19),A.decodeVideoTextureEmissive&&a.enable(20),A.alphaToCoverage&&a.enable(21),A.numLightProbeGrids>0&&a.enable(22),A.hasPositionAttribute&&a.enable(23),_.push(a.mask)}function R(_){let A=u[_.type],L;if(A){let D=Fn[A];L=vh.clone(D.uniforms)}else L=_.uniforms;return L}function y(_,A){let L=d.get(A);return L!==void 0?++L.usedTimes:(L=new Xg(i,A,_,r),c.push(L),d.set(A,L)),L}function M(_){if(--_.usedTimes===0){let A=c.indexOf(_);c[A]=c[c.length-1],c.pop(),d.delete(_.cacheKey),_.destroy()}}function S(_){o.remove(_)}function E(){o.dispose()}return{getParameters:x,getProgramCacheKey:m,getUniforms:R,acquireProgram:y,releaseProgram:M,releaseShaderCache:S,programs:c,dispose:E}}function Kg(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function r(a,o,l){i.get(a)[o]=l}function s(){i=new WeakMap}return{has:e,get:t,remove:n,update:r,dispose:s}}function Jg(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function Oh(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Bh(){let i=[],e=0,t=[],n=[],r=[];function s(){e=0,t.length=0,n.length=0,r.length=0}function a(h){let u=0;return h.isInstancedMesh&&(u+=2),h.isSkinnedMesh&&(u+=1),u}function o(h,u,g,x,m,p){let T=i[e];return T===void 0?(T={id:h.id,object:h,geometry:u,material:g,materialVariant:a(h),groupOrder:x,renderOrder:h.renderOrder,z:m,group:p},i[e]=T):(T.id=h.id,T.object=h,T.geometry=u,T.material=g,T.materialVariant=a(h),T.groupOrder=x,T.renderOrder=h.renderOrder,T.z=m,T.group=p),e++,T}function l(h,u,g,x,m,p,T){T.reversedDepth===!0&&(m=-m);let R=o(h,u,g,x,m,p);g.transmission>0?n.push(R):g.transparent===!0?r.push(R):t.push(R)}function c(h,u,g,x,m,p){let T=o(h,u,g,x,m,p);g.transmission>0?n.unshift(T):g.transparent===!0?r.unshift(T):t.unshift(T)}function d(h,u){t.length>1&&t.sort(h||Jg),n.length>1&&n.sort(u||Oh),r.length>1&&r.sort(u||Oh)}function f(){for(let h=e,u=i.length;h<u;h++){let g=i[h];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:r,init:s,push:l,unshift:c,finish:f,sort:d}}function $g(){let i=new WeakMap;function e(n,r){let s=i.get(n),a;return s===void 0?(a=new Bh,i.set(n,[a])):r>=s.length?(a=new Bh,s.push(a)):a=s[r],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function jg(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new N,color:new Ce};break;case"SpotLight":t={position:new N,direction:new N,color:new Ce,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new N,color:new Ce,distance:0,decay:0};break;case"HemisphereLight":t={direction:new N,skyColor:new Ce,groundColor:new Ce};break;case"RectAreaLight":t={color:new Ce,position:new N,halfWidth:new N,halfHeight:new N};break}return i[e.id]=t,t}}}function Qg(){let i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new De,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}var ev=0;function tv(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function nv(i){let e=new jg,t=Qg(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new N);let r=new N,s=new Fe,a=new Fe;function o(c){let d=0,f=0,h=0;for(let k=0;k<9;k++)n.probe[k].set(0,0,0);let u=0,g=0,x=0,m=0,p=0,T=0,R=0,y=0,M=0,S=0,E=0,_=0,A=0,L=0;c.sort(tv);for(let k=0,G=c.length;k<G;k++){let F=c[k],H=F.color,K=F.intensity,Z=F.distance,ne=null;if(F.shadow&&F.shadow.map&&(F.shadow.map.texture.format===pi?ne=F.shadow.map.texture:ne=F.shadow.map.depthTexture||F.shadow.map.texture),F.isAmbientLight)d+=H.r*K,f+=H.g*K,h+=H.b*K;else if(F.isLightProbe){for(let X=0;X<9;X++)n.probe[X].addScaledVector(F.sh.coefficients[X],K);L++}else if(F.isSunLight){let X=e.get(F);if(X.color.copy(F.color).multiplyScalar(F.intensity),F.castShadow){let Q=F.shadow,te=t.get(F);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize.copy(Q.mapSize).multiply(Q.getFrameExtents()),n.sunShadow[g]=te,n.sunShadowMap[g]=ne;let Ee=Q.getViewportCount();for(let Te=0;Te<Ee;Te++)n.sunShadowMatrix[x+Te]=Q.getMatrix(Te),n.sunShadowCascade[x+Te]=Q._cascadeData[Te];x+=Ee,g++}n.sun[u]=X,u++}else if(F.isDirectionalLight){let X=e.get(F);if(X.color.copy(F.color).multiplyScalar(F.intensity),F.castShadow){let Q=F.shadow,te=t.get(F);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize=Q.mapSize,n.directionalShadow[m]=te,n.directionalShadowMap[m]=ne,n.directionalShadowMatrix[m]=F.shadow.matrix,M++}n.directional[m]=X,m++}else if(F.isSpotLight){let X=e.get(F);X.position.setFromMatrixPosition(F.matrixWorld),X.color.copy(H).multiplyScalar(K),X.distance=Z,X.coneCos=Math.cos(F.angle),X.penumbraCos=Math.cos(F.angle*(1-F.penumbra)),X.decay=F.decay,n.spot[T]=X;let Q=F.shadow;if(F.map&&(n.spotLightMap[_]=F.map,_++,Q.updateMatrices(F),F.castShadow&&A++),n.spotLightMatrix[T]=Q.matrix,F.castShadow){let te=t.get(F);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize=Q.mapSize,n.spotShadow[T]=te,n.spotShadowMap[T]=ne,E++}T++}else if(F.isRectAreaLight){let X=e.get(F);X.color.copy(H).multiplyScalar(K),X.halfWidth.set(F.width*.5,0,0),X.halfHeight.set(0,F.height*.5,0),n.rectArea[R]=X,R++}else if(F.isPointLight){let X=e.get(F);if(X.color.copy(F.color).multiplyScalar(F.intensity),X.distance=F.distance,X.decay=F.decay,F.castShadow){let Q=F.shadow,te=t.get(F);te.shadowIntensity=Q.intensity,te.shadowBias=Q.bias,te.shadowNormalBias=Q.normalBias,te.shadowRadius=Q.radius,te.shadowMapSize=Q.mapSize,te.shadowCameraNear=Q.camera.near,te.shadowCameraFar=Q.camera.far,n.pointShadow[p]=te,n.pointShadowMap[p]=ne,n.pointShadowMatrix[p]=F.shadow.matrix,S++}n.point[p]=X,p++}else if(F.isHemisphereLight){let X=e.get(F);X.skyColor.copy(F.color).multiplyScalar(K),X.groundColor.copy(F.groundColor).multiplyScalar(K),n.hemi[y]=X,y++}}R>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=de.LTC_FLOAT_1,n.rectAreaLTC2=de.LTC_FLOAT_2):(n.rectAreaLTC1=de.LTC_HALF_1,n.rectAreaLTC2=de.LTC_HALF_2)),n.ambient[0]=d,n.ambient[1]=f,n.ambient[2]=h;let D=n.hash;(D.sunLength!==u||D.directionalLength!==m||D.pointLength!==p||D.spotLength!==T||D.rectAreaLength!==R||D.hemiLength!==y||D.numSunShadows!==g||D.numDirectionalShadows!==M||D.numPointShadows!==S||D.numSpotShadows!==E||D.numSpotMaps!==_||D.numLightProbes!==L)&&(n.sun.length=u,n.directional.length=m,n.spot.length=T,n.rectArea.length=R,n.point.length=p,n.hemi.length=y,n.sunShadow.length=g,n.sunShadowMap.length=g,n.sunShadowMatrix.length=x,n.sunShadowCascade.length=x,n.directionalShadow.length=M,n.directionalShadowMap.length=M,n.directionalShadowMatrix.length=M,n.pointShadow.length=S,n.pointShadowMap.length=S,n.pointShadowMatrix.length=S,n.spotShadow.length=E,n.spotShadowMap.length=E,n.spotLightMatrix.length=E+_-A,n.spotLightMap.length=_,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=L,D.sunLength=u,D.directionalLength=m,D.pointLength=p,D.spotLength=T,D.rectAreaLength=R,D.hemiLength=y,D.numSunShadows=g,D.numDirectionalShadows=M,D.numPointShadows=S,D.numSpotShadows=E,D.numSpotMaps=_,D.numLightProbes=L,n.version=ev++)}function l(c,d){let f=0,h=0,u=0,g=0,x=0,m=0,p=d.matrixWorldInverse;for(let T=0,R=c.length;T<R;T++){let y=c[T];if(y.isSunLight){let M=n.sun[f];M.direction.setFromMatrixPosition(y.matrixWorld),M.direction.transformDirection(p),f++}else if(y.isDirectionalLight){let M=n.directional[h];M.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),M.direction.sub(r),M.direction.transformDirection(p),h++}else if(y.isSpotLight){let M=n.spot[g];M.position.setFromMatrixPosition(y.matrixWorld),M.position.applyMatrix4(p),M.direction.setFromMatrixPosition(y.matrixWorld),r.setFromMatrixPosition(y.target.matrixWorld),M.direction.sub(r),M.direction.transformDirection(p),g++}else if(y.isRectAreaLight){let M=n.rectArea[x];M.position.setFromMatrixPosition(y.matrixWorld),M.position.applyMatrix4(p),a.identity(),s.copy(y.matrixWorld),s.premultiply(p),a.extractRotation(s),M.halfWidth.set(y.width*.5,0,0),M.halfHeight.set(0,y.height*.5,0),M.halfWidth.applyMatrix4(a),M.halfHeight.applyMatrix4(a),x++}else if(y.isPointLight){let M=n.point[u];M.position.setFromMatrixPosition(y.matrixWorld),M.position.applyMatrix4(p),u++}else if(y.isHemisphereLight){let M=n.hemi[m];M.direction.setFromMatrixPosition(y.matrixWorld),M.direction.transformDirection(p),m++}}}return{setup:o,setupView:l,state:n}}function zh(i){let e=new nv(i),t=[],n=[],r=[];function s(h){f.camera=h,t.length=0,n.length=0,r.length=0}function a(h){t.push(h)}function o(h){n.push(h)}function l(h){r.push(h)}function c(){e.setup(t)}function d(h){e.setupView(t,h)}let f={lightsArray:t,shadowsArray:n,lightProbeGridArray:r,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:s,state:f,setupLights:c,setupLightsView:d,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function iv(i){let e=new WeakMap;function t(r,s=0){let a=e.get(r),o;return a===void 0?(o=new zh(i),e.set(r,[o])):s>=a.length?(o=new zh(i),a.push(o)):o=a[s],o}function n(){e=new WeakMap}return{get:t,dispose:n}}var rv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,sv=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,av=[new N(1,0,0),new N(-1,0,0),new N(0,1,0),new N(0,-1,0),new N(0,0,1),new N(0,0,-1)],ov=[new N(0,-1,0),new N(0,-1,0),new N(0,0,1),new N(0,0,-1),new N(0,-1,0),new N(0,-1,0)],kh=new Fe,gs=new N,$c=new N;function cv(i,e,t){let n=new cr,r=new De,s=new De,a=new tt,o=new fa,l=new ua,c={},d=t.maxTextureSize,f={[Pn]:Yt,[Yt]:Pn,[Qt]:Qt},h=new Xt({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new De},radius:{value:4}},vertexShader:rv,fragmentShader:sv}),u=h.clone();u.defines.HORIZONTAL_PASS=1;let g=new wt;g.setAttribute("position",new pt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new Ke(g,h),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=as;let p=this.type;this.render=function(S,E,_){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||S.length===0)return;this.type===Nd&&(Me("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=as);let A=i.getRenderTarget(),L=i.getActiveCubeFace(),D=i.getActiveMipmapLevel(),k=i.state;k.setBlending(ln),k.buffers.depth.getReversed()===!0?k.buffers.color.setClear(0,0,0,0):k.buffers.color.setClear(1,1,1,1),k.buffers.depth.setTest(!0),k.setScissorTest(!1);let G=p!==this.type;G&&E.traverse(function(F){F.material&&(Array.isArray(F.material)?F.material.forEach(H=>H.needsUpdate=!0):F.material.needsUpdate=!0)});for(let F=0,H=S.length;F<H;F++){let K=S[F],Z=K.shadow;if(Z===void 0){Me("WebGLShadowMap:",K,"has no shadow.");continue}if(Z.autoUpdate===!1&&Z.needsUpdate===!1)continue;r.copy(Z.mapSize);let ne=Z.getFrameExtents();r.multiply(ne),s.copy(Z.mapSize),(r.x>d||r.y>d)&&(r.x>d&&(s.x=Math.floor(d/ne.x),r.x=s.x*ne.x,Z.mapSize.x=s.x),r.y>d&&(s.y=Math.floor(d/ne.y),r.y=s.y*ne.y,Z.mapSize.y=s.y));let X=i.state.buffers.depth.getReversed();if(Z.camera._reversedDepth=X,Z.map===null||G===!0){if(Z.map!==null&&(Z.map.depthTexture!==null&&(Z.map.depthTexture.dispose(),Z.map.depthTexture=null),Z.map.dispose()),this.type===mr){if(K.isPointLight){Me("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}Z.map=new Pt(r.x,r.y,{format:pi,type:Mn,minFilter:vt,magFilter:vt,generateMipmaps:!1}),Z.map.texture.name=K.name+".shadowMap",Z.map.depthTexture=new li(r.x,r.y,qt),Z.map.depthTexture.name=K.name+".shadowMapDepth",Z.map.depthTexture.format=En,Z.map.depthTexture.compareFunction=null,Z.map.depthTexture.minFilter=st,Z.map.depthTexture.magFilter=st}else K.isPointLight?(Z.map=new go(r.x),Z.map.depthTexture=new da(r.x,yn)):(Z.map=new Pt(r.x,r.y),Z.map.depthTexture=new li(r.x,r.y,yn)),Z.map.depthTexture.name=K.name+".shadowMap",Z.map.depthTexture.format=En,this.type===as?(Z.map.depthTexture.compareFunction=X?fo:ho,Z.map.depthTexture.minFilter=vt,Z.map.depthTexture.magFilter=vt):(Z.map.depthTexture.compareFunction=null,Z.map.depthTexture.minFilter=st,Z.map.depthTexture.magFilter=st);Z.camera.updateProjectionMatrix()}Z.map.isWebGLCubeRenderTarget!==!0&&(Z.map.width!==r.x||Z.map.height!==r.y)&&Z.map.setSize(r.x,r.y);let Q=Z.map.isWebGLCubeRenderTarget?6:Z.getViewportCount();K.isPointLight!==!0&&Z.updateMatrices(K,_);for(let te=0;te<Q;te++){let Ee=Z.getCamera(te);if(K.isPointLight){let Te=Z.camera,at=Z.matrix,Xe=K.distance||Te.far;Xe!==Te.far&&(Te.far=Xe,Te.updateProjectionMatrix()),gs.setFromMatrixPosition(K.matrixWorld),Te.position.copy(gs),$c.copy(Te.position),$c.add(av[te]),Te.up.copy(ov[te]),Te.lookAt($c),Te.updateMatrixWorld(),at.makeTranslation(-gs.x,-gs.y,-gs.z),kh.multiplyMatrices(Te.projectionMatrix,Te.matrixWorldInverse),Z._frustum.setFromProjectionMatrix(kh,Te.coordinateSystem,Te.reversedDepth)}if(Z.map.isWebGLCubeRenderTarget)i.setRenderTarget(Z.map,te),i.clear();else{te===0&&(i.setRenderTarget(Z.map),i.clear());let Te=Z.getViewport(te);a.set(s.x*Te.x,s.y*Te.y,s.x*Te.z,s.y*Te.w),k.viewport(a)}n=Z.getFrustum(te),y(E,_,Ee,K,this.type)}Z.isPointLightShadow!==!0&&this.type===mr&&T(Z,_),Z.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(A,L,D)};function T(S,E){let _=e.update(x);h.defines.VSM_SAMPLES!==S.blurSamples&&(h.defines.VSM_SAMPLES=S.blurSamples,u.defines.VSM_SAMPLES=S.blurSamples,h.needsUpdate=!0,u.needsUpdate=!0),S.mapPass===null?S.mapPass=new Pt(r.x,r.y,{format:pi,type:Mn}):(S.mapPass.width!==S.map.width||S.mapPass.height!==S.map.height)&&S.mapPass.setSize(S.map.width,S.map.height),h.uniforms.shadow_pass.value=S.map.depthTexture,h.uniforms.resolution.value.set(S.map.width,S.map.height),h.uniforms.radius.value=S.radius,i.setRenderTarget(S.mapPass),i.clear(),i.renderBufferDirect(E,null,_,h,x,null),u.uniforms.shadow_pass.value=S.mapPass.texture,u.uniforms.resolution.value.set(S.map.width,S.map.height),u.uniforms.radius.value=S.radius,i.setRenderTarget(S.map),i.clear(),i.renderBufferDirect(E,null,_,u,x,null)}function R(S,E,_,A){let L=null,D=_.isPointLight===!0?S.customDistanceMaterial:S.customDepthMaterial;if(D!==void 0)L=D;else if(L=_.isPointLight===!0?l:o,i.localClippingEnabled&&E.clipShadows===!0&&Array.isArray(E.clippingPlanes)&&E.clippingPlanes.length!==0||E.displacementMap&&E.displacementScale!==0||E.alphaMap&&E.alphaTest>0||E.map&&E.alphaTest>0||E.alphaToCoverage===!0){let k=L.uuid,G=E.uuid,F=c[k];F===void 0&&(F={},c[k]=F);let H=F[G];H===void 0&&(H=L.clone(),F[G]=H,E.addEventListener("dispose",M)),L=H}if(L.visible=E.visible,L.wireframe=E.wireframe,A===mr?L.side=E.shadowSide!==null?E.shadowSide:E.side:L.side=E.shadowSide!==null?E.shadowSide:f[E.side],L.alphaMap=E.alphaMap,L.alphaTest=E.alphaToCoverage===!0?.5:E.alphaTest,L.map=E.map,L.clipShadows=E.clipShadows,L.clippingPlanes=E.clippingPlanes,L.clipIntersection=E.clipIntersection,L.displacementMap=E.displacementMap,L.displacementScale=E.displacementScale,L.displacementBias=E.displacementBias,L.wireframeLinewidth=E.wireframeLinewidth,L.linewidth=E.linewidth,_.isPointLight===!0&&L.isMeshDistanceMaterial===!0){let k=i.properties.get(L);k.light=_}return L}function y(S,E,_,A,L){if(S.visible===!1)return;if(S.layers.test(E.layers)&&(S.isMesh||S.isLine||S.isPoints)&&(S.castShadow||S.receiveShadow&&L===mr)&&(!S.frustumCulled||S.intersectsFrustum(n))){S.modelViewMatrix.multiplyMatrices(_.matrixWorldInverse,S.matrixWorld);let G=e.update(S),F=S.material;if(Array.isArray(F)){let H=G.groups;for(let K=0,Z=H.length;K<Z;K++){let ne=H[K],X=F[ne.materialIndex];if(X&&X.visible){let Q=R(S,X,A,L);S.onBeforeShadow(i,S,E,_,G,Q,ne),i.renderBufferDirect(_,null,G,Q,S,ne),S.onAfterShadow(i,S,E,_,G,Q,ne)}}}else if(F.visible){let H=R(S,F,A,L);S.onBeforeShadow(i,S,E,_,G,H,null),i.renderBufferDirect(_,null,G,H,S,null),S.onAfterShadow(i,S,E,_,G,H,null)}}let k=S.children;for(let G=0,F=k.length;G<F;G++)y(k[G],E,_,A,L)}function M(S){S.target.removeEventListener("dispose",M);for(let _ in c){let A=c[_],L=S.target.uuid;L in A&&(A[L].dispose(),delete A[L])}}}function lv(i,e){function t(){let I=!1,oe=new tt,J=null,ce=new tt(0,0,0,0);return{setMask:function(ue){J!==ue&&!I&&(i.colorMask(ue,ue,ue,ue),J=ue)},setLocked:function(ue){I=ue},setClear:function(ue,ee,Ae,xe,ct){ct===!0&&(ue*=xe,ee*=xe,Ae*=xe),oe.set(ue,ee,Ae,xe),ce.equals(oe)===!1&&(i.clearColor(ue,ee,Ae,xe),ce.copy(oe))},reset:function(){I=!1,J=null,ce.set(-1,0,0,0)}}}function n(){let I=!1,oe=!1,J=null,ce=null,ue=null;return{setReversed:function(ee){if(oe!==ee){let Ae=e.get("EXT_clip_control");ee?Ae.clipControlEXT(Ae.LOWER_LEFT_EXT,Ae.ZERO_TO_ONE_EXT):Ae.clipControlEXT(Ae.LOWER_LEFT_EXT,Ae.NEGATIVE_ONE_TO_ONE_EXT),oe=ee;let xe=ue;ue=null,this.setClear(xe)}},getReversed:function(){return oe},setTest:function(ee){ee?j(i.DEPTH_TEST):ve(i.DEPTH_TEST)},setMask:function(ee){J!==ee&&!I&&(i.depthMask(ee),J=ee)},setFunc:function(ee){if(oe&&(ee=mh[ee]),ce!==ee){switch(ee){case js:i.depthFunc(i.NEVER);break;case Qs:i.depthFunc(i.ALWAYS);break;case ea:i.depthFunc(i.LESS);break;case ji:i.depthFunc(i.LEQUAL);break;case ta:i.depthFunc(i.EQUAL);break;case na:i.depthFunc(i.GEQUAL);break;case ia:i.depthFunc(i.GREATER);break;case ra:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}ce=ee}},setLocked:function(ee){I=ee},setClear:function(ee){ue!==ee&&(ue=ee,oe&&(ee=1-ee),i.clearDepth(ee))},reset:function(){I=!1,J=null,ce=null,ue=null,oe=!1}}}function r(){let I=!1,oe=null,J=null,ce=null,ue=null,ee=null,Ae=null,xe=null,ct=null;return{setTest:function(Je){I||(Je?j(i.STENCIL_TEST):ve(i.STENCIL_TEST))},setMask:function(Je){oe!==Je&&!I&&(i.stencilMask(Je),oe=Je)},setFunc:function(Je,hn,Sn){(J!==Je||ce!==hn||ue!==Sn)&&(i.stencilFunc(Je,hn,Sn),J=Je,ce=hn,ue=Sn)},setOp:function(Je,hn,Sn){(ee!==Je||Ae!==hn||xe!==Sn)&&(i.stencilOp(Je,hn,Sn),ee=Je,Ae=hn,xe=Sn)},setLocked:function(Je){I=Je},setClear:function(Je){ct!==Je&&(i.clearStencil(Je),ct=Je)},reset:function(){I=!1,oe=null,J=null,ce=null,ue=null,ee=null,Ae=null,xe=null,ct=null}}}let s=new t,a=new n,o=new r,l=new WeakMap,c=new WeakMap,d={},f={},h={},u=new WeakMap,g=[],x=null,m=!1,p=null,T=null,R=null,y=null,M=null,S=null,E=null,_=new Ce(0,0,0),A=0,L=!1,D=null,k=null,G=null,F=null,H=null,K=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS),Z=!1,ne=0,X=i.getParameter(i.VERSION);X.indexOf("WebGL")!==-1?(ne=parseFloat(/^WebGL (\d)/.exec(X)[1]),Z=ne>=1):X.indexOf("OpenGL ES")!==-1&&(ne=parseFloat(/^OpenGL ES (\d)/.exec(X)[1]),Z=ne>=2);let Q=null,te={},Ee=i.getParameter(i.SCISSOR_BOX),Te=i.getParameter(i.VIEWPORT),at=new tt().fromArray(Ee),Xe=new tt().fromArray(Te);function Ze(I,oe,J,ce){let ue=new Uint8Array(4),ee=i.createTexture();i.bindTexture(I,ee),i.texParameteri(I,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(I,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ae=0;Ae<J;Ae++)I===i.TEXTURE_3D||I===i.TEXTURE_2D_ARRAY?i.texImage3D(oe,0,i.RGBA,1,1,ce,0,i.RGBA,i.UNSIGNED_BYTE,ue):i.texImage2D(oe+Ae,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,ue);return ee}let Y={};Y[i.TEXTURE_2D]=Ze(i.TEXTURE_2D,i.TEXTURE_2D,1),Y[i.TEXTURE_CUBE_MAP]=Ze(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),Y[i.TEXTURE_2D_ARRAY]=Ze(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),Y[i.TEXTURE_3D]=Ze(i.TEXTURE_3D,i.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),j(i.DEPTH_TEST),a.setFunc(ji),We(!1),ft(gc),j(i.CULL_FACE),qe(ln);function j(I){d[I]!==!0&&(i.enable(I),d[I]=!0)}function ve(I){d[I]!==!1&&(i.disable(I),d[I]=!1)}function Le(I,oe){return h[I]!==oe?(i.bindFramebuffer(I,oe),h[I]=oe,I===i.DRAW_FRAMEBUFFER&&(h[i.FRAMEBUFFER]=oe),I===i.FRAMEBUFFER&&(h[i.DRAW_FRAMEBUFFER]=oe),!0):!1}function me(I,oe){let J=g,ce=!1;if(I){J=u.get(oe),J===void 0&&(J=[],u.set(oe,J));let ue=I.textures;if(J.length!==ue.length||J[0]!==i.COLOR_ATTACHMENT0){for(let ee=0,Ae=ue.length;ee<Ae;ee++)J[ee]=i.COLOR_ATTACHMENT0+ee;J.length=ue.length,ce=!0}}else J[0]!==i.BACK&&(J[0]=i.BACK,ce=!0);ce&&i.drawBuffers(J)}function ze(I){return x!==I?(i.useProgram(I),x=I,!0):!1}let St={[Ci]:i.FUNC_ADD,[Ud]:i.FUNC_SUBTRACT,[Od]:i.FUNC_REVERSE_SUBTRACT};St[Bd]=i.MIN,St[zd]=i.MAX;let He={[kd]:i.ZERO,[Hd]:i.ONE,[Vd]:i.SRC_COLOR,[xc]:i.SRC_ALPHA,[Zd]:i.SRC_ALPHA_SATURATE,[Yd]:i.DST_COLOR,[Wd]:i.DST_ALPHA,[Gd]:i.ONE_MINUS_SRC_COLOR,[yc]:i.ONE_MINUS_SRC_ALPHA,[qd]:i.ONE_MINUS_DST_COLOR,[Xd]:i.ONE_MINUS_DST_ALPHA,[Kd]:i.CONSTANT_COLOR,[Jd]:i.ONE_MINUS_CONSTANT_COLOR,[$d]:i.CONSTANT_ALPHA,[jd]:i.ONE_MINUS_CONSTANT_ALPHA};function qe(I,oe,J,ce,ue,ee,Ae,xe,ct,Je){if(I===ln){m===!0&&(ve(i.BLEND),m=!1);return}if(m===!1&&(j(i.BLEND),m=!0),I!==Dd){if(I!==p||Je!==L){if((T!==Ci||M!==Ci)&&(i.blendEquation(i.FUNC_ADD),T=Ci,M=Ci),Je)switch(I){case gr:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case vc:i.blendFunc(i.ONE,i.ONE);break;case _c:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case bc:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:Ie("WebGLState: Invalid blending: ",I);break}else switch(I){case gr:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case vc:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case _c:Ie("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case bc:Ie("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ie("WebGLState: Invalid blending: ",I);break}R=null,y=null,S=null,E=null,_.set(0,0,0),A=0,p=I,L=Je}return}ue=ue||oe,ee=ee||J,Ae=Ae||ce,(oe!==T||ue!==M)&&(i.blendEquationSeparate(St[oe],St[ue]),T=oe,M=ue),(J!==R||ce!==y||ee!==S||Ae!==E)&&(i.blendFuncSeparate(He[J],He[ce],He[ee],He[Ae]),R=J,y=ce,S=ee,E=Ae),(xe.equals(_)===!1||ct!==A)&&(i.blendColor(xe.r,xe.g,xe.b,ct),_.copy(xe),A=ct),p=I,L=!1}function ot(I,oe){I.side===Qt?ve(i.CULL_FACE):j(i.CULL_FACE);let J=I.side===Yt;oe&&(J=!J),We(J),I.blending===gr&&I.transparent===!1?qe(ln):qe(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),a.setFunc(I.depthFunc),a.setTest(I.depthTest),a.setMask(I.depthWrite),s.setMask(I.colorWrite);let ce=I.stencilWrite;o.setTest(ce),ce&&(o.setMask(I.stencilWriteMask),o.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),o.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),Zt(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?j(i.SAMPLE_ALPHA_TO_COVERAGE):ve(i.SAMPLE_ALPHA_TO_COVERAGE)}function We(I){D!==I&&(I?i.frontFace(i.CW):i.frontFace(i.CCW),D=I)}function ft(I){I!==Ld?(j(i.CULL_FACE),I!==k&&(I===gc?i.cullFace(i.BACK):I===Fd?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):ve(i.CULL_FACE),k=I}function Et(I){I!==G&&(Z&&i.lineWidth(I),G=I)}function Zt(I,oe,J){I?(j(i.POLYGON_OFFSET_FILL),(F!==oe||H!==J)&&(F=oe,H=J,a.getReversed()&&(oe=-oe),i.polygonOffset(oe,J))):ve(i.POLYGON_OFFSET_FILL)}function ut(I){I?j(i.SCISSOR_TEST):ve(i.SCISSOR_TEST)}function bt(I){I===void 0&&(I=i.TEXTURE0+K-1),Q!==I&&(i.activeTexture(I),Q=I)}function P(I,oe,J){J===void 0&&(Q===null?J=i.TEXTURE0+K-1:J=Q);let ce=te[J];ce===void 0&&(ce={type:void 0,texture:void 0},te[J]=ce),(ce.type!==I||ce.texture!==oe)&&(Q!==J&&(i.activeTexture(J),Q=J),i.bindTexture(I,oe||Y[I]),ce.type=I,ce.texture=oe)}function Ft(){let I=te[Q];I!==void 0&&I.type!==void 0&&(i.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function Qe(){try{i.compressedTexImage2D(...arguments)}catch(I){Ie("WebGLState:",I)}}function w(){try{i.compressedTexImage3D(...arguments)}catch(I){Ie("WebGLState:",I)}}function v(){try{i.texSubImage2D(...arguments)}catch(I){Ie("WebGLState:",I)}}function U(){try{i.texSubImage3D(...arguments)}catch(I){Ie("WebGLState:",I)}}function z(){try{i.compressedTexSubImage2D(...arguments)}catch(I){Ie("WebGLState:",I)}}function W(){try{i.compressedTexSubImage3D(...arguments)}catch(I){Ie("WebGLState:",I)}}function ie(){try{i.texStorage2D(...arguments)}catch(I){Ie("WebGLState:",I)}}function re(){try{i.texStorage3D(...arguments)}catch(I){Ie("WebGLState:",I)}}function q(){try{i.texImage2D(...arguments)}catch(I){Ie("WebGLState:",I)}}function $(){try{i.texImage3D(...arguments)}catch(I){Ie("WebGLState:",I)}}function se(I){return f[I]!==void 0?f[I]:i.getParameter(I)}function Se(I,oe){f[I]!==oe&&(i.pixelStorei(I,oe),f[I]=oe)}function le(I){at.equals(I)===!1&&(i.scissor(I.x,I.y,I.z,I.w),at.copy(I))}function ae(I){Xe.equals(I)===!1&&(i.viewport(I.x,I.y,I.z,I.w),Xe.copy(I))}function we(I,oe){let J=c.get(oe);J===void 0&&(J=new WeakMap,c.set(oe,J));let ce=J.get(I);ce===void 0&&(ce=i.getUniformBlockIndex(oe,I.name),J.set(I,ce))}function Re(I,oe){let ce=c.get(oe).get(I);l.get(oe)!==ce&&(i.uniformBlockBinding(oe,ce,I.__bindingPointIndex),l.set(oe,ce))}function Ne(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),d={},f={},Q=null,te={},h={},u=new WeakMap,g=[],x=null,m=!1,p=null,T=null,R=null,y=null,M=null,S=null,E=null,_=new Ce(0,0,0),A=0,L=!1,D=null,k=null,G=null,F=null,H=null,at.set(0,0,i.canvas.width,i.canvas.height),Xe.set(0,0,i.canvas.width,i.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:j,disable:ve,bindFramebuffer:Le,drawBuffers:me,useProgram:ze,setBlending:qe,setMaterial:ot,setFlipSided:We,setCullFace:ft,setLineWidth:Et,setPolygonOffset:Zt,setScissorTest:ut,activeTexture:bt,bindTexture:P,unbindTexture:Ft,compressedTexImage2D:Qe,compressedTexImage3D:w,texImage2D:q,texImage3D:$,pixelStorei:Se,getParameter:se,updateUBOMapping:we,uniformBlockBinding:Re,texStorage2D:ie,texStorage3D:re,texSubImage2D:v,texSubImage3D:U,compressedTexSubImage2D:z,compressedTexSubImage3D:W,scissor:le,viewport:ae,reset:Ne}}function dv(i,e,t,n,r,s,a){let o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new De,d=new WeakMap,f=new Set,h,u=new WeakMap,g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(w,v){return g?new OffscreenCanvas(w,v):tr("canvas")}function m(w,v,U){let z=1,W=Qe(w);if((W.width>U||W.height>U)&&(z=U/Math.max(W.width,W.height)),z<1)if(typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&w instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&w instanceof ImageBitmap||typeof VideoFrame<"u"&&w instanceof VideoFrame){let ie=Math.floor(z*W.width),re=Math.floor(z*W.height);h===void 0&&(h=x(ie,re));let q=v?x(ie,re):h;return q.width=ie,q.height=re,q.getContext("2d").drawImage(w,0,0,ie,re),Me("WebGLRenderer: Texture has been resized from ("+W.width+"x"+W.height+") to ("+ie+"x"+re+")."),q}else return"data"in w&&Me("WebGLRenderer: Image in DataTexture is too big ("+W.width+"x"+W.height+")."),w;return w}function p(w){return w.generateMipmaps}function T(w){i.generateMipmap(w)}function R(w){return w.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:w.isWebGL3DRenderTarget?i.TEXTURE_3D:w.isWebGLArrayRenderTarget||w.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function y(w,v,U,z,W,ie=!1){if(w!==null){if(i[w]!==void 0)return i[w];Me("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+w+"'")}let re;z&&(re=e.get("EXT_texture_norm16"),re||Me("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let q=v;if(v===i.RED&&(U===i.FLOAT&&(q=i.R32F),U===i.HALF_FLOAT&&(q=i.R16F),U===i.UNSIGNED_BYTE&&(q=i.R8),U===i.UNSIGNED_SHORT&&re&&(q=re.R16_EXT),U===i.SHORT&&re&&(q=re.R16_SNORM_EXT)),v===i.RED_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.R8UI),U===i.UNSIGNED_SHORT&&(q=i.R16UI),U===i.UNSIGNED_INT&&(q=i.R32UI),U===i.BYTE&&(q=i.R8I),U===i.SHORT&&(q=i.R16I),U===i.INT&&(q=i.R32I)),v===i.RG&&(U===i.FLOAT&&(q=i.RG32F),U===i.HALF_FLOAT&&(q=i.RG16F),U===i.UNSIGNED_BYTE&&(q=i.RG8),U===i.UNSIGNED_SHORT&&re&&(q=re.RG16_EXT),U===i.SHORT&&re&&(q=re.RG16_SNORM_EXT)),v===i.RG_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.RG8UI),U===i.UNSIGNED_SHORT&&(q=i.RG16UI),U===i.UNSIGNED_INT&&(q=i.RG32UI),U===i.BYTE&&(q=i.RG8I),U===i.SHORT&&(q=i.RG16I),U===i.INT&&(q=i.RG32I)),v===i.RGB_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.RGB8UI),U===i.UNSIGNED_SHORT&&(q=i.RGB16UI),U===i.UNSIGNED_INT&&(q=i.RGB32UI),U===i.BYTE&&(q=i.RGB8I),U===i.SHORT&&(q=i.RGB16I),U===i.INT&&(q=i.RGB32I)),v===i.RGBA_INTEGER&&(U===i.UNSIGNED_BYTE&&(q=i.RGBA8UI),U===i.UNSIGNED_SHORT&&(q=i.RGBA16UI),U===i.UNSIGNED_INT&&(q=i.RGBA32UI),U===i.BYTE&&(q=i.RGBA8I),U===i.SHORT&&(q=i.RGBA16I),U===i.INT&&(q=i.RGBA32I)),v===i.RGB&&(U===i.UNSIGNED_SHORT&&re&&(q=re.RGB16_EXT),U===i.SHORT&&re&&(q=re.RGB16_SNORM_EXT),U===i.UNSIGNED_INT_5_9_9_9_REV&&(q=i.RGB9_E5),U===i.UNSIGNED_INT_10F_11F_11F_REV&&(q=i.R11F_G11F_B10F)),v===i.RGBA){let $=ie?Or:Be.getTransfer(W);U===i.FLOAT&&(q=i.RGBA32F),U===i.HALF_FLOAT&&(q=i.RGBA16F),U===i.UNSIGNED_BYTE&&(q=$===je?i.SRGB8_ALPHA8:i.RGBA8),U===i.UNSIGNED_SHORT&&re&&(q=re.RGBA16_EXT),U===i.SHORT&&re&&(q=re.RGBA16_SNORM_EXT),U===i.UNSIGNED_SHORT_4_4_4_4&&(q=i.RGBA4),U===i.UNSIGNED_SHORT_5_5_5_1&&(q=i.RGB5_A1)}return(q===i.R16F||q===i.R32F||q===i.RG16F||q===i.RG32F||q===i.RGBA16F||q===i.RGBA32F)&&e.get("EXT_color_buffer_float"),q}function M(w,v){let U;return w?v===null||v===yn||v===br?U=i.DEPTH24_STENCIL8:v===qt?U=i.DEPTH32F_STENCIL8:v===_r&&(U=i.DEPTH24_STENCIL8,Me("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===yn||v===br?U=i.DEPTH_COMPONENT24:v===qt?U=i.DEPTH_COMPONENT32F:v===_r&&(U=i.DEPTH_COMPONENT16),U}function S(w,v){return p(w)===!0||w.isFramebufferTexture&&w.minFilter!==st&&w.minFilter!==vt?Math.log2(Math.max(v.width,v.height))+1:w.mipmaps!==void 0&&w.mipmaps.length>0?w.mipmaps.length:w.isCompressedTexture&&Array.isArray(w.image)?v.mipmaps.length:1}function E(w){let v=w.target;v.removeEventListener("dispose",E),A(v),v.isVideoTexture&&d.delete(v),v.isHTMLTexture&&f.delete(v)}function _(w){let v=w.target;v.removeEventListener("dispose",_),D(v)}function A(w){let v=n.get(w);if(v.__webglInit===void 0)return;let U=w.source,z=u.get(U);if(z){let W=z[v.__cacheKey];W.usedTimes--,W.usedTimes===0&&L(w),Object.keys(z).length===0&&u.delete(U)}n.remove(w)}function L(w){let v=n.get(w);i.deleteTexture(v.__webglTexture);let U=w.source,z=u.get(U);delete z[v.__cacheKey],a.memory.textures--}function D(w){let v=n.get(w);if(w.depthTexture&&(w.depthTexture.dispose(),n.remove(w.depthTexture)),w.isWebGLCubeRenderTarget)for(let z=0;z<6;z++){if(Array.isArray(v.__webglFramebuffer[z]))for(let W=0;W<v.__webglFramebuffer[z].length;W++)i.deleteFramebuffer(v.__webglFramebuffer[z][W]);else i.deleteFramebuffer(v.__webglFramebuffer[z]);v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer[z])}else{if(Array.isArray(v.__webglFramebuffer))for(let z=0;z<v.__webglFramebuffer.length;z++)i.deleteFramebuffer(v.__webglFramebuffer[z]);else i.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&i.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&i.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let z=0;z<v.__webglColorRenderbuffer.length;z++)v.__webglColorRenderbuffer[z]&&i.deleteRenderbuffer(v.__webglColorRenderbuffer[z]);v.__webglDepthRenderbuffer&&i.deleteRenderbuffer(v.__webglDepthRenderbuffer)}let U=w.textures;for(let z=0,W=U.length;z<W;z++){let ie=n.get(U[z]);ie.__webglTexture&&(i.deleteTexture(ie.__webglTexture),a.memory.textures--),n.remove(U[z])}n.remove(w)}let k=0;function G(){k=0}function F(){return k}function H(w){k=w}function K(){let w=k;return w>=r.maxTextures&&Me("WebGLTextures: Trying to use "+(w+1)+" texture units while this GPU supports only "+r.maxTextures),k+=1,w}function Z(w){let v=[];return v.push(w.wrapS),v.push(w.wrapT),v.push(w.wrapR||0),v.push(w.magFilter),v.push(w.minFilter),v.push(w.anisotropy),v.push(w.internalFormat),v.push(w.format),v.push(w.type),v.push(w.generateMipmaps),v.push(w.premultiplyAlpha),v.push(w.flipY),v.push(w.unpackAlignment),v.push(w.colorSpace),v.join()}function ne(w,v){let U=n.get(w);if(w.isVideoTexture&&P(w),w.isRenderTargetTexture===!1&&w.isExternalTexture!==!0&&w.version>0&&U.__version!==w.version){let z=w.image;if(z===null)Me("WebGLRenderer: Texture marked for update but no image data found.");else if(z.complete===!1)Me("WebGLRenderer: Texture marked for update but image is incomplete");else{ve(U,w,v);return}}else w.isExternalTexture&&(U.__webglTexture=w.sourceTexture?w.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,U.__webglTexture,i.TEXTURE0+v)}function X(w,v){let U=n.get(w);if(w.isRenderTargetTexture===!1&&w.version>0&&U.__version!==w.version){ve(U,w,v);return}else w.isExternalTexture&&(U.__webglTexture=w.sourceTexture?w.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,U.__webglTexture,i.TEXTURE0+v)}function Q(w,v){let U=n.get(w);if(w.isRenderTargetTexture===!1&&w.version>0&&U.__version!==w.version){ve(U,w,v);return}t.bindTexture(i.TEXTURE_3D,U.__webglTexture,i.TEXTURE0+v)}function te(w,v){let U=n.get(w);if(w.isCubeDepthTexture!==!0&&w.version>0&&U.__version!==w.version){Le(U,w,v);return}t.bindTexture(i.TEXTURE_CUBE_MAP,U.__webglTexture,i.TEXTURE0+v)}let Ee={[ci]:i.REPEAT,[cn]:i.CLAMP_TO_EDGE,[Qi]:i.MIRRORED_REPEAT},Te={[st]:i.NEAREST,[Ta]:i.NEAREST_MIPMAP_NEAREST,[Pi]:i.NEAREST_MIPMAP_LINEAR,[vt]:i.LINEAR,[vr]:i.LINEAR_MIPMAP_NEAREST,[xn]:i.LINEAR_MIPMAP_LINEAR},at={[ah]:i.NEVER,[hh]:i.ALWAYS,[oh]:i.LESS,[ho]:i.LEQUAL,[ch]:i.EQUAL,[fo]:i.GEQUAL,[lh]:i.GREATER,[dh]:i.NOTEQUAL};function Xe(w,v){if(v.type===qt&&e.has("OES_texture_float_linear")===!1&&(v.magFilter===vt||v.magFilter===vr||v.magFilter===Pi||v.magFilter===xn||v.minFilter===vt||v.minFilter===vr||v.minFilter===Pi||v.minFilter===xn)&&Me("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(w,i.TEXTURE_WRAP_S,Ee[v.wrapS]),i.texParameteri(w,i.TEXTURE_WRAP_T,Ee[v.wrapT]),(w===i.TEXTURE_3D||w===i.TEXTURE_2D_ARRAY)&&i.texParameteri(w,i.TEXTURE_WRAP_R,Ee[v.wrapR]),i.texParameteri(w,i.TEXTURE_MAG_FILTER,Te[v.magFilter]),i.texParameteri(w,i.TEXTURE_MIN_FILTER,Te[v.minFilter]),v.compareFunction&&(i.texParameteri(w,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(w,i.TEXTURE_COMPARE_FUNC,at[v.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===st||v.minFilter!==Pi&&v.minFilter!==xn||v.type===qt&&e.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||n.get(v).__currentAnisotropy){let U=e.get("EXT_texture_filter_anisotropic");i.texParameterf(w,U.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,r.getMaxAnisotropy())),n.get(v).__currentAnisotropy=v.anisotropy}}}function Ze(w,v){let U=!1;w.__webglInit===void 0&&(w.__webglInit=!0,v.addEventListener("dispose",E));let z=v.source,W=u.get(z);W===void 0&&(W={},u.set(z,W));let ie=Z(v);if(ie!==w.__cacheKey){W[ie]===void 0&&(W[ie]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,U=!0),W[ie].usedTimes++;let re=W[w.__cacheKey];re!==void 0&&(W[w.__cacheKey].usedTimes--,re.usedTimes===0&&L(v)),w.__cacheKey=ie,w.__webglTexture=W[ie].texture}return U}function Y(w,v,U){return Math.floor(Math.floor(w/U)/v)}function j(w,v,U,z){let ie=w.updateRanges;if(ie.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,v.width,v.height,U,z,v.data);else{ie.sort((Se,le)=>Se.start-le.start);let re=0;for(let Se=1;Se<ie.length;Se++){let le=ie[re],ae=ie[Se],we=le.start+le.count,Re=Y(ae.start,v.width,4),Ne=Y(le.start,v.width,4);ae.start<=we+1&&Re===Ne&&Y(ae.start+ae.count-1,v.width,4)===Re?le.count=Math.max(le.count,ae.start+ae.count-le.start):(++re,ie[re]=ae)}ie.length=re+1;let q=t.getParameter(i.UNPACK_ROW_LENGTH),$=t.getParameter(i.UNPACK_SKIP_PIXELS),se=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,v.width);for(let Se=0,le=ie.length;Se<le;Se++){let ae=ie[Se],we=Math.floor(ae.start/4),Re=Math.ceil(ae.count/4),Ne=we%v.width,I=Math.floor(we/v.width),oe=Re,J=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Ne),t.pixelStorei(i.UNPACK_SKIP_ROWS,I),t.texSubImage2D(i.TEXTURE_2D,0,Ne,I,oe,J,U,z,v.data)}w.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,q),t.pixelStorei(i.UNPACK_SKIP_PIXELS,$),t.pixelStorei(i.UNPACK_SKIP_ROWS,se)}}function ve(w,v,U){let z=i.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(z=i.TEXTURE_2D_ARRAY),v.isData3DTexture&&(z=i.TEXTURE_3D);let W=Ze(w,v),ie=v.source;t.bindTexture(z,w.__webglTexture,i.TEXTURE0+U);let re=n.get(ie);if(ie.version!==re.__version||W===!0){if(t.activeTexture(i.TEXTURE0+U),(typeof ImageBitmap<"u"&&v.image instanceof ImageBitmap)===!1){let J=Be.getPrimaries(Be.workingColorSpace),ce=v.colorSpace===Jn?null:Be.getPrimaries(v.colorSpace),ue=v.colorSpace===Jn||J===ce?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,ue)}t.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment);let $=m(v.image,!1,r.maxTextureSize);$=Ft(v,$);let se=s.convert(v.format,v.colorSpace),Se=s.convert(v.type),le=y(v.internalFormat,se,Se,v.normalized,v.colorSpace,v.isVideoTexture);Xe(z,v);let ae,we=v.mipmaps,Re=v.isVideoTexture!==!0,Ne=re.__version===void 0||W===!0,I=ie.dataReady,oe=S(v,$);if(v.isDepthTexture)le=M(v.format===ui,v.type),Ne&&(Re?t.texStorage2D(i.TEXTURE_2D,1,le,$.width,$.height):t.texImage2D(i.TEXTURE_2D,0,le,$.width,$.height,0,se,Se,null));else if(v.isDataTexture)if(we.length>0){Re&&Ne&&t.texStorage2D(i.TEXTURE_2D,oe,le,we[0].width,we[0].height);for(let J=0,ce=we.length;J<ce;J++)ae=we[J],Re?I&&t.texSubImage2D(i.TEXTURE_2D,J,0,0,ae.width,ae.height,se,Se,ae.data):t.texImage2D(i.TEXTURE_2D,J,le,ae.width,ae.height,0,se,Se,ae.data);v.generateMipmaps=!1}else Re?(Ne&&t.texStorage2D(i.TEXTURE_2D,oe,le,$.width,$.height),I&&j(v,$,se,Se)):t.texImage2D(i.TEXTURE_2D,0,le,$.width,$.height,0,se,Se,$.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Re&&Ne&&t.texStorage3D(i.TEXTURE_2D_ARRAY,oe,le,we[0].width,we[0].height,$.depth);for(let J=0,ce=we.length;J<ce;J++)if(ae=we[J],v.format!==sn)if(se!==null)if(Re){if(I)if(v.layerUpdates.size>0){let ue=Xc(ae.width,ae.height,v.format,v.type);for(let ee of v.layerUpdates){let Ae=ae.data.subarray(ee*ue/ae.data.BYTES_PER_ELEMENT,(ee+1)*ue/ae.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,ee,ae.width,ae.height,1,se,Ae)}}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,$.depth,se,ae.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,J,le,ae.width,ae.height,$.depth,0,ae.data,0,0);else Me("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Re?I&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,ae.width,ae.height,$.depth,se,Se,ae.data):t.texImage3D(i.TEXTURE_2D_ARRAY,J,le,ae.width,ae.height,$.depth,0,se,Se,ae.data);v.layerUpdates.size>0&&v.clearLayerUpdates()}else{Re&&Ne&&t.texStorage2D(i.TEXTURE_2D,oe,le,we[0].width,we[0].height);for(let J=0,ce=we.length;J<ce;J++)ae=we[J],v.format!==sn?se!==null?Re?I&&t.compressedTexSubImage2D(i.TEXTURE_2D,J,0,0,ae.width,ae.height,se,ae.data):t.compressedTexImage2D(i.TEXTURE_2D,J,le,ae.width,ae.height,0,ae.data):Me("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Re?I&&t.texSubImage2D(i.TEXTURE_2D,J,0,0,ae.width,ae.height,se,Se,ae.data):t.texImage2D(i.TEXTURE_2D,J,le,ae.width,ae.height,0,se,Se,ae.data)}else if(v.isDataArrayTexture)if(Re){if(Ne&&t.texStorage3D(i.TEXTURE_2D_ARRAY,oe,le,$.width,$.height,$.depth),I)if(v.layerUpdates.size>0){let J=Xc($.width,$.height,v.format,v.type);for(let ce of v.layerUpdates){let ue=$.data.subarray(ce*J/$.data.BYTES_PER_ELEMENT,(ce+1)*J/$.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,ce,$.width,$.height,1,se,Se,ue)}v.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,$.width,$.height,$.depth,se,Se,$.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,le,$.width,$.height,$.depth,0,se,Se,$.data);else if(v.isData3DTexture)Re?(Ne&&t.texStorage3D(i.TEXTURE_3D,oe,le,$.width,$.height,$.depth),I&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,$.width,$.height,$.depth,se,Se,$.data)):t.texImage3D(i.TEXTURE_3D,0,le,$.width,$.height,$.depth,0,se,Se,$.data);else if(v.isFramebufferTexture){if(Ne)if(Re)t.texStorage2D(i.TEXTURE_2D,oe,le,$.width,$.height);else{let J=$.width,ce=$.height;for(let ue=0;ue<oe;ue++)t.texImage2D(i.TEXTURE_2D,ue,le,J,ce,0,se,Se,null),J>>=1,ce>>=1}}else if(v.isHTMLTexture){if("texElementImage2D"in i){let J=i.canvas;if(J.hasAttribute("layoutsubtree")||J.setAttribute("layoutsubtree","true"),$.parentNode!==J){J.appendChild($),f.add(v),J.onpaint=ce=>{let ue=ce.changedElements;for(let ee of f)ue.includes(ee.image)&&(ee.needsUpdate=!0)},J.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,$);else{let ue=i.RGBA,ee=i.RGBA,Ae=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,ue,ee,Ae,$)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(we.length>0){if(Re&&Ne){let J=Qe(we[0]);t.texStorage2D(i.TEXTURE_2D,oe,le,J.width,J.height)}for(let J=0,ce=we.length;J<ce;J++)ae=we[J],Re?I&&t.texSubImage2D(i.TEXTURE_2D,J,0,0,se,Se,ae):t.texImage2D(i.TEXTURE_2D,J,le,se,Se,ae);v.generateMipmaps=!1}else if(Re){if(Ne){let J=Qe($);t.texStorage2D(i.TEXTURE_2D,oe,le,J.width,J.height)}I&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,se,Se,$)}else t.texImage2D(i.TEXTURE_2D,0,le,se,Se,$);p(v)&&T(z),re.__version=ie.version,v.onUpdate&&v.onUpdate(v)}w.__version=v.version}function Le(w,v,U){if(v.image.length!==6)return;let z=Ze(w,v),W=v.source;t.bindTexture(i.TEXTURE_CUBE_MAP,w.__webglTexture,i.TEXTURE0+U);let ie=n.get(W);if(W.version!==ie.__version||z===!0){t.activeTexture(i.TEXTURE0+U);let re=Be.getPrimaries(Be.workingColorSpace),q=v.colorSpace===Jn?null:Be.getPrimaries(v.colorSpace),$=v.colorSpace===Jn||re===q?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,v.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,v.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,$);let se=v.isCompressedTexture||v.image[0].isCompressedTexture,Se=v.image[0]&&v.image[0].isDataTexture,le=[];for(let ee=0;ee<6;ee++)!se&&!Se?le[ee]=m(v.image[ee],!0,r.maxCubemapSize):le[ee]=Se?v.image[ee].image:v.image[ee],le[ee]=Ft(v,le[ee]);let ae=le[0],we=s.convert(v.format,v.colorSpace),Re=s.convert(v.type),Ne=y(v.internalFormat,we,Re,v.normalized,v.colorSpace),I=v.isVideoTexture!==!0,oe=ie.__version===void 0||z===!0,J=W.dataReady,ce=S(v,ae);Xe(i.TEXTURE_CUBE_MAP,v);let ue;if(se){I&&oe&&t.texStorage2D(i.TEXTURE_CUBE_MAP,ce,Ne,ae.width,ae.height);for(let ee=0;ee<6;ee++){ue=le[ee].mipmaps;for(let Ae=0;Ae<ue.length;Ae++){let xe=ue[Ae];v.format!==sn?we!==null?I?J&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae,0,0,xe.width,xe.height,we,xe.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae,Ne,xe.width,xe.height,0,xe.data):Me("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):I?J&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae,0,0,xe.width,xe.height,we,Re,xe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae,Ne,xe.width,xe.height,0,we,Re,xe.data)}}}else{if(ue=v.mipmaps,I&&oe){ue.length>0&&ce++;let ee=Qe(le[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,ce,Ne,ee.width,ee.height)}for(let ee=0;ee<6;ee++)if(Se){I?J&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,0,0,le[ee].width,le[ee].height,we,Re,le[ee].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,Ne,le[ee].width,le[ee].height,0,we,Re,le[ee].data);for(let Ae=0;Ae<ue.length;Ae++){let ct=ue[Ae].image[ee].image;I?J&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae+1,0,0,ct.width,ct.height,we,Re,ct.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae+1,Ne,ct.width,ct.height,0,we,Re,ct.data)}}else{I?J&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,0,0,we,Re,le[ee]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,0,Ne,we,Re,le[ee]);for(let Ae=0;Ae<ue.length;Ae++){let xe=ue[Ae];I?J&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae+1,0,0,we,Re,xe.image[ee]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ee,Ae+1,Ne,we,Re,xe.image[ee])}}}p(v)&&T(i.TEXTURE_CUBE_MAP),ie.__version=W.version,v.onUpdate&&v.onUpdate(v)}w.__version=v.version}function me(w,v,U,z,W,ie){let re=s.convert(U.format,U.colorSpace),q=s.convert(U.type),$=y(U.internalFormat,re,q,U.normalized,U.colorSpace),se=n.get(v),Se=n.get(U);if(Se.__renderTarget=v,!se.__hasExternalTextures){let le=Math.max(1,v.width>>ie),ae=Math.max(1,v.height>>ie);W===i.TEXTURE_3D||W===i.TEXTURE_2D_ARRAY?t.texImage3D(W,ie,$,le,ae,v.depth,0,re,q,null):t.texImage2D(W,ie,$,le,ae,0,re,q,null)}t.bindFramebuffer(i.FRAMEBUFFER,w),bt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,z,W,Se.__webglTexture,0,ut(v)):(W===i.TEXTURE_2D||W>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&W<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,z,W,Se.__webglTexture,ie),t.bindFramebuffer(i.FRAMEBUFFER,null)}function ze(w,v,U){if(i.bindRenderbuffer(i.RENDERBUFFER,w),v.depthBuffer){let z=v.depthTexture,W=z&&z.isDepthTexture?z.type:null,ie=M(v.stencilBuffer,W),re=v.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;bt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ut(v),ie,v.width,v.height):U?i.renderbufferStorageMultisample(i.RENDERBUFFER,ut(v),ie,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,ie,v.width,v.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,re,i.RENDERBUFFER,w)}else{let z=v.textures;for(let W=0;W<z.length;W++){let ie=z[W],re=s.convert(ie.format,ie.colorSpace),q=s.convert(ie.type),$=y(ie.internalFormat,re,q,ie.normalized,ie.colorSpace);bt(v)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,ut(v),$,v.width,v.height):U?i.renderbufferStorageMultisample(i.RENDERBUFFER,ut(v),$,v.width,v.height):i.renderbufferStorage(i.RENDERBUFFER,$,v.width,v.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function St(w,v,U){let z=v.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,w),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let W=n.get(v.depthTexture);if(W.__renderTarget=v,(!W.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),z){if(W.__webglInit===void 0&&(W.__webglInit=!0,v.depthTexture.addEventListener("dispose",E)),W.__webglTexture===void 0){W.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture),Xe(i.TEXTURE_CUBE_MAP,v.depthTexture);let se=s.convert(v.depthTexture.format),Se=s.convert(v.depthTexture.type),le;v.depthTexture.format===En?le=i.DEPTH_COMPONENT24:v.depthTexture.format===ui&&(le=i.DEPTH24_STENCIL8);for(let ae=0;ae<6;ae++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ae,0,le,v.width,v.height,0,se,Se,null)}}else ne(v.depthTexture,0);let ie=W.__webglTexture,re=ut(v),q=z?i.TEXTURE_CUBE_MAP_POSITIVE_X+U:i.TEXTURE_2D,$=v.depthTexture.format===ui?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(v.depthTexture.format===En)bt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,$,q,ie,0,re):i.framebufferTexture2D(i.FRAMEBUFFER,$,q,ie,0);else if(v.depthTexture.format===ui)bt(v)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,$,q,ie,0,re):i.framebufferTexture2D(i.FRAMEBUFFER,$,q,ie,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function He(w){let v=n.get(w),U=w.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==w.depthTexture){let z=w.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),z){let W=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,z.removeEventListener("dispose",W)};z.addEventListener("dispose",W),v.__depthDisposeCallback=W}v.__boundDepthTexture=z}if(w.depthTexture&&!v.__autoAllocateDepthBuffer)if(U)for(let z=0;z<6;z++)St(v.__webglFramebuffer[z],w,z);else{let z=w.texture.mipmaps;z&&z.length>0?St(v.__webglFramebuffer[0],w,0):St(v.__webglFramebuffer,w,0)}else if(U){v.__webglDepthbuffer=[];for(let z=0;z<6;z++)if(t.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[z]),v.__webglDepthbuffer[z]===void 0)v.__webglDepthbuffer[z]=i.createRenderbuffer(),ze(v.__webglDepthbuffer[z],w,!1);else{let W=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ie=v.__webglDepthbuffer[z];i.bindRenderbuffer(i.RENDERBUFFER,ie),i.framebufferRenderbuffer(i.FRAMEBUFFER,W,i.RENDERBUFFER,ie)}}else{let z=w.texture.mipmaps;if(z&&z.length>0?t.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=i.createRenderbuffer(),ze(v.__webglDepthbuffer,w,!1);else{let W=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ie=v.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ie),i.framebufferRenderbuffer(i.FRAMEBUFFER,W,i.RENDERBUFFER,ie)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function qe(w,v,U){let z=n.get(w);v!==void 0&&me(z.__webglFramebuffer,w,w.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),U!==void 0&&He(w)}function ot(w){let v=w.texture,U=n.get(w),z=n.get(v);w.addEventListener("dispose",_);let W=w.textures,ie=w.isWebGLCubeRenderTarget===!0,re=W.length>1;if(re||(z.__webglTexture===void 0&&(z.__webglTexture=i.createTexture()),z.__version=v.version,a.memory.textures++),ie){U.__webglFramebuffer=[];for(let q=0;q<6;q++)if(v.mipmaps&&v.mipmaps.length>0){U.__webglFramebuffer[q]=[];for(let $=0;$<v.mipmaps.length;$++)U.__webglFramebuffer[q][$]=i.createFramebuffer()}else U.__webglFramebuffer[q]=i.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){U.__webglFramebuffer=[];for(let q=0;q<v.mipmaps.length;q++)U.__webglFramebuffer[q]=i.createFramebuffer()}else U.__webglFramebuffer=i.createFramebuffer();if(re)for(let q=0,$=W.length;q<$;q++){let se=n.get(W[q]);se.__webglTexture===void 0&&(se.__webglTexture=i.createTexture(),a.memory.textures++)}if(w.samples>0&&bt(w)===!1){U.__webglMultisampledFramebuffer=i.createFramebuffer(),U.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,U.__webglMultisampledFramebuffer);for(let q=0;q<W.length;q++){let $=W[q];U.__webglColorRenderbuffer[q]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,U.__webglColorRenderbuffer[q]);let se=s.convert($.format,$.colorSpace),Se=s.convert($.type),le=y($.internalFormat,se,Se,$.normalized,$.colorSpace,w.isXRRenderTarget===!0),ae=ut(w);i.renderbufferStorageMultisample(i.RENDERBUFFER,ae,le,w.width,w.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+q,i.RENDERBUFFER,U.__webglColorRenderbuffer[q])}i.bindRenderbuffer(i.RENDERBUFFER,null),w.depthBuffer&&(U.__webglDepthRenderbuffer=i.createRenderbuffer(),ze(U.__webglDepthRenderbuffer,w,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ie){t.bindTexture(i.TEXTURE_CUBE_MAP,z.__webglTexture),Xe(i.TEXTURE_CUBE_MAP,v);for(let q=0;q<6;q++)if(v.mipmaps&&v.mipmaps.length>0)for(let $=0;$<v.mipmaps.length;$++)me(U.__webglFramebuffer[q][$],w,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+q,$);else me(U.__webglFramebuffer[q],w,v,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+q,0);p(v)&&T(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(re){for(let q=0,$=W.length;q<$;q++){let se=W[q],Se=n.get(se),le=i.TEXTURE_2D;(w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(le=w.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(le,Se.__webglTexture),Xe(le,se),me(U.__webglFramebuffer,w,se,i.COLOR_ATTACHMENT0+q,le,0),p(se)&&T(le)}t.unbindTexture()}else{let q=i.TEXTURE_2D;if((w.isWebGL3DRenderTarget||w.isWebGLArrayRenderTarget)&&(q=w.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(q,z.__webglTexture),Xe(q,v),v.mipmaps&&v.mipmaps.length>0)for(let $=0;$<v.mipmaps.length;$++)me(U.__webglFramebuffer[$],w,v,i.COLOR_ATTACHMENT0,q,$);else me(U.__webglFramebuffer,w,v,i.COLOR_ATTACHMENT0,q,0);p(v)&&T(q),t.unbindTexture()}w.depthBuffer&&He(w)}function We(w){let v=w.textures;for(let U=0,z=v.length;U<z;U++){let W=v[U];if(p(W)){let ie=R(w),re=n.get(W).__webglTexture;t.bindTexture(ie,re),T(ie),t.unbindTexture()}}}let ft=[],Et=[];function Zt(w){if(w.samples>0){if(bt(w)===!1){let v=w.textures,U=w.width,z=w.height,W=i.COLOR_BUFFER_BIT,ie=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,re=n.get(w),q=v.length>1;if(q)for(let se=0;se<v.length;se++)t.bindFramebuffer(i.FRAMEBUFFER,re.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+se,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,re.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+se,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,re.__webglMultisampledFramebuffer);let $=w.texture.mipmaps;$&&$.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,re.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,re.__webglFramebuffer);for(let se=0;se<v.length;se++){if(w.resolveDepthBuffer&&(w.depthBuffer&&(W|=i.DEPTH_BUFFER_BIT),w.stencilBuffer&&w.resolveStencilBuffer&&(W|=i.STENCIL_BUFFER_BIT)),q){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,re.__webglColorRenderbuffer[se]);let Se=n.get(v[se]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Se,0)}i.blitFramebuffer(0,0,U,z,0,0,U,z,W,i.NEAREST),l===!0&&(ft.length=0,Et.length=0,ft.push(i.COLOR_ATTACHMENT0+se),w.depthBuffer&&w.storeMultisampledDepthBuffer===!1&&(ft.push(ie),Et.push(ie),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,Et)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,ft))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),q)for(let se=0;se<v.length;se++){t.bindFramebuffer(i.FRAMEBUFFER,re.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+se,i.RENDERBUFFER,re.__webglColorRenderbuffer[se]);let Se=n.get(v[se]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,re.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+se,i.TEXTURE_2D,Se,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,re.__webglMultisampledFramebuffer)}else if(w.depthBuffer&&w.storeMultisampledDepthBuffer===!1&&l){let v=w.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[v])}}}function ut(w){return Math.min(r.maxSamples,w.samples)}function bt(w){let v=n.get(w);return w.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function P(w){let v=a.render.frame;d.get(w)!==v&&(d.set(w,v),w.update())}function Ft(w,v){let U=w.colorSpace,z=w.format,W=w.type;return w.isCompressedTexture===!0||w.isVideoTexture===!0||U!==Vt&&U!==Jn&&(Be.getTransfer(U)===je?(z!==sn||W!==en)&&Me("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ie("WebGLTextures: Unsupported texture color space:",U)),v}function Qe(w){return typeof HTMLImageElement<"u"&&w instanceof HTMLImageElement?(c.width=w.naturalWidth||w.width,c.height=w.naturalHeight||w.height):typeof VideoFrame<"u"&&w instanceof VideoFrame?(c.width=w.displayWidth,c.height=w.displayHeight):(c.width=w.width,c.height=w.height),c}this.allocateTextureUnit=K,this.resetTextureUnits=G,this.getTextureUnits=F,this.setTextureUnits=H,this.setTexture2D=ne,this.setTexture2DArray=X,this.setTexture3D=Q,this.setTextureCube=te,this.rebindTextures=qe,this.setupRenderTarget=ot,this.updateRenderTargetMipmap=We,this.updateMultisampleRenderTarget=Zt,this.setupDepthRenderbuffer=He,this.setupFrameBufferTexture=me,this.useMultisampledRTT=bt,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function hv(i,e){function t(n,r=Jn){let s,a=Be.getTransfer(r);if(n===en)return i.UNSIGNED_BYTE;if(n===Ea)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Ra)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Fc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Nc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Pc)return i.BYTE;if(n===Lc)return i.SHORT;if(n===_r)return i.UNSIGNED_SHORT;if(n===Aa)return i.INT;if(n===yn)return i.UNSIGNED_INT;if(n===qt)return i.FLOAT;if(n===Mn)return i.HALF_FLOAT;if(n===Dc)return i.ALPHA;if(n===Uc)return i.RGB;if(n===sn)return i.RGBA;if(n===En)return i.DEPTH_COMPONENT;if(n===ui)return i.DEPTH_STENCIL;if(n===Ca)return i.RED;if(n===Ia)return i.RED_INTEGER;if(n===pi)return i.RG;if(n===Pa)return i.RG_INTEGER;if(n===La)return i.RGBA_INTEGER;if(n===cs||n===ls||n===ds||n===hs)if(a===je)if(s=e.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===cs)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===ls)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===ds)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===hs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=e.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===cs)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===ls)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===ds)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===hs)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Fa||n===Na||n===Da||n===Ua)if(s=e.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===Fa)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Na)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Da)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Ua)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Oa||n===Ba||n===za||n===ka||n===Ha||n===fs||n===Va)if(s=e.get("WEBGL_compressed_texture_etc"),s!==null){if(n===Oa||n===Ba)return a===je?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===za)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC;if(n===ka)return s.COMPRESSED_R11_EAC;if(n===Ha)return s.COMPRESSED_SIGNED_R11_EAC;if(n===fs)return s.COMPRESSED_RG11_EAC;if(n===Va)return s.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Ga||n===Wa||n===Xa||n===Ya||n===qa||n===Za||n===Ka||n===Ja||n===$a||n===ja||n===Qa||n===eo||n===to||n===no)if(s=e.get("WEBGL_compressed_texture_astc"),s!==null){if(n===Ga)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Wa)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Xa)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Ya)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===qa)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Za)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Ka)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Ja)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===$a)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===ja)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Qa)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===eo)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===to)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===no)return a===je?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===io||n===ro||n===so)if(s=e.get("EXT_texture_compression_bptc"),s!==null){if(n===io)return a===je?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===ro)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===so)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ao||n===oo||n===us||n===co)if(s=e.get("EXT_texture_compression_rgtc"),s!==null){if(n===ao)return s.COMPRESSED_RED_RGTC1_EXT;if(n===oo)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===us)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===co)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===br?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}var fv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,uv=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,sl=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new Jr(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new Xt({vertexShader:fv,fragmentShader:uv,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Ke(new Ri(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},al=class extends Rn{constructor(e,t){super();let n=this,r=null,s=1,a=null,o="local-floor",l=1,c=null,d=null,f=null,h=null,u=null,g=null,x=typeof XRWebGLBinding<"u",m=new sl,p={},T=t.getContextAttributes(),R=null,y=null,M=[],S=[],E=new De,_=null,A=null,L=new Ct;L.viewport=new tt;let D=new Ct;D.viewport=new tt;let k=[L,D],G=new Ma,F=null,H=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Y){let j=M[Y];return j===void 0&&(j=new rr,M[Y]=j),j.getTargetRaySpace()},this.getControllerGrip=function(Y){let j=M[Y];return j===void 0&&(j=new rr,M[Y]=j),j.getGripSpace()},this.getHand=function(Y){let j=M[Y];return j===void 0&&(j=new rr,M[Y]=j),j.getHandSpace()};function K(Y){let j=S.indexOf(Y.inputSource);if(j===-1)return;let ve=M[j];ve!==void 0&&(ve.update(Y.inputSource,Y.frame,c||a),ve.dispatchEvent({type:Y.type,data:Y.inputSource}))}function Z(){r.removeEventListener("select",K),r.removeEventListener("selectstart",K),r.removeEventListener("selectend",K),r.removeEventListener("squeeze",K),r.removeEventListener("squeezestart",K),r.removeEventListener("squeezeend",K),r.removeEventListener("end",Z),r.removeEventListener("inputsourceschange",ne);for(let Y=0;Y<M.length;Y++){let j=S[Y];j!==null&&(S[Y]=null,M[Y].disconnect(j))}F=null,H=null,m.reset();for(let Y in p)delete p[Y];if(e.setRenderTarget(R),u=null,h=null,f=null,r=null,y=null,Ze.stop(),n.isPresenting=!1,e.setPixelRatio(_),e.setSize(E.width,E.height,!1),A!==null){let Y=A.camera;Y.fov=A.fov,Y.zoom=A.zoom,Y.updateProjectionMatrix(),A=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Y){s=Y,n.isPresenting===!0&&Me("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Y){o=Y,n.isPresenting===!0&&Me("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(Y){c=Y},this.getBaseLayer=function(){return h!==null?h:u},this.getBinding=function(){return f===null&&x&&(f=new XRWebGLBinding(r,t)),f},this.getFrame=function(){return g},this.getSession=function(){return r},this.setSession=async function(Y){if(r=Y,r!==null){if(R=e.getRenderTarget(),r.addEventListener("select",K),r.addEventListener("selectstart",K),r.addEventListener("selectend",K),r.addEventListener("squeeze",K),r.addEventListener("squeezestart",K),r.addEventListener("squeezeend",K),r.addEventListener("end",Z),r.addEventListener("inputsourceschange",ne),T.xrCompatible!==!0&&await t.makeXRCompatible(),_=e.getPixelRatio(),e.getSize(E),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let ve=null,Le=null,me=null;T.depth&&(me=T.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ve=T.stencil?ui:En,Le=T.stencil?br:yn);let ze={colorFormat:t.RGBA8,depthFormat:me,scaleFactor:s};f=this.getBinding(),h=f.createProjectionLayer(ze),r.updateRenderState({layers:[h]}),e.setPixelRatio(1),e.setSize(h.textureWidth,h.textureHeight,!1),y=new Pt(h.textureWidth,h.textureHeight,{format:sn,type:en,depthTexture:new li(h.textureWidth,h.textureHeight,Le,void 0,void 0,void 0,void 0,void 0,void 0,ve),stencilBuffer:T.stencil,colorSpace:e.outputColorSpace,samples:T.antialias?4:0,resolveDepthBuffer:h.ignoreDepthValues===!1,resolveStencilBuffer:h.ignoreDepthValues===!1,storeMultisampledDepthBuffer:h.ignoreDepthValues===!1,storeMultisampledStencilBuffer:h.ignoreDepthValues===!1})}else{let ve={antialias:T.antialias,alpha:!0,depth:T.depth,stencil:T.stencil,framebufferScaleFactor:s};u=new XRWebGLLayer(r,t,ve),r.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),y=new Pt(u.framebufferWidth,u.framebufferHeight,{format:sn,type:en,colorSpace:e.outputColorSpace,stencilBuffer:T.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await r.requestReferenceSpace(o),Ze.setContext(r),Ze.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function ne(Y){for(let j=0;j<Y.removed.length;j++){let ve=Y.removed[j],Le=S.indexOf(ve);Le>=0&&(S[Le]=null,M[Le].disconnect(ve))}for(let j=0;j<Y.added.length;j++){let ve=Y.added[j],Le=S.indexOf(ve);if(Le===-1){for(let ze=0;ze<M.length;ze++)if(ze>=S.length){S.push(ve),Le=ze;break}else if(S[ze]===null){S[ze]=ve,Le=ze;break}if(Le===-1)break}let me=M[Le];me&&me.connect(ve)}}let X=new N,Q=new N;function te(Y,j,ve){X.setFromMatrixPosition(j.matrixWorld),Q.setFromMatrixPosition(ve.matrixWorld);let Le=X.distanceTo(Q),me=j.projectionMatrix.elements,ze=ve.projectionMatrix.elements,St=me[14]/(me[10]-1),He=me[14]/(me[10]+1),qe=(me[9]+1)/me[5],ot=(me[9]-1)/me[5],We=(me[8]-1)/me[0],ft=(ze[8]+1)/ze[0],Et=St*We,Zt=St*ft,ut=Le/(-We+ft),bt=ut*-We;if(j.matrixWorld.decompose(Y.position,Y.quaternion,Y.scale),Y.translateX(bt),Y.translateZ(ut),Y.matrixWorld.compose(Y.position,Y.quaternion,Y.scale),Y.matrixWorldInverse.copy(Y.matrixWorld).invert(),me[10]===-1)Y.projectionMatrix.copy(j.projectionMatrix),Y.projectionMatrixInverse.copy(j.projectionMatrixInverse);else{let P=St+ut,Ft=He+ut,Qe=Et-bt,w=Zt+(Le-bt),v=qe*He/Ft*P,U=ot*He/Ft*P;Y.projectionMatrix.makePerspective(Qe,w,v,U,P,Ft),Y.projectionMatrixInverse.copy(Y.projectionMatrix).invert()}}function Ee(Y,j){j===null?Y.matrixWorld.copy(Y.matrix):Y.matrixWorld.multiplyMatrices(j.matrixWorld,Y.matrix),Y.matrixWorldInverse.copy(Y.matrixWorld).invert()}this.updateCamera=function(Y){if(r===null)return;let j=Y.near,ve=Y.far;m.texture!==null&&(m.depthNear>0&&(j=m.depthNear),m.depthFar>0&&(ve=m.depthFar)),G.near=D.near=L.near=j,G.far=D.far=L.far=ve,(F!==G.near||H!==G.far)&&(r.updateRenderState({depthNear:G.near,depthFar:G.far}),F=G.near,H=G.far),G.layers.mask=Y.layers.mask|6,L.layers.mask=G.layers.mask&-5,D.layers.mask=G.layers.mask&-3;let Le=Y.parent,me=G.cameras;Ee(G,Le);for(let ze=0;ze<me.length;ze++)Ee(me[ze],Le);me.length===2?te(G,L,D):G.projectionMatrix.copy(L.projectionMatrix),A===null&&Y.isPerspectiveCamera&&(A={camera:Y,fov:Y.fov,zoom:Y.zoom}),Te(Y,G,Le)};function Te(Y,j,ve){ve===null?Y.matrix.copy(j.matrixWorld):(Y.matrix.copy(ve.matrixWorld),Y.matrix.invert(),Y.matrix.multiply(j.matrixWorld)),Y.matrix.decompose(Y.position,Y.quaternion,Y.scale),Y.updateMatrixWorld(!0),Y.projectionMatrix.copy(j.projectionMatrix),Y.projectionMatrixInverse.copy(j.projectionMatrixInverse),Y.isPerspectiveCamera&&(Y.fov=wi*2*Math.atan(1/Y.projectionMatrix.elements[5]),Y.zoom=1)}this.getCamera=function(){return G},this.getFoveation=function(){if(!(h===null&&u===null))return l},this.setFoveation=function(Y){l=Y,h!==null&&(h.fixedFoveation=Y),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=Y)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(G)},this.getCameraTexture=function(Y){return p[Y]};let at=null;function Xe(Y,j){if(d=j.getViewerPose(c||a),g=j,d!==null){let ve=d.views;u!==null&&(e.setRenderTargetFramebuffer(y,u.framebuffer),e.setRenderTarget(y));let Le=!1;ve.length!==G.cameras.length&&(G.cameras.length=0,Le=!0);for(let He=0;He<ve.length;He++){let qe=ve[He],ot=null;if(u!==null)ot=u.getViewport(qe);else{let ft=f.getViewSubImage(h,qe);ot=ft.viewport,He===0&&(e.setRenderTargetTextures(y,ft.colorTexture,ft.depthStencilTexture),e.setRenderTarget(y))}let We=k[He];We===void 0&&(We=new Ct,We.layers.enable(He),We.viewport=new tt,k[He]=We),We.matrix.fromArray(qe.transform.matrix),We.matrix.decompose(We.position,We.quaternion,We.scale),We.projectionMatrix.fromArray(qe.projectionMatrix),We.projectionMatrixInverse.copy(We.projectionMatrix).invert(),We.viewport.set(ot.x,ot.y,ot.width,ot.height),He===0&&(G.matrix.copy(We.matrix),G.matrix.decompose(G.position,G.quaternion,G.scale)),Le===!0&&G.cameras.push(We)}let me=r.enabledFeatures;if(me&&me.includes("depth-sensing")&&r.depthUsage=="gpu-optimized"&&x){f=n.getBinding();let He=f.getDepthInformation(ve[0]);He&&He.isValid&&He.texture&&m.init(He,r.renderState)}if(me&&me.includes("camera-access")&&x){e.state.unbindTexture(),f=n.getBinding();for(let He=0;He<ve.length;He++){let qe=ve[He].camera;if(qe){let ot=p[qe];ot||(ot=new Jr,p[qe]=ot);let We=f.getCameraImage(qe);ot.sourceTexture=We}}}}for(let ve=0;ve<M.length;ve++){let Le=S[ve],me=M[ve];Le!==null&&me!==void 0&&me.update(Le,j,c||a)}at&&at(Y,j),j.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:j}),g=null}let Ze=new Hh;Ze.setAnimationLoop(Xe),this.setAnimationLoop=function(Y){at=Y},this.dispose=function(){}}},pv=new Fe,qh=new Pe;qh.set(-1,0,0,0,1,0,0,0,1);function mv(i,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Vc(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function r(m,p,T,R,y){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?s(m,p):p.isMeshLambertMaterial?(s(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(s(m,p),f(m,p)):p.isMeshPhongMaterial?(s(m,p),d(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(s(m,p),h(m,p),p.isMeshPhysicalMaterial&&u(m,p,y)):p.isMeshMatcapMaterial?(s(m,p),g(m,p)):p.isMeshDepthMaterial?s(m,p):p.isMeshDistanceMaterial?(s(m,p),x(m,p)):p.isMeshNormalMaterial?s(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,T,R):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Yt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Yt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);let T=e.get(p),R=T.envMap,y=T.envMapRotation;R&&(m.envMap.value=R,m.envMapRotation.value.setFromMatrix4(pv.makeRotationFromEuler(y)).transpose(),R.isCubeTexture&&R.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(qh),m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,T,R){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*T,m.scale.value=R*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function d(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function f(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function h(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function u(m,p,T){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Yt&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.retroreflectivity>0&&(m.retroreflectivity.value=p.retroreflectivity),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=T.texture,m.transmissionSamplerSize.value.set(T.width,T.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function x(m,p){let T=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(T.matrixWorld),m.nearDistance.value=T.shadow.camera.near,m.farDistance.value=T.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:r}}function gv(i,e,t,n){let r={},s={},a=[],o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,M){let S=M.program;n.uniformBlockBinding(y,S)}function c(y,M){let S=r[y.id];S===void 0&&(m(y),S=d(y),r[y.id]=S,y.addEventListener("dispose",T));let E=M.program;n.updateUBOMapping(y,E);let _=e.render.frame;s[y.id]!==_&&(h(y),s[y.id]=_)}function d(y){let M=f();y.__bindingPointIndex=M;let S=i.createBuffer(),E=y.__size,_=y.usage;return i.bindBuffer(i.UNIFORM_BUFFER,S),i.bufferData(i.UNIFORM_BUFFER,E,_),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,M,S),S}function f(){for(let y=0;y<o;y++)if(a.indexOf(y)===-1)return a.push(y),y;return Ie("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function h(y){let M=r[y.id],S=y.uniforms,E=y.__cache;i.bindBuffer(i.UNIFORM_BUFFER,M);for(let _=0,A=S.length;_<A;_++){let L=S[_];if(Array.isArray(L))for(let D=0,k=L.length;D<k;D++)u(L[D],_,D,E);else u(L,_,0,E)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function u(y,M,S,E){if(x(y,M,S,E)===!0){let _=y.__offset,A=y.value;if(Array.isArray(A)){let L=0;for(let D=0;D<A.length;D++){let k=A[D],G=p(k);g(k,y.__data,L),typeof k!="number"&&typeof k!="boolean"&&!k.isMatrix3&&!ArrayBuffer.isView(k)&&(L+=G.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(A,y.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,_,y.__data)}}function g(y,M,S){typeof y=="number"||typeof y=="boolean"?M[0]=y:y.isMatrix3?(M[0]=y.elements[0],M[1]=y.elements[1],M[2]=y.elements[2],M[3]=0,M[4]=y.elements[3],M[5]=y.elements[4],M[6]=y.elements[5],M[7]=0,M[8]=y.elements[6],M[9]=y.elements[7],M[10]=y.elements[8],M[11]=0):ArrayBuffer.isView(y)?M.set(new y.constructor(y.buffer,y.byteOffset,M.length)):y.toArray(M,S)}function x(y,M,S,E){let _=y.value,A=M+"_"+S;if(E[A]===void 0)return typeof _=="number"||typeof _=="boolean"?E[A]=_:ArrayBuffer.isView(_)?E[A]=_.slice():E[A]=_.clone(),!0;{let L=E[A];if(typeof _=="number"||typeof _=="boolean"){if(L!==_)return E[A]=_,!0}else{if(ArrayBuffer.isView(_))return!0;if(L.equals(_)===!1)return L.copy(_),!0}}return!1}function m(y){let M=y.uniforms,S=0,E=16;for(let A=0,L=M.length;A<L;A++){let D=Array.isArray(M[A])?M[A]:[M[A]];for(let k=0,G=D.length;k<G;k++){let F=D[k],H=Array.isArray(F.value)?F.value:[F.value];for(let K=0,Z=H.length;K<Z;K++){let ne=H[K],X=p(ne),Q=S%E,te=Q%X.boundary,Ee=Q+te;S+=te,Ee!==0&&E-Ee<X.storage&&(S+=E-Ee),F.__data=new Float32Array(X.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=S,S+=X.storage}}}let _=S%E;return _>0&&(S+=E-_),y.__size=S,y.__cache={},this}function p(y){let M={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(M.boundary=4,M.storage=4):y.isVector2?(M.boundary=8,M.storage=8):y.isVector3||y.isColor?(M.boundary=16,M.storage=12):y.isVector4?(M.boundary=16,M.storage=16):y.isMatrix3?(M.boundary=48,M.storage=48):y.isMatrix4?(M.boundary=64,M.storage=64):y.isTexture?Me("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(M.boundary=16,M.storage=y.byteLength):Me("WebGLRenderer: Unsupported uniform value type.",y),M}function T(y){let M=y.target;M.removeEventListener("dispose",T);let S=a.indexOf(M.__bindingPointIndex);a.splice(S,1),i.deleteBuffer(r[M.id]),delete r[M.id],delete s[M.id]}function R(){for(let y in r)i.deleteBuffer(r[y]);a=[],r={},s={}}return{bind:l,update:c,dispose:R}}var vv=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Ln=null;function _v(){return Ln===null&&(Ln=new or(vv,16,16,pi,Mn),Ln.name="DFG_LUT",Ln.minFilter=vt,Ln.magFilter=vt,Ln.wrapS=cn,Ln.wrapT=cn,Ln.generateMipmaps=!1,Ln.needsUpdate=!0),Ln}var vo=class{constructor(e={}){let{canvas:t=fh(),context:n=null,depth:r=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:d="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:h=!1,outputBufferType:u=en}=e;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=a;let x=u,m=new Set([La,Pa,Ia]),p=new Set([en,yn,_r,br,Ea,Ra]),T=new Uint32Array(4),R=new Int32Array(4),y=new N,M=null,S=null,E=[],_=[],A=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=rn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let L=this,D=!1,k=null,G=null,F=null,H=null;this._outputColorSpace=ht;let K=0,Z=0,ne=null,X=-1,Q=null,te=new tt,Ee=new tt,Te=null,at=new Ce(0),Xe=0,Ze=t.width,Y=t.height,j=1,ve=null,Le=null,me=new tt(0,0,Ze,Y),ze=new tt(0,0,Ze,Y),St=!1,He=new cr,qe=!1,ot=!1,We=new Fe,ft=new N,Et=new tt,Zt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},ut=!1;function bt(){return ne===null?j:1}let P=n;function Ft(b,C){return t.getContext(b,C)}let Qe,w,v,U,z,W,ie,re,q,$,se,Se,le,ae,we,Re,Ne,I,oe,J,ce,ue,ee;try{let b={alpha:!0,depth:r,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:d,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"186"}`),t.addEventListener("webglcontextlost",ct,!1),t.addEventListener("webglcontextrestored",Je,!1),t.addEventListener("webglcontextcreationerror",hn,!1),P===null){let C="webgl2";if(P=Ft(C,b),P===null)throw Ft(C)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Ae()}catch(b){throw t.removeEventListener("webglcontextlost",ct,!1),t.removeEventListener("webglcontextrestored",Je,!1),t.removeEventListener("webglcontextcreationerror",hn,!1),Ie("WebGLRenderer: "+b.message),b}function Ae(){Qe=new T0(P),Qe.init(),ce=new hv(P,Qe),w=new m0(P,Qe,e,ce),v=new lv(P,Qe),w.reversedDepthBuffer&&h&&v.buffers.depth.setReversed(!0),G=P.createFramebuffer(),F=P.createFramebuffer(),H=P.createFramebuffer(),U=new R0(P),z=new Kg,W=new dv(P,Qe,v,z,w,ce,U),ie=new w0(L),re=new Iu(P),ue=new u0(P,re),q=new A0(P,re,U,ue),$=new I0(P,q,re,ue,U),I=new C0(P,w,W),we=new g0(z),se=new Zg(L,ie,Qe,w,ue,we),Se=new mv(L,z),le=new $g,ae=new iv(Qe),Ne=new f0(L,ie,v,$,g,l),Re=new cv(L,$,w),ee=new gv(P,U,w,v),oe=new p0(P,Qe,U),J=new E0(P,Qe,U),U.programs=se.programs,L.capabilities=w,L.extensions=Qe,L.properties=z,L.renderLists=le,L.shadowMap=Re,L.state=v,L.info=U}x!==en&&(A=new L0(x,t.width,t.height,o,r,s));let xe=new al(L,P);this.xr=xe,this.getContext=function(){return P},this.getContextAttributes=function(){return P.getContextAttributes()},this.forceContextLoss=function(){let b=Qe.get("WEBGL_lose_context");b&&b.loseContext()},this.forceContextRestore=function(){let b=Qe.get("WEBGL_lose_context");b&&b.restoreContext()},this.getPixelRatio=function(){return j},this.setPixelRatio=function(b){b!==void 0&&(j=b,this.setSize(Ze,Y,!1))},this.getSize=function(b){return b.set(Ze,Y)},this.setSize=function(b,C,V=!0){if(xe.isPresenting){Me("WebGLRenderer: Can't change size while VR device is presenting.");return}Ze=b,Y=C,t.width=Math.floor(b*j),t.height=Math.floor(C*j),V===!0&&(t.style.width=b+"px",t.style.height=C+"px"),A!==null&&A.setSize(t.width,t.height),this.setViewport(0,0,b,C)},this.getDrawingBufferSize=function(b){return b.set(Ze*j,Y*j).floor()},this.setDrawingBufferSize=function(b,C,V){Ze=b,Y=C,j=V,t.width=Math.floor(b*V),t.height=Math.floor(C*V),this.setViewport(0,0,b,C)},this.setEffects=function(b){if(x===en){Ie("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(b){for(let C=0;C<b.length;C++)if(b[C].isOutputPass===!0){Me("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(b||[])},this.getCurrentViewport=function(b){return b.copy(te)},this.getViewport=function(b){return b.copy(me)},this.setViewport=function(b,C,V,O){b.isVector4?me.set(b.x,b.y,b.z,b.w):me.set(b,C,V,O),v.viewport(te.copy(me).multiplyScalar(j).round())},this.getScissor=function(b){return b.copy(ze)},this.setScissor=function(b,C,V,O){b.isVector4?ze.set(b.x,b.y,b.z,b.w):ze.set(b,C,V,O),v.scissor(Ee.copy(ze).multiplyScalar(j).round())},this.getScissorTest=function(){return St},this.setScissorTest=function(b){v.setScissorTest(St=b)},this.setOpaqueSort=function(b){ve=b},this.setTransparentSort=function(b){Le=b},this.getClearColor=function(b){return b.copy(Ne.getClearColor())},this.setClearColor=function(){Ne.setClearColor(...arguments)},this.getClearAlpha=function(){return Ne.getClearAlpha()},this.setClearAlpha=function(){Ne.setClearAlpha(...arguments)},this.clear=function(b=!0,C=!0,V=!0){let O=0;if(b){let B=!1;if(ne!==null){let fe=ne.texture.format;B=m.has(fe)}if(B){let fe=ne.texture.type,ge=p.has(fe),he=Ne.getClearColor(),_e=Ne.getClearAlpha(),ye=he.r,Ue=he.g,Ve=he.b;ge?(T[0]=ye,T[1]=Ue,T[2]=Ve,T[3]=_e,P.clearBufferuiv(P.COLOR,0,T)):(R[0]=ye,R[1]=Ue,R[2]=Ve,R[3]=_e,P.clearBufferiv(P.COLOR,0,R))}else O|=P.COLOR_BUFFER_BIT}C&&(O|=P.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),V&&(O|=P.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),O!==0&&P.clear(O)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(b){b.setRenderer(this),k=b},this.dispose=function(){t.removeEventListener("webglcontextlost",ct,!1),t.removeEventListener("webglcontextrestored",Je,!1),t.removeEventListener("webglcontextcreationerror",hn,!1),Ne.dispose(),le.dispose(),ae.dispose(),z.dispose(),ie.dispose(),$.dispose(),ue.dispose(),ee.dispose(),se.dispose(),xe.dispose(),xe.removeEventListener("sessionstart",kl),xe.removeEventListener("sessionend",Hl),gi.stop()};function ct(b){b.preventDefault(),Br("WebGLRenderer: Context Lost."),D=!0}function Je(){Br("WebGLRenderer: Context Restored."),D=!1;let b=U.autoReset,C=Re.enabled,V=Re.autoUpdate,O=Re.needsUpdate,B=Re.type;Ae(),U.autoReset=b,Re.enabled=C,Re.autoUpdate=V,Re.needsUpdate=O,Re.type=B}function hn(b){Ie("WebGLRenderer: A WebGL context could not be created. Reason: ",b.statusMessage)}function Sn(b){let C=b.target;C.removeEventListener("dispose",Sn),bf(C)}function bf(b){xf(b),z.remove(b)}function xf(b){let C=z.get(b).programs;C!==void 0&&(C.forEach(function(V){se.releaseProgram(V)}),b.isShaderMaterial&&se.releaseShaderCache(b))}this.renderBufferDirect=function(b,C,V,O,B,fe){C===null&&(C=Zt);let ge=B.isMesh&&B.matrixWorld.determinantAffine()<0,he=Sf(b,C,V,O,B);v.setMaterial(O,ge);let _e=V.index,ye=1;if(O.wireframe===!0){if(_e=q.getWireframeAttribute(V),_e===void 0)return;ye=2}let Ue=V.drawRange,Ve=V.attributes.position,be=Ue.start*ye,$e=(Ue.start+Ue.count)*ye;fe!==null&&(be=Math.max(be,fe.start*ye),$e=Math.min($e,(fe.start+fe.count)*ye)),_e!==null?(be=Math.max(be,0),$e=Math.min($e,_e.count)):Ve!=null&&(be=Math.max(be,0),$e=Math.min($e,Ve.count));let xt=$e-be;if(xt<0||xt===1/0)return;ue.setup(B,O,he,V,_e);let dt,it=oe;if(_e!==null&&(dt=re.get(_e),it=J,it.setIndex(dt)),B.isMesh)O.wireframe===!0?(v.setLineWidth(O.wireframeLinewidth*bt()),it.setMode(P.LINES)):it.setMode(P.TRIANGLES);else if(B.isLine){let Nt=O.linewidth;Nt===void 0&&(Nt=1),v.setLineWidth(Nt*bt()),B.isLineSegments?it.setMode(P.LINES):B.isLineLoop?it.setMode(P.LINE_LOOP):it.setMode(P.LINE_STRIP)}else B.isPoints?it.setMode(P.POINTS):B.isSprite&&it.setMode(P.TRIANGLES);if(B.isBatchedMesh)if(Qe.get("WEBGL_multi_draw"))it.renderMultiDraw(B._multiDrawStarts,B._multiDrawCounts,B._multiDrawCount);else{let Nt=B._multiDrawStarts,pe=B._multiDrawCounts,zt=B._multiDrawCount,Ye=_e?re.get(_e).bytesPerElement:1,an=z.get(O).currentProgram.getUniforms();for(let wn=0;wn<zt;wn++)an.setValue(P,"_gl_DrawID",wn),it.render(Nt[wn]/Ye,pe[wn])}else if(B.isInstancedMesh)it.renderInstances(be,xt,B.count);else if(V.isInstancedBufferGeometry){let Nt=V._maxInstanceCount!==void 0?V._maxInstanceCount:1/0,pe=Math.min(V.instanceCount,Nt);it.renderInstances(be,xt,pe)}else it.render(be,xt)};function zl(b,C,V,O){k!==null&&b.isNodeMaterial&&k.setObject(O,b),qe===!0&&we.setState(b,V,!1),b.transparent===!0&&b.side===Qt&&b.forceSinglePass===!1?(b.side=Yt,b.needsUpdate=!0,Ss(b,C,O),b.side=Pn,b.needsUpdate=!0,Ss(b,C,O),b.side=Qt):Ss(b,C,O)}this.compile=function(b,C,V=null){V===null&&(V=b),k!==null&&k.renderStart(b,C,V),S=ae.get(V),S.init(C),_.push(S),V.traverseVisible(function(B){B.isLight&&B.layers.test(C.layers)&&(S.pushLight(B),B.castShadow&&S.pushShadow(B))}),b!==V&&b.traverseVisible(function(B){B.isLight&&B.layers.test(C.layers)&&(S.pushLight(B),B.castShadow&&S.pushShadow(B))}),S.setupLights(),k!==null&&k.updateLights(S.state.lightsArray),ot=this.localClippingEnabled,qe=we.init(this.clippingPlanes,ot),qe===!0&&we.setGlobalState(this.clippingPlanes,C),k!==null&&Re.render(S.state.shadowsArray,V,C);let O=new Set;return b.traverse(function(B){if(!(B.isMesh||B.isPoints||B.isLine||B.isSprite))return;let fe=B.material;if(fe)if(Array.isArray(fe))for(let ge=0;ge<fe.length;ge++){let he=fe[ge];zl(he,V,C,B),O.add(he)}else zl(fe,V,C,B),O.add(fe)}),S=_.pop(),k!==null&&k.renderEnd(),O},this.compileAsync=function(b,C,V=null){let O=this.compile(b,C,V);return new Promise(B=>{function fe(){if(O.forEach(function(ge){let _e=z.get(ge).currentProgram;(_e===void 0||_e.isReady())&&O.delete(ge)}),O.size===0){B(b);return}setTimeout(fe,10)}Qe.get("KHR_parallel_shader_compile")!==null?fe():setTimeout(fe,10)})};let Lo=null;function yf(b){Lo&&Lo(b)}function kl(){gi.stop()}function Hl(){gi.start()}let gi=new Hh;gi.setAnimationLoop(yf),typeof self<"u"&&gi.setContext(self),this.setAnimationLoop=function(b){Lo=b,xe.setAnimationLoop(b),b===null?gi.stop():gi.start()},xe.addEventListener("sessionstart",kl),xe.addEventListener("sessionend",Hl),this.render=function(b,C){if(C!==void 0&&C.isCamera!==!0){Ie("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(D===!0)return;k!==null&&k.renderStart(b,C);let V=xe.enabled===!0&&xe.isPresenting===!0,O=A!==null&&(ne===null||V)&&A.begin(L,ne);if(b.matrixWorldAutoUpdate===!0&&b.updateMatrixWorld(),C.parent===null&&C.matrixWorldAutoUpdate===!0&&C.updateMatrixWorld(),xe.enabled===!0&&xe.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(xe.cameraAutoUpdate===!0&&xe.updateCamera(C),C=xe.getCamera()),b.isScene===!0&&b.onBeforeRender(L,b,C,ne),S=ae.get(b,_.length),S.init(C),S.state.textureUnits=W.getTextureUnits(),_.push(S),We.multiplyMatrices(C.projectionMatrix,C.matrixWorldInverse),He.setFromProjectionMatrix(We,vn,C.reversedDepth),ot=this.localClippingEnabled,qe=we.init(this.clippingPlanes,ot),M=le.get(b,E.length),M.init(),E.push(M),xe.enabled===!0&&xe.isPresenting===!0){let ge=L.xr.getDepthSensingMesh();ge!==null&&Fo(ge,C,-1/0,L.sortObjects)}Fo(b,C,0,L.sortObjects),M.finish(),k!==null&&k.updateLights(S.state.lightsArray),L.sortObjects===!0&&M.sort(ve,Le),ut=xe.enabled===!1||xe.isPresenting===!1||xe.hasDepthSensing()===!1,ut&&Ne.addToRenderList(M,b),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),qe===!0&&we.beginShadows();let B=S.state.shadowsArray;if(Re.render(B,b,C),qe===!0&&we.endShadows(),(O&&A.hasRenderPass())===!1){let ge=M.opaque,he=M.transmissive;if(S.setupLights(),C.isArrayCamera){let _e=C.cameras;if(he.length>0)for(let ye=0,Ue=_e.length;ye<Ue;ye++){let Ve=_e[ye];Gl(ge,he,b,Ve)}ut&&Ne.render(b);for(let ye=0,Ue=_e.length;ye<Ue;ye++){let Ve=_e[ye];Vl(M,b,Ve,Ve.viewport)}}else he.length>0&&Gl(ge,he,b,C),ut&&Ne.render(b),Vl(M,b,C)}ne!==null&&Z===0&&(W.updateMultisampleRenderTarget(ne),W.updateRenderTargetMipmap(ne)),O&&A.end(L),b.isScene===!0&&b.onAfterRender(L,b,C),ue.resetDefaultState(),X=-1,Q=null,_.pop(),_.length>0?(S=_[_.length-1],W.setTextureUnits(S.state.textureUnits),qe===!0&&we.setGlobalState(L.clippingPlanes,S.state.camera)):S=null,E.pop(),E.length>0?M=E[E.length-1]:M=null,k!==null&&k.renderEnd()};function Fo(b,C,V,O){if(b.visible===!1)return;if(b.layers.test(C.layers)){if(b.isGroup)V=b.renderOrder;else if(b.isLOD)b.autoUpdate===!0&&b.update(C);else if(b.isLightProbeGrid)S.pushLightProbeGrid(b);else if(b.isLight)S.pushLight(b),b.castShadow&&S.pushShadow(b);else if(b.isSprite){if(!b.frustumCulled||b.intersectsFrustum(He)){O&&Et.setFromMatrixPosition(b.matrixWorld).applyMatrix4(We);let ge=$.update(b),he=b.material;he.visible&&M.push(b,ge,he,V,Et.z,null,C)}}else if((b.isMesh||b.isLine||b.isPoints)&&(!b.frustumCulled||b.intersectsFrustum(He))){let ge=$.update(b),he=b.material;if(O&&(b.boundingSphere!==void 0?(b.boundingSphere===null&&b.computeBoundingSphere(),Et.copy(b.boundingSphere.center)):(ge.boundingSphere===null&&ge.computeBoundingSphere(),Et.copy(ge.boundingSphere.center)),Et.applyMatrix4(b.matrixWorld).applyMatrix4(We)),Array.isArray(he)){let _e=ge.groups;for(let ye=0,Ue=_e.length;ye<Ue;ye++){let Ve=_e[ye],be=he[Ve.materialIndex];be&&be.visible&&M.push(b,ge,be,V,Et.z,Ve,C)}}else he.visible&&M.push(b,ge,he,V,Et.z,null,C)}}let fe=b.children;for(let ge=0,he=fe.length;ge<he;ge++)Fo(fe[ge],C,V,O)}function Vl(b,C,V,O){let{opaque:B,transmissive:fe,transparent:ge}=b;S.setupLightsView(V),qe===!0&&we.setGlobalState(L.clippingPlanes,V),O&&v.viewport(te.copy(O)),B.length>0&&Ms(B,C,V),fe.length>0&&Ms(fe,C,V),ge.length>0&&Ms(ge,C,V),v.buffers.depth.setTest(!0),v.buffers.depth.setMask(!0),v.buffers.color.setMask(!0),v.setPolygonOffset(!1)}function Gl(b,C,V,O){if((V.isScene===!0?V.overrideMaterial:null)!==null)return;if(S.state.transmissionRenderTarget[O.id]===void 0){let be=Qe.has("EXT_color_buffer_half_float")||Qe.has("EXT_color_buffer_float");S.state.transmissionRenderTarget[O.id]=new Pt(1,1,{generateMipmaps:!0,type:be?Mn:en,minFilter:xn,samples:Math.max(4,w.samples),stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:Be.workingColorSpace})}let fe=S.state.transmissionRenderTarget[O.id],ge=O.viewport||te;fe.setSize(ge.z*L.transmissionResolutionScale,ge.w*L.transmissionResolutionScale);let he=L.getRenderTarget(),_e=L.getActiveCubeFace(),ye=L.getActiveMipmapLevel();L.setRenderTarget(fe),L.getClearColor(at),Xe=L.getClearAlpha(),Xe<1&&L.setClearColor(16777215,.5),L.clear(),ut&&Ne.render(V);let Ue=L.toneMapping;L.toneMapping=rn;let Ve=O.viewport;if(O.viewport!==void 0&&(O.viewport=void 0),S.setupLightsView(O),qe===!0&&we.setGlobalState(L.clippingPlanes,O),Ms(b,V,O),W.updateMultisampleRenderTarget(fe),W.updateRenderTargetMipmap(fe),Qe.has("WEBGL_multisampled_render_to_texture")===!1){let be=!1;for(let $e=0,xt=C.length;$e<xt;$e++){let dt=C[$e],{object:it,geometry:Nt,material:pe,group:zt}=dt;if(pe.side===Qt&&it.layers.test(O.layers)){let Ye=pe.side;pe.side=Yt,pe.needsUpdate=!0,Wl(it,V,O,Nt,pe,zt),pe.side=Ye,pe.needsUpdate=!0,be=!0}}be===!0&&(W.updateMultisampleRenderTarget(fe),W.updateRenderTargetMipmap(fe))}L.setRenderTarget(he,_e,ye),L.setClearColor(at,Xe),Ve!==void 0&&(O.viewport=Ve),L.toneMapping=Ue}function Ms(b,C,V){let O=C.isScene===!0?C.overrideMaterial:null;for(let B=0,fe=b.length;B<fe;B++){let ge=b[B],{object:he,geometry:_e,group:ye}=ge,Ue=ge.material;Ue.allowOverride===!0&&O!==null&&(Ue=O),he.layers.test(V.layers)&&Wl(he,C,V,_e,Ue,ye)}}function Wl(b,C,V,O,B,fe){k!==null&&B.isNodeMaterial&&k.setObject(b,B),b.onBeforeRender(L,C,V,O,B,fe),b.modelViewMatrix.multiplyMatrices(V.matrixWorldInverse,b.matrixWorld),b.normalMatrix.getNormalMatrix(b.modelViewMatrix),B.onBeforeRender(L,C,V,O,b,fe),B.transparent===!0&&B.side===Qt&&B.forceSinglePass===!1?(B.side=Yt,B.needsUpdate=!0,L.renderBufferDirect(V,C,O,B,b,fe),B.side=Pn,B.needsUpdate=!0,L.renderBufferDirect(V,C,O,B,b,fe),B.side=Qt):L.renderBufferDirect(V,C,O,B,b,fe),b.onAfterRender(L,C,V,O,B,fe)}function Ss(b,C,V){C.isScene!==!0&&(C=Zt);let O=z.get(b),B=S.state.lights,fe=S.state.shadowsArray,ge=B.state.version,he=se.getParameters(b,B.state,fe,C,V,S.state.lightProbeGridArray),_e=se.getProgramCacheKey(he),ye=O.programs;O.environment=b.isMeshStandardMaterial||b.isMeshLambertMaterial||b.isMeshPhongMaterial?C.environment:null,O.fog=C.fog;let Ue=b.isMeshStandardMaterial||b.isMeshLambertMaterial&&!b.envMap||b.isMeshPhongMaterial&&!b.envMap;O.envMap=ie.get(b.envMap||O.environment,Ue),O.envMapRotation=O.environment!==null&&b.envMap===null?C.environmentRotation:b.envMapRotation,ye===void 0&&(b.addEventListener("dispose",Sn),ye=new Map,O.programs=ye);let Ve=ye.get(_e);if(Ve!==void 0){if(O.currentProgram===Ve&&O.lightsStateVersion===ge)return Yl(b,he),Ve}else he.uniforms=se.getUniforms(b),k!==null&&b.isNodeMaterial&&k.build(b,V,he),b.onBeforeCompile(he,L),Ve=se.acquireProgram(he,_e),ye.set(_e,Ve),O.uniforms=he.uniforms;let be=O.uniforms;return(!b.isShaderMaterial&&!b.isRawShaderMaterial||b.clipping===!0)&&(be.clippingPlanes=we.uniform),Yl(b,he),O.needsLights=Tf(b),O.lightsStateVersion=ge,O.needsLights&&(be.ambientLightColor.value=B.state.ambient,be.lightProbe.value=B.state.probe,be.sunLights.value=B.state.sun,be.sunLightShadows.value=B.state.sunShadow,be.directionalLights.value=B.state.directional,be.directionalLightShadows.value=B.state.directionalShadow,be.spotLights.value=B.state.spot,be.spotLightShadows.value=B.state.spotShadow,be.rectAreaLights.value=B.state.rectArea,be.ltc_1.value=B.state.rectAreaLTC1,be.ltc_2.value=B.state.rectAreaLTC2,be.pointLights.value=B.state.point,be.pointLightShadows.value=B.state.pointShadow,be.hemisphereLights.value=B.state.hemi,be.sunShadowMatrix.value=B.state.sunShadowMatrix,be.sunShadowCascade.value=B.state.sunShadowCascade,be.directionalShadowMatrix.value=B.state.directionalShadowMatrix,be.spotLightMatrix.value=B.state.spotLightMatrix,be.spotLightMap.value=B.state.spotLightMap,be.pointShadowMatrix.value=B.state.pointShadowMatrix),O.lightProbeGrid=S.state.lightProbeGridArray.length>0,O.currentProgram=Ve,O.uniformsList=null,Ve}function Xl(b){if(b.uniformsList===null){let C=b.currentProgram.getUniforms();b.uniformsList=Sr.seqWithValue(C.seq,b.uniforms)}return b.uniformsList}function Yl(b,C){let V=z.get(b);V.outputColorSpace=C.outputColorSpace,V.batching=C.batching,V.batchingColor=C.batchingColor,V.instancing=C.instancing,V.instancingColor=C.instancingColor,V.instancingMorph=C.instancingMorph,V.skinning=C.skinning,V.morphTargets=C.morphTargets,V.morphNormals=C.morphNormals,V.morphColors=C.morphColors,V.morphTargetsCount=C.morphTargetsCount,V.numClippingPlanes=C.numClippingPlanes,V.numIntersection=C.numClipIntersection,V.vertexAlphas=C.vertexAlphas,V.vertexTangents=C.vertexTangents,V.toneMapping=C.toneMapping}function Mf(b,C){if(b.length===0)return null;if(b.length===1)return b[0].texture!==null?b[0]:null;y.setFromMatrixPosition(C.matrixWorld);for(let V=0,O=b.length;V<O;V++){let B=b[V];if(B.texture!==null&&B.boundingBox.containsPoint(y))return B}return null}function Sf(b,C,V,O,B){C.isScene!==!0&&(C=Zt),W.resetTextureUnits();let fe=C.fog,ge=O.isMeshStandardMaterial||O.isMeshLambertMaterial||O.isMeshPhongMaterial?C.environment:null,he=ne===null?L.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:Be.workingColorSpace,_e=O.isMeshStandardMaterial||O.isMeshLambertMaterial&&!O.envMap||O.isMeshPhongMaterial&&!O.envMap,ye=ie.get(O.envMap||ge,_e),Ue=O.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,Ve=!!V.attributes.tangent&&(!!O.normalMap||O.anisotropy>0),be=!!V.morphAttributes.position,$e=!!V.morphAttributes.normal,xt=!!V.morphAttributes.color,dt=rn;O.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(dt=L.toneMapping);let it=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,Nt=it!==void 0?it.length:0,pe=z.get(O),zt=S.state.lights;if(qe===!0&&(ot===!0||b!==Q)){let lt=b===Q&&O.id===X;we.setState(O,b,lt)}let Ye=!1;O.version===pe.__version?(pe.needsLights&&pe.lightsStateVersion!==zt.state.version||pe.outputColorSpace!==he||B.isBatchedMesh&&pe.batching===!1||!B.isBatchedMesh&&pe.batching===!0||B.isBatchedMesh&&pe.batchingColor===!0&&B._colorsTexture===null||B.isBatchedMesh&&pe.batchingColor===!1&&B._colorsTexture!==null||B.isInstancedMesh&&pe.instancing===!1||!B.isInstancedMesh&&pe.instancing===!0||B.isSkinnedMesh&&pe.skinning===!1||!B.isSkinnedMesh&&pe.skinning===!0||B.isInstancedMesh&&pe.instancingColor===!0&&B.instanceColor===null||B.isInstancedMesh&&pe.instancingColor===!1&&B.instanceColor!==null||B.isInstancedMesh&&pe.instancingMorph===!0&&B.morphTexture===null||B.isInstancedMesh&&pe.instancingMorph===!1&&B.morphTexture!==null||pe.envMap!==ye||O.fog===!0&&pe.fog!==fe||pe.numClippingPlanes!==void 0&&(pe.numClippingPlanes!==we.numPlanes||pe.numIntersection!==we.numIntersection)||pe.vertexAlphas!==Ue||pe.vertexTangents!==Ve||pe.morphTargets!==be||pe.morphNormals!==$e||pe.morphColors!==xt||pe.toneMapping!==dt||pe.morphTargetsCount!==Nt||!!pe.lightProbeGrid!=S.state.lightProbeGridArray.length>0)&&(Ye=!0):(Ye=!0,pe.__version=O.version);let an=pe.currentProgram;Ye===!0&&(an=Ss(O,C,B),k&&O.isNodeMaterial&&k.onUpdateProgram(O,an,pe));let wn=!1,jn=!1,Di=!1,nt=an.getUniforms(),gt=pe.uniforms;if(v.useProgram(an.program)&&(wn=!0,jn=!0,Di=!0),O.id!==X&&(X=O.id,jn=!0),pe.needsLights){let lt=Mf(S.state.lightProbeGridArray,B);pe.lightProbeGrid!==lt&&(pe.lightProbeGrid=lt,jn=!0)}if(wn||Q!==b){v.buffers.depth.getReversed()&&b.reversedDepth!==!0&&(b._reversedDepth=!0,b.updateProjectionMatrix()),nt.setValue(P,"projectionMatrix",b.projectionMatrix),nt.setValue(P,"viewMatrix",b.matrixWorldInverse);let ei=nt.map.cameraPosition;ei!==void 0&&ei.setValue(P,ft.setFromMatrixPosition(b.matrixWorld)),w.logarithmicDepthBuffer&&nt.setValue(P,"logDepthBufFC",2/(Math.log(b.far+1)/Math.LN2)),(O.isMeshPhongMaterial||O.isMeshToonMaterial||O.isMeshLambertMaterial||O.isMeshBasicMaterial||O.isMeshStandardMaterial||O.isShaderMaterial)&&nt.setValue(P,"isOrthographic",b.isOrthographicCamera===!0),Q!==b&&(Q=b,jn=!0,Di=!0)}if(pe.needsLights&&(zt.state.sunShadowMap.length>0&&nt.setValue(P,"sunShadowMap",zt.state.sunShadowMap,W),zt.state.directionalShadowMap.length>0&&nt.setValue(P,"directionalShadowMap",zt.state.directionalShadowMap,W),zt.state.spotShadowMap.length>0&&nt.setValue(P,"spotShadowMap",zt.state.spotShadowMap,W),zt.state.pointShadowMap.length>0&&nt.setValue(P,"pointShadowMap",zt.state.pointShadowMap,W)),B.isSkinnedMesh){nt.setOptional(P,B,"bindMatrix"),nt.setOptional(P,B,"bindMatrixInverse");let lt=B.skeleton;lt&&(lt.boneTexture===null&&lt.computeBoneTexture(),nt.setValue(P,"boneTexture",lt.boneTexture,W))}B.isBatchedMesh&&(nt.setOptional(P,B,"batchingTexture"),nt.setValue(P,"batchingTexture",B._matricesTexture,W),nt.setOptional(P,B,"batchingIdTexture"),nt.setValue(P,"batchingIdTexture",B._indirectTexture,W),nt.setOptional(P,B,"batchingColorTexture"),B._colorsTexture!==null&&nt.setValue(P,"batchingColorTexture",B._colorsTexture,W));let Qn=V.morphAttributes;if((Qn.position!==void 0||Qn.normal!==void 0||Qn.color!==void 0)&&I.update(B,V,an),(jn||pe.receiveShadow!==B.receiveShadow)&&(pe.receiveShadow=B.receiveShadow,nt.setValue(P,"receiveShadow",B.receiveShadow)),(O.isMeshStandardMaterial||O.isMeshLambertMaterial||O.isMeshPhongMaterial)&&O.envMap===null&&C.environment!==null&&(gt.envMapIntensity.value=C.environmentIntensity),gt.dfgLUT!==void 0&&(gt.dfgLUT.value=_v()),jn){if(nt.setValue(P,"toneMappingExposure",L.toneMappingExposure),pe.needsLights&&wf(gt,Di),fe&&O.fog===!0&&Se.refreshFogUniforms(gt,fe),Se.refreshMaterialUniforms(gt,O,j,Y,S.state.transmissionRenderTarget[b.id]),pe.needsLights&&pe.lightProbeGrid){let lt=pe.lightProbeGrid;gt.probesSH.value=lt.texture,gt.probesMin.value.copy(lt.boundingBox.min),gt.probesMax.value.copy(lt.boundingBox.max),gt.probesResolution.value.copy(lt.resolution)}Sr.upload(P,Xl(pe),gt,W)}if(O.isShaderMaterial&&O.uniformsNeedUpdate===!0&&(Sr.upload(P,Xl(pe),gt,W),O.uniformsNeedUpdate=!1),O.isSpriteMaterial&&nt.setValue(P,"center",B.center),nt.setValue(P,"modelViewMatrix",B.modelViewMatrix),nt.setValue(P,"normalMatrix",B.normalMatrix),nt.setValue(P,"modelMatrix",B.matrixWorld),O.uniformsGroups!==void 0){let lt=O.uniformsGroups;for(let ei=0,Ui=lt.length;ei<Ui;ei++){let Zl=lt[ei];ee.update(Zl,an),ee.bind(Zl,an)}}return an}function wf(b,C){b.ambientLightColor.needsUpdate=C,b.lightProbe.needsUpdate=C,b.sunLights.needsUpdate=C,b.sunLightShadows.needsUpdate=C,b.directionalLights.needsUpdate=C,b.directionalLightShadows.needsUpdate=C,b.pointLights.needsUpdate=C,b.pointLightShadows.needsUpdate=C,b.spotLights.needsUpdate=C,b.spotLightShadows.needsUpdate=C,b.rectAreaLights.needsUpdate=C,b.hemisphereLights.needsUpdate=C}function Tf(b){return b.isMeshLambertMaterial||b.isMeshToonMaterial||b.isMeshPhongMaterial||b.isMeshStandardMaterial||b.isShadowMaterial||b.isShaderMaterial&&b.lights===!0}this.getActiveCubeFace=function(){return K},this.getActiveMipmapLevel=function(){return Z},this.getRenderTarget=function(){return ne},this.setRenderTargetTextures=function(b,C,V){let O=z.get(b);O.__autoAllocateDepthBuffer=b.resolveDepthBuffer===!1,O.__autoAllocateDepthBuffer===!1&&(O.__useRenderToTexture=!1),z.get(b.texture).__webglTexture=C,z.get(b.depthTexture).__webglTexture=O.__autoAllocateDepthBuffer?void 0:V,O.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(b,C){let V=z.get(b);V.__webglFramebuffer=C,V.__useDefaultFramebuffer=C===void 0},this.setRenderTarget=function(b,C=0,V=0){ne=b,K=C,Z=V;let O=null,B=!1,fe=!1;if(b){let he=z.get(b);if(he.__useDefaultFramebuffer!==void 0){v.bindFramebuffer(P.FRAMEBUFFER,he.__webglFramebuffer),te.copy(b.viewport),Ee.copy(b.scissor),Te=b.scissorTest,v.viewport(te),v.scissor(Ee),v.setScissorTest(Te),X=-1;return}else if(he.__webglFramebuffer===void 0)W.setupRenderTarget(b);else if(he.__hasExternalTextures)W.rebindTextures(b,z.get(b.texture).__webglTexture,z.get(b.depthTexture).__webglTexture);else if(b.depthBuffer){let Ue=b.depthTexture;if(he.__boundDepthTexture!==Ue){if(Ue!==null&&z.has(Ue)&&(b.width!==Ue.image.width||b.height!==Ue.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");W.setupDepthRenderbuffer(b)}}let _e=b.texture;(_e.isData3DTexture||_e.isDataArrayTexture||_e.isCompressedArrayTexture)&&(fe=!0);let ye=z.get(b).__webglFramebuffer;b.isWebGLCubeRenderTarget?(Array.isArray(ye[C])?O=ye[C][V]:O=ye[C],B=!0):b.samples>0&&W.useMultisampledRTT(b)===!1?O=z.get(b).__webglMultisampledFramebuffer:Array.isArray(ye)?O=ye[V]:O=ye,te.copy(b.viewport),Ee.copy(b.scissor),Te=b.scissorTest}else te.copy(me).multiplyScalar(j).floor(),Ee.copy(ze).multiplyScalar(j).floor(),Te=St;if(V!==0&&(O=G),v.bindFramebuffer(P.FRAMEBUFFER,O)&&v.drawBuffers(b,O),v.viewport(te),v.scissor(Ee),v.setScissorTest(Te),B){let he=z.get(b.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_CUBE_MAP_POSITIVE_X+C,he.__webglTexture,V)}else if(fe){let he=C;for(let _e=0;_e<b.textures.length;_e++){let ye=z.get(b.textures[_e]);P.framebufferTextureLayer(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0+_e,ye.__webglTexture,V,he)}}else if(b!==null&&V!==0){let he=z.get(b.texture);P.framebufferTexture2D(P.FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,he.__webglTexture,V)}X=-1};function ql(b){let C=z.get(b);return(C.__readFormat!==b.format||C.__readType!==b.type)&&(C.__readFormat=b.format,C.__readType=b.type,C.__formatReadable=w.textureFormatReadable(b.format),C.__typeReadable=w.textureTypeReadable(b.type)),C}this.readRenderTargetPixels=function(b,C,V,O,B,fe,ge,he=0){if(!(b&&b.isWebGLRenderTarget)){Ie("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let _e=z.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&ge!==void 0&&(_e=_e[ge]),_e){v.bindFramebuffer(P.FRAMEBUFFER,_e);try{let ye=b.textures[he],Ue=ye.format,Ve=ye.type;b.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+he);let be=ql(ye);if(be.__formatReadable===!1){Ie("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(be.__typeReadable===!1){Ie("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}C>=0&&C<=b.width-O&&V>=0&&V<=b.height-B&&P.readPixels(C,V,O,B,ce.convert(Ue),ce.convert(Ve),fe)}finally{let ye=ne!==null?z.get(ne).__webglFramebuffer:null;v.bindFramebuffer(P.FRAMEBUFFER,ye)}}},this.readRenderTargetPixelsAsync=async function(b,C,V,O,B,fe,ge,he=0){if(!(b&&b.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let _e=z.get(b).__webglFramebuffer;if(b.isWebGLCubeRenderTarget&&ge!==void 0&&(_e=_e[ge]),_e)if(C>=0&&C<=b.width-O&&V>=0&&V<=b.height-B){v.bindFramebuffer(P.FRAMEBUFFER,_e);let ye=b.textures[he],Ue=ye.format,Ve=ye.type;b.textures.length>1&&P.readBuffer(P.COLOR_ATTACHMENT0+he);let be=ql(ye);if(be.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(be.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let $e=P.createBuffer();P.bindBuffer(P.PIXEL_PACK_BUFFER,$e),P.bufferData(P.PIXEL_PACK_BUFFER,fe.byteLength,P.STREAM_READ),P.readPixels(C,V,O,B,ce.convert(Ue),ce.convert(Ve),0),P.bindBuffer(P.PIXEL_PACK_BUFFER,null);let xt=ne!==null?z.get(ne).__webglFramebuffer:null;v.bindFramebuffer(P.FRAMEBUFFER,xt);let dt=P.fenceSync(P.SYNC_GPU_COMMANDS_COMPLETE,0);return P.flush(),await ph(P,dt,4),P.bindBuffer(P.PIXEL_PACK_BUFFER,$e),P.getBufferSubData(P.PIXEL_PACK_BUFFER,0,fe),P.bindBuffer(P.PIXEL_PACK_BUFFER,null),P.deleteBuffer($e),P.deleteSync(dt),fe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(b,C=null,V=0){let O=Math.pow(2,-V),B=Math.floor(b.image.width*O),fe=Math.floor(b.image.height*O),ge=C!==null?C.x:0,he=C!==null?C.y:0;W.setTexture2D(b,0),P.copyTexSubImage2D(P.TEXTURE_2D,V,0,0,ge,he,B,fe),v.unbindTexture()},this.copyTextureToTexture=function(b,C,V=null,O=null,B=0,fe=0){let ge,he,_e,ye,Ue,Ve,be,$e,xt,dt=b.isCompressedTexture?b.mipmaps[fe]:b.image;if(V!==null)ge=V.max.x-V.min.x,he=V.max.y-V.min.y,_e=V.isBox3?V.max.z-V.min.z:1,ye=V.min.x,Ue=V.min.y,Ve=V.isBox3?V.min.z:0;else{let gt=Math.pow(2,-B);ge=Math.floor(dt.width*gt),he=Math.floor(dt.height*gt),b.isDataArrayTexture?_e=dt.depth:b.isData3DTexture?_e=Math.floor(dt.depth*gt):_e=1,ye=0,Ue=0,Ve=0}O!==null?(be=O.x,$e=O.y,xt=O.z):(be=0,$e=0,xt=0);let it=ce.convert(C.format),Nt=ce.convert(C.type),pe;C.isData3DTexture?(W.setTexture3D(C,0),pe=P.TEXTURE_3D):C.isDataArrayTexture||C.isCompressedArrayTexture?(W.setTexture2DArray(C,0),pe=P.TEXTURE_2D_ARRAY):(W.setTexture2D(C,0),pe=P.TEXTURE_2D),v.activeTexture(P.TEXTURE0),v.pixelStorei(P.UNPACK_FLIP_Y_WEBGL,C.flipY),v.pixelStorei(P.UNPACK_PREMULTIPLY_ALPHA_WEBGL,C.premultiplyAlpha),v.pixelStorei(P.UNPACK_ALIGNMENT,C.unpackAlignment);let zt=v.getParameter(P.UNPACK_ROW_LENGTH),Ye=v.getParameter(P.UNPACK_IMAGE_HEIGHT),an=v.getParameter(P.UNPACK_SKIP_PIXELS),wn=v.getParameter(P.UNPACK_SKIP_ROWS),jn=v.getParameter(P.UNPACK_SKIP_IMAGES);v.pixelStorei(P.UNPACK_ROW_LENGTH,dt.width),v.pixelStorei(P.UNPACK_IMAGE_HEIGHT,dt.height),v.pixelStorei(P.UNPACK_SKIP_PIXELS,ye),v.pixelStorei(P.UNPACK_SKIP_ROWS,Ue),v.pixelStorei(P.UNPACK_SKIP_IMAGES,Ve);let Di=b.isDataArrayTexture||b.isData3DTexture,nt=C.isDataArrayTexture||C.isData3DTexture;if(b.isDepthTexture){let gt=z.get(b),Qn=z.get(C),lt=z.get(gt.__renderTarget),ei=z.get(Qn.__renderTarget);v.bindFramebuffer(P.READ_FRAMEBUFFER,lt.__webglFramebuffer),v.bindFramebuffer(P.DRAW_FRAMEBUFFER,ei.__webglFramebuffer);for(let Ui=0;Ui<_e;Ui++)Di&&(P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,z.get(b).__webglTexture,B,Ve+Ui),P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,z.get(C).__webglTexture,fe,xt+Ui)),P.blitFramebuffer(ye,Ue,ge,he,be,$e,ge,he,P.DEPTH_BUFFER_BIT,P.NEAREST);v.bindFramebuffer(P.READ_FRAMEBUFFER,null),v.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else if(B!==0||b.isRenderTargetTexture||z.has(b)){let gt=z.get(b),Qn=z.get(C);v.bindFramebuffer(P.READ_FRAMEBUFFER,F),v.bindFramebuffer(P.DRAW_FRAMEBUFFER,H);for(let lt=0;lt<_e;lt++)Di?P.framebufferTextureLayer(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,gt.__webglTexture,B,Ve+lt):P.framebufferTexture2D(P.READ_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,gt.__webglTexture,B),nt?P.framebufferTextureLayer(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,Qn.__webglTexture,fe,xt+lt):P.framebufferTexture2D(P.DRAW_FRAMEBUFFER,P.COLOR_ATTACHMENT0,P.TEXTURE_2D,Qn.__webglTexture,fe),B!==0?P.blitFramebuffer(ye,Ue,ge,he,be,$e,ge,he,P.COLOR_BUFFER_BIT,P.NEAREST):nt?P.copyTexSubImage3D(pe,fe,be,$e,xt+lt,ye,Ue,ge,he):P.copyTexSubImage2D(pe,fe,be,$e,ye,Ue,ge,he);v.bindFramebuffer(P.READ_FRAMEBUFFER,null),v.bindFramebuffer(P.DRAW_FRAMEBUFFER,null)}else nt?b.isDataTexture||b.isData3DTexture?P.texSubImage3D(pe,fe,be,$e,xt,ge,he,_e,it,Nt,dt.data):C.isCompressedArrayTexture?P.compressedTexSubImage3D(pe,fe,be,$e,xt,ge,he,_e,it,dt.data):P.texSubImage3D(pe,fe,be,$e,xt,ge,he,_e,it,Nt,dt):b.isDataTexture?P.texSubImage2D(P.TEXTURE_2D,fe,be,$e,ge,he,it,Nt,dt.data):b.isCompressedTexture?P.compressedTexSubImage2D(P.TEXTURE_2D,fe,be,$e,dt.width,dt.height,it,dt.data):P.texSubImage2D(P.TEXTURE_2D,fe,be,$e,ge,he,it,Nt,dt);v.pixelStorei(P.UNPACK_ROW_LENGTH,zt),v.pixelStorei(P.UNPACK_IMAGE_HEIGHT,Ye),v.pixelStorei(P.UNPACK_SKIP_PIXELS,an),v.pixelStorei(P.UNPACK_SKIP_ROWS,wn),v.pixelStorei(P.UNPACK_SKIP_IMAGES,jn),fe===0&&C.generateMipmaps&&P.generateMipmap(pe),v.unbindTexture()},this.initRenderTarget=function(b){z.get(b).__webglFramebuffer===void 0&&W.setupRenderTarget(b)},this.initTexture=function(b){b.isCubeTexture?W.setTextureCube(b,0):b.isData3DTexture?W.setTexture3D(b,0):b.isDataArrayTexture||b.isCompressedArrayTexture?W.setTexture2DArray(b,0):W.setTexture2D(b,0),v.unbindTexture()},this.resetState=function(){K=0,Z=0,ne=null,v.reset(),ue.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return vn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=Be._getDrawingBufferColorSpace(e),t.unpackColorSpace=Be._getUnpackColorSpace()}};function Kh(i,e=!1){let t=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),r=new Set(Object.keys(i[0].morphAttributes)),s={},a={},o=i[0].morphTargetsRelative,l=new wt,c=0;for(let d=0;d<i.length;++d){let f=i[d],h=0;if(t!==(f.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+d+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let u in f.attributes){if(!n.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+d+'. All geometries must have compatible attributes; make sure "'+u+'" attribute exists among all geometries, or in none of them.'),null;s[u]===void 0&&(s[u]=[]),s[u].push(f.attributes[u]),h++}if(h!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+d+". Make sure all geometries have the same number of attributes."),null;if(o!==f.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+d+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let u in f.morphAttributes){if(!r.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+d+".  .morphAttributes must be consistent throughout all geometries."),null;a[u]===void 0&&(a[u]=[]),a[u].push(f.morphAttributes[u])}if(e){let u;if(t)u=f.index.count;else if(f.attributes.position!==void 0)u=f.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+d+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,u,d),c+=u}}if(t){let d=0,f=[];for(let h=0;h<i.length;++h){let u=i[h].index;for(let g=0;g<u.count;++g)f.push(u.getX(g)+d);d+=i[h].attributes.position.count}l.setIndex(f)}for(let d in s){let f=Zh(s[d]);if(!f)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+d+" attribute."),null;l.setAttribute(d,f)}for(let d in a){let f=a[d][0].length;if(f!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[d]=[];for(let h=0;h<f;++h){let u=[];for(let x=0;x<a[d].length;++x)u.push(a[d][x][h]);let g=Zh(u);if(!g)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+d+" morphAttribute."),null;l.morphAttributes[d].push(g)}}}return l}function Zh(i){let e,t,n,r=-1,s=0;for(let c=0;c<i.length;++c){let d=i[c];if(e===void 0&&(e=d.array.constructor),e!==d.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=d.itemSize),t!==d.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=d.normalized),n!==d.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(r===-1&&(r=d.gpuType),r!==d.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;s+=d.count*t}let a=new e(s),o=new pt(a,t,n),l=0;for(let c=0;c<i.length;++c){let d=i[c];if(d.isInterleavedBufferAttribute){let f=l/t;for(let h=0,u=d.count;h<u;h++)for(let g=0;g<t;g++){let x=d.getComponent(h,g);o.setComponent(h+f,g,x)}}else a.set(d.array,l);l+=d.count*t}return r!==void 0&&(o.gpuType=r),o}function ol(i,e){if(e===Oc)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),i;if(e===xr||e===ps){let t=i.getIndex();if(t===null){let s=[],a=i.getAttribute("position");if(a!==void 0){for(let o=0;o<a.count;o++)s.push(o);i.setIndex(s),t=i.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),i}let n=t.count-2,r=[];if(e===xr)for(let s=1;s<=n;s++)r.push(t.getX(0)),r.push(t.getX(s)),r.push(t.getX(s+1));else for(let s=0;s<n;s++)s%2===0?(r.push(t.getX(s)),r.push(t.getX(s+1)),r.push(t.getX(s+2))):(r.push(t.getX(s+2)),r.push(t.getX(s+1)),r.push(t.getX(s)));return r.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles."),i.setIndex(r),i.clearGroups(),i}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),i}function Jh(i){let e=new Map,t=new Map,n=i.clone();return $h(i,n,function(r,s){e.set(s,r),t.set(r,s)}),n.traverse(function(r){if(!r.isSkinnedMesh)return;let s=r,a=e.get(r),o=a.skeleton.bones;s.skeleton=a.skeleton.clone(),s.bindMatrix.copy(a.bindMatrix),s.skeleton.bones=o.map(function(l){return t.get(l)}),s.bind(s.skeleton,s.bindMatrix)}),n}function $h(i,e,t){t(i,e);for(let n=0;n<i.children.length;n++)$h(i.children[n],e.children[n],t)}var xo=class extends In{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new pl(t)}),this.register(function(t){return new ml(t)}),this.register(function(t){return new wl(t)}),this.register(function(t){return new Tl(t)}),this.register(function(t){return new Al(t)}),this.register(function(t){return new vl(t)}),this.register(function(t){return new _l(t)}),this.register(function(t){return new bl(t)}),this.register(function(t){return new xl(t)}),this.register(function(t){return new ul(t)}),this.register(function(t){return new yl(t)}),this.register(function(t){return new gl(t)}),this.register(function(t){return new Sl(t)}),this.register(function(t){return new Ml(t)}),this.register(function(t){return new hl(t)}),this.register(function(t){return new yo(t,ke.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new yo(t,ke.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new El(t)})}load(e,t,n,r){let s=this,a;if(this.resourcePath!=="")a=this.resourcePath;else if(this.path!==""){let c=Kn.extractUrlBase(e);a=Kn.resolveURL(c,this.path)}else a=Kn.extractUrlBase(e);this.manager.itemStart(e);let o=function(c){r?r(c):console.error(c),s.manager.itemError(e),s.manager.itemEnd(e)},l=new fr(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{s.parse(c,a,function(d){t(d),s.manager.itemEnd(e)},o)}catch(d){o(d)}},n,o)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,r){let s,a={},o={},l=new TextDecoder;if(typeof e=="string")s=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===nf){try{a[ke.KHR_BINARY_GLTF]=new Rl(e)}catch(f){r&&r(f);return}s=JSON.parse(a[ke.KHR_BINARY_GLTF].content)}else s=JSON.parse(l.decode(e));else s=e;if(s.asset===void 0||s.asset.version[0]<2){r&&r(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let c=new Dl(s,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let d=0;d<this.pluginCallbacks.length;d++){let f=this.pluginCallbacks[d](c);f.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),o[f.name]=f,a[f.name]=!0}if(s.extensionsUsed)for(let d=0;d<s.extensionsUsed.length;++d){let f=s.extensionsUsed[d],h=s.extensionsRequired||[];switch(f){case ke.KHR_MATERIALS_UNLIT:a[f]=new fl;break;case ke.KHR_DRACO_MESH_COMPRESSION:a[f]=new Cl(s,this.dracoLoader);break;case ke.KHR_TEXTURE_TRANSFORM:a[f]=new Il;break;case ke.KHR_MESH_QUANTIZATION:a[f]=new Pl;break;default:h.indexOf(f)>=0&&o[f]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+f+'".')}}c.setExtensions(a),c.setPlugins(o),c.parse(n,r)}parseAsync(e,t){let n=this;return new Promise(function(r,s){n.parse(e,t,r,s)})}};function bv(){let i={};return{get:function(e){return i[e]},add:function(e,t){i[e]=t},remove:function(e){delete i[e]},removeAll:function(){i={}}}}function _t(i,e,t){let n=i.json.materials[e];return n.extensions&&n.extensions[t]?n.extensions[t]:null}var ke={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},hl=class{constructor(e){this.parser=e,this.name=ke.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let n=0,r=t.length;n<r;n++){let s=t[n];s.extensions&&s.extensions[this.name]&&s.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,s.extensions[this.name].light)}}_loadLight(e){let t=this.parser,n="light:"+e,r=t.cache.get(n);if(r)return r;let s=t.json,l=((s.extensions&&s.extensions[this.name]||{}).lights||[])[e],c,d=new Ce(16777215);l.color!==void 0&&d.setRGB(l.color[0],l.color[1],l.color[2],Vt);let f=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new is(d),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new ns(d),c.distance=f;break;case"spot":c=new ts(d),c.distance=f,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),Nn(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),r=Promise.resolve(c),t.cache.add(n,r),r}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,n=this.parser,s=n.json.nodes[e],o=(s.extensions&&s.extensions[this.name]||{}).light;return o===void 0?null:this._loadLight(o).then(function(l){return n._getNodeRef(t.cache,o,l)})}},fl=class{constructor(){this.name=ke.KHR_MATERIALS_UNLIT}getMaterialType(){return Lt}extendParams(e,t,n){let r=[];e.color=new Ce(1,1,1),e.opacity=1;let s=t.pbrMetallicRoughness;if(s){if(Array.isArray(s.baseColorFactor)){let a=s.baseColorFactor;e.color.setRGB(a[0],a[1],a[2],Vt),e.opacity=a[3]}s.baseColorTexture!==void 0&&r.push(n.assignTexture(e,"map",s.baseColorTexture,ht))}return Promise.all(r)}},ul=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}},pl=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&r.push(this.parser.assignTexture(t,"clearcoatMap",n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(r.push(this.parser.assignTexture(t,"clearcoatNormalMap",n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){let s=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new De(s,s)}return Promise.all(r)}},ml=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_DISPERSION}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion!==void 0?n.dispersion:0),Promise.resolve()}},gl=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&r.push(this.parser.assignTexture(t,"iridescenceMap",n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,"iridescenceThicknessMap",n.iridescenceThicknessTexture)),Promise.all(r)}},vl=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_SHEEN}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];if(t.sheenColor=new Ce(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){let s=n.sheenColorFactor;t.sheenColor.setRGB(s[0],s[1],s[2],Vt)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&r.push(this.parser.assignTexture(t,"sheenColorMap",n.sheenColorTexture,ht)),n.sheenRoughnessTexture!==void 0&&r.push(this.parser.assignTexture(t,"sheenRoughnessMap",n.sheenRoughnessTexture)),Promise.all(r)}},_l=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&r.push(this.parser.assignTexture(t,"transmissionMap",n.transmissionTexture)),Promise.all(r)}},bl=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_VOLUME}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];t.thickness=n.thicknessFactor!==void 0?n.thicknessFactor:0,n.thicknessTexture!==void 0&&r.push(this.parser.assignTexture(t,"thicknessMap",n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;let s=n.attenuationColor||[1,1,1];return t.attenuationColor=new Ce().setRGB(s[0],s[1],s[2],Vt),Promise.all(r)}},xl=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_IOR}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);return n===null||(t.ior=n.ior!==void 0?n.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}},yl=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_SPECULAR}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];t.specularIntensity=n.specularFactor!==void 0?n.specularFactor:1,n.specularTexture!==void 0&&r.push(this.parser.assignTexture(t,"specularIntensityMap",n.specularTexture));let s=n.specularColorFactor||[1,1,1];return t.specularColor=new Ce().setRGB(s[0],s[1],s[2],Vt),n.specularColorTexture!==void 0&&r.push(this.parser.assignTexture(t,"specularColorMap",n.specularColorTexture,ht)),Promise.all(r)}},Ml=class{constructor(e){this.parser=e,this.name=ke.EXT_MATERIALS_BUMP}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return t.bumpScale=n.bumpFactor!==void 0?n.bumpFactor:1,n.bumpTexture!==void 0&&r.push(this.parser.assignTexture(t,"bumpMap",n.bumpTexture)),Promise.all(r)}},Sl=class{constructor(e){this.parser=e,this.name=ke.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return _t(this.parser,e,this.name)!==null?Ot:null}extendMaterialParams(e,t){let n=_t(this.parser,e,this.name);if(n===null)return Promise.resolve();let r=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&r.push(this.parser.assignTexture(t,"anisotropyMap",n.anisotropyTexture)),Promise.all(r)}},wl=class{constructor(e){this.parser=e,this.name=ke.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,n=t.json,r=n.textures[e];if(!r.extensions||!r.extensions[this.name])return null;let s=r.extensions[this.name],a=t.options.ktx2Loader;if(!a){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,s.source,a)}},Tl=class{constructor(e){this.parser=e,this.name=ke.EXT_TEXTURE_WEBP}loadTexture(e){let t=this.name,n=this.parser,r=n.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;let a=s.extensions[t],o=r.images[a.source],l=n.textureLoader;if(o.uri){let c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,a.source,l)}},Al=class{constructor(e){this.parser=e,this.name=ke.EXT_TEXTURE_AVIF}loadTexture(e){let t=this.name,n=this.parser,r=n.json,s=r.textures[e];if(!s.extensions||!s.extensions[t])return null;let a=s.extensions[t],o=r.images[a.source],l=n.textureLoader;if(o.uri){let c=n.options.manager.getHandler(o.uri);c!==null&&(l=c)}return n.loadTextureImage(e,a.source,l)}},yo=class{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){let t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){let r=n.extensions[this.name],s=this.parser.getDependency("buffer",r.buffer),a=this.parser.options.meshoptDecoder;if(!a||!a.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return s.then(function(o){let l=r.byteOffset||0,c=r.byteLength||0,d=r.count,f=r.byteStride,h=new Uint8Array(o,l,c);return a.decodeGltfBufferAsync?a.decodeGltfBufferAsync(d,f,h,r.mode,r.filter).then(function(u){return u.buffer}):a.ready.then(function(){let u=new ArrayBuffer(d*f);return a.decodeGltfBuffer(new Uint8Array(u),d,f,h,r.mode,r.filter),u})})}else return null}},El=class{constructor(e){this.name=ke.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;let r=t.meshes[n.mesh];for(let c of r.primitives)if(c.mode!==dn.TRIANGLES&&c.mode!==dn.TRIANGLE_STRIP&&c.mode!==dn.TRIANGLE_FAN&&c.mode!==void 0)return null;let a=n.extensions[this.name].attributes,o=[],l={};for(let c in a)o.push(this.parser.getDependency("accessor",a[c]).then(d=>(l[c]=d,l[c])));return o.length<1?null:(o.push(this.parser.createNodeMesh(e)),Promise.all(o).then(c=>{let d=c.pop(),f=d.isGroup?d.children:[d],h=c[0].count,u=[];for(let g of f){let x=new Fe,m=new N,p=new Gt,T=new N(1,1,1),R=new Xr(g.geometry,g.material,h);for(let M=0;M<h;M++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,M),l.ROTATION&&p.fromBufferAttribute(l.ROTATION,M),l.SCALE&&T.fromBufferAttribute(l.SCALE,M),R.setMatrixAt(M,x.compose(m,p,T));let y=null;for(let M in l)if(M==="_COLOR_0"){let S=l[M];R.instanceColor=new bn(S.array,S.itemSize,S.normalized)}else if(M!=="TRANSLATION"&&M!=="ROTATION"&&M!=="SCALE"){if(y===null){let E=R.geometry;y=new wt,y.name=E.name;for(let _ in E.attributes)y.setAttribute(_,E.attributes[_]);for(let _ in E.morphAttributes)y.morphAttributes[_]=E.morphAttributes[_];E.index!==null&&y.setIndex(E.index),y.morphTargetsRelative=E.morphTargetsRelative;for(let _ of E.groups)y.addGroup(_.start,_.count,_.materialIndex);E.boundingBox!==null&&(y.boundingBox=E.boundingBox.clone()),E.boundingSphere!==null&&(y.boundingSphere=E.boundingSphere.clone()),y.drawRange.start=E.drawRange.start,y.drawRange.count=E.drawRange.count,y.userData=Object.assign({},E.userData),R.geometry=y}let S=l[M];y.setAttribute(M,new bn(S.array,S.itemSize,S.normalized))}mt.prototype.copy.call(R,g),this.parser.assignFinalMaterial(R),u.push(R)}return d.isGroup?(d.clear(),d.add(...u),d):u[0]}))}},nf="glTF",bs=12,jh={JSON:1313821514,BIN:5130562},Rl=class{constructor(e){this.name=ke.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,bs),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==nf)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let r=this.header.length-bs,s=new DataView(e,bs),a=0;for(;a<r;){let o=s.getUint32(a,!0);a+=4;let l=s.getUint32(a,!0);if(a+=4,l===jh.JSON){let c=new Uint8Array(e,bs+a,o);this.content=n.decode(c)}else if(l===jh.BIN){let c=bs+a;this.body=e.slice(c,c+o)}a+=o}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},Cl=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=ke.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let n=this.json,r=this.dracoLoader,s=e.extensions[this.name].bufferView,a=e.extensions[this.name].attributes,o={},l={},c={};for(let d in a){let f=Fl[d]||d.toLowerCase();o[f]=a[d]}for(let d in e.attributes){let f=Fl[d]||d.toLowerCase();if(a[d]!==void 0){let h=n.accessors[e.attributes[d]],u=Tr[h.componentType];c[f]=u.name,l[f]=h.normalized===!0}}return t.getDependency("bufferView",s).then(function(d){return new Promise(function(f,h){r.decodeDracoFile(d,function(u){for(let g in u.attributes){let x=u.attributes[g],m=l[g];m!==void 0&&(x.normalized=m)}f(u)},o,c,Vt,h)})})}},Il=class{constructor(){this.name=ke.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){if((t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0)return e;if(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),t.rotation!==void 0){let n=Math.cos(e.rotation),r=Math.sin(e.rotation);e.matrix.set(e.repeat.x*n,e.repeat.y*r,e.offset.x,-e.repeat.x*r,e.repeat.y*n,e.offset.y,0,0,1),e.matrixAutoUpdate=!1}return e.needsUpdate=!0,e}},Pl=class{constructor(){this.name=ke.KHR_MESH_QUANTIZATION}},Mo=class extends Cn{constructor(e,t,n,r){super(e,t,n,r)}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,s=e*r*3+r;for(let a=0;a!==r;a++)t[a]=n[s+a];return t}interpolate_(e,t,n,r){let s=this.resultBuffer,a=this.sampleValues,o=this.valueSize,l=o*2,c=o*3,d=r-t,f=(n-t)/d,h=f*f,u=h*f,g=e*c,x=g-c,m=-2*u+3*h,p=u-h,T=1-m,R=p-h+f;for(let y=0;y!==o;y++){let M=a[x+y+o],S=a[x+y+l]*d,E=a[g+y+o],_=a[g+y]*d;s[y]=T*M+R*S+m*E+p*_}return s}},xv=new Gt,Ll=class extends Mo{interpolate_(e,t,n,r){let s=super.interpolate_(e,t,n,r);return xv.fromArray(s).normalize().toArray(s),s}},dn={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Tr={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Qh={9728:st,9729:vt,9984:Ta,9985:vr,9986:Pi,9987:xn},ef={33071:cn,33648:Qi,10497:ci},cl={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},Fl={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},mi={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},yv={CUBICSPLINE:void 0,LINEAR:Si,STEP:Mi},ll={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function Mv(i){return i.DefaultMaterial===void 0&&(i.DefaultMaterial=new $t({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:Pn})),i.DefaultMaterial}function Ni(i,e,t){for(let n in t.extensions)i[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function Nn(i,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(i.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function Sv(i,e,t){let n=!1,r=!1,s=!1;for(let c=0,d=e.length;c<d;c++){let f=e[c];if(f.POSITION!==void 0&&(n=!0),f.NORMAL!==void 0&&(r=!0),f.COLOR_0!==void 0&&(s=!0),n&&r&&s)break}if(!n&&!r&&!s)return Promise.resolve(i);let a=[],o=[],l=[];for(let c=0,d=e.length;c<d;c++){let f=e[c];if(n){let h=f.POSITION!==void 0?t.getDependency("accessor",f.POSITION):i.attributes.position;a.push(h)}if(r){let h=f.NORMAL!==void 0?t.getDependency("accessor",f.NORMAL):i.attributes.normal;o.push(h)}if(s){let h=f.COLOR_0!==void 0?t.getDependency("accessor",f.COLOR_0):i.attributes.color;l.push(h)}}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l)]).then(function(c){let d=c[0],f=c[1],h=c[2];return n&&(i.morphAttributes.position=d),r&&(i.morphAttributes.normal=f),s&&(i.morphAttributes.color=h),i.morphTargetsRelative=!0,i})}function wv(i,e){if(i.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)i.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(i.morphTargetInfluences.length===t.length){i.morphTargetDictionary={};for(let n=0,r=t.length;n<r;n++)i.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function Tv(i){let e,t=i.extensions&&i.extensions[ke.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+dl(t.attributes):e=i.indices+":"+dl(i.attributes)+":"+i.mode,i.targets!==void 0)for(let n=0,r=i.targets.length;n<r;n++)e+=":"+dl(i.targets[n]);return e}function dl(i){let e="",t=Object.keys(i).sort();for(let n=0,r=t.length;n<r;n++)e+=t[n]+":"+i[t[n]]+";";return e}function Nl(i){switch(i){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function Av(i){return i.search(/\.jpe?g($|\?)/i)>0||i.search(/^data\:image\/jpeg/)===0?"image/jpeg":i.search(/\.webp($|\?)/i)>0||i.search(/^data\:image\/webp/)===0?"image/webp":i.search(/\.ktx2($|\?)/i)>0||i.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var Ev=new Fe,Dl=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new bv,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,r=-1,s=!1,a=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){let o=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(o)===!0;let l=o.match(/Version\/(\d+)/);r=n&&l?parseInt(l[1],10):-1,s=o.indexOf("Firefox")>-1,a=s?o.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&r<17||s&&a<98?this.textureLoader=new es(this.options.manager):this.textureLoader=new ss(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new fr(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let n=this,r=this.json,s=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(a){return a._markDefs&&a._markDefs()}),Promise.all(this._invokeAll(function(a){return a.beforeRoot&&a.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(a){let o={scene:a[0][r.scene||0],scenes:a[0],animations:a[1],cameras:a[2],asset:r.asset,parser:n,userData:{}};return Ni(s,o,r),Nn(o,r),Promise.all(n._invokeAll(function(l){return l.afterRoot&&l.afterRoot(o)})).then(function(){for(let l of o.scenes)l.updateMatrixWorld();e(o)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let r=0,s=t.length;r<s;r++){let a=t[r].joints;for(let o=0,l=a.length;o<l;o++)e[a[o]].isBone=!0}for(let r=0,s=e.length;r<s;r++){let a=e[r];a.mesh!==void 0&&(this._addNodeRef(this.meshCache,a.mesh),a.skin!==void 0&&(n[a.mesh].isSkinnedMesh=!0)),a.camera!==void 0&&this._addNodeRef(this.cameraCache,a.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;let r=n.clone(),s=(a,o)=>{let l=this.associations.get(a);l!=null&&this.associations.set(o,l);for(let[c,d]of a.children.entries())s(d,o.children[c])};return s(n,r),r.name+="_instance_"+e.uses[t]++,r}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){let r=e(t[n]);if(r)return r}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let n=[];for(let r=0;r<t.length;r++){let s=e(t[r]);s&&n.push(s)}return n}getDependency(e,t){let n=e+":"+t,r=this.cache.get(n);if(!r){switch(e){case"scene":r=this.loadScene(t);break;case"node":r=this._invokeOne(function(s){return s.loadNode&&s.loadNode(t)});break;case"mesh":r=this._invokeOne(function(s){return s.loadMesh&&s.loadMesh(t)});break;case"accessor":r=this.loadAccessor(t);break;case"bufferView":r=this._invokeOne(function(s){return s.loadBufferView&&s.loadBufferView(t)});break;case"buffer":r=this.loadBuffer(t);break;case"material":r=this._invokeOne(function(s){return s.loadMaterial&&s.loadMaterial(t)});break;case"texture":r=this._invokeOne(function(s){return s.loadTexture&&s.loadTexture(t)});break;case"skin":r=this.loadSkin(t);break;case"animation":r=this._invokeOne(function(s){return s.loadAnimation&&s.loadAnimation(t)});break;case"camera":r=this.loadCamera(t);break;default:if(r=this._invokeOne(function(s){return s!=this&&s.getDependency&&s.getDependency(e,t)}),!r)throw new Error("Unknown type: "+e);break}this.cache.add(n,r)}return r}getDependencies(e){let t=this.cache.get(e);if(!t){let n=this,r=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(r.map(function(s,a){return n.getDependency(e,a)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[ke.KHR_BINARY_GLTF].body);let r=this.options;return new Promise(function(s,a){n.load(Kn.resolveURL(t.uri,r.path),s,void 0,function(){a(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){let r=t.byteLength||0,s=t.byteOffset||0;return n.slice(s,s+r)})}loadAccessor(e){let t=this,n=this.json,r=this.json.accessors[e];if(r.bufferView===void 0&&r.sparse===void 0){let a=cl[r.type],o=Tr[r.componentType],l=r.normalized===!0,c=new o(r.count*a);return Promise.resolve(new pt(c,a,l))}let s=[];return r.bufferView!==void 0?s.push(this.getDependency("bufferView",r.bufferView)):s.push(null),r.sparse!==void 0&&(s.push(this.getDependency("bufferView",r.sparse.indices.bufferView)),s.push(this.getDependency("bufferView",r.sparse.values.bufferView))),Promise.all(s).then(function(a){let o=a[0],l=cl[r.type],c=Tr[r.componentType],d=c.BYTES_PER_ELEMENT,f=d*l,h=r.byteOffset||0,u=r.bufferView!==void 0?n.bufferViews[r.bufferView].byteStride:void 0,g=r.normalized===!0,x,m;if(u&&u!==f){let p=Math.floor(h/u),T="InterleavedBuffer:"+r.bufferView+":"+r.componentType+":"+p+":"+r.count,R=t.cache.get(T);R||(x=new c(o,p*u,r.count*u/d),R=new sr(x,u/d),t.cache.add(T,R)),m=new Gn(R,l,h%u/d,g)}else o===null?x=new c(r.count*l):x=new c(o,h,r.count*l),m=new pt(x,l,g);if(r.sparse!==void 0){let p=cl.SCALAR,T=Tr[r.sparse.indices.componentType],R=r.sparse.indices.byteOffset||0,y=r.sparse.values.byteOffset||0,M=new T(a[1],R,r.sparse.count*p),S=new c(a[2],y,r.sparse.count*l);o!==null&&(m=new pt(m.array.slice(),m.itemSize,m.normalized)),m.normalized=!1;for(let E=0,_=M.length;E<_;E++){let A=M[E];if(m.setX(A,S[E*l]),l>=2&&m.setY(A,S[E*l+1]),l>=3&&m.setZ(A,S[E*l+2]),l>=4&&m.setW(A,S[E*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}m.normalized=g}return m})}loadTexture(e){let t=this.json,n=this.options,s=t.textures[e].source,a=t.images[s],o=this.textureLoader;if(a.uri){let l=n.manager.getHandler(a.uri);l!==null&&(o=l)}return this.loadTextureImage(e,s,o)}loadTextureImage(e,t,n){let r=this,s=this.json,a=s.textures[e],o=s.images[t],l=(o.uri||o.bufferView)+":"+a.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,n).then(function(d){d.flipY=!1,d.name=a.name||o.name||"",d.name===""&&typeof o.uri=="string"&&o.uri.startsWith("data:image/")===!1&&(d.name=o.uri);let h=(s.samplers||{})[a.sampler]||{};return d.magFilter=Qh[h.magFilter]||vt,d.minFilter=Qh[h.minFilter]||xn,d.wrapS=ef[h.wrapS]||ci,d.wrapT=ef[h.wrapT]||ci,d.generateMipmaps=!d.isCompressedTexture&&d.minFilter!==st&&d.minFilter!==vt,r.associations.set(d,{textures:e}),d}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let n=this,r=this.json,s=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(f=>f.clone());let a=r.images[e],o=self.URL||self.webkitURL,l=a.uri||"",c=!1;if(a.bufferView!==void 0)l=n.getDependency("bufferView",a.bufferView).then(function(f){c=!0;let h=new Blob([f],{type:a.mimeType});return l=o.createObjectURL(h),l});else if(a.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let d=Promise.resolve(l).then(function(f){return new Promise(function(h,u){let g=h;t.isImageBitmapLoader===!0&&(g=function(x){let m=new Mt(x);m.needsUpdate=!0,h(m)}),t.load(Kn.resolveURL(f,s.path),g,void 0,u)})}).then(function(f){return c===!0&&o.revokeObjectURL(l),Nn(f,a),f.userData.mimeType=a.mimeType||Av(a.uri),f}).catch(function(f){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),f});return this.sourceCache[e]=d,d}assignTexture(e,t,n,r){let s=this;return this.getDependency("texture",n.index).then(function(a){if(!a)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(a=a.clone(),a.channel=n.texCoord),s.extensions[ke.KHR_TEXTURE_TRANSFORM]){let o=n.extensions!==void 0?n.extensions[ke.KHR_TEXTURE_TRANSFORM]:void 0;if(o){let l=s.associations.get(a);a=s.extensions[ke.KHR_TEXTURE_TRANSFORM].extendTexture(a,o),s.associations.set(a,l)}}return r!==void 0&&(a.colorSpace=r),e[t]=a,a})}assignFinalMaterial(e){let t=e.geometry,n=e.material,r=t.attributes.tangent===void 0,s=t.attributes.color!==void 0,a=t.attributes.normal===void 0;if(e.isPoints){let o="PointsMaterial:"+n.uuid,l=this.cache.get(o);l||(l=new dr,Jt.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,l.sizeAttenuation=!1,this.cache.add(o,l)),n=l}else if(e.isLine){let o="LineBasicMaterial:"+n.uuid,l=this.cache.get(o);l||(l=new lr,Jt.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,this.cache.add(o,l)),n=l}if(r||s||a){let o="ClonedMaterial:"+n.uuid+":";r&&(o+="derivative-tangents:"),s&&(o+="vertex-colors:"),a&&(o+="flat-shading:");let l=this.cache.get(o);l||(l=n.clone(),s&&(l.vertexColors=!0),a&&(l.flatShading=!0),r&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(o,l),this.associations.set(l,this.associations.get(n))),n=l}e.material=n}getMaterialType(){return $t}loadMaterial(e){let t=this,n=this.json,r=this.extensions,s=n.materials[e],a,o={},l=s.extensions||{},c=[];if(l[ke.KHR_MATERIALS_UNLIT]){let f=r[ke.KHR_MATERIALS_UNLIT];a=f.getMaterialType(),c.push(f.extendParams(o,s,t))}else{let f=s.pbrMetallicRoughness||{};if(o.color=new Ce(1,1,1),o.opacity=1,Array.isArray(f.baseColorFactor)){let h=f.baseColorFactor;o.color.setRGB(h[0],h[1],h[2],Vt),o.opacity=h[3]}f.baseColorTexture!==void 0&&c.push(t.assignTexture(o,"map",f.baseColorTexture,ht)),o.metalness=f.metallicFactor!==void 0?f.metallicFactor:1,o.roughness=f.roughnessFactor!==void 0?f.roughnessFactor:1,f.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(o,"metalnessMap",f.metallicRoughnessTexture)),c.push(t.assignTexture(o,"roughnessMap",f.metallicRoughnessTexture))),a=this._invokeOne(function(h){return h.getMaterialType&&h.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(h){return h.extendMaterialParams&&h.extendMaterialParams(e,o)})))}s.doubleSided===!0&&(o.side=Qt);let d=s.alphaMode||ll.OPAQUE;if(d===ll.BLEND?(o.transparent=!0,o.depthWrite=!1):(o.transparent=!1,d===ll.MASK&&(o.alphaTest=s.alphaCutoff!==void 0?s.alphaCutoff:.5)),s.normalTexture!==void 0&&a!==Lt&&(c.push(t.assignTexture(o,"normalMap",s.normalTexture)),o.normalScale=new De(1,1),s.normalTexture.scale!==void 0)){let f=s.normalTexture.scale;o.normalScale.set(f,f)}if(s.occlusionTexture!==void 0&&a!==Lt&&(c.push(t.assignTexture(o,"aoMap",s.occlusionTexture)),s.occlusionTexture.strength!==void 0&&(o.aoMapIntensity=s.occlusionTexture.strength)),s.emissiveFactor!==void 0&&a!==Lt){let f=s.emissiveFactor;o.emissive=new Ce().setRGB(f[0],f[1],f[2],Vt)}return s.emissiveTexture!==void 0&&a!==Lt&&c.push(t.assignTexture(o,"emissiveMap",s.emissiveTexture,ht)),Promise.all(c).then(function(){let f=new a(o);return s.name&&(f.name=s.name),Nn(f,s),t.associations.set(f,{materials:e}),s.extensions&&Ni(r,f,s),f})}createUniqueName(e){let t=rt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,n=this.extensions,r=this.primitiveCache;function s(o){return n[ke.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(o,t).then(function(l){return tf(l,o,t)})}let a=[];for(let o=0,l=e.length;o<l;o++){let c=e[o],d=Tv(c),f=r[d];if(f)a.push(f.promise);else{let h;c.extensions&&c.extensions[ke.KHR_DRACO_MESH_COMPRESSION]?h=s(c):h=tf(new wt,c,t),c.mode===dn.TRIANGLE_STRIP?h=h.then(u=>ol(u,ps)):c.mode===dn.TRIANGLE_FAN&&(h=h.then(u=>ol(u,xr))),r[d]={primitive:c,promise:h},a.push(h)}}return Promise.all(a)}loadMesh(e){let t=this,n=this.json,r=this.extensions,s=n.meshes[e],a=s.primitives,o=[];for(let l=0,c=a.length;l<c;l++){let d=a[l].material===void 0?Mv(this.cache):this.getDependency("material",a[l].material);o.push(d)}return o.push(t.loadGeometries(a)),Promise.all(o).then(async function(l){let c=l.slice(0,l.length-1),d=l[l.length-1],f=[];for(let u=0,g=d.length;u<g;u++){let x=d[u],m=a[u],p,T=c[u];if(m.mode===dn.TRIANGLES||m.mode===dn.TRIANGLE_STRIP||m.mode===dn.TRIANGLE_FAN||m.mode===void 0){let R=s.isSkinnedMesh===!0,y=x.hasAttribute("skinIndex")&&x.hasAttribute("skinWeight");R&&y===!1&&console.warn("THREE.GLTFLoader: Missing skinIndex or skinWeight attributes. Skinning disabled."),p=R&&y?new Gr(x,T):new Ke(x,T),p.isSkinnedMesh===!0&&p.normalizeSkinWeights()}else if(m.mode===dn.LINES)p=new Yr(x,T);else if(m.mode===dn.LINE_STRIP)p=new Ei(x,T);else if(m.mode===dn.LINE_LOOP)p=new qr(x,T);else if(m.mode===dn.POINTS)p=new Zr(x,T);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(p.geometry.morphAttributes).length>0&&wv(p,s),p.name=t.createUniqueName(s.name||"mesh_"+e),Nn(p,s),m.extensions&&Ni(r,p,m),t.assignFinalMaterial(p),f.push(p)}for(let u=0,g=f.length;u<g;u++)t.associations.set(f[u],{meshes:e,primitives:u});if(f.length===1)return s.extensions&&Ni(r,f[0],s),f[0];let h=new Ht;s.extensions&&Ni(r,h,s),t.associations.set(h,{meshes:e});for(let u=0,g=f.length;u<g;u++)h.add(f[u]);return h})}loadCamera(e){let t,n=this.json.cameras[e],r=n[n.type];if(!r){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new Ct(Hc.radToDeg(r.yfov),r.aspectRatio||1,r.znear||1,r.zfar||2e6):n.type==="orthographic"&&(t=new hi(-r.xmag,r.xmag,r.ymag,-r.ymag,r.znear,r.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),Nn(t,n),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],n=[];for(let r=0,s=t.joints.length;r<s;r++)n.push(this._loadNodeShallow(t.joints[r]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(r){let s=r.pop(),a=r,o=[],l=[];for(let c=0,d=a.length;c<d;c++){let f=a[c];if(f){o.push(f);let h=new Fe;s!==null&&h.fromArray(s.array,c*16),l.push(h)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new Wr(o,l)})}loadAnimation(e){let t=this.json,n=this,r=t.animations[e],s=r.name?r.name:"animation_"+e,a=[],o=[],l=[],c=[],d=[];for(let f=0,h=r.channels.length;f<h;f++){let u=r.channels[f],g=r.samplers[u.sampler],x=u.target,m=x.node,p=r.parameters!==void 0?r.parameters[g.input]:g.input,T=r.parameters!==void 0?r.parameters[g.output]:g.output;x.node!==void 0&&(a.push(this.getDependency("node",m)),o.push(this.getDependency("accessor",p)),l.push(this.getDependency("accessor",T)),c.push(g),d.push(x))}return Promise.all([Promise.all(a),Promise.all(o),Promise.all(l),Promise.all(c),Promise.all(d)]).then(function(f){let h=f[0],u=f[1],g=f[2],x=f[3],m=f[4],p=[];for(let R=0,y=h.length;R<y;R++){let M=h[R],S=u[R],E=g[R],_=x[R],A=m[R];if(M===void 0)continue;M.updateMatrix&&M.updateMatrix();let L=n._createAnimationTracks(M,S,E,_,A);if(L)for(let D=0;D<L.length;D++)p.push(L[D])}let T=new Qr(s,void 0,p);return Nn(T,r),T})}createNodeMesh(e){let t=this.json,n=this,r=t.nodes[e];return r.mesh===void 0?null:n.getDependency("mesh",r.mesh).then(function(s){let a=n._getNodeRef(n.meshCache,r.mesh,s);return r.weights!==void 0&&a.traverse(function(o){if(o.isMesh)for(let l=0,c=r.weights.length;l<c;l++)o.morphTargetInfluences[l]=r.weights[l]}),a})}loadNode(e){let t=this.json,n=this,r=t.nodes[e],s=n._loadNodeShallow(e),a=[],o=r.children||[];for(let c=0,d=o.length;c<d;c++)a.push(n.getDependency("node",o[c]));let l=r.skin===void 0?Promise.resolve(null):n.getDependency("skin",r.skin);return Promise.all([s,Promise.all(a),l]).then(function(c){let d=c[0],f=c[1],h=c[2];h!==null&&d.traverse(function(u){u.isSkinnedMesh&&u.bind(h,Ev)});for(let u=0,g=f.length;u<g;u++)d.add(f[u]);if(d.userData.pivot!==void 0&&f.length>0){let u=d.userData.pivot,g=f[0];d.pivot=new N().fromArray(u),d.position.x-=u[0],d.position.y-=u[1],d.position.z-=u[2],g.position.set(0,0,0),delete d.userData.pivot}return d})}_loadNodeShallow(e){let t=this.json,n=this.extensions,r=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let s=t.nodes[e],a=s.name?r.createUniqueName(s.name):"",o=[],l=r._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&o.push(l),s.camera!==void 0&&o.push(r.getDependency("camera",s.camera).then(function(c){return r._getNodeRef(r.cameraCache,s.camera,c)})),r._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){o.push(c)}),this.nodeCache[e]=Promise.all(o).then(function(c){let d;if(s.isBone===!0?d=new ar:c.length>1?d=new Ht:c.length===1?d=c[0]:d=new mt,d!==c[0])for(let f=0,h=c.length;f<h;f++)d.add(c[f]);if(s.name&&(d.userData.name=s.name,d.name=a),Nn(d,s),s.extensions&&Ni(n,d,s),s.matrix!==void 0){let f=new Fe;f.fromArray(s.matrix),d.applyMatrix4(f)}else s.translation!==void 0&&d.position.fromArray(s.translation),s.rotation!==void 0&&d.quaternion.fromArray(s.rotation),s.scale!==void 0&&d.scale.fromArray(s.scale);if(!r.associations.has(d))r.associations.set(d,{});else if(s.mesh!==void 0&&r.meshCache.refs[s.mesh]>1){let f=r.associations.get(d);r.associations.set(d,{...f})}return r.associations.get(d).nodes=e,d}),this.nodeCache[e]}loadScene(e){let t=this.extensions,n=this.json.scenes[e],r=this,s=new Ht;n.name&&(s.name=r.createUniqueName(n.name)),Nn(s,n),n.extensions&&Ni(t,s,n);let a=n.nodes||[],o=[];for(let l=0,c=a.length;l<c;l++)o.push(r.getDependency("node",a[l]));return Promise.all(o).then(function(l){for(let d=0,f=l.length;d<f;d++){let h=l[d];h.parent!==null?s.add(Jh(h)):s.add(h)}let c=d=>{let f=new Map;for(let[h,u]of r.associations)(h instanceof Jt||h instanceof Mt)&&f.set(h,u);return d.traverse(h=>{let u=r.associations.get(h);u!=null&&f.set(h,u)}),f};return r.associations=c(s),s})}_createAnimationTracks(e,t,n,r,s){let a=[],o=e.name?e.name:e.uuid,l=[];function c(u){u.morphTargetInfluences&&l.push(u.name?u.name:u.uuid)}mi[s.path]===mi.weights?(c(e),e.isGroup&&e.children.forEach(c)):l.push(o);let d;switch(mi[s.path]){case mi.weights:d=Xn;break;case mi.rotation:d=Yn;break;case mi.translation:case mi.scale:d=di;break;default:n.itemSize===1?d=Xn:d=di;break}let f=r.interpolation!==void 0?yv[r.interpolation]:Si,h=this._getArrayFromAccessor(n);for(let u=0,g=l.length;u<g;u++){let x=new d(l[u]+"."+mi[s.path],t.array,h,f);r.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(x),a.push(x)}return a}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let n=Nl(t.constructor),r=new Float32Array(t.length);for(let s=0,a=t.length;s<a;s++)r[s]=t[s]*n;t=r}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){let r=this instanceof Yn?Ll:Mo;return new r(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function Rv(i,e,t){let n=e.attributes,r=new Wt;if(n.POSITION!==void 0){let o=t.json.accessors[n.POSITION],l=o.min,c=o.max;if(l!==void 0&&c!==void 0){if(r.set(new N(l[0],l[1],l[2]),new N(c[0],c[1],c[2])),o.normalized){let d=Nl(Tr[o.componentType]);r.min.multiplyScalar(d),r.max.multiplyScalar(d)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let s=e.targets;if(s!==void 0){let o=new N,l=new N;for(let c=0,d=s.length;c<d;c++){let f=s[c];if(f.POSITION!==void 0){let h=t.json.accessors[f.POSITION],u=h.min,g=h.max;if(u!==void 0&&g!==void 0){if(l.setX(Math.max(Math.abs(u[0]),Math.abs(g[0]))),l.setY(Math.max(Math.abs(u[1]),Math.abs(g[1]))),l.setZ(Math.max(Math.abs(u[2]),Math.abs(g[2]))),h.normalized){let x=Nl(Tr[h.componentType]);l.multiplyScalar(x)}o.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}r.expandByVector(o)}i.boundingBox=r;let a=new Kt;r.getCenter(a.center),a.radius=r.min.distanceTo(r.max)/2,i.boundingSphere=a}function tf(i,e,t){let n=e.attributes,r=[];function s(a,o){return t.getDependency("accessor",a).then(function(l){i.setAttribute(o,l)})}for(let a in n){let o=Fl[a]||a.toLowerCase();o in i.attributes||r.push(s(n[a],o))}if(e.indices!==void 0&&!i.index){let a=t.getDependency("accessor",e.indices).then(function(o){i.setIndex(o)});r.push(a)}return Be.workingColorSpace!==Vt&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${Be.workingColorSpace}" not supported.`),Nn(i,e),Rv(i,e,t),Promise.all(r).then(function(){return e.targets!==void 0?Sv(i,e.targets,t):i})}var xs={version:"vehicles-v1",sourceFingerprint:"1429a07733836963fc6f1bf703bba59e2e766152bea54a9e936a65089c2d0737",sheetSize:[192,224],groundAnchor:[96,144],views:[{id:"vehicle:compact-1:north",vehicleId:"compact-1",direction:"north",rect:[64,1152,32,64],metadata:{name:"Compact 1 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"north",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"2169d3f2-7bb4-4adb-8f45-9fafe1c452e9",createdAt:"2026-10-03T10:49:12.913Z",candidateFingerprint:"07aab820e6ce8a06592298db822c2a057cb4ea0b390f9cd23647707a5c9e2951",metadataFingerprint:"876e88518ee38a407e18bb3393369c54274a351257953511219bae4f0e68124b"}},{id:"vehicle:compact-1:east",vehicleId:"compact-1",direction:"east",rect:[96,1152,64,64],metadata:{name:"Compact 1 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"east",anchor:[32,60],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"6690ffa8-9c93-4f0e-8e7d-4b4ebc2037c4",createdAt:"2026-10-03T10:49:13.798Z",candidateFingerprint:"ac3e36833f5691f4f443b6d8ca03ca1b6cac2f6096ffcb7b6ccf5d3a4bb2604a",metadataFingerprint:"1bde75839bd563c37be513313e0a437f08875b5c1e9c77d112559c9d72d0bbae"}},{id:"vehicle:compact-1:south",vehicleId:"compact-1",direction:"south",rect:[160,1152,32,64],metadata:{name:"Compact 1 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"south",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"f2e4bc13-c538-42b9-b0bf-11deb0b3e192",createdAt:"2026-10-03T10:49:17.784Z",candidateFingerprint:"dce650fcfa30ab50214efb97b4a12caa05413e97456a6023fa42a38886033a65",metadataFingerprint:"4adc9216de3dc4d4526a407e6421f243990c967fb83a8279cf8e3deba2a9233f"}},{id:"vehicle:compact-1:west",vehicleId:"compact-1",direction:"west",rect:[0,1152,64,64],metadata:{name:"Compact 1 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"west",anchor:[32,61],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"d0ae7fc9-caba-4fc6-a3ce-31b43437f0ec",createdAt:"2026-10-03T10:47:25.967Z",candidateFingerprint:"6bfb47db443da242898c5c530752435eff81b6e6567548a63ae2021b772db774",metadataFingerprint:"2f45766ab574f0bd091183247380f58b76fbfa55055155a917b8fe956e9edaad"}},{id:"vehicle:compact-2:north",vehicleId:"compact-2",direction:"north",rect:[64,1216,32,64],metadata:{name:"Compact 2 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"north",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"149e3962-d483-40c1-acdb-e3b5a5dfaa3c",createdAt:"2026-10-03T10:47:27.364Z",candidateFingerprint:"2af80624d4a3da8d79d11c50a3571a36a27bbfe4593f8d1f2673b17d00c05169",metadataFingerprint:"8766030124d1f83a9d5ac269531b40bcaa35d9d55f534d5ea335f043c3dcbaa2"}},{id:"vehicle:compact-2:east",vehicleId:"compact-2",direction:"east",rect:[96,1216,64,64],metadata:{name:"Compact 2 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"east",anchor:[32,60],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"75e993d2-322b-4937-b7f3-2dc342627b1e",createdAt:"2026-10-03T10:47:28.776Z",candidateFingerprint:"1eb76afc6744f7f06049d18bb0a9cca7e91b809d7ca2673ce0713c5c4fd17c79",metadataFingerprint:"e9b156a36104f81b4183473a202ab49a8c0b06ea3165e0df0955114a900322fe"}},{id:"vehicle:compact-2:south",vehicleId:"compact-2",direction:"south",rect:[160,1216,32,64],metadata:{name:"Compact 2 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"south",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"24812862-da93-4bec-b089-1d03294076c0",createdAt:"2026-10-03T10:47:29.577Z",candidateFingerprint:"52e33f98bf577d7aba390fc6e6d7f904dfff6316f53e3231fb6f11b7226fc865",metadataFingerprint:"c0d3f25ef0e40b78e8bdad6a24fc77f28f8c8753f7a0dddf7da77288a045afe1"}},{id:"vehicle:compact-2:west",vehicleId:"compact-2",direction:"west",rect:[0,1216,64,64],metadata:{name:"Compact 2 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"west",anchor:[32,61],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"4a240c6e-c9a5-45e2-bf61-b401b5d2e96e",createdAt:"2026-10-03T10:47:30.815Z",candidateFingerprint:"5416ed02cbd289f6ce1f58faa9be3524e05807fb16cd8eebe7e88dcf75266fc1",metadataFingerprint:"1e690c04c658b49cffccb0c2f009d2d98bb7b1a779ff41f196330f34156fe7b8"}},{id:"vehicle:compact-3:north",vehicleId:"compact-3",direction:"north",rect:[64,1280,32,64],metadata:{name:"Compact 3 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"north",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"ab72cf8c-95a3-476a-9bf0-40c01ccd1c8a",createdAt:"2026-10-03T10:47:36.742Z",candidateFingerprint:"55a7f08fd255d8f137118a760fa18018eb912fd4afac962ec7ee56e24fb81f0b",metadataFingerprint:"f85c979b994f3cdfe9d1258e159746ed3ab1a664074f3ea7c8be8c73556e8a08"}},{id:"vehicle:compact-3:east",vehicleId:"compact-3",direction:"east",rect:[96,1280,64,64],metadata:{name:"Compact 3 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"east",anchor:[32,60],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"10087481-bf8b-4809-abbc-8508a46ad146",createdAt:"2026-10-03T10:47:37.577Z",candidateFingerprint:"9ac761c018233252627e6e70fbe15f9ba9185902bb5075f8288ef9d4c4b15ed8",metadataFingerprint:"254378171892e8bb4cf6bead4a3b64c05fc193454bceb7567be0a2315f551392"}},{id:"vehicle:compact-3:south",vehicleId:"compact-3",direction:"south",rect:[160,1280,32,64],metadata:{name:"Compact 3 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"south",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"bd0a5556-8804-46fc-b641-bab76bc684d0",createdAt:"2026-10-03T10:47:38.385Z",candidateFingerprint:"94752a15c7c1aecc75582582581ff210e58d524162dc2cf2dc394e02497fe395",metadataFingerprint:"7c452547bdbd5b4aee36d46bf04aa3b164dce4d26ca25ff6704167121c42eb7e"}},{id:"vehicle:compact-3:west",vehicleId:"compact-3",direction:"west",rect:[0,1280,64,64],metadata:{name:"Compact 3 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"west",anchor:[32,61],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"80b1efbc-e37b-46c6-97ca-f4ea8a8e029e",createdAt:"2026-10-03T10:47:39.196Z",candidateFingerprint:"5bb35418ac01ec8b6d26b7333d858e7292af1b9d819f552fe3f5be6a9f5dbcf7",metadataFingerprint:"b3d411064110b144ca557373ccae5ac122b38f574c1e152cae6eed2dfd7feb68"}},{id:"vehicle:compact-4:north",vehicleId:"compact-4",direction:"north",rect:[64,1344,32,64],metadata:{name:"Compact 4 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"north",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"eef73190-7f20-4551-8078-dc5a095cfdb5",createdAt:"2026-10-03T10:47:39.855Z",candidateFingerprint:"3843d33b8324437057c6b9adb85eba418c25ea06cb514fad4edeae61bb979cc0",metadataFingerprint:"eb56148909783fd8890068ff5a447b675869dfc1af0a00c583cba8199fd9ac34"}},{id:"vehicle:compact-4:east",vehicleId:"compact-4",direction:"east",rect:[96,1344,64,64],metadata:{name:"Compact 4 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"east",anchor:[32,60],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"4ca53d78-213e-44d2-ba57-1e01c81174fc",createdAt:"2026-10-03T10:47:40.322Z",candidateFingerprint:"971490d91360df701cfee8d3a07c40c94b05a6b3de5515b2003192ac82bf7c94",metadataFingerprint:"f20fb14f1c66dc9ceccd95b7fb4e7a24650981a5948de4202c0b325df2c2d4aa"}},{id:"vehicle:compact-4:south",vehicleId:"compact-4",direction:"south",rect:[160,1344,32,64],metadata:{name:"Compact 4 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"south",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"601cbe64-0440-47bc-81e2-adf2b418ab97",createdAt:"2026-10-03T10:47:40.787Z",candidateFingerprint:"f1382f4bdc2ed1366af3a02bcd7da0e399f720ce69fe814c042051c4658038e4",metadataFingerprint:"e1be6c27ff9d9efe8d855b6eea770e24dbf61c25e32ff2d4452e71b7c5102510"}},{id:"vehicle:compact-4:west",vehicleId:"compact-4",direction:"west",rect:[0,1344,64,64],metadata:{name:"Compact 4 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"west",anchor:[32,61],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"639cd298-2ccc-4ab4-912d-41b76fbfc1db",createdAt:"2026-10-03T10:47:41.236Z",candidateFingerprint:"5618c3c95866538c35adc59ddc3bb50aea67ecd2a4fc54e7098a97a1277912ae",metadataFingerprint:"cfe6c5aa348001e38c2beb6df180b42fedda745ddaffd1fbfbc42f2d9f47e492"}},{id:"vehicle:compact-5:north",vehicleId:"compact-5",direction:"north",rect:[64,1408,32,64],metadata:{name:"Compact 5 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"north",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"e0a1ded5-dc10-4d96-bb08-ed92d2deca81",createdAt:"2026-10-03T10:47:41.695Z",candidateFingerprint:"9277dfa424da4100e6019f8b362b56dbe998ba202f27f149bf552997809103bc",metadataFingerprint:"2f021ff625d9cfbdc38399887984fd07f615f220b49b0f3a3cdb022a044ac859"}},{id:"vehicle:compact-5:east",vehicleId:"compact-5",direction:"east",rect:[96,1408,64,64],metadata:{name:"Compact 5 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"east",anchor:[32,60],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"36bb410a-81d4-4982-99c6-9a2c81b847c2",createdAt:"2026-10-03T10:47:42.155Z",candidateFingerprint:"08bb80c075689bc9a70fad2de269c2e9c115f2662377b1642c7242da11d17f89",metadataFingerprint:"6c5d0123865dc28c0b13d739f69b7a6be0955b7a893b4f2c8bcf05feb7eb1e30"}},{id:"vehicle:compact-5:south",vehicleId:"compact-5",direction:"south",rect:[160,1408,32,64],metadata:{name:"Compact 5 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"south",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"5c3d0321-272d-4a87-a9ef-49a51c86f676",createdAt:"2026-10-03T10:47:42.601Z",candidateFingerprint:"34267c9405fc7a5461e9bf3ed61b04bd75840cda8b9315b4f8f758aed9386b5f",metadataFingerprint:"a29ccffaad7cb73c7135b0557167e9753c3d96c80e7225b183716123822a25dd"}},{id:"vehicle:compact-5:west",vehicleId:"compact-5",direction:"west",rect:[0,1408,64,64],metadata:{name:"Compact 5 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"west",anchor:[32,61],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"a2e29884-715c-4807-ad24-40885825e88b",createdAt:"2026-10-03T10:47:44.424Z",candidateFingerprint:"c1334efdce85b29e88d0522c0982698696907311cd7de8bff71229abd2d8023a",metadataFingerprint:"9c41fc7533fed53ca2f96ce54c20b41c4958393f4e3c42a8a4331e65a5ad802b"}},{id:"vehicle:compact-6:north",vehicleId:"compact-6",direction:"north",rect:[64,1472,32,64],metadata:{name:"Compact 6 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"north",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"bae5c465-cd2e-49c5-8bda-e4f75b48e58e",createdAt:"2026-10-03T10:47:44.894Z",candidateFingerprint:"b06f9838dc6557a35955469dac2914e76632dcc568831ff4707a32fabcce2b68",metadataFingerprint:"7d40e67781ef89ffcc1f400628c04ce6123e194bd773e8d73abe24e0c959c3b4"}},{id:"vehicle:compact-6:east",vehicleId:"compact-6",direction:"east",rect:[96,1472,64,64],metadata:{name:"Compact 6 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"east",anchor:[32,60],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"6dcdde9a-9bb9-4bba-87d8-bce7f8ea7d1d",createdAt:"2026-10-03T10:47:45.284Z",candidateFingerprint:"8961107e2f3b897b6c0afed34927d9a414ad4e50f95caee3ac014e0ae37fdbb8",metadataFingerprint:"7ee3c270e768d53bfe0229f263625d889c8737d841d0ccfdd1d34f47300c4e26"}},{id:"vehicle:compact-6:south",vehicleId:"compact-6",direction:"south",rect:[160,1472,32,64],metadata:{name:"Compact 6 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"south",anchor:[16,60],footprint:[-12,-44,24,44],colliders:[{offsetX:0,offsetY:0,width:24,height:44,zHeight:24}],depthOffset:-22},approval:{id:"b69eac07-f7af-4007-8429-93927df24eda",createdAt:"2026-10-03T10:47:45.671Z",candidateFingerprint:"7dbfb004ce8ec1a5c6c4d364ec25858c5d605fbcc6a535b0157e1a3376e00ef0",metadataFingerprint:"d9ffe74e954ed6fd48f5e3f8fd3a03d6f8ef5908a2bca4b5bbad38c423a2f8a4"}},{id:"vehicle:compact-6:west",vehicleId:"compact-6",direction:"west",rect:[0,1472,64,64],metadata:{name:"Compact 6 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","compact","review proposal"],settings:["road"],facing:"west",anchor:[32,61],footprint:[-28,-20,56,20],colliders:[{offsetX:0,offsetY:0,width:56,height:20,zHeight:24}],depthOffset:-10},approval:{id:"ea6c36ac-9835-47dc-a459-77c1d133072f",createdAt:"2026-10-03T10:47:46.059Z",candidateFingerprint:"262acccd6ad1fce6f880b63749fe248880f6a522551f29221c2b85401bb2a7a5",metadataFingerprint:"72dbf42a89205b19724097fb7cc76a649058cf640c92ce7d00645a44fe88b94d"}},{id:"vehicle:bus-1:north",vehicleId:"bus-1",direction:"north",rect:[368,1136,48,112],metadata:{name:"Bus 1 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"north",anchor:[24,103],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"c1945688-1933-4871-9251-c3f1afe886ef",createdAt:"2026-10-03T10:47:46.473Z",candidateFingerprint:"9b3956fa1a58b1c8c7ba31d6fa4ec9b9a76acb5ca49636975f5f01c8b1201441",metadataFingerprint:"f70f8c6bfe2f0c7890da89dbb4375aaa05f162173da022e240f4f2130e80d909"}},{id:"vehicle:bus-1:east",vehicleId:"bus-1",direction:"east",rect:[208,1200,112,64],metadata:{name:"Bus 1 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"east",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"15a6271a-c85d-4329-95e1-806edccb75df",createdAt:"2026-10-03T10:47:47.503Z",candidateFingerprint:"0a9f3bebc96149948de72a07b67477790e31a828d308c6c1f2b8c834157be817",metadataFingerprint:"173875e49ef5b5c6e041c6529aa04252a2e7c18a4cf0804e1ad84a96768cd02c"}},{id:"vehicle:bus-1:south",vehicleId:"bus-1",direction:"south",rect:[320,1136,48,112],metadata:{name:"Bus 1 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"south",anchor:[24,109],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"50d5042c-0fbc-4200-887e-4280e3f88dae",createdAt:"2026-10-03T10:48:03.052Z",candidateFingerprint:"7784dc2414b180b02c94dafbf3a3c11847e4c400f057395c07fb4615d891114d",metadataFingerprint:"4b187f62a30649ffb00753492aedc5bdd7ab259f6b72cb8ba330f6bdfe7ed88c"}},{id:"vehicle:bus-1:west",vehicleId:"bus-1",direction:"west",rect:[208,1136,112,64],metadata:{name:"Bus 1 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"west",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"4c34c48e-e62a-4f6e-a58d-b90fb57bc1c8",createdAt:"2026-10-03T10:48:10.173Z",candidateFingerprint:"20727d022ca447f78fce203c266700f476c2c4010e3bc61cf38d26fa50990661",metadataFingerprint:"14b79fa508b527ddea2e68f47a71667e1823e86c55f4945307bd42429147d794"}},{id:"vehicle:bus-2:north",vehicleId:"bus-2",direction:"north",rect:[576,1136,48,112],metadata:{name:"Bus 2 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"north",anchor:[24,103],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"c5f1a7ab-5a87-4a9b-b30a-73ae129c2456",createdAt:"2026-10-03T10:48:11.019Z",candidateFingerprint:"d010b844bf18da882aecaa76ac893bcabc2291e4881a4131ea5a081fa20138a5",metadataFingerprint:"30078cf26e70d91d7e08901703ccfcdbac2af75aee0aad7d7f3a429fd68751ba"}},{id:"vehicle:bus-2:east",vehicleId:"bus-2",direction:"east",rect:[416,1200,112,64],metadata:{name:"Bus 2 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"east",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"c0de1a2e-d8de-4224-8552-e47ba017f4e5",createdAt:"2026-10-03T10:48:12.302Z",candidateFingerprint:"c9dc4a1b8fbd3e2165a41713c4c71c778b3f541f806c89a9cfe08ff2b7fd2ff7",metadataFingerprint:"90144d02e8faebcbf06b738e8e0c535eac9b4943c62daddf93c032d19af58614"}},{id:"vehicle:bus-2:south",vehicleId:"bus-2",direction:"south",rect:[528,1136,48,112],metadata:{name:"Bus 2 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"south",anchor:[24,109],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"fcb0665f-74c4-4feb-935c-9613cecfc935",createdAt:"2026-10-03T10:48:13.092Z",candidateFingerprint:"0e7327ace35e46194bb7a598b3f9b593c5fb76db0bb5c6770d923de1adf80244",metadataFingerprint:"467b8a1f4ddc948a9cc8cc2499f3e01bb3963fe6416e6e99e9f6ab7c175f142d"}},{id:"vehicle:bus-2:west",vehicleId:"bus-2",direction:"west",rect:[416,1136,112,64],metadata:{name:"Bus 2 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"west",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"1767158c-0940-46fb-9058-5749ee2b70c3",createdAt:"2026-10-03T10:48:13.831Z",candidateFingerprint:"f0e454b7f88a7e6efb8a829b76a91c0499be82e51b04a04a5e922077905784e8",metadataFingerprint:"c637fb4f09bad8a4c28ae3a44208a1dd1e214dbaf255bcab75393b01f64d80f1"}},{id:"vehicle:bus-3:north",vehicleId:"bus-3",direction:"north",rect:[368,1264,48,112],metadata:{name:"Bus 3 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"north",anchor:[24,103],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"01513845-0713-458a-aed9-6f0d0073064d",createdAt:"2026-10-03T10:48:14.616Z",candidateFingerprint:"fa43a7f7e93af57bf45bb04f09a64b9dd79175a1f2123e8343bb3f756a93820d",metadataFingerprint:"5e620a9ba90561e06d978e979d3b0593211463157873501a1c65acdd1c7e7282"}},{id:"vehicle:bus-3:east",vehicleId:"bus-3",direction:"east",rect:[208,1328,112,64],metadata:{name:"Bus 3 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"east",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"c2200ed2-05d1-4ae2-8570-63684a20a43b",createdAt:"2026-10-03T10:48:15.110Z",candidateFingerprint:"7335db700ad161019b659bbc5ce1388e2094c69d3d533c4bc45cf01a5b5e1456",metadataFingerprint:"a57ffa26b28b6eedc0bf4247d533e008fd0ef4e93472137cdede0f1a744da682"}},{id:"vehicle:bus-3:south",vehicleId:"bus-3",direction:"south",rect:[320,1264,48,112],metadata:{name:"Bus 3 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"south",anchor:[24,109],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"8554d36e-fc9a-4570-9e56-a81e5a7cbc98",createdAt:"2026-10-03T10:48:15.612Z",candidateFingerprint:"d5cbdcb86d006fa78659b3bf01f31f389e89e6dc6014e99e3d9a0d372a39e4e1",metadataFingerprint:"6b4e3206b4b3205857cc9335c36ed8567f438d7b8cce2ee6ddcf8c5003961acf"}},{id:"vehicle:bus-3:west",vehicleId:"bus-3",direction:"west",rect:[208,1264,112,64],metadata:{name:"Bus 3 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"west",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"1ad91828-cebb-40e4-9256-17174c417cd8",createdAt:"2026-10-03T10:48:15.988Z",candidateFingerprint:"490fa09fdadd5601e96b4394662d3c6d45d893e64d909e22ee0596485e79f605",metadataFingerprint:"2c638ecabd11280ec777868f2023fa5f90eb7f70fc0a29dcb8a46962f71ae0b5"}},{id:"vehicle:bus-4:north",vehicleId:"bus-4",direction:"north",rect:[576,1264,48,112],metadata:{name:"Bus 4 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"north",anchor:[24,103],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"949f0ecd-cbc1-4302-ad85-10fb4e3ffd7f",createdAt:"2026-10-03T10:48:16.328Z",candidateFingerprint:"20a8cf64c2661abe3596f0fc8eed4d42069e40da4e7240ee0eca858e92d20645",metadataFingerprint:"aabd71bae808e44f48595178799c879aa18abc30634fd337d4844d44c33426bc"}},{id:"vehicle:bus-4:east",vehicleId:"bus-4",direction:"east",rect:[416,1328,112,64],metadata:{name:"Bus 4 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"east",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"706e1cf4-e2df-4efd-a70b-887a929b2e7a",createdAt:"2026-10-03T10:48:16.622Z",candidateFingerprint:"7409e2f7a75d3f2315195e1a0a38c52c7407d3c67bd53c9901e8579f727a90cc",metadataFingerprint:"9450bdab4dc44e086a56091796e63699804e428bf9dcb05e14e775a0878ad752"}},{id:"vehicle:bus-4:south",vehicleId:"bus-4",direction:"south",rect:[528,1264,48,112],metadata:{name:"Bus 4 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"south",anchor:[24,109],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"240f4681-5310-4389-9ca8-888783b69034",createdAt:"2026-10-03T10:48:16.926Z",candidateFingerprint:"6a3a7928ad4426fb7b27f79c798607d55bfb48029aa9e68e7ea48b6fd08b3fdb",metadataFingerprint:"b2e8620d2fe5fa6b8b517edb203a18ebe87b2bc5d9866af0052b37582ad6db3b"}},{id:"vehicle:bus-4:west",vehicleId:"bus-4",direction:"west",rect:[416,1264,112,64],metadata:{name:"Bus 4 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"west",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"82f28bea-7f47-4545-99d0-14e1d8110b3b",createdAt:"2026-10-03T10:48:17.251Z",candidateFingerprint:"3e4bf6c628e1d53a94ba30a16f5fda557479697aaa9e20a1a037947ac9869f43",metadataFingerprint:"ea26223b06316f3911d6b5480b3f81aa373458b9ea24ae4ae2b93556029908f2"}},{id:"vehicle:bus-5:north",vehicleId:"bus-5",direction:"north",rect:[368,1392,48,112],metadata:{name:"Bus 5 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"north",anchor:[24,103],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"dd886229-7e98-418e-b375-4c0b0f18f3bc",createdAt:"2026-10-03T10:48:17.667Z",candidateFingerprint:"8e8cbe39ce1dfed0ef6f6cc3719d3eaa4a420193c3d4a55ceec7b4bb3103e318",metadataFingerprint:"419cc06eabf291a4e01e3e866734db93d4f44f70720ec9e219b020e25058f0e2"}},{id:"vehicle:bus-5:east",vehicleId:"bus-5",direction:"east",rect:[208,1456,112,64],metadata:{name:"Bus 5 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"east",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"6c34ae4c-f1e3-45ac-a6a6-8b26f7fbb6c4",createdAt:"2026-10-03T10:48:18.249Z",candidateFingerprint:"0155129d472c2c56347cc3807ab8f6ec5ba6e22753371e0f8c1ef51d52af6703",metadataFingerprint:"05e7b21769d5495327a662e5580c053a41f2015ec4b8704c0edfd39dc81c6695"}},{id:"vehicle:bus-5:south",vehicleId:"bus-5",direction:"south",rect:[320,1392,48,112],metadata:{name:"Bus 5 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"south",anchor:[24,109],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"3d092c2c-de62-463c-8067-152df9397e04",createdAt:"2026-10-03T10:48:18.883Z",candidateFingerprint:"b8469c2386b6525329ecb11eb136e6234a42a72428da1c7ab7b32fddc3fd0058",metadataFingerprint:"54a0c4cfa698734e51449a550ea3b673e7f1254e5987a02f5240984a4dcb89a9"}},{id:"vehicle:bus-5:west",vehicleId:"bus-5",direction:"west",rect:[208,1392,112,64],metadata:{name:"Bus 5 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"west",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"0e445f1c-579b-48e5-96f2-f56c9fa670ad",createdAt:"2026-10-03T10:48:19.350Z",candidateFingerprint:"cf7afeeb7f889e93a4de2d2597aea58f8711ea73710abea26fafc53923fbdf44",metadataFingerprint:"6ff7be87e858e613935f027462e4aabeee8df9d9b7cfe19bf415370c3cc69724"}},{id:"vehicle:bus-6:north",vehicleId:"bus-6",direction:"north",rect:[576,1392,48,112],metadata:{name:"Bus 6 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"north",anchor:[24,103],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"b5d70180-f25e-440c-a17b-477067eedd1c",createdAt:"2026-10-03T10:48:19.799Z",candidateFingerprint:"8a8f55d1e6d9dcfe38deb9df78f76ea8f19fabf9c368e2653dcce4ec03fcadd3",metadataFingerprint:"78da7fc41e811421c108037ba372a885a5337afe444985799c32472cb0c4cce2"}},{id:"vehicle:bus-6:east",vehicleId:"bus-6",direction:"east",rect:[416,1456,112,64],metadata:{name:"Bus 6 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"east",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"cfb2fcd0-46e9-4c80-b70c-0e01735fc0d0",createdAt:"2026-10-03T10:48:20.252Z",candidateFingerprint:"fe625101492852a508a2dd273770f72954dab7e5f061f929ffd033c7ebea45a5",metadataFingerprint:"4293191460014824e96939ada7e64a0b28b503bd0a9cdf7809a5cd61a5c048d0"}},{id:"vehicle:bus-6:south",vehicleId:"bus-6",direction:"south",rect:[528,1392,48,112],metadata:{name:"Bus 6 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"south",anchor:[24,109],footprint:[-19,-86,38,86],colliders:[{offsetX:0,offsetY:0,width:38,height:86,zHeight:40}],depthOffset:-43},approval:{id:"aa351063-81c5-4cf6-85aa-41cc3f94b28c",createdAt:"2026-10-03T10:48:20.720Z",candidateFingerprint:"1918742d97585b3ab3fa8f3fef7d697ff7673ec32e909d95336841078a29d319",metadataFingerprint:"2bba77cfed22f3c55f222dbf43f38fd0d0272686f5a03a30f151c9903fc04564"}},{id:"vehicle:bus-6:west",vehicleId:"bus-6",direction:"west",rect:[416,1392,112,64],metadata:{name:"Bus 6 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","bus","review proposal"],settings:["road"],facing:"west",anchor:[56,61],footprint:[-52,-32,104,32],colliders:[{offsetX:0,offsetY:0,width:104,height:32,zHeight:40}],depthOffset:-16},approval:{id:"9698e6bc-1e92-45c9-9ef7-44b6b08d7bb6",createdAt:"2026-10-03T10:48:21.154Z",candidateFingerprint:"c36f9b364ba84425688188c3f2b84db88960a8dde475415231a59e5069b62119",metadataFingerprint:"6f5167e9df52d427f2f648c214053d051ae416a9177aac2de35435d30d22e239"}},{id:"vehicle:sedan-12:north",vehicleId:"sedan-12",direction:"north",rect:[640,5520,48,80],metadata:{name:"Car 12 \xB7 beige sedan \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"5e64093e-d3f5-4caf-ad93-e567c2a3d525",createdAt:"2026-10-03T10:48:21.649Z",candidateFingerprint:"f569bb452bf522f017f44f1d90ead48267b345b417059669b6f80b40dc465023",metadataFingerprint:"ddce1151bc25cc4e6f9d88ef41a8fc5a7cf6e037e49b7e5c7ad95ddb49544206"}},{id:"vehicle:sedan-12:east",vehicleId:"sedan-12",direction:"east",rect:[512,5504,80,48],metadata:{name:"Car 12 \xB7 beige sedan \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"ac327268-1eaf-4478-8ce7-2ade03affe87",createdAt:"2026-10-03T10:48:22.344Z",candidateFingerprint:"c8931d6f537217119106d31a30d989b8d8d8299db4d00402af997f02809801d3",metadataFingerprint:"bcd4f115d0b609b1e8940a5cfd0fae1cf0979ddaee6023c8eab173ef07172d6c"}},{id:"vehicle:sedan-12:south",vehicleId:"sedan-12",direction:"south",rect:[592,5520,48,80],metadata:{name:"Car 12 \xB7 beige sedan \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"61886de2-ed5f-4b0b-a5a8-5313f52ed1bf",createdAt:"2026-10-03T10:48:22.761Z",candidateFingerprint:"cb7fe4da5130a00f6d2e3779a01b4d5bc7083e683f70af21d3ad9fcfef5faf00",metadataFingerprint:"89b86cd33c03795d64d50d835bcf91ac80cdb826e4b697dc54d150b327cd845d"}},{id:"vehicle:sedan-12:west",vehicleId:"sedan-12",direction:"west",rect:[512,5552,80,48],metadata:{name:"Car 12 \xB7 beige sedan \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"3c33e01e-073b-475d-9c1b-2ad070376e9f",createdAt:"2026-10-03T10:48:23.097Z",candidateFingerprint:"342bbf69a79c715b1eed01fda7231d8c79082bffad8e4762ab62a17b9824eb74",metadataFingerprint:"95ea0832093be7bbac7bd7a8578efd3de2bf42925d60affebf0bd850ff5d3cc5"}},{id:"vehicle:car-7:north",vehicleId:"car-7",direction:"north",rect:[992,5520,48,80],metadata:{name:"Car 7 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"b0bac773-209e-4b7a-9cd7-7bc0aaa093eb",createdAt:"2026-10-03T10:48:23.449Z",candidateFingerprint:"a10ecd897e521bfffc5e73569c84e54deeeb7b63ec17c0b93f0bc987413d94a9",metadataFingerprint:"ec364b7b9adc2d187557f322b97b1130be6c5e007f9f032955fb5cfed791dc9b"}},{id:"vehicle:car-7:east",vehicleId:"car-7",direction:"east",rect:[864,5504,80,48],metadata:{name:"Car 7 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"c0d00e2d-889b-4e24-86e2-ad73222af890",createdAt:"2026-10-03T10:48:23.743Z",candidateFingerprint:"b83fc73c80f88954a6d0768f80db257bb84ed254de5a3d9bb0c6bc4a1c517cfe",metadataFingerprint:"edf6e9f7bb75076c0bacabb2255120f31f64cfb26da8b0789eddc4f20ceb7971"}},{id:"vehicle:car-7:south",vehicleId:"car-7",direction:"south",rect:[944,5520,48,80],metadata:{name:"Car 7 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"ad64cc31-8c37-4b99-9790-b34d568d4c4b",createdAt:"2026-10-03T10:48:24.059Z",candidateFingerprint:"73ab3ca10b8289d0a1a8e2a8a91b43a47392983c8f935f87774841a7d67e85d4",metadataFingerprint:"3301978d4c92d88de8084e644a3ee12456308f27bd412476c5657aab80391c57"}},{id:"vehicle:car-7:west",vehicleId:"car-7",direction:"west",rect:[864,5552,80,48],metadata:{name:"Car 7 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"8aef7688-037d-488a-9869-6494afaaf58e",createdAt:"2026-10-03T10:48:24.528Z",candidateFingerprint:"f75357c788c5308c9476fcfda6bb8d6a530f066e552f43aa2ad6ebad524f0ffe",metadataFingerprint:"02ca2c52bfc1acc78f35bf516f882e474284b655e8827a072edd4d90f45bace4"}},{id:"vehicle:car-8:north",vehicleId:"car-8",direction:"north",rect:[992,5616,48,80],metadata:{name:"Car 8 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"c83d816b-a33c-4e82-b650-84b41d4ab18a",createdAt:"2026-10-03T10:48:24.946Z",candidateFingerprint:"2345e6dce0d20a7aa6d574b6f0fa53fae396b434e0e46a477028ba3ed56d9fe0",metadataFingerprint:"cc7dc81cb0e8718120d028c9ad6690f46c191f16a8243bab88b07fefd7083c5b"}},{id:"vehicle:car-8:east",vehicleId:"car-8",direction:"east",rect:[864,5600,80,48],metadata:{name:"Car 8 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"9229d173-68bf-47e4-980b-38481fc1f4ad",createdAt:"2026-10-03T10:48:25.282Z",candidateFingerprint:"27e3179dcf6efc421c0cdee7a8119be7fa3706fc5dba53174f68d4380d5e5cc8",metadataFingerprint:"7c67755dba576a37943bcabc3fe66910d184d16ffe9e41e117d36b9f4c805541"}},{id:"vehicle:car-8:south",vehicleId:"car-8",direction:"south",rect:[944,5616,48,80],metadata:{name:"Car 8 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"061e1ad4-66c3-41d4-92e4-0e16e0532078",createdAt:"2026-10-03T10:48:25.502Z",candidateFingerprint:"f1f53a10f45dac6b736233f179aacefcec9617cf4d378767fde0ca157a87ce64",metadataFingerprint:"83cfde9fa5374794efcf1b0cee06bdb196a82d7672ddb2e74ce0a484179d5aeb"}},{id:"vehicle:car-8:west",vehicleId:"car-8",direction:"west",rect:[864,5648,80,48],metadata:{name:"Car 8 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"77f45078-d670-4469-963c-f28f0d98a00c",createdAt:"2026-10-03T10:48:25.901Z",candidateFingerprint:"336e90ec5c9c3e436d955285fa952cd34d66fe1dfbd61c03e650930a3c05cb92",metadataFingerprint:"29c9ce4b5d8031e835a063a1c1e9f9c402f887ad314aae666a7b5e3594d50570"}},{id:"vehicle:car-9:north",vehicleId:"car-9",direction:"north",rect:[992,5712,48,80],metadata:{name:"Car 9 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"e80c0ee1-728a-4b99-b702-5e23f19d51e4",createdAt:"2026-10-03T10:48:26.223Z",candidateFingerprint:"f5077b8847dea5d323efc42f89cb63f5fb6e60fc94eb97ecc306a150bb035fe9",metadataFingerprint:"afb6593a018280c13b08038ffa73d59f88f606ffc5b637d7594440d86eab83af"}},{id:"vehicle:car-9:east",vehicleId:"car-9",direction:"east",rect:[864,5696,80,48],metadata:{name:"Car 9 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"a51e4f76-f28c-4eaa-a56f-d8d2acbf39ec",createdAt:"2026-10-03T10:48:26.590Z",candidateFingerprint:"3404935ff37a42eef2111a8f01ff03213de010e36096be78e86debcfa414b722",metadataFingerprint:"3d37fb70486db7e410869cee6ca6714d50a0fa50eaa2208c519c3fec7d768ff5"}},{id:"vehicle:car-9:south",vehicleId:"car-9",direction:"south",rect:[944,5712,48,80],metadata:{name:"Car 9 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"bc6e7adc-bcfb-4403-a35a-cbaccd2740b4",createdAt:"2026-10-03T10:48:26.900Z",candidateFingerprint:"32529d80ff0977f814ae804275310914724ca40dd522b9203f9bdc9f607cd37e",metadataFingerprint:"df4b900e060c9fd115a45ee498f712df03618ed198b850a237b0f48989dfddf2"}},{id:"vehicle:car-9:west",vehicleId:"car-9",direction:"west",rect:[864,5744,80,48],metadata:{name:"Car 9 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"5e33e232-92f4-44b0-9bf5-ba2aa2ddbf6e",createdAt:"2026-10-03T10:48:27.297Z",candidateFingerprint:"604782742fd65b7b4d3bdb5dece2c94639731be45751b0cf8e365ee2df27985f",metadataFingerprint:"36e9600c4cf0ece84ff811c6f9389d7cf3f359178b1a96da800396b38704209c"}},{id:"vehicle:car-10:north",vehicleId:"car-10",direction:"north",rect:[992,5808,48,80],metadata:{name:"Car 10 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"a3248d9d-7634-499f-8eab-6e03614fa62b",createdAt:"2026-10-03T10:48:27.733Z",candidateFingerprint:"c92f1b8d250d6fdd5ddc13d514814bf0bd65a42989fd433d36c3008b4e68f291",metadataFingerprint:"029018f7167948acdb9334c89612db3d2a3aefa74ac7b38fdfe959a659cd5237"}},{id:"vehicle:car-10:east",vehicleId:"car-10",direction:"east",rect:[864,5792,80,48],metadata:{name:"Car 10 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"e26892de-62f4-417b-932b-9f15553290fa",createdAt:"2026-10-03T10:48:28.087Z",candidateFingerprint:"55e06b113c522fb534bd0bfb6dee6e98516ff256fd12fcc3164a57a62ee71e0f",metadataFingerprint:"90875180aaff56e91a1893780355edf915a5cfa381be0831897267be11b798ec"}},{id:"vehicle:car-10:south",vehicleId:"car-10",direction:"south",rect:[944,5808,48,80],metadata:{name:"Car 10 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"09e3a8d1-2535-4311-b016-0b957158ade7",createdAt:"2026-10-03T10:48:28.518Z",candidateFingerprint:"656d6026eae8f48c05a87994e033a0b83c347df338af21a1b6f338f2d038d5d0",metadataFingerprint:"ee669c3ac10023887b5f8112534b41c3e86a536a26e49579df73080504dcf6e2"}},{id:"vehicle:car-10:west",vehicleId:"car-10",direction:"west",rect:[864,5840,80,48],metadata:{name:"Car 10 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"d4e7d530-6ace-4d14-9791-c585e4573a21",createdAt:"2026-10-03T10:48:28.869Z",candidateFingerprint:"790fbdb88e861aa2a603f7d475a6672f3936892cd28609a83b4003f2b8b6d238",metadataFingerprint:"3ea44459b7b2ef430d5ba9a516cf21b12c165ce80bd1eaf28b6e8f31be138af3"}},{id:"vehicle:car-11:north",vehicleId:"car-11",direction:"north",rect:[992,5904,48,80],metadata:{name:"Car 11 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"17071d3b-32c2-4f14-be14-1bb94f5179a8",createdAt:"2026-10-03T10:48:29.240Z",candidateFingerprint:"67aa434e776f1d1753dbddcfb8811b20e3b8b15f855d8270559f1100c374a467",metadataFingerprint:"caf6ba6f32f8e6a08f17dc59873a95221296fd0a59ee05beb7d9c8e299b45761"}},{id:"vehicle:car-11:east",vehicleId:"car-11",direction:"east",rect:[864,5888,80,48],metadata:{name:"Car 11 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"6cc15d89-87f6-405b-8156-d829c66a838b",createdAt:"2026-10-03T10:48:29.626Z",candidateFingerprint:"ad4f3e11b464b14fb6ec0bd444139131831b066821eca65165d0ae7a3ae2a30a",metadataFingerprint:"77a90585a4eb08bdc028d3ec515aadff7ac4e54c4080f1b51c26997994c8e526"}},{id:"vehicle:car-11:south",vehicleId:"car-11",direction:"south",rect:[944,5904,48,80],metadata:{name:"Car 11 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"eead34a4-ec55-4508-9ad7-c263163931c9",createdAt:"2026-10-03T10:48:30.083Z",candidateFingerprint:"59731bf4dea205d2c1a51af6a8c8ee57f87a8d90cd7bf821c7112d6dbabf11ad",metadataFingerprint:"3473ba87fcd738048d32b2360e2b235c4fb0233a469a091b4dfd63a8e4653660"}},{id:"vehicle:car-11:west",vehicleId:"car-11",direction:"west",rect:[864,5936,80,48],metadata:{name:"Car 11 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"eee33cd6-7fda-495f-aa3f-08564cdee78b",createdAt:"2026-10-03T10:48:30.429Z",candidateFingerprint:"15067996348e31f15a45d0b9619a2dafe2ae22492e81a67a97fd65c56cdf0dd0",metadataFingerprint:"41709ab8d4a1e8d48897ccd34a526d510da320f005addf89fd3dbb82dc1d6b9b"}},{id:"vehicle:car-13:north",vehicleId:"car-13",direction:"north",rect:[640,5616,48,80],metadata:{name:"Car 13 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"c2e34e96-b2b2-40ca-8118-16aff88ebacd",createdAt:"2026-10-03T10:48:30.808Z",candidateFingerprint:"940e61ee063a1290fcb19570c75d75e0e30949955a01003c55b4c180afcd11b1",metadataFingerprint:"ad7a2ee9020486ade7af2ea914b691395f1c7d1439b69d2524819d1c7a016607"}},{id:"vehicle:car-13:east",vehicleId:"car-13",direction:"east",rect:[512,5600,80,48],metadata:{name:"Car 13 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"e1c25787-aecc-4ed8-bbce-be000bd9a256",createdAt:"2026-10-03T10:48:31.240Z",candidateFingerprint:"39fe7e0589b692a512452396a28d809d7bb294a51fc921f159f76846774681b2",metadataFingerprint:"483d3a63e8fe088f4fc2beca3de860e611e93fb336186915481cc4b8265a9f97"}},{id:"vehicle:car-13:south",vehicleId:"car-13",direction:"south",rect:[592,5616,48,80],metadata:{name:"Car 13 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,74],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"3b30a6ea-d5af-4108-8797-bcb77bbf9f27",createdAt:"2026-10-03T10:48:31.706Z",candidateFingerprint:"72648db6badb1928e06bcce057a932452f5b1eee1233c15bbc34ae496158c6b7",metadataFingerprint:"24db8d57ff8ce98f8af2e1e7ccd774d87999ee6be366857fb0d317a23145507f"}},{id:"vehicle:car-13:west",vehicleId:"car-13",direction:"west",rect:[512,5648,80,48],metadata:{name:"Car 13 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"98c0fef7-b99a-40f2-8213-184c3952c231",createdAt:"2026-10-03T10:48:32.157Z",candidateFingerprint:"174db9c5e8dab73e6990440a5f4c2ea3209e84ff7a5a2d4831c8eca8b0ce42e0",metadataFingerprint:"4b288aec90499843d2e42666cb43ea4d3a4e8f37a1c8db49c3e1cedb8b4cfdf0"}},{id:"vehicle:car-14:north",vehicleId:"car-14",direction:"north",rect:[1168,5520,48,64],metadata:{name:"Car 14 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"34d464cd-3bff-4e30-b11e-df39e662829b",createdAt:"2026-10-03T10:48:32.587Z",candidateFingerprint:"c96a506c4296bdf089629bc6d1719e31924a77d4b926965ea9ed00aa020d79a0",metadataFingerprint:"bdd83aded34f67956a117678eba4ca6d0356e261b1f8889a06d8bd59a8c3d3c7"}},{id:"vehicle:car-14:east",vehicleId:"car-14",direction:"east",rect:[1040,5504,80,48],metadata:{name:"Car 14 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"3f99bc0b-6d41-4367-971a-65a8aab30088",createdAt:"2026-10-03T10:48:32.970Z",candidateFingerprint:"a9cbba6c3c9e3c44078d93ffc4493150e06c4214eabbc789f9ad918dcf65c5a3",metadataFingerprint:"2cece372dd11db0bfcc70ae8135f8d72aa4c2f121eea3977a894f4f956684d2a"}},{id:"vehicle:car-14:south",vehicleId:"car-14",direction:"south",rect:[1120,5520,48,64],metadata:{name:"Car 14 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"ae9301c1-ce61-4399-8241-735109e3fe14",createdAt:"2026-10-03T10:48:33.318Z",candidateFingerprint:"e8a8e3a912209e9423cf5f3bf4715abb0eb1a3fac2171bd8583662465cf68cff",metadataFingerprint:"11ab24588bd154b199f7faaad349bc2a2baf42089f12122b4c803f92dc36b686"}},{id:"vehicle:car-14:west",vehicleId:"car-14",direction:"west",rect:[1040,5552,80,48],metadata:{name:"Car 14 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"80c98979-894f-4a7b-918a-d7fdfe29c66f",createdAt:"2026-10-03T10:48:33.629Z",candidateFingerprint:"3bdbd1b8b5dfd0236b638dc2c6307e85340137111870e9e5411f77431ab35cc9",metadataFingerprint:"82b1a2b085b5d231c661b076f070aa72b7898753cbe721c0aea41d2854355985"}},{id:"vehicle:car-15:north",vehicleId:"car-15",direction:"north",rect:[1168,5616,48,64],metadata:{name:"Car 15 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"642cecdc-883b-428e-9c0a-9868ed248dfc",createdAt:"2026-10-03T10:48:34.002Z",candidateFingerprint:"8f32d008c858fa91742a74ef3e5ca450ebf1fdf3eaea1d17bc73716d2c69d0c6",metadataFingerprint:"de26aa219148689b68219f982fbe45681d81c5aa2da6a9b6fd690ab1e53acaec"}},{id:"vehicle:car-15:east",vehicleId:"car-15",direction:"east",rect:[1040,5600,80,48],metadata:{name:"Car 15 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"c67ddfb5-b218-4213-9640-dfa462237316",createdAt:"2026-10-03T10:48:34.325Z",candidateFingerprint:"9b22269923c016fb03f99c179477773d117fc2f3865416506b16dcc5f89b92a8",metadataFingerprint:"33addbfc8298f2b9a587df76b2c5ef1c51761221604f95fbfd586501fd3d4ec2"}},{id:"vehicle:car-15:south",vehicleId:"car-15",direction:"south",rect:[1120,5616,48,64],metadata:{name:"Car 15 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"fbc116d3-f8db-43f5-9ebc-2c5c755c4b9b",createdAt:"2026-10-03T10:48:34.729Z",candidateFingerprint:"7d8fae3d0d60760cd0b1963d4ff2cee51efca3cc5f8ec13cc197b12bbdb7e934",metadataFingerprint:"49036a140e4334a57136255c29c89514c94261d12745917968c81818ff62b245"}},{id:"vehicle:car-15:west",vehicleId:"car-15",direction:"west",rect:[1040,5648,80,48],metadata:{name:"Car 15 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"e4155c45-6fe9-46b3-9a6b-7621202e7008",createdAt:"2026-10-03T10:48:35.061Z",candidateFingerprint:"dc4aa893515442ad0df75230c835ac399c2ededa0cffa3c25e77f1ebf20c5293",metadataFingerprint:"4672fb0eb9ed09326d1132d771702fd62b8ac5e6c735b29dce9fe4a656d85459"}},{id:"vehicle:car-16:north",vehicleId:"car-16",direction:"north",rect:[1168,5712,48,64],metadata:{name:"Car 16 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"65a717cc-070b-498b-81d0-e45251d22a4a",createdAt:"2026-10-03T10:48:35.377Z",candidateFingerprint:"3186df7a679b9e816ad23e40f8d4813acb5635ad8361c39909f7f3275f3f348a",metadataFingerprint:"da85fc3ed9fe9d1f84af087fa0bae9375dd43ecaf660b8113c78f2f94a914f11"}},{id:"vehicle:car-16:east",vehicleId:"car-16",direction:"east",rect:[1040,5696,80,48],metadata:{name:"Car 16 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"31ece62f-b8fc-4b3d-bcb4-0b8ce828c8b2",createdAt:"2026-10-03T10:48:35.713Z",candidateFingerprint:"677cf817bda945cd1c8864b9668ef4f7bdb4f71b55bd4b9c9d568e0accfb462f",metadataFingerprint:"caf4ea56456dfed1a0243de1ca4f7d9fd5e7d7c49faccc7166d2804c8c23973f"}},{id:"vehicle:car-16:south",vehicleId:"car-16",direction:"south",rect:[1120,5712,48,64],metadata:{name:"Car 16 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"03d4372b-e8c5-472b-8080-ebab9dd64e9b",createdAt:"2026-10-03T10:48:38.036Z",candidateFingerprint:"4cf2716147779faba3a7effcef23bc86ca8fa7cd820c5d026ef7cbd4a89f21ed",metadataFingerprint:"3bb26435bedf4eccabaac8f5c85cd76e24d69d06dfa2b5e5a80eaa36ce5c4dd2"}},{id:"vehicle:car-16:west",vehicleId:"car-16",direction:"west",rect:[1040,5744,80,48],metadata:{name:"Car 16 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"20083d69-328c-446e-853b-f32aadc3d50a",createdAt:"2026-10-03T10:48:38.368Z",candidateFingerprint:"9ddca517a497af184400e90a4a1ce5cad48a8e227eb8d3fa4510cfc81cbb7e2b",metadataFingerprint:"a8f88c949c2ba900aecd0d8f1ececcf0eb925d701c63dcfc373ff3df8e69de3d"}},{id:"vehicle:car-17:north",vehicleId:"car-17",direction:"north",rect:[1168,5808,48,64],metadata:{name:"Car 17 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"b8d5def1-03fb-4fdd-84b4-61b4974b8388",createdAt:"2026-10-03T10:48:38.750Z",candidateFingerprint:"12e194dfd19f72111288852d8eaa6099ffe6335dfcf599ec0cd3d7c27ec0b6f8",metadataFingerprint:"865350ea11e3eb41979685f5af8826c6bbc604d10745b3b71917f549729b4684"}},{id:"vehicle:car-17:east",vehicleId:"car-17",direction:"east",rect:[1040,5792,80,48],metadata:{name:"Car 17 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"e5569343-a773-49dd-baf3-8215f2bdf6e2",createdAt:"2026-10-03T10:48:38.936Z",candidateFingerprint:"d984307be0f44d9010a547d0e8212c8090858e1b562d7e3f7798970002c3dcdc",metadataFingerprint:"71b2882e99e7b937882dd5eda3386ecb5c895ba5d900283d1039dfcd1ed5db5a"}},{id:"vehicle:car-17:south",vehicleId:"car-17",direction:"south",rect:[1120,5808,48,64],metadata:{name:"Car 17 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"d297d476-8333-4f81-9ff0-2742375ecbfd",createdAt:"2026-10-03T10:48:39.094Z",candidateFingerprint:"cfde06d65239e3255746e8258a2f8a87d774c5f0f96502ea2741bce103c4170c",metadataFingerprint:"1e11f7de106ef3775df802f6e56dfe1cac338c65a82edc623863e6a4a00c0d4d"}},{id:"vehicle:car-17:west",vehicleId:"car-17",direction:"west",rect:[1040,5840,80,48],metadata:{name:"Car 17 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"1e5004b3-439e-4db3-812e-a74a5fdfda8d",createdAt:"2026-10-03T10:48:39.268Z",candidateFingerprint:"febe246946246bead4cc432d33e786bb3b1476499f4863d9650eb5f0807c414b",metadataFingerprint:"74d787e9de5cd72378fe6341d74b6ff9524677ea4fc4b2d6f32d0ab7b50f151e"}},{id:"vehicle:car-18:north",vehicleId:"car-18",direction:"north",rect:[1168,5904,48,64],metadata:{name:"Car 18 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"b3e1f1d0-98c8-4d46-bdea-6901b2cc9db4",createdAt:"2026-10-03T10:48:39.443Z",candidateFingerprint:"dfacaaf18168fb4f4cb0b786a9882750c9f4edb9b195a0377e03dcabc59c4134",metadataFingerprint:"faa090bdbebde0e4e62c77f8a76b98968fc4bb88d7667d2133d035aee6921c04"}},{id:"vehicle:car-18:east",vehicleId:"car-18",direction:"east",rect:[1040,5888,80,48],metadata:{name:"Car 18 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"20393e70-ac06-4da2-931c-2374489fa1f4",createdAt:"2026-10-03T10:48:39.621Z",candidateFingerprint:"61ea1ab4bb6658b6b73a0396507719fed8a8dc918013aa9690fb7866711294af",metadataFingerprint:"2f348b21f9ce8c998a5f24bb4f93cd1a24740d49811e860931507f012009cb5d"}},{id:"vehicle:car-18:south",vehicleId:"car-18",direction:"south",rect:[1120,5904,48,64],metadata:{name:"Car 18 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"fcec8c0f-0182-4e25-886a-aaa4642b2736",createdAt:"2026-10-03T10:48:39.799Z",candidateFingerprint:"27a49d73d3bbc0c304a5bf48ae4aeed693034e2f1ea9a919726307c1bfc35e21",metadataFingerprint:"a05e1554f1d8abf39610ed9144d9f9dc79feb42bf99781fa77c7ab2647567d0c"}},{id:"vehicle:car-18:west",vehicleId:"car-18",direction:"west",rect:[1040,5936,80,48],metadata:{name:"Car 18 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"d1f320f3-2ae1-4514-a4f8-3afd4e174019",createdAt:"2026-10-03T10:48:39.983Z",candidateFingerprint:"2f336a496d02f4235364ba2033e771cdd205ffa211027472d1dfbdc04bc0f387",metadataFingerprint:"d6044241948110f5c1389368634254b2dda02c197366565793aeeea22f511542"}},{id:"vehicle:car-19:north",vehicleId:"car-19",direction:"north",rect:[816,5520,48,64],metadata:{name:"Car 19 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"d46ca795-eab4-4a9c-9a1d-44ade651b6ea",createdAt:"2026-10-03T10:48:40.192Z",candidateFingerprint:"17f8641b9112490d7897b0736c5720f857432c08dcc32b65675c27b25b46635e",metadataFingerprint:"307dde288f1a50f39366e1e09dcf72ede0b73edfc7a016e7765bf2d92e0c8e1c"}},{id:"vehicle:car-19:east",vehicleId:"car-19",direction:"east",rect:[688,5504,80,48],metadata:{name:"Car 19 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"a35caf2c-d125-4b23-936a-f1ab326d1b24",createdAt:"2026-10-03T10:48:40.413Z",candidateFingerprint:"1dee2b97c6ec2ab29d14a77d38761fc583f9ed0e85cd3ab0d3188038ebdd57aa",metadataFingerprint:"14226086d9f4bbf6cb27648faf92e02d68b94cb98646d234f7a43a786653807b"}},{id:"vehicle:car-19:south",vehicleId:"car-19",direction:"south",rect:[768,5520,48,64],metadata:{name:"Car 19 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"0a6c4fbb-7d96-46b5-803c-15480aaf29fb",createdAt:"2026-10-03T10:48:40.626Z",candidateFingerprint:"2f8a8d206543b6edbd08651d91c5dd57d537076673b893e36ec11879e9269d24",metadataFingerprint:"41beb39e51517dbc7e4318341981711c183770e47dee8e71cd6a6bc429d14c0f"}},{id:"vehicle:car-19:west",vehicleId:"car-19",direction:"west",rect:[688,5552,80,48],metadata:{name:"Car 19 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"70da1205-9bfe-4567-ae38-abf8dd3293e2",createdAt:"2026-10-03T10:48:40.846Z",candidateFingerprint:"ab96ba71723f5fafe5db475dd5925e72fe370f9f2ae11a60a02273719e32ec6c",metadataFingerprint:"53af27d930a5336ae3593412eeca8a3b137532fae1077c01fb2b32ea6c58db79"}},{id:"vehicle:car-20:north",vehicleId:"car-20",direction:"north",rect:[816,5616,48,64],metadata:{name:"Car 20 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"d593e64e-b340-4892-99ee-f0fc86234166",createdAt:"2026-10-03T10:48:41.051Z",candidateFingerprint:"86590bc3b7db18a0bf8be578354ae031e789dee7286a93e1ec6c35a3187e2a6b",metadataFingerprint:"526aa128c1d802df5294528f6736e5a3e352df2dff7bf86c9a5d1688764d06d2"}},{id:"vehicle:car-20:east",vehicleId:"car-20",direction:"east",rect:[688,5600,80,48],metadata:{name:"Car 20 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"ce931a53-121b-469e-a0c1-18e7ae1985d8",createdAt:"2026-10-03T10:48:41.266Z",candidateFingerprint:"c527e8156e653e7f151ef37ecf08760c4a449bc6a28bddd62f58b4ccc0e8a0c0",metadataFingerprint:"f514a5510f339f89f69a0464cd6616d1c14ee7922c99b1cc84d2fcbb0442d988"}},{id:"vehicle:car-20:south",vehicleId:"car-20",direction:"south",rect:[768,5616,48,64],metadata:{name:"Car 20 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,60],footprint:[-20,-52,40,52],colliders:[{offsetX:0,offsetY:0,width:40,height:52,zHeight:28}],depthOffset:-26},approval:{id:"cf7a5a19-746a-4d6c-b67a-4a532ad2fa71",createdAt:"2026-10-03T10:48:41.469Z",candidateFingerprint:"5bb4ef77fbc65953d28cfea3c006618fccb5e34563790442a633392e9e3c2dee",metadataFingerprint:"e218ccf10a11a78159be53926fbb7e419efc5e37f1332e1b4b2a67d2672f657d"}},{id:"vehicle:car-20:west",vehicleId:"car-20",direction:"west",rect:[688,5648,80,48],metadata:{name:"Car 20 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"8a65bc19-448e-45c2-bc8f-b29fb6f0b005",createdAt:"2026-10-03T10:48:41.720Z",candidateFingerprint:"e6c79b138ef3f190bfbe007b748f80a1775bef3a6101c828d4b7c4466340aca3",metadataFingerprint:"9ecac9c4644576aa110d1292c1acb58d0210f92844f49e6dae5a1f5712829ae1"}},{id:"vehicle:car-21:north",vehicleId:"car-21",direction:"north",rect:[640,5712,48,80],metadata:{name:"Car 21 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,72],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"af94cb02-6147-4c38-8265-6e232691d5f3",createdAt:"2026-10-03T10:48:41.926Z",candidateFingerprint:"02800248c57d706531bede4ea0f78dd809d172c81d1ce416dd59dfd8fa3c218c",metadataFingerprint:"bdde5485a15775a63209e485406e34760a28326bbc3914b66822f0227fcb63e6"}},{id:"vehicle:car-21:east",vehicleId:"car-21",direction:"east",rect:[512,5696,80,48],metadata:{name:"Car 21 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"0501bccf-6819-40b5-b187-7e62fb873d25",createdAt:"2026-10-03T10:48:42.195Z",candidateFingerprint:"eac822ba68fe93e8ca3e31799954679e0a26d59e2d8cd565ddcee6080d53ebee",metadataFingerprint:"044ebaaa0b66403dbb581391f53bb652e3432ada463ae553d57e70d2645080b5"}},{id:"vehicle:car-21:south",vehicleId:"car-21",direction:"south",rect:[592,5712,48,80],metadata:{name:"Car 21 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,71],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"24bfea4b-c329-4e70-b9f0-db72e31c69a4",createdAt:"2026-10-03T10:48:42.469Z",candidateFingerprint:"4ad6e7847db11dcb4c628baa98e2bcb49c985fd55b5ee7ca083c38fdb9bb956a",metadataFingerprint:"1d0a7942bc0c0901a6811e1a78d1a92820f7e7cb95fe60c961682759cb863f06"}},{id:"vehicle:car-21:west",vehicleId:"car-21",direction:"west",rect:[512,5744,80,48],metadata:{name:"Car 21 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"ccb30f8b-07f9-4e7d-9a16-840e5157600e",createdAt:"2026-10-03T10:48:42.763Z",candidateFingerprint:"7eff579dc30a309a8931b90d67a1a125de8f81211a9a8ac7c0118344041fc342",metadataFingerprint:"e7d0d7243e10500ce82c158c452458f095655e9313189215a684412e00b2f8a8"}},{id:"vehicle:car-22:north",vehicleId:"car-22",direction:"north",rect:[640,5808,48,80],metadata:{name:"Car 22 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,72],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"7ca4e10d-5a20-44a7-a522-9a4c99952440",createdAt:"2026-10-03T10:48:42.960Z",candidateFingerprint:"747e2e8076651bbc3a1cc85a0b03cb1abd2dfd4826b5fc012131e271cb2d660d",metadataFingerprint:"09071e255fbdff227f95c953c492ec45e6cd0dcc2c60155e93d5b0938cc945eb"}},{id:"vehicle:car-22:east",vehicleId:"car-22",direction:"east",rect:[512,5792,80,48],metadata:{name:"Car 22 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"1a9d7299-372a-4e02-a5be-2ea74795e88d",createdAt:"2026-10-03T10:48:43.157Z",candidateFingerprint:"847692de6392a95bdb3c63a36f963058013224ef16818cb8b32673b4dee5dab3",metadataFingerprint:"fd9a6055e050cdcbbe9456630abfea1006d1a9009867a5a9d2a1c01757da5afc"}},{id:"vehicle:car-22:south",vehicleId:"car-22",direction:"south",rect:[592,5808,48,80],metadata:{name:"Car 22 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,71],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"0a2fc5ad-c02d-43e5-8aa9-5f713601d535",createdAt:"2026-10-03T10:48:43.353Z",candidateFingerprint:"696490e6dbc7c8d6d1a428cff20b7b9defee8304bae62ce4de581a296ce36c06",metadataFingerprint:"e17969ae58930b140bec92350df1d482c0cf57f695a15dd6590952d6fa76d7f8"}},{id:"vehicle:car-22:west",vehicleId:"car-22",direction:"west",rect:[512,5840,80,48],metadata:{name:"Car 22 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"76741aa9-bbe9-4743-bc8d-87771462b489",createdAt:"2026-10-03T10:48:43.544Z",candidateFingerprint:"6d5a46dd2fb92cc94b710670c9d701e19709072ccf7437bb3801f51e90b2f116",metadataFingerprint:"9aecba2889ef678df983c99988ce47bcfe5662fdd10e042b160a2ce9216ffbe4"}},{id:"vehicle:car-23:north",vehicleId:"car-23",direction:"north",rect:[640,5904,48,80],metadata:{name:"Car 23 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,72],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"c242f15c-c396-4905-9ce6-b8fa6883f9da",createdAt:"2026-10-03T10:48:43.712Z",candidateFingerprint:"3699e54c3bcb0205bf043341e717fde629605b149c9469b6d11a553c7a2fabc9",metadataFingerprint:"17821170b3b1cc93978f9808db2647581fea67849fcbae25852cb8a226847afa"}},{id:"vehicle:car-23:east",vehicleId:"car-23",direction:"east",rect:[512,5888,80,48],metadata:{name:"Car 23 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"3951fab5-01aa-4990-89ae-f78d4c1d5073",createdAt:"2026-10-03T10:48:43.898Z",candidateFingerprint:"91a99c22574112dadcc30a7f97196237abdec9d944b672968e81fd69c0648dde",metadataFingerprint:"20d415b8005190b889c4e050962a5c215d96210dfd9fd1ec80d96fd8d75054ee"}},{id:"vehicle:car-23:south",vehicleId:"car-23",direction:"south",rect:[592,5904,48,80],metadata:{name:"Car 23 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,71],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"7c869fc0-a04f-4f2b-985e-546aa294cd8c",createdAt:"2026-10-03T10:48:44.085Z",candidateFingerprint:"3ee654cd9f639c112ba521d43e5c20e8e023ee0a6bf60948e93c453a94eb1aa7",metadataFingerprint:"a079b0ce11523094acbe4d39a93f9f2f0d30697dde602a2502044240d8bfd5c4"}},{id:"vehicle:car-23:west",vehicleId:"car-23",direction:"west",rect:[512,5936,80,48],metadata:{name:"Car 23 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"42d50241-7b4c-4651-8ef3-9904ac6ac3a4",createdAt:"2026-10-03T10:48:44.284Z",candidateFingerprint:"e4f0e3236b3e85c51a8b617c931ae0ec6a4dbd0237ba5cf28f342eebaf211c26",metadataFingerprint:"a3ca56801310123e5772d073d2506e7dac7d6868ba9824f7f6163b2302007973"}},{id:"vehicle:car-24:north",vehicleId:"car-24",direction:"north",rect:[816,5712,48,80],metadata:{name:"Car 24 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,72],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"340a6c61-f960-4353-9424-2c8c3ee3fb5e",createdAt:"2026-10-03T10:48:44.479Z",candidateFingerprint:"8d7ec64c4946d17a924c06da718cfe6362c3e77082e3a00f035e7698a20aace2",metadataFingerprint:"bf32ae26777c072ed8d3b94615533bdb4e021215a695d91d267965d47423ea52"}},{id:"vehicle:car-24:east",vehicleId:"car-24",direction:"east",rect:[688,5696,80,48],metadata:{name:"Car 24 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"52b67f9e-6f33-4732-b216-1211c80f067e",createdAt:"2026-10-03T10:48:44.666Z",candidateFingerprint:"8e3297a0c9b6d7949c080de34bd9ef72f81f9377ee9f3608692f3625d052ceb8",metadataFingerprint:"66ed0e2b0efab5cda47be2d0793bc2b6e2e1dd1ff3ec821ab01ac88b003a033b"}},{id:"vehicle:car-24:south",vehicleId:"car-24",direction:"south",rect:[768,5712,48,80],metadata:{name:"Car 24 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,71],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"804b345e-b7e3-4f66-953c-736f8e3c937a",createdAt:"2026-10-03T10:48:44.867Z",candidateFingerprint:"3c0a2c9d5e2c398decd1b6ff1d6326828bbdc19a97008e3f557df7933a7f842c",metadataFingerprint:"948a5775a14af0980ec002a48c41390f087c291a8069babceab8b3de52e8c159"}},{id:"vehicle:car-24:west",vehicleId:"car-24",direction:"west",rect:[688,5744,80,48],metadata:{name:"Car 24 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"0620025e-9b38-43ee-8082-821d949dd141",createdAt:"2026-10-03T10:48:45.077Z",candidateFingerprint:"a83c01d0f67e80bc6b54c583e3b195db774f7ac1596d43b2c675b2bc27bc25f9",metadataFingerprint:"40bcbec7122e57a53851983e3bd74caff0f7502561604b2f256ee6173215c4ac"}},{id:"vehicle:car-25:north",vehicleId:"car-25",direction:"north",rect:[816,5808,48,80],metadata:{name:"Car 25 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,72],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"cdd91f6e-b197-41ea-99a0-54382a39c2e9",createdAt:"2026-10-03T10:48:45.294Z",candidateFingerprint:"362d45ca023a15849e1213210d38978c9504e7a7b043198f18ac219efa19496c",metadataFingerprint:"6fd489e9e15c76cf15bac671b212078c73ace3699914e0d7329b9821f2fc8e75"}},{id:"vehicle:car-25:east",vehicleId:"car-25",direction:"east",rect:[688,5792,80,48],metadata:{name:"Car 25 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"356648c0-49fd-401c-a432-a36cf0b607a1",createdAt:"2026-10-03T10:48:45.730Z",candidateFingerprint:"193173aeaeb202e747e7b20b16c1f105f5ce8cd68c227f0c30352b14c7c164bc",metadataFingerprint:"499c2564f8f8538bf8f229383bf7adaa2a8ae1f51793a0dac3420cf2c1a1e6ac"}},{id:"vehicle:car-25:south",vehicleId:"car-25",direction:"south",rect:[768,5808,48,80],metadata:{name:"Car 25 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,71],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"281d123d-0f1c-42f2-a7e9-6e53d3714c13",createdAt:"2026-10-03T10:48:45.935Z",candidateFingerprint:"e883ee4f7f6558e4d6c82030531a0a04b1b74a9144abb736b86940225216a8c8",metadataFingerprint:"dccde5cdfb360a90c80d7345a352bf15e124ce03d3a84bd5f2ef76c765b73807"}},{id:"vehicle:car-25:west",vehicleId:"car-25",direction:"west",rect:[688,5840,80,48],metadata:{name:"Car 25 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"12274c05-409c-48c7-8e23-c0b1b9931664",createdAt:"2026-10-03T10:48:46.119Z",candidateFingerprint:"41f8373807fd506f585f27da06d42c40202697cb12421a91611a1c34722bf3b5",metadataFingerprint:"436058361ffacbb4f1b4aeffdd4d9af6ca0a79dff8a1c5a9793de5b6d9ad80f7"}},{id:"vehicle:car-26:north",vehicleId:"car-26",direction:"north",rect:[816,5904,48,80],metadata:{name:"Car 26 \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"north",anchor:[24,72],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"6a69dd76-e707-4689-99d3-2e5eb504670a",createdAt:"2026-10-03T10:48:46.319Z",candidateFingerprint:"c49d8e1003f71e3eb8b526a9342634185e007e03a7e564fd1843e3092d61c557",metadataFingerprint:"997308aa12cef82cfa74170f4ca7c1c11de85ebd5f2b2013935ccadad48671e5"}},{id:"vehicle:car-26:east",vehicleId:"car-26",direction:"east",rect:[688,5888,80,48],metadata:{name:"Car 26 \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"374e5735-00ef-4943-92d8-37f8a50e5b93",createdAt:"2026-10-03T10:48:46.523Z",candidateFingerprint:"254207b3e445da5c65e525e3cab4ddd45f3832870d03d116474892cde78d0690",metadataFingerprint:"20c8329583715b91e020edd9dd7fa04a9f23568e2187afe8b5bbbe80c35a8874"}},{id:"vehicle:car-26:south",vehicleId:"car-26",direction:"south",rect:[768,5904,48,80],metadata:{name:"Car 26 \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"south",anchor:[24,71],footprint:[-20,-56,40,56],colliders:[{offsetX:0,offsetY:0,width:40,height:56,zHeight:28}],depthOffset:-28},approval:{id:"7f0df7b6-28e8-41c1-a4b1-bba133bc915a",createdAt:"2026-10-03T10:48:46.725Z",candidateFingerprint:"665642dd3c45b2d8a1376ae802af94a3aa8c860ec27879498d3c12f2d728bc94",metadataFingerprint:"14d98aa6a870bd6ac2a2d8ea4b4b6fb5c9c82ec54fe9035771adf0a4fce658f6"}},{id:"vehicle:car-26:west",vehicleId:"car-26",direction:"west",rect:[688,5936,80,48],metadata:{name:"Car 26 \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","car","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:28}],depthOffset:-12},approval:{id:"84f8b8ca-ccc0-43d4-8bca-7d84d3d3b2e8",createdAt:"2026-10-03T10:48:46.939Z",candidateFingerprint:"c52392372e0fdb58193435b5e6aaa1e0eec5daf373e9cbdbf36c7300110c735a",metadataFingerprint:"8abfd5eda6db05462b59a1bf34a2ffdee963c1711f9678104079271644f9b79e"}},{id:"vehicle:unindexed-sedan-red:north",vehicleId:"unindexed-sedan-red",direction:"north",rect:[1024,1568,32,80],metadata:{name:"Sedan \xB7 red \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"north",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"66c9967f-dbac-4f4b-b499-67d5a229c884",createdAt:"2026-10-03T10:48:47.171Z",candidateFingerprint:"4d27864aac208c00f224c311b7747a8a4c4558d9f31acb6b773ebbdd3213e2ec",metadataFingerprint:"87f1ea6e32b4e7a43625876c30031942e00c8b1f663e0f60a40b04e846cfc887"}},{id:"vehicle:unindexed-sedan-red:east",vehicleId:"unindexed-sedan-red",direction:"east",rect:[1056,1600,80,48],metadata:{name:"Sedan \xB7 red \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"a6856aaa-1551-4253-b4cb-f3f6dcd2459b",createdAt:"2026-10-03T10:48:47.400Z",candidateFingerprint:"0b71d8dc2edbae101f6dbbf6ab1fe52db26cb87e76bfd1815d4f56c8ff302ba9",metadataFingerprint:"d119d62d148cfb16d49fa085eed047c98f2ac78b3468a6873d3f2e983e6c53e1"}},{id:"vehicle:unindexed-sedan-red:south",vehicleId:"unindexed-sedan-red",direction:"south",rect:[992,1568,32,80],metadata:{name:"Sedan \xB7 red \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"south",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"95e1cd6b-43f6-4db1-b5a9-5c660ec8019f",createdAt:"2026-10-03T10:48:47.898Z",candidateFingerprint:"7957dfe00acfe6916013e66a86b7f98d05fa90d85005d86ab0e96673bbff2aa2",metadataFingerprint:"28b2101efbc25a3ba49b6bddd1398d83d3cb6fc84ccffeb5ca15f609a6cfaf95"}},{id:"vehicle:unindexed-sedan-red:west",vehicleId:"unindexed-sedan-red",direction:"west",rect:[1056,1552,80,48],metadata:{name:"Sedan \xB7 red \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"04b7ce68-670a-4552-9dd9-9ba65cdb48c7",createdAt:"2026-10-03T10:48:48.108Z",candidateFingerprint:"30c6103975d688cdd5b0565bbcb0afbf7f35f38a54ce1b88640f7f2c1beb4645",metadataFingerprint:"2c8376abfa7f0127b4466b2a8c79a51a35a95e0ac277993344f0d87064bb3b9f"}},{id:"vehicle:unindexed-sedan-beige:north",vehicleId:"unindexed-sedan-beige",direction:"north",rect:[1168,1568,32,80],metadata:{name:"Sedan \xB7 beige \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"north",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"f8d6db23-b646-4004-81f0-f2ef0aff63af",createdAt:"2026-10-03T10:48:48.478Z",candidateFingerprint:"52de06426a01328b8866a880b7570bd8cf7232d3ce7015819f734200d6473e15",metadataFingerprint:"b058977799186b997f5bf0e9f0fb8979fd998e215076280e3ab3cb54840208bd"}},{id:"vehicle:unindexed-sedan-beige:east",vehicleId:"unindexed-sedan-beige",direction:"east",rect:[1200,1600,80,48],metadata:{name:"Sedan \xB7 beige \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"f620e272-e550-476c-a545-892c08f47ed8",createdAt:"2026-10-03T10:48:48.681Z",candidateFingerprint:"6149866c42c48c63f2c5da183b2f867f686aaab59c1250edb9ca8f01fbf336cd",metadataFingerprint:"b9cbf208cf292ee3f9b1a6510d276321717e415155aaed8e75cdd9357c40f93c"}},{id:"vehicle:unindexed-sedan-beige:south",vehicleId:"unindexed-sedan-beige",direction:"south",rect:[1136,1568,32,80],metadata:{name:"Sedan \xB7 beige \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"south",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"c6416f8e-5dcf-4b8d-aafe-15e0d12867ba",createdAt:"2026-10-03T10:48:49.006Z",candidateFingerprint:"c36089750e94c6d5e6f088531be6be636dd38968c74dcce9721f6214c58f1bfa",metadataFingerprint:"a9857882b39442fbdf7e1f9c10025dc3c149e997afcaf115d49ed48e5d05e084"}},{id:"vehicle:unindexed-sedan-beige:west",vehicleId:"unindexed-sedan-beige",direction:"west",rect:[1200,1552,80,48],metadata:{name:"Sedan \xB7 beige \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"b14c7c19-0e5e-4347-85e4-c208af793244",createdAt:"2026-10-03T10:48:49.149Z",candidateFingerprint:"ea4ed2d9556d830f8e0f79c21d5de86fcc58a0dd360eaf725c8d11e1f80c7ac6",metadataFingerprint:"7d4d98528f80b4110f1f6686838dbafb9e5a0dc5c202d91478e0a9a9c341072e"}},{id:"vehicle:unindexed-sedan-cyan:north",vehicleId:"unindexed-sedan-cyan",direction:"north",rect:[1312,1568,32,80],metadata:{name:"Sedan \xB7 cyan \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"north",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"82894991-2b5f-47b9-9061-22477181c3c7",createdAt:"2026-10-03T10:48:49.374Z",candidateFingerprint:"83f586ddfa50cc5c017665698d2d83f217d5d0602ed954577984aa22e543b367",metadataFingerprint:"5d6fd6bcaea053ed781703e500d4d35c2a736c345aea58b2c37c6d7acdbdff26"}},{id:"vehicle:unindexed-sedan-cyan:east",vehicleId:"unindexed-sedan-cyan",direction:"east",rect:[1344,1600,80,48],metadata:{name:"Sedan \xB7 cyan \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"fd8c2649-b148-45cf-9afe-63ceab4ae376",createdAt:"2026-10-03T10:48:49.521Z",candidateFingerprint:"6a86f79db12c8cea1ce5ae341a941dd98000575c3edebde5273446af98fdf23a",metadataFingerprint:"4dde167e11acf9eacf536895019dd2f8988df52dcc174fb4919acdb6482c8c4e"}},{id:"vehicle:unindexed-sedan-cyan:south",vehicleId:"unindexed-sedan-cyan",direction:"south",rect:[1280,1568,32,80],metadata:{name:"Sedan \xB7 cyan \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"south",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"b1f55f82-d312-4f71-bd74-b54ac65f91a3",createdAt:"2026-10-03T10:48:49.721Z",candidateFingerprint:"8dea52120af7e8b432806fb7cd56210ae80e55ad397a4cafa19dbb6c722049a9",metadataFingerprint:"6ad2b51f2b65512ddfac94894e00e1ca0d624d6bf58f1835b25f4b88964fbc85"}},{id:"vehicle:unindexed-sedan-cyan:west",vehicleId:"unindexed-sedan-cyan",direction:"west",rect:[1344,1552,80,48],metadata:{name:"Sedan \xB7 cyan \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"39f3b008-54da-4e21-9245-de3af0adb64c",createdAt:"2026-10-03T10:48:49.872Z",candidateFingerprint:"fe422fc22dacddf6a335cc756895b4f801ed9c3af03abbee99ea27efd8677d51",metadataFingerprint:"b9cef3f000236750936b7f5c22b950a40ddb9a827635683922b5dcbfabbdfb26"}},{id:"vehicle:unindexed-sedan-orange:north",vehicleId:"unindexed-sedan-orange",direction:"north",rect:[880,1664,32,80],metadata:{name:"Sedan \xB7 orange \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"north",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"39afbeff-0134-494e-9a9c-7bf5eb19be62",createdAt:"2026-10-03T10:48:50.093Z",candidateFingerprint:"9de3e932d411413efa1c41e65293ab8a646e220c33198a5785f94b10b5901d4f",metadataFingerprint:"39ae8ff55263d994748df887af5cc609a6f4950be0ec34369efb67f6b32fffc3"}},{id:"vehicle:unindexed-sedan-orange:east",vehicleId:"unindexed-sedan-orange",direction:"east",rect:[912,1696,80,48],metadata:{name:"Sedan \xB7 orange \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"d7d6f931-b62c-499b-8fee-a0db5373538e",createdAt:"2026-10-03T10:48:50.248Z",candidateFingerprint:"920c9d17b5293ab025552ef037d8765410a4257de88b272a62e8250112915b98",metadataFingerprint:"888141f1a8458d231d7368c43cd57cc0efcbb5ffd2e1ac78b1d6410577816b9f"}},{id:"vehicle:unindexed-sedan-orange:south",vehicleId:"unindexed-sedan-orange",direction:"south",rect:[848,1664,32,80],metadata:{name:"Sedan \xB7 orange \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"south",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"b2ac0cb8-5ab8-440a-bebd-e34d4c8b76b1",createdAt:"2026-10-03T10:48:50.500Z",candidateFingerprint:"c13a982de0ab99451896be8c6c1a632fdab4a97f14c5815f290a62b246990078",metadataFingerprint:"ec89739b9190a9509ee41c7bbbba680c8f5014ee7532d985cd6b3401c3a848be"}},{id:"vehicle:unindexed-sedan-orange:west",vehicleId:"unindexed-sedan-orange",direction:"west",rect:[912,1648,80,48],metadata:{name:"Sedan \xB7 orange \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"b23b2463-05b2-420a-b5b0-faf4ebc0fb58",createdAt:"2026-10-03T10:48:50.647Z",candidateFingerprint:"0f7d5e8234772d1c8be6613afe1dc701ccd20c905f80a2a4397c989384e41384",metadataFingerprint:"a6b73027be7e48c2f7c0a5d962b96d8ffeb1ff6012ac218cdc6badfe80ab1e7c"}},{id:"vehicle:unindexed-sedan-silver:north",vehicleId:"unindexed-sedan-silver",direction:"north",rect:[1024,1664,32,80],metadata:{name:"Sedan \xB7 silver \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"north",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"70c5d830-6948-4fb7-b4bf-ad0a4ba91e09",createdAt:"2026-10-03T10:48:50.910Z",candidateFingerprint:"83190d4f75e828c28e64228085503f5abeef1d436c365712931096a15b11c34f",metadataFingerprint:"66557f9c7b006fe6e664ce5c9747af482915a3110fa9fafb8e66baafcc0e4013"}},{id:"vehicle:unindexed-sedan-silver:east",vehicleId:"unindexed-sedan-silver",direction:"east",rect:[1056,1696,80,48],metadata:{name:"Sedan \xB7 silver \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"a9cae9b5-6ae2-41d2-87ef-1f7586db6190",createdAt:"2026-10-03T10:48:51.051Z",candidateFingerprint:"7f43cd886b9d9dda2dd3918bf70c576ce07d4e5c07967ac987993d1ea1becfd0",metadataFingerprint:"b1562f899aca4575e338bcf9a3383b9f4b7ea942b481e1446cd70c33623f73be"}},{id:"vehicle:unindexed-sedan-silver:south",vehicleId:"unindexed-sedan-silver",direction:"south",rect:[992,1664,32,80],metadata:{name:"Sedan \xB7 silver \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"south",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"02465aff-9c62-4f0e-9609-56231ba1e151",createdAt:"2026-10-03T10:48:51.360Z",candidateFingerprint:"e44044fd40c6ebf37943c1b73f0425cb22b50d944f7ce7dd1901aea6c0148cd0",metadataFingerprint:"d7fa09e7190f2e999c03cd7b22429afaf6c8ae8eaea42ab1ad40c2565eac54de"}},{id:"vehicle:unindexed-sedan-silver:west",vehicleId:"unindexed-sedan-silver",direction:"west",rect:[1056,1648,80,48],metadata:{name:"Sedan \xB7 silver \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"07e9af3f-6fef-4420-b225-7e0e64551858",createdAt:"2026-10-03T10:48:51.603Z",candidateFingerprint:"e495fe2f9c2b655fe8a0d75a2deadd77767fd0988960054e339e3cca697ce9c9",metadataFingerprint:"4f685a26b6dd05fd6c65503a5331410e22d391f248caf19c89faf567b72451b4"}},{id:"vehicle:unindexed-sedan-olive:north",vehicleId:"unindexed-sedan-olive",direction:"north",rect:[1168,1664,32,80],metadata:{name:"Sedan \xB7 olive \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"north",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"bec89a97-52cc-4206-a963-bab7c0c27525",createdAt:"2026-10-03T10:48:51.768Z",candidateFingerprint:"b9114ee4cae021bec37a5fbeffd50a5f55bb7cc7baed3c7986f64abea9a5845f",metadataFingerprint:"1ae5c8c18c731d84c4550c98215f31842f8bf2fe60f1b287a6e0e29cf421a5f1"}},{id:"vehicle:unindexed-sedan-olive:east",vehicleId:"unindexed-sedan-olive",direction:"east",rect:[1200,1696,80,48],metadata:{name:"Sedan \xB7 olive \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"39508245-94f3-4523-9677-8f04fc6e59ad",createdAt:"2026-10-03T10:48:51.929Z",candidateFingerprint:"6e839ae951b2aa223697b354ce9d2e64d2ec8aec2e5fcf3a7790e86353b8115d",metadataFingerprint:"97a6d93d07ab54084c53a80d060458d3a1a2b9dd5e26933b3daff45954d9f93a"}},{id:"vehicle:unindexed-sedan-olive:south",vehicleId:"unindexed-sedan-olive",direction:"south",rect:[1136,1664,32,80],metadata:{name:"Sedan \xB7 olive \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"south",anchor:[16,72],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"edf67bd2-cd57-47c6-acbf-30e57a30fe85",createdAt:"2026-10-03T10:48:52.177Z",candidateFingerprint:"8afbe77096b86a2de66a4e3fd82285937dbf1e0c7f3d4872ad15fc19ed13eeb4",metadataFingerprint:"0fabd8868e94641398a158a04c9439a0fa19855266943a90b931e3262d8df1f6"}},{id:"vehicle:unindexed-sedan-olive:west",vehicleId:"unindexed-sedan-olive",direction:"west",rect:[1200,1648,80,48],metadata:{name:"Sedan \xB7 olive \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"west",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"2c86ad6b-b49d-4fd8-9d4a-19aa7a41801b",createdAt:"2026-10-03T10:48:52.457Z",candidateFingerprint:"779ed94273722d4e722e896c5722855ed94184269208d349a8e4e467e4a30001",metadataFingerprint:"ed7d958b1e57bd4644d78368cbaea079532c569c7278c24159d96c1dee686524"}},{id:"vehicle:unindexed-sedan-dark:north",vehicleId:"unindexed-sedan-dark",direction:"north",rect:[1312,1664,32,80],metadata:{name:"Sedan \xB7 dark \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"north",anchor:[16,73],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"135cdcd6-895d-402f-a7b7-38e2c2e22b07",createdAt:"2026-10-03T10:48:52.781Z",candidateFingerprint:"d2ee7c6f41a05eb0ffa583d0459422de1099c48a5b144601f7623aef05ef5cd5",metadataFingerprint:"98ed9673add1cb180a04dca84b58af3e179e22529a655153ab5b5e327e67fadd"}},{id:"vehicle:unindexed-sedan-dark:east",vehicleId:"unindexed-sedan-dark",direction:"east",rect:[1344,1696,80,48],metadata:{name:"Sedan \xB7 dark \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"east",anchor:[40,39],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"b965b2bf-dff9-486d-b067-13b42af36de6",createdAt:"2026-10-03T10:48:52.950Z",candidateFingerprint:"159a944d8ff813bb5e450a67c2267cff76eb3da4fb8c662a7fcdf8343b2993b7",metadataFingerprint:"7cf988e5e517e54c23b96492f98c171d1649da7549655abf4681314fee948280"}},{id:"vehicle:unindexed-sedan-dark:south",vehicleId:"unindexed-sedan-dark",direction:"south",rect:[1280,1664,32,80],metadata:{name:"Sedan \xB7 dark \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"south",anchor:[16,73],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"4a2cc480-1407-45dd-9ea7-0bce93a7d149",createdAt:"2026-10-03T10:48:53.496Z",candidateFingerprint:"c50bac7aed77fbe42912c53faf5b6bf4319c276b7842552604c624e5c0a6759f",metadataFingerprint:"2dcf7caa953a7e34c894f7ea230fb95fa09f9f1f21904fcd701523957f56e8c9"}},{id:"vehicle:unindexed-sedan-dark:west",vehicleId:"unindexed-sedan-dark",direction:"west",rect:[1344,1648,80,48],metadata:{name:"Sedan \xB7 dark \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","sedan","review proposal"],settings:["road"],facing:"west",anchor:[40,39],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"ddd1ef05-e1e2-4f7f-b4b4-a58fe660b0f0",createdAt:"2026-10-03T10:48:53.727Z",candidateFingerprint:"5551ebaa19a92e4cd346f938fd3b42ff6530f463b95580659360317346a281b0",metadataFingerprint:"b4e4a3ed1646936c7c2a93be06e01cfce75684f53c702d693047c629cd5dc4c9"}},{id:"vehicle:police-car:north",vehicleId:"police-car",direction:"north",rect:[1904,1744,32,80],metadata:{name:"Police car \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","police","review proposal"],settings:["road"],facing:"north",anchor:[16,73],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"dfa5f408-5b0e-48f4-a613-d295e6564173",createdAt:"2026-10-03T10:48:53.876Z",candidateFingerprint:"520146fa62146a15f1f79be03857a52ad3ee1323ad5a55a59a631d57f6239de1",metadataFingerprint:"834d5b1d109db6f3b8a171312c0af4a461b7b36d81295242847bea74f92f3cb2"}},{id:"vehicle:police-car:east",vehicleId:"police-car",direction:"east",rect:[1792,1744,80,48],metadata:{name:"Police car \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","police","review proposal"],settings:["road"],facing:"east",anchor:[40,45],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"86bccfa4-3bef-4504-9c3c-4ecf4547628a",createdAt:"2026-10-03T10:48:54.021Z",candidateFingerprint:"8142493cacb5541737ec2400084216143b20253cdfe46a504f75ab036fa46dbe",metadataFingerprint:"b3c7f5964dc6027a1c51404b4971820239b76ec83df90a90cdddef84469f3dc7"}},{id:"vehicle:police-car:south",vehicleId:"police-car",direction:"south",rect:[1872,1744,32,80],metadata:{name:"Police car \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","police","review proposal"],settings:["road"],facing:"south",anchor:[16,73],footprint:[-13,-54,26,54],colliders:[{offsetX:0,offsetY:0,width:26,height:54,zHeight:24}],depthOffset:-27},approval:{id:"a4ed510c-b5f6-419c-86b9-b3232c3cb9c9",createdAt:"2026-10-03T10:48:54.291Z",candidateFingerprint:"e7b607136781851da5673259b5ef494bc8ed9d5237cdf0ecfbe2fc0088f7f927",metadataFingerprint:"a30d7c225067d595ae2e3db862fe9fee4dc60748a178c478f1ae68e3552981de"}},{id:"vehicle:police-car:west",vehicleId:"police-car",direction:"west",rect:[1712,1745,80,47],metadata:{name:"Police car \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","police","review proposal"],settings:["road"],facing:"west",anchor:[40,44],footprint:[-36,-24,72,24],colliders:[{offsetX:0,offsetY:0,width:72,height:24,zHeight:24}],depthOffset:-12},approval:{id:"76f22630-ae74-4db0-a88f-27f58e1e6935",createdAt:"2026-10-03T10:48:54.466Z",candidateFingerprint:"ad7f87afe484c73de10486e8d1d04fd09df45994bb4ce7d51fa4a9d2ea3bb548",metadataFingerprint:"a748963cda65ef2b6b91ea04f82eb66e6c947a91e345d37481270ada363758ad"}},{id:"vehicle:ambulance:north",vehicleId:"ambulance",direction:"north",rect:[352,1792,48,112],metadata:{name:"Ambulance \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","ambulance","review proposal"],settings:["road"],facing:"north",anchor:[24,100],footprint:[-20,-82,40,82],colliders:[{offsetX:0,offsetY:0,width:40,height:82,zHeight:40}],depthOffset:-41},approval:{id:"2ed969d1-ade1-474b-a092-46edbdbb9780",createdAt:"2026-10-03T10:48:54.610Z",candidateFingerprint:"f52113af9ef8f1574f3808153afcc422f40f4503d8886da7a405622a2429cdc9",metadataFingerprint:"e599cbb9803ea9a881e7dab404c133a65d5962a4cf93997fc4d4b5d6f65ba20a"}},{id:"vehicle:ambulance:east",vehicleId:"ambulance",direction:"east",rect:[224,1825,128,79],metadata:{name:"Ambulance \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","ambulance","review proposal"],settings:["road"],facing:"east",anchor:[64,76],footprint:[-56,-36,112,36],colliders:[{offsetX:0,offsetY:0,width:112,height:36,zHeight:40}],depthOffset:-18},approval:{id:"f2ebee52-46de-4300-9331-fa28821d8049",createdAt:"2026-10-03T10:48:57.022Z",candidateFingerprint:"8fbba9b314bbf3ab4521b9f5bc5a15902ba5533357d31fd6dd8455056303401a",metadataFingerprint:"077dc5e09c41cb7da71c58807009d3c835761082b76a1d2152439cf832c6af45"}},{id:"vehicle:ambulance:south",vehicleId:"ambulance",direction:"south",rect:[48,1792,48,112],metadata:{name:"Ambulance \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","ambulance","review proposal"],settings:["road"],facing:"south",anchor:[24,109],footprint:[-20,-82,40,82],colliders:[{offsetX:0,offsetY:0,width:40,height:82,zHeight:40}],depthOffset:-41},approval:{id:"6449c392-d7b8-48ac-8a5e-6f5f4da5ec10",createdAt:"2026-10-03T10:48:57.851Z",candidateFingerprint:"ca662e0330629020b7f43edcf02d9913ff53fcf3529f1d4d6979aaf03d8a8b30",metadataFingerprint:"a8f79d1535e558b575d3c6c3515c54e0b903c0c1194c9541b327f9fe2e111204"}},{id:"vehicle:ambulance:west",vehicleId:"ambulance",direction:"west",rect:[96,1825,128,79],metadata:{name:"Ambulance \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","ambulance","review proposal"],settings:["road"],facing:"west",anchor:[64,76],footprint:[-56,-36,112,36],colliders:[{offsetX:0,offsetY:0,width:112,height:36,zHeight:40}],depthOffset:-18},approval:{id:"d79a4596-74b7-4da6-bd5a-e79bf24e116b",createdAt:"2026-10-03T10:48:59.249Z",candidateFingerprint:"f8ca90cb276af45ccfdff6abb70fbeec7ef85272b837c3d2fc4775e51aac1879",metadataFingerprint:"11716e9e6ead0bd6c4dfedb6a256350176cae6b20502c703f584e27418d77482"}},{id:"vehicle:garbage-truck-green:north",vehicleId:"garbage-truck-green",direction:"north",rect:[1456,4144,48,128],metadata:{name:"Garbage truck green \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"north",anchor:[24,121],footprint:[-20,-96,40,96],colliders:[{offsetX:0,offsetY:0,width:40,height:96,zHeight:48}],depthOffset:-48},approval:{id:"fad514eb-31a6-4caf-afaf-c9987c420b5d",createdAt:"2026-10-03T10:49:00.313Z",candidateFingerprint:"5af210e348579412cf90ef6552f5c4e4942920816149ec44a8b70eca943e6d38",metadataFingerprint:"f7ae1d8e5643725a63ea01183ac624d1afa8c00c10ab95fb7a9f00aebfb39213"}},{id:"vehicle:garbage-truck-green:east",vehicleId:"garbage-truck-green",direction:"east",rect:[1280,4128,128,80],metadata:{name:"Garbage truck green \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"east",anchor:[64,77],footprint:[-58,-40,116,40],colliders:[{offsetX:0,offsetY:0,width:116,height:40,zHeight:48}],depthOffset:-20},approval:{id:"fbb606f3-6ebc-434c-950d-14773abf3852",createdAt:"2026-10-03T10:49:00.966Z",candidateFingerprint:"494b8afcf61281846fab918bec48bd9889223be596ed3bc2bb047e375186026d",metadataFingerprint:"99e7b658280ee564ddf51f94008884d3d1049f32af65957e433661fc407578a4"}},{id:"vehicle:garbage-truck-green:south",vehicleId:"garbage-truck-green",direction:"south",rect:[1408,4144,48,128],metadata:{name:"Garbage truck green \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"south",anchor:[24,121],footprint:[-20,-96,40,96],colliders:[{offsetX:0,offsetY:0,width:40,height:96,zHeight:48}],depthOffset:-48},approval:{id:"46b6d90f-fddb-4483-9f7a-9905c6e7ccc4",createdAt:"2026-10-03T10:49:01.539Z",candidateFingerprint:"14772ae08ed87421d69e2755743afc8c1e0b9ce56e626d5b76c04b0bee045ca3",metadataFingerprint:"41de6bc553adc634987b67c5449d273a0552f56a9813524ec58d98bc4a610dc2"}},{id:"vehicle:garbage-truck-green:west",vehicleId:"garbage-truck-green",direction:"west",rect:[1280,4208,128,80],metadata:{name:"Garbage truck green \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"west",anchor:[64,77],footprint:[-58,-40,116,40],colliders:[{offsetX:0,offsetY:0,width:116,height:40,zHeight:48}],depthOffset:-20},approval:{id:"662566f3-70cc-4555-9ea5-283a7c9b3d5f",createdAt:"2026-10-03T10:49:02.093Z",candidateFingerprint:"0866b6d7357d44325eec42e00a8216d41583e170243cc14ca5f020ead9278634",metadataFingerprint:"289f897b83123f0572ce1f9296df34d60968b077f19566ce42105e8536651027"}},{id:"vehicle:garbage-truck-orange:north",vehicleId:"garbage-truck-orange",direction:"north",rect:[1680,4144,48,128],metadata:{name:"Garbage truck orange \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"north",anchor:[24,121],footprint:[-20,-96,40,96],colliders:[{offsetX:0,offsetY:0,width:40,height:96,zHeight:48}],depthOffset:-48},approval:{id:"7d1caf07-02d2-489e-81bc-78f5fcc02c32",createdAt:"2026-10-03T10:49:02.776Z",candidateFingerprint:"f0b231208fefffcf0ea7ba64b4fe5b2b577c2fe6d18b237ee6e2ff86012b0091",metadataFingerprint:"84084d2f118da0b56c449986dc4d5b9019baf7448d4389ba7b4572a0ac5470a8"}},{id:"vehicle:garbage-truck-orange:east",vehicleId:"garbage-truck-orange",direction:"east",rect:[1504,4128,128,80],metadata:{name:"Garbage truck orange \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"east",anchor:[64,77],footprint:[-58,-40,116,40],colliders:[{offsetX:0,offsetY:0,width:116,height:40,zHeight:48}],depthOffset:-20},approval:{id:"eb6c509b-9344-4c11-b0a3-1726f26f511f",createdAt:"2026-10-03T10:49:03.126Z",candidateFingerprint:"41d1bd7cf0f543b19e2611fee9967abbdc29f88c5171d9ab18a705c58c62cf72",metadataFingerprint:"155df4d368380ca044b6ae8209113db81745b5bd052cedc9d13adbe4e32fa36e"}},{id:"vehicle:garbage-truck-orange:south",vehicleId:"garbage-truck-orange",direction:"south",rect:[1632,4144,48,128],metadata:{name:"Garbage truck orange \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"south",anchor:[24,121],footprint:[-20,-96,40,96],colliders:[{offsetX:0,offsetY:0,width:40,height:96,zHeight:48}],depthOffset:-48},approval:{id:"5f28df49-b034-4e64-93d0-b29a351079b2",createdAt:"2026-10-03T10:49:03.501Z",candidateFingerprint:"e63e4cbc4c192733766216695648f656bb4028d5c1ca8ba81b44188ca4a84742",metadataFingerprint:"a2a4a5da59509d972d78e5e92430f422730d4133136c0cbc4cbc8b4f2774336d"}},{id:"vehicle:garbage-truck-orange:west",vehicleId:"garbage-truck-orange",direction:"west",rect:[1504,4208,128,80],metadata:{name:"Garbage truck orange \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","garbage","review proposal"],settings:["road"],facing:"west",anchor:[64,77],footprint:[-58,-40,116,40],colliders:[{offsetX:0,offsetY:0,width:116,height:40,zHeight:48}],depthOffset:-20},approval:{id:"8f7f9640-e6cd-4f14-9b52-75318d38c542",createdAt:"2026-10-03T10:49:03.986Z",candidateFingerprint:"cbcd267f860d81a95e553f23705812ebf0eba78b56932a0952b24db435cf91c6",metadataFingerprint:"a5932c634d073bdec6e887fe8cde21e62eeb42b2d2de954f1039899dd2df273c"}},{id:"vehicle:fire-truck-ladder-1:north",vehicleId:"fire-truck-ladder-1",direction:"north",rect:[2624,4016,64,160],metadata:{name:"Fire truck \xB7 stowed ladder \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"north",anchor:[32,156],footprint:[-26,-128,52,128],colliders:[{offsetX:0,offsetY:0,width:52,height:128,zHeight:48}],depthOffset:-64},approval:{id:"b149d188-9d2f-46f2-92a2-464157be4d14",createdAt:"2026-10-03T10:49:04.552Z",candidateFingerprint:"c97431f252516a1964bdecd70aaad759330aecea0ec6624feebda2645c807456",metadataFingerprint:"292bf2d7daae67b481ffd61958e25e34b2c7cd62e6b3e2e85befa70e8cf422f2"}},{id:"vehicle:fire-truck-ladder-1:east",vehicleId:"fire-truck-ladder-1",direction:"east",rect:[2416,4096,144,80],metadata:{name:"Fire truck \xB7 stowed ladder \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"east",anchor:[72,77],footprint:[-66,-40,132,40],colliders:[{offsetX:0,offsetY:0,width:132,height:40,zHeight:48}],depthOffset:-20},approval:{id:"28b1e7b9-73e7-4e10-ba5e-61a83639523b",createdAt:"2026-10-03T10:49:05.340Z",candidateFingerprint:"e6595566ea75ece7d031f17468559d79b781869d96a18c33b2e13d9ac5d69ec5",metadataFingerprint:"fd42560d9ca0873c94aac9e3c73af63aba996ff41e27a4905546d87fde349da2"}},{id:"vehicle:fire-truck-ladder-1:south",vehicleId:"fire-truck-ladder-1",direction:"south",rect:[2560,4016,64,160],metadata:{name:"Fire truck \xB7 stowed ladder \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"south",anchor:[32,156],footprint:[-26,-128,52,128],colliders:[{offsetX:0,offsetY:0,width:52,height:128,zHeight:48}],depthOffset:-64},approval:{id:"9b6753b8-d80f-4a5f-b169-884d5a96e410",createdAt:"2026-10-03T10:49:05.898Z",candidateFingerprint:"47c1ae9d9ed5af5b93d2fbb2b0687fc611298de8f1f4881e2b5e08611fb3a270",metadataFingerprint:"f424fca613962dc6c6d846faa18a4b9557764f052fd9f74a61e6b942b47609c5"}},{id:"vehicle:fire-truck-ladder-1:west",vehicleId:"fire-truck-ladder-1",direction:"west",rect:[2416,4016,144,80],metadata:{name:"Fire truck \xB7 stowed ladder \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"west",anchor:[72,77],footprint:[-66,-40,132,40],colliders:[{offsetX:0,offsetY:0,width:132,height:40,zHeight:48}],depthOffset:-20},approval:{id:"b2b4ae6e-041d-4808-8e11-78fb01c3b58b",createdAt:"2026-10-03T10:49:06.424Z",candidateFingerprint:"616817e73e6068f416dba8b48cd9c36ebe5513ffd980d7a259991eeb7b863df2",metadataFingerprint:"671d1fda2588286da06c6c37d1aa2f1093cbfc6aa10f7a6f0b7a03238adf9344"}},{id:"vehicle:fire-truck-ladder-2:north",vehicleId:"fire-truck-ladder-2",direction:"north",rect:[2624,4176,64,160],metadata:{name:"Fire truck \xB7 raised ladder \xB7 north",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"north",anchor:[32,156],footprint:[-26,-128,52,128],colliders:[{offsetX:0,offsetY:0,width:52,height:128,zHeight:64}],depthOffset:-64},approval:{id:"1262dcc4-3076-4274-b131-1f81d228b6ed",createdAt:"2026-10-03T10:49:07.119Z",candidateFingerprint:"7dfcd9e9ef6f16d7c6a7f2e71eea99edb32bf1eb7ee94c06c4267a79f7613205",metadataFingerprint:"f3413d852b75d0ada1bc376f5237dea0490c547d2b8e7f07ba32196ce0814680"}},{id:"vehicle:fire-truck-ladder-2:east",vehicleId:"fire-truck-ladder-2",direction:"east",rect:[2416,4256,144,80],metadata:{name:"Fire truck \xB7 raised ladder \xB7 east",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"east",anchor:[72,77],footprint:[-66,-40,132,40],colliders:[{offsetX:0,offsetY:0,width:132,height:40,zHeight:64}],depthOffset:-20},approval:{id:"800d1505-cda2-4365-9ef0-4370f8b82627",createdAt:"2026-10-03T10:49:07.769Z",candidateFingerprint:"8202bbd09eeef5a58de7330457ce9f87385d8dad0a68a96ac6602c51c206c7fa",metadataFingerprint:"a10c468cdc8a1750001410f379e312b9084ccae468f6478370bb5a063c86de12"}},{id:"vehicle:fire-truck-ladder-2:south",vehicleId:"fire-truck-ladder-2",direction:"south",rect:[2560,4176,64,160],metadata:{name:"Fire truck \xB7 raised ladder \xB7 south",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"south",anchor:[32,156],footprint:[-26,-128,52,128],colliders:[{offsetX:0,offsetY:0,width:52,height:128,zHeight:64}],depthOffset:-64},approval:{id:"e7b44001-3f56-470e-93a4-b167a069b73f",createdAt:"2026-10-03T10:49:11.282Z",candidateFingerprint:"f3f3d591f6cf251f48a87e589279002f6134529c8c114e4799a833457463b4f8",metadataFingerprint:"68c47f35fc1025e52aa2bd0a16b5473b74ab69395322bd705bc5a92b44b871e2"}},{id:"vehicle:fire-truck-ladder-2:west",vehicleId:"fire-truck-ladder-2",direction:"west",rect:[2416,4176,144,80],metadata:{name:"Fire truck \xB7 raised ladder \xB7 west",category:"vehicle",kind:"prop",tags:["vehicle","fire","review proposal"],settings:["road"],facing:"west",anchor:[72,77],footprint:[-66,-40,132,40],colliders:[{offsetX:0,offsetY:0,width:132,height:40,zHeight:64}],depthOffset:-20},approval:{id:"d560885e-f498-4fdc-a140-a2e9b7b5e633",createdAt:"2026-10-03T10:49:12.153Z",candidateFingerprint:"025a25e1e28489eb8f9595ff2d6c7e3a062437b41b8a512535bc67b41c1b47d3",metadataFingerprint:"6ee247e6b8bbcd3c8345c4c9dfd1092aae0133b9d31131ff309fd522c655df15"}}]};var wo=xs.views.find(i=>i.id==="vehicle:compact-1:east");if(!wo)throw Error("Missing pinned compact-car view");var[rf,sf]=wo.rect;if(rf===void 0||sf===void 0)throw Error("Missing pinned car source dimensions");var So=wo.metadata.colliders[0];if(!So)throw Error("Missing approved collision geometry");var af={revision:"car-projection-v2",name:"Blue compact car",sourceView:wo.id,sourceFingerprint:xs.sourceFingerprint,atlas:"assets/tilesets/me-complete.png",atlasSize:[2816,8224],rect:[rf,sf+24,64,40],sourceOrigin:[32,54],sourceSize:[64,64],cropTop:24,facing:"left",collision:{width:So.width,depth:So.height,height:So.zHeight}};var Ao=xs.views.find(i=>i.id===af.sourceView),To=Ao?.metadata.colliders[0],of=Ao?.metadata.anchor[0],cf=Ao?.metadata.anchor[1];if(!Ao||!To||of===void 0||cf===void 0)throw Error("Missing approved car registration");var Q1=[of+To.offsetX,cf+To.offsetY-To.height/2];var Eo=class{constructor(e,t){this.pattern=t;if(!Number.isFinite(t.periodSeconds)||t.periodSeconds<=0||!Number.isFinite(t.peakGain)||t.peakGain<1||!Array.isArray(t.pulseWindows)||!t.pulseWindows.length||t.pulseWindows.some(n=>n.length!==2||!n.every(Number.isFinite)||n[0]<0||n[1]>1||n[0]>=n[1]))throw Error("Invalid vehicle light pattern");try{e.traverse(n=>{if(n.userData.tilefun_role!=="emergency-light")return;let r=n.userData.tilefun_phase;if(!(n instanceof Ke)||n.userData.tilefun_effect_schema!==1||n.userData.tilefun_channel!=="emergencyLights"||typeof n.userData.tilefun_group!="string"||!n.userData.tilefun_group||typeof r!="number"||!Number.isFinite(r)||r<0||r>=1||!(n.material instanceof Lt||n.material instanceof $t&&n.material.emissiveMap&&n.material.emissiveIntensity>0&&n.material.emissive.r+n.material.emissive.g+n.material.emissive.b>0))throw Error(`Invalid emergency-light lens: ${n.name}`);let s=n.material;if(!(s instanceof Lt||s instanceof $t))throw Error(`Unsupported emergency-light material: ${n.name}`);let a=s.clone();a.toneMapped=!1,n.material=a,this.lenses.push({mesh:n,original:s,material:a,rest:s.color.clone(),restIntensity:s instanceof $t?s.emissiveIntensity:1,phase:r})})}catch(n){throw this.dispose(),n}this.count=this.lenses.length}pattern;lenses=[];count;setState(e,t){if(!Number.isFinite(t))throw Error("Vehicle light time must be finite");for(let n of this.lenses){let r=((t/this.pattern.periodSeconds+n.phase)%1+1)%1,a=e&&this.pattern.pulseWindows.some(([o,l])=>r>=o&&r<l)?this.pattern.peakGain:1;n.material instanceof $t?n.material.emissiveIntensity=n.restIntensity*a:n.material.color.copy(n.rest).multiplyScalar(a)}}dispose(){for(let e of this.lenses)e.mesh.material=e.original,e.material.dispose();this.lenses.length=0}};var Iv=new Fe;function lf(i,e,t=new Set){let n=new Map;i.traverse(s=>{if(!(s instanceof Ke)||s.type!=="Mesh"||!s.parent||s.children.length||!s.visible||s.userData.tilefun_role||t.has(s.name)||Array.isArray(s.material)||s.material.transparent||!(s.material instanceof Lt||s.material instanceof $t)||s.material instanceof Ot&&s.material.transmission>0||s.onBeforeRender!==Ke.prototype.onBeforeRender||s.onAfterRender!==Ke.prototype.onAfterRender||s.customDepthMaterial||s.customDistanceMaterial||(s.matrixAutoUpdate&&s.updateMatrix(),!s.matrix.equals(Iv)))return;let a=s.geometry;if(a instanceof rs||a.drawRange.start!==0||a.drawRange.count!==1/0||Object.keys(a.morphAttributes).length||!a.getAttribute("position"))return;let o=[];for(let h of Object.keys(a.attributes).sort()){let u=a.getAttribute(h);if(!(u instanceof pt||u instanceof Gn))return;o.push([h,u])}if(o.some(([,h])=>!((h instanceof Gn?h.data.array:h.array)instanceof Float32Array)||h instanceof bn||h instanceof pt&&h.gpuType!==qt))return;let l=[!!a.index,s.renderOrder,s.layers.mask,s.frustumCulled,s.castShadow,s.receiveShadow,...o.map(([h,u])=>`${h}:${u.itemSize}:${u.normalized}`)].join("|"),c=n.get(s.parent);c||(c=new Map,n.set(s.parent,c));let d=c.get(s.material);d||(d=new Map,c.set(s.material,d));let f=d.get(l);f||(f=[],d.set(l,f)),f.push(s)});for(let[s,a]of n)for(let o of a.values())for(let l of o.values()){if(l.length<2)continue;let c=l[0];if(!c)continue;let d=Kh(l.map(u=>u.geometry));if(!d)continue;e(d);let f=new Ke(d,c.material);f.name=`Batch:${s.name||"body"}`,f.renderOrder=c.renderOrder,f.layers.mask=c.layers.mask,f.frustumCulled=c.frustumCulled,f.castShadow=c.castShadow,f.receiveShadow=c.receiveShadow;let h=s.children.indexOf(c);for(let u of l)s.remove(u);s.add(f),s.children.splice(s.children.indexOf(f),1),s.children.splice(h,0,f)}let r=0;return i.traverse(s=>{s instanceof Ke&&r++}),r}var Ro=class{object=new Ht;resources=new Set;bitmaps=new Set;wheels=[];rotation=new Gt;meshCount;drawMeshCount;lights;propeller;propellerRest;constructor(e,t=1.3,n){let r=0;e.traverse(s=>{if(!(s instanceof Ke))return;r++,this.resources.add(s.geometry);let a=Array.isArray(s.material)?s.material:[s.material];for(let o of a){this.resources.add(o),o.toneMapped=!1;for(let l of Object.values(o))l instanceof Mt&&(l.magFilter=l.minFilter=st,l.generateMipmaps=!1,l.needsUpdate=!0,this.resources.add(l),typeof ImageBitmap<"u"&&l.image instanceof ImageBitmap&&this.bitmaps.add(l.image))}}),this.meshCount=r;try{let s=new Map;if(e.traverse(c=>{let d=/^Wheel_(.+)_Roll$/.exec(c.name);if(!d)return;let f=d[1];if(!f||s.has(f))throw Error(`Duplicate authored car wheel ${f}`);s.set(f,c)}),e.getObjectByName("Boat_Root")?.userData.tilefun_watercraft===1){if(s.size||!e.getObjectByName("Boat_Hull"))throw Error("Invalid authored boat rig");let c=e.getObjectByName("Boat_Propeller");if(!c)throw Error("Missing authored boat propeller");this.propeller=c,this.propellerRest=this.propeller.quaternion.clone()}else for(let c of["FL","FR","RL","RR"])if(!s.has(c))throw Error(`Missing authored car wheel ${c}`);for(let[c,d]of s){let f=e.getObjectByName(`Wheel_${c}_Steer`),h=d?.userData.wheel_radius,u=d?.userData.roll_axis_gltf;if(!d||!f||d.parent!==f||typeof h!="number"||!Number.isFinite(h)||h<=0||!Array.isArray(u)||u.length!==3||!u.every(g=>typeof g=="number"&&Number.isFinite(g))||Math.hypot(...u)===0)throw Error(`Invalid authored car wheel ${c}`);this.wheels.push({roll:d,rest:d.quaternion.clone(),axis:new N(u[0],u[1],u[2]).normalize(),radius:h})}if(n?.batch){for(let c of n.preserveParts??[])if(!(e.getObjectByName(c)instanceof Ke))throw Error(`Missing qualified vehicle part ${c}`)}this.drawMeshCount=n?.batch?lf(e,c=>this.resources.add(c),new Set(n.preserveParts)):r;let o=new Ht;o.rotation.set(Math.PI/2,0,Math.PI,"ZYX"),o.add(e);let l=new Ht;if(l.scale.y=t,l.scale.z=n?.heightScale??1,l.add(o),this.object.add(l),n?.contactShadow){this.object.updateMatrixWorld(!0);let c=new Wt().setFromObject(this.object,!0),d=c.getCenter(new N),f=c.getSize(new N),h=new $r(1,32),u=new Lt({color:0,transparent:!0,opacity:.2,side:Qt,forceSinglePass:!0,depthWrite:!1,toneMapped:!1}),g=new Ke(h,u);g.name="Game-contact-shadow",g.position.set(d.x,d.y,-.01),g.scale.set(f.x*.48,f.y*.48,1),this.object.add(g),this.resources.add(h),this.resources.add(u)}this.lights=new Eo(e,{periodSeconds:1,pulseWindows:[[0,.12],[.2,.32]],peakGain:4})}catch(s){throw this.dispose(),s}}setTravel(e){this.propeller&&this.propellerRest&&(this.rotation.setFromAxisAngle(new N(1,0,0),e/2),this.propeller.quaternion.copy(this.propellerRest).multiply(this.rotation));for(let t of this.wheels)this.rotation.setFromAxisAngle(t.axis,-e/t.radius),t.roll.quaternion.copy(t.rest).multiply(this.rotation)}setEmergency(e,t){this.lights?.setState(e,t)}dispose(){this.lights?.dispose();for(let e of this.resources)e.dispose();for(let e of this.bitmaps)e.close();this.resources.clear(),this.bitmaps.clear(),this.object.clear()}};function df(i,e){i.set(1/e,0,0,0,0,-1/e,1/e,0,0,-1/(e*4),-1/(e*4),0,0,0,0,1)}var Co=class{target=new Pt(1,1,{depthBuffer:!1});scene=new Ti;camera=new Zn;geometry=new Ri(2,2);uniforms={painted:{value:null},imageSize:{value:new De(1,1)},inkColor:{value:new Ce().setRGB(58/255,58/255,80/255,ht)}};material=new Xt({uniforms:this.uniforms,vertexShader:"void main(){gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:`uniform sampler2D painted;
      uniform ivec2 imageSize;
      uniform vec3 inkColor;
      bool occupied(ivec2 p){
        if(any(lessThan(p,ivec2(0))) || any(greaterThanEqual(p,imageSize))) return false;
        return texelFetch(painted,p,0).a >= 128.0/255.0;
      }
      void main(){
        ivec2 p=ivec2(gl_FragCoord.xy);
        vec4 base=texelFetch(painted,p,0);
        if(occupied(p) && !(occupied(p+ivec2(-1,0)) && occupied(p+ivec2(1,0)) &&
            occupied(p+ivec2(0,-1)) && occupied(p+ivec2(0,1)))){
          if(dot(base.rgb,vec3(1.0)) > dot(inkColor,vec3(1.0)) + 0.5/255.0) base.rgb=inkColor;
        }
        gl_FragColor=base;
        #include <colorspace_fragment>
      }`,depthTest:!1,depthWrite:!1,blending:ln,toneMapped:!1});constructor(){this.target.texture.colorSpace=ht,this.target.texture.magFilter=this.target.texture.minFilter=st,this.target.texture.generateMipmaps=!1,this.scene.add(new Ke(this.geometry,this.material))}render(e,t){return this.target.setSize(t.width,t.height),this.uniforms.painted.value=t.texture,this.uniforms.imageSize.value.set(t.width,t.height),e.setRenderTarget(this.target),e.render(this.scene,this.camera),this.target.texture}recover(){this.target.dispose()}dispose(){this.target.dispose(),this.geometry.dispose(),this.material.dispose()}};var mf=document.querySelector("canvas"),gf=mf.getContext("2d"),$n=new vo({alpha:!0,antialias:!1});$n.setSize(128,128);$n.outputColorSpace=ht;$n.toneMapping=rn;var vf=new Ti,Io=new Zn;df(Io.projectionMatrix,64);Io.projectionMatrixInverse.copy(Io.projectionMatrix).invert();var Ar=new Pt(128,128,{depthBuffer:!0});Ar.texture.colorSpace=ht;Ar.texture.magFilter=Ar.texture.minFilter=st;Ar.texture.generateMipmaps=!1;var hf=new Co,Pv=await new xo().loadAsync(new URL("inputs/model.glb",location.href).href),ys=new Ro(Pv.scene,1,{batch:!0,preserveParts:["Boat_Propeller"]});vf.add(ys.object);var ff=new Uint8Array(16384*4),uf=gf.createImageData(128,128),Ol=45,Bl=0,Ul=!1;function Po(i,e=0){Ol=i,Bl=e,ys.object.rotation.z=i*Math.PI/180,ys.setTravel(e),$n.setRenderTarget(Ar),$n.setClearColor(0,0),$n.clear(),$n.render(vf,Io),hf.render($n,Ar),$n.readRenderTargetPixels(hf.target,0,0,128,128,ff);for(let t=0;t<128;t++)uf.data.set(ff.subarray((127-t)*512,(128-t)*512),t*512);return gf.putImageData(uf,0,0),mf.toDataURL()}Object.assign(window,{boatReview:{pose:Po,stats:{meshes:ys.meshCount,drawMeshes:ys.drawMeshCount},ready:!0}});document.querySelector("#heading").oninput=i=>Po(Number(i.target.value),Bl);document.querySelector("button").onclick=()=>{Ul=!Ul};var pf=performance.now();function _f(i){Ul&&Po(Ol,Bl+(i-pf)*.04),pf=i,requestAnimationFrame(_f)}requestAnimationFrame(_f);Po(Ol);
/*! Bundled license information:

three/build/three.core.js:
three/build/three.module.js:
  (**
   * @license
   * Copyright 2010-2026 Three.js Authors
   * SPDX-License-Identifier: MIT
   *)
*/
