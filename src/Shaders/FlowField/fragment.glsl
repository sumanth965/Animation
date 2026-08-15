uniform vec3 uColor;
uniform float uTime;

varying float vAlpha;
varying float vParticleType;

void main() {
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);

  if(dist > 0.5) {
    discard;
  }

  float alpha = 0.0;
  vec3 finalColor = uColor;

  if (vParticleType < 0.45) {
    // Bubble: hollow ring with highlight
    float bubbleEdge = smoothstep(0.5, 0.42, dist) * smoothstep(0.32, 0.45, dist);
    
    // Specular highlight at top-left
    vec2 specCenter = gl_PointCoord - vec2(0.35, 0.35);
    float spec = smoothstep(0.12, 0.0, length(specCenter)) * 0.85;
    
    alpha = (bubbleEdge * 0.65 + spec) * vAlpha;
    // Bubbles are slightly lighter/whiter
    finalColor = mix(uColor, vec3(1.0), 0.4);
  } else {
    // Dust: soft fuzzy dot
    float glow = smoothstep(0.5, 0.0, dist);
    alpha = glow * vAlpha;
    
    // Shimmer effect for organic dust
    float shimmer = sin(uTime * 1.5 + vParticleType * 100.0) * 0.2 + 0.8;
    alpha *= shimmer;
  }

  gl_FragColor = vec4(finalColor, alpha);
}
