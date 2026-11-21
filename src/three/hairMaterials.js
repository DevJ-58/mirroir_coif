import * as THREE from 'three';

// Lumières partagées (repère monde), alignées sur celles de la scène.
export const hairLights = {
  uL1: { value: new THREE.Vector3(-0.55, 0.62, 0.56).normalize() },
  uL1c: { value: new THREE.Color('#fff0dc').multiplyScalar(1.9) },
  uL2: { value: new THREE.Vector3(0.62, 0.35, -0.7).normalize() },
  uL2c: { value: new THREE.Color('#c4d0f0').multiplyScalar(0.85) },
  uL3: { value: new THREE.Vector3(-0.7, 0.1, -0.6).normalize() },
  uL3c: { value: new THREE.Color('#ffb98a').multiplyScalar(0.9) },
};

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float hash11(float n){ return fract(sin(n)*43758.5453123); }
`;

// Éclairage Kajiya-Kay (reflets anisotropes des cheveux)
const KK = /* glsl */ `
uniform vec3 uL1; uniform vec3 uL1c; uniform vec3 uL2; uniform vec3 uL2c; uniform vec3 uL3; uniform vec3 uL3c;
vec3 kk(vec3 base, vec3 N, vec3 T, vec3 V, vec3 L, vec3 Lc, float shine, float shift, float specAmt){
  float d = dot(N, L);
  float diff = clamp(d * 0.55 + 0.45, 0.0, 1.0); diff *= diff;
  vec3 H = normalize(L + V);
  vec3 T1 = normalize(T + N * shift);
  vec3 T2 = normalize(T - N * (shift + 0.1));
  float th1 = dot(T1, H), th2 = dot(T2, H);
  float s1 = pow(sqrt(max(0.0, 1.0 - th1 * th1)), shine);
  float s2 = pow(sqrt(max(0.0, 1.0 - th2 * th2)), shine * 0.25);
  float vis = smoothstep(-0.2, 0.35, d);
  vec3 sc = mix(vec3(1.0), normalize(base + 0.02) * 1.4, 0.45);
  return Lc * (base * diff + (sc * s1 * 0.2 + base * s2 * 0.6) * specAmt * vis);
}
vec3 lightHair(vec3 base, vec3 N, vec3 T, vec3 V, float shine, float shift, float specAmt){
  vec3 c = base * 0.16;
  c += kk(base, N, T, V, uL1, uL1c, shine, shift, specAmt);
  c += kk(base, N, T, V, uL2, uL2c, shine, shift, specAmt) * 0.8;
  c += kk(base, N, T, V, uL3, uL3c, shine, shift, specAmt) * 0.6;
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  c += base * rim * 0.35;
  return c;
}
`;

export function makeStrandMaterial(common) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...hairLights, ...common,
      uShine: { value: 90 }, uStriation: { value: 14 }, uLobeShade: { value: 0.0 }, uSpec: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aTan; attribute float aT; attribute float aRand; attribute float aU;
      varying vec3 vN; varying vec3 vTan; varying vec3 vW; varying float vT; varying float vRand; varying float vU; varying float vLy;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vTan = normalize(mat3(modelMatrix) * aTan);
        vT = aT; vRand = aRand; vU = aU; vLy = position.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uTip; uniform float uGrow; uniform float uShine; uniform float uStriation; uniform float uLobeShade; uniform float uSpec;
      varying vec3 vN; varying vec3 vTan; varying vec3 vW; varying float vT; varying float vRand; varying float vU; varying float vLy;
      ${NOISE}
      ${KK}
      void main(){
        float g = uGrow * 1.08 - vRand * 0.08;
        if (vT > g) discard;
        vec3 N = normalize(vN); vec3 T = normalize(vTan); vec3 V = normalize(cameraPosition - vW);
        float str = 0.86 + 0.28 * hash11(floor(vU * uStriation + vRand * 31.0) + 1.7);
        vec3 base = mix(uColor, uTip, smoothstep(0.45, 1.0, vT)) * (0.8 + 0.4 * vRand) * str;
        float lobe = 1.0 - uLobeShade * (0.5 - 0.5 * cos(vU * 6.2831 * 3.0));
        base *= lobe;
        float ao = mix(0.32, 1.0, smoothstep(0.0, 0.22, vT));
        ao *= smoothstep(-48.0, -24.0, vLy) * 0.5 + 0.5;
        vec3 col = lightHair(base, N, T, V, uShine, 0.06 + vRand * 0.08, uSpec) * ao;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// mode : 0 rasé, 1 dégradé, 2 waves, 3 afro, 4 plaqué
export function makeShellMaterial(common, mode, opts = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: mode === 3 || mode === 4,
    uniforms: {
      ...hairLights, ...common,
      uMode: { value: mode },
      uTarget: { value: opts.target || new THREE.Vector3(0, -6, -14) },
      uFade: { value: new THREE.Vector2(opts.fadeLo ?? 1.0, opts.fadeHi ?? 6.0) },
      uDensity: { value: opts.density ?? 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aMask;
      varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vMask;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vL = position; vN = normalize(mat3(modelMatrix) * normal); vMask = aMask;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uTip; uniform float uGrow; uniform int uMode; uniform vec3 uTarget; uniform vec2 uFade; uniform float uDensity;
      varying vec3 vN; varying vec3 vW; varying vec3 vL; varying float vMask;
      ${NOISE}
      ${KK}
      void main(){
        float h = (14.5 - vL.y) / 32.0;
        float reveal = smoothstep(uGrow * 1.15, uGrow * 1.15 - 0.07, h);
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        vec3 T = vec3(0.0, -1.0, 0.0);
        float cov = vMask;
        vec3 base = uColor;
        float shine = 60.0; float spec = 0.6;
        float grain = snoise(vL * 7.0) * 0.5 + 0.5;
        float fine = snoise(vL * 22.0) * 0.5 + 0.5;
        if (uMode == 0) {
          cov *= (0.55 + 0.45 * fine) * uDensity;
          base *= 0.8 + 0.3 * grain; spec = 0.25; shine = 20.0;
        } else if (uMode == 1) {
          float f = smoothstep(uFade.x, uFade.y, vL.y + (grain - 0.5) * 0.8);
          cov *= mix(0.42 * (0.4 + 0.6 * fine), 1.0, f);
          base *= 0.78 + 0.35 * grain; spec = mix(0.2, 0.6, f); shine = 30.0;
        } else if (uMode == 5) {
          // waves : ondulations concentriques en relief + dégradé sur les côtés
          vec3 crown = vec3(0.0, 13.0, -7.2);
          vec3 d = vL - crown;
          float a = atan(d.x, d.z);
          float r = length(d);
          float ph = r * 6.6 + a * 1.0 + snoise(vL * 0.22) * 1.4;
          float w = sin(ph);
          vec3 radial = normalize(d - N * dot(d, N) + vec3(0.0001));
          float f = smoothstep(uFade.x, uFade.y, vL.y + (grain - 0.5) * 0.7);
          N = normalize(N + radial * cos(ph) * 0.35 * f);
          T = normalize(cross(N, radial));
          base *= mix(0.85 + 0.3 * grain, 0.45 + 0.75 * smoothstep(-0.7, 0.9, w), f);
          base *= 0.85 + 0.3 * fine;
          cov *= mix(0.22 + 0.3 * fine * smoothstep(uFade.x - 1.5, uFade.x + 1.0, vL.y), 1.0, f);
          shine = 18.0; spec = mix(0.05, 0.14, f);
        } else if (uMode == 2) {
          vec3 crown = vec3(0.0, 13.2, -6.5);
          vec3 d = vL - crown;
          float a = atan(d.x, d.z);
          float r = length(d);
          float w = sin(r * 3.1 + a * 1.0 + snoise(vL * 0.35) * 0.9);
          base *= 0.28 + 1.0 * smoothstep(-0.5, 0.9, w);
          T = normalize(cross(N, normalize(d + 0.001)));
          cov *= 0.97; shine = 40.0; spec = 0.75;
        } else if (uMode == 3) {
          float n1 = snoise(vL * 0.9) * 0.5 + 0.5;
          float n2 = snoise(vL * 3.2) * 0.5 + 0.5;
          float n3 = snoise(vL * 9.0) * 0.5 + 0.5;
          base *= 0.5 + 0.25 * n1 + 0.3 * n2 + 0.2 * n3;
          float fres = 1.0 - abs(dot(N, V));
          cov *= 1.0 - smoothstep(0.7, 1.0, fres) * (0.3 + 0.7 * n3);
          T = normalize(cross(N, vec3(n2 - 0.5, 1.0, n3 - 0.5)));
          shine = 10.0; spec = 0.12;
        } else {
          T = normalize(uTarget - vL);
          float p = dot(vL, normalize(cross(N, T)));
          base *= 0.82 + 0.34 * hash11(floor(p * 16.0) + 3.1);
          shine = 90.0; spec = 0.6;
        }
        T = normalize(T - N * dot(T, N) + vec3(0.0001));
        vec3 col = lightHair(base, N, T, V, shine, 0.08, spec);
        float alpha = cov * reveal;
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
