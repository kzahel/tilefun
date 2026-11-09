/** Quads whose image slot is at least this sample `atlas` layer `slot - ATLAS_SLOT`;
 * batch slots must stay below it. */
export const ATLAS_SLOT = 8;

/** Constant sampler indices are portable across WebGL2/ANGLE implementations.
 * Software rasterizers (CI's SwiftShader) evaluate every branch, so batches
 * without filtered actor quads omit the filter, and its four taps share one
 * per-slot fetch in a loop rather than four inlined copies per slot. */
export function rasterFragmentShader(limit: number, filtered: boolean) {
  const encode =
    "c.rgb=mix(12.92*c.rgb,1.055*pow(c.rgb,vec3(1./2.4))-.055,step(vec3(.0031308),c.rgb));";
  const declarations = Array.from(
    { length: limit },
    (_, i) => `uniform sampler2D image${i || ""}, depthImage${i}; uniform bool encode${i || ""};`,
  ).join("\n");
  const slots = (body: (i: number) => string) =>
    Array.from(
      { length: limit },
      (_, i) => `${i ? "else " : ""}${i < limit - 1 ? `if(slot0<${i + 0.5})` : ""}{${body(i)}}`,
    ).join("\n");
  const atlas = (body: string) => `if(slot0>${ATLAS_SLOT - 0.5}){${body}}else `;
  // The common opaque/static path samples directly, outside the actor filter.
  const rawSample = (i: number) => `vec2 uv=uv0;if(stableRaster){
      vec2 dim=vec2(textureSize(image${i || ""},0));uv=(floor(uv*dim+.0001)+.5)/dim;}
      c=texture2D(image${i || ""},uv);e=encode${i || ""};`;
  // Unfiltered atlas quads carry their page rectangle as bounds: clamping to its
  // edge texel centers is CLAMP_TO_EDGE for the 2D page each one replaces.
  const raw = `{bool e=false;${atlas(`vec2 edge=.5/vec2(textureSize(atlas,0).xy);
      vec2 uv=clamp(uv0,bounds0.xy+edge,bounds0.zw-edge);if(stableRaster)uv=nearestAtlas(uv);
      c=texture(atlas,vec3(uv,layer0));`)}${slots(rawSample)}if(e){${encode}}
      c*=color0;if(c.a<.001)discard;gl_FragColor=vec4(c.rgb*c.a,c.a);return;}`;
  // Bilinear blend of four transparent-bounded nearest taps. Tap offsets stay
  // additions: GPU compilers may round an equivalent multiply differently.
  const filter = `if(fract(slot0)<.1)${raw}
      vec2 stepUV=max(fwidth(uv0),vec2(.00000001));
      vec2 p=(uv0-bounds0.xy)/stepUV-.5;
      vec2 f=fract(p), lo=bounds0.xy+(floor(p)+.5)*stepUV;
      vec4 taps[4];
      for(int k=0;k<4;k++){
        vec2 uv=lo;if((k&1)!=0)uv.x+=stepUV.x;if(k>1)uv.y+=stepUV.y;c=vec4(0.);
        if(!(any(lessThan(uv,bounds0.xy))||any(greaterThanEqual(uv,bounds0.zw)))){bool e=false;
          ${atlas("c=texture(atlas,vec3(nearestAtlas(uv),layer0));")}${slots((i) => `c=nearestSample(image${i || ""},uv);e=encode${i || ""};`)}
          if(e){${encode}}c=vec4(c.rgb*c.a,c.a);}
        taps[k]=c;}
      c=mix(mix(taps[0],taps[1],f.x),mix(taps[2],taps[3],f.x),f.y);
      if(c.a*color0.a<.001)discard;gl_FragColor=vec4(c.rgb*color0.rgb*color0.a,c.a*color0.a);`;
  return `${declarations} varying vec3 depth0; varying vec2 uv0; varying vec4 color0; varying float slot0;
    varying vec4 bounds0; uniform bool stableRaster; uniform highp sampler2DArray atlas; float layer0;
    vec2 nearestAtlas(vec2 uv){vec2 dim=vec2(textureSize(atlas,0).xy);return (floor(uv*dim+.0001)+.5)/dim;}
    vec4 nearestSample(sampler2D image,vec2 uv){
      vec2 dim=vec2(textureSize(image,0));uv=(floor(uv*dim+.0001)+.5)/dim;
      return texture2D(image,uv);
    }
    void main(){layer0=floor(slot0+.1)-${ATLAS_SLOT}.;gl_FragDepth=max(depth0.x,depth0.z);if(depth0.y!=0.){float d;${slots(
      (i) => `d=nearestSample(depthImage${i},clamp(uv0,bounds0.xy,bounds0.zw)).r;`,
    )}gl_FragDepth+=depth0.y*(d-.5);}
      vec4 c;${filtered ? filter : raw}}`;
}
