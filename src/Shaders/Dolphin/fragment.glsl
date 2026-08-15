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

    vec3 color = uBaseColor * (1.0 + uVelocity * 1.5);
    gl_FragColor = vec4(color, fresnel * (1.0 + uVelocity * 0.5));

    #include <colorspace_fragment>
}
