#version 300 es
precision highp float;
precision highp int;
uniform sampler2D painted;
uniform ivec2 imageSize;
uniform int outlineMode;
uniform vec3 inkColor;
out vec4 fragment;

bool occupied(ivec2 p) {
  if (any(lessThan(p, ivec2(0))) || any(greaterThanEqual(p, imageSize))) return false;
  return texelFetch(painted, p, 0).a >= 128.0 / 255.0;
}

void main() {
  // Uint8 texture rows are native image order, with row zero at the top.
  ivec2 p = ivec2(int(gl_FragCoord.x), imageSize.y - 1 - int(gl_FragCoord.y));
  vec4 base = texelFetch(painted, p, 0);
  bool here = occupied(p);
  bool a = occupied(p + ivec2(-1, 0));
  bool b = occupied(p + ivec2( 1, 0));
  bool c = occupied(p + ivec2(0, -1));
  bool d = occupied(p + ivec2(0,  1));
  if (outlineMode == 1 && here && !(a && b && c && d)) {
    if (dot(base.rgb, vec3(1.0)) > dot(inkColor, vec3(1.0)) + 0.5 / 255.0) base.rgb = inkColor;
  } else if (outlineMode == 2 && !here && (a || b || c || d)) {
    base = vec4(inkColor, 1.0);
  }
  // Input/output are encoded source colors; no tone mapping or color conversion.
  fragment = base;
}
