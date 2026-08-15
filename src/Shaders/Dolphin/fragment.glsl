uniform float uTime;
uniform vec3 uBaseColor;
uniform float uVelocity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    if(!gl_FrontFacing) {
        normal *= -1.0;
    }

    vec3 viewDirection = normalize(vPosition - cameraPosition);
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.5);

    // Retain a deep body while making the cyan silhouette legible in the hero.
    vec3 deepBlue = vec3(0.008, 0.045, 0.10);
    vec3 glowColor = uBaseColor * (1.35 + uVelocity * 1.5);
    vec3 color = mix(deepBlue, glowColor, 0.18 + fresnel * 0.82);
    gl_FragColor = vec4(color, 0.28 + fresnel * 0.72);

    #include <colorspace_fragment>
}
