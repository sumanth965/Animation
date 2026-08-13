precision highp float;
uniform float uTime;
uniform vec3 uColorCore;
uniform vec3 uColorEdge;
uniform float uOpacity;
varying float vLocalProgress;
varying float vRandom;
varying float vEdge;
varying float vHeightFactor;
void main() {
  float circle = smoothstep(.5, 0.0, length(gl_PointCoord - .5));
  float shapeAlpha = mix(circle, 1.0, vEdge);
  vec3 color = mix(uColorEdge, uColorCore, vHeightFactor * .6 + .4);
  float flicker = vLocalProgress < .98 ? .6 + .4 * sin(uTime * 20.0 + vRandom * 50.0) : 1.0;
  float alpha = shapeAlpha * vLocalProgress * flicker * uOpacity;
  color += uColorCore * pow(vLocalProgress, 3.0) * .25;
  gl_FragColor = vec4(color, alpha);
}
