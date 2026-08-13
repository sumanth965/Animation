uniform float uProgress;
uniform float uTime;
uniform float uSeaFloorY;
uniform float uBuildingHeight;
uniform float uStagger;

attribute float aFloor;
attribute float aRandom;
attribute float aEdge;

varying float vLocalProgress;
varying float vRandom;
varying float vEdge;
varying float vHeightFactor;

float hash(float n) { return fract(sin(n) * 43758.5453123); }

void main() {
  vRandom = aRandom;
  vEdge = aEdge;
  vHeightFactor = aFloor;
  float delay = aFloor * uStagger;
  float localProgress = clamp((uProgress - delay) / max(.0001, 1.0 - uStagger), 0.0, 1.0);
  localProgress = smoothstep(0.0, 1.0, localProgress);
  vLocalProgress = localProgress;

  vec3 pos = position;
  float restY = uSeaFloorY + aFloor * uBuildingHeight;
  float startY = uSeaFloorY - 4.0 - aFloor * 2.0;
  pos.y = mix(startY, restY, localProgress);
  float jitter = (1.0 - localProgress) * (1.0 + aRandom * 2.0);
  pos.x += (hash(aRandom * 91.7 + uTime * .15) - .5) * jitter;
  pos.z += (hash(aRandom * 47.3 + uTime * .22 + 3.1) - .5) * jitter;
  pos.x += sin(uTime * .6 + aFloor * 6.2831) * .03 * localProgress;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  float size = mix(2.0, 4.6, 1.0 - aEdge);
  gl_PointSize = size * (1.0 + sin(uTime * 2.0 + aRandom * 10.0) * .3 * (1.0 - aEdge));
  gl_PointSize *= 200.0 / max(.1, -mvPosition.z);
}
