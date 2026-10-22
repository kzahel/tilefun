import * as THREE from "three";

/** One native-world-pixel inward silhouette stroke. Internal window ink is
 * retained atlas paint. Render-target rows already follow GL coordinates.
 */
export class CarPixelOutline {
  readonly target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly uniforms = {
    painted: { value: null as THREE.Texture | null },
    imageSize: { value: new THREE.Vector2(1, 1) },
    inkColor: {
      value: new THREE.Color().setRGB(58 / 255, 58 / 255, 80 / 255, THREE.SRGBColorSpace),
    },
  };
  private readonly material = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform sampler2D painted;
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
      }`,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  constructor() {
    this.target.texture.colorSpace = THREE.SRGBColorSpace;
    this.target.texture.magFilter = this.target.texture.minFilter = THREE.NearestFilter;
    this.target.texture.generateMipmaps = false;
    this.scene.add(new THREE.Mesh(this.geometry, this.material));
  }
  render(renderer: THREE.WebGLRenderer, source: THREE.WebGLRenderTarget) {
    this.target.setSize(source.width, source.height);
    this.uniforms.painted.value = source.texture;
    this.uniforms.imageSize.value.set(source.width, source.height);
    renderer.setRenderTarget(this.target);
    renderer.render(this.scene, this.camera);
    return this.target.texture;
  }
  recover() {
    this.target.dispose();
  }
  dispose() {
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
