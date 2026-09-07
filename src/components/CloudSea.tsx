import { useEffect, useRef } from 'react'
import type { Tone } from '@/data/palettes'
import { clamp01, easeInOutCubic, hexToRgb, lerp } from '@/lib/ease'

/**
 * Biển mây dựng bằng một fragment shader: mặt phẳng mây chiếu phối cảnh, độ cao
 * từ fbm, chiếu sáng theo pháp tuyến và mặt trời của palette. Camera trôi
 * chậm liên tục; đổi màn thì cả tone lẫn vùng mây được tween ease-in-out tới
 * giá trị mới, nên mây "trôi sang vùng khác" chứ không cắt cảnh.
 */
const VERT = `
attribute vec2 a;
void main(){ gl_Position = vec4(a, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uOffset;
uniform vec3 uSkyTop, uSkyHorizon, uCloudLit, uCloudShadow, uSun;
uniform vec2 uSunPos;
uniform float uHorizon;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p, float detail){
  float v = 0.0, a = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++){
    if (float(i) > detail) break;
    v += a * noise(p);
    p = m * p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float horizon = uHorizon;

  // --- Bầu trời ---
  float t = clamp((uv.y - horizon) / (1.0 - horizon), 0.0, 1.0);
  vec3 sky = mix(uSkyHorizon, uSkyTop, pow(t, 0.65));
  vec2 d = (uv - uSunPos) * vec2(aspect, 1.0);
  float dist = length(d);
  float disc = exp(-dist * dist * 1400.0);
  float glow = exp(-dist * 3.4);
  sky += uSun * disc * 0.8 + uSun * glow * 0.32;
  // mây cao mỏng
  vec2 hp = uv * vec2(aspect, 1.0) * 2.4 + uOffset * 0.12 + vec2(uTime * 0.012, 0.0);
  float hc = fbm(hp, 5.0);
  float thin = smoothstep(0.52, 0.80, hc) * t * 0.55;
  sky = mix(sky, mix(sky, uCloudLit, 0.55), thin);
  vec3 col = sky;

  // --- Biển mây ---
  if (uv.y < horizon) {
    float depth = horizon - uv.y;             // 0 ở chân trời
    float z = 1.0 / (depth * 5.5 + 0.035);    // khoảng cách phối cảnh
    vec2 p = vec2((uv.x - 0.5) * aspect * z, z) + uOffset;
    p += vec2(uTime * 0.020, uTime * 0.009);
    float detail = clamp(6.0 - z * 0.18, 2.5, 6.0);
    float e = 0.045;
    // hai tầng: khối lớn + gợn nhỏ để mặt mây phồng chứ không phẳng như nước
    float h  = fbm(p * 0.7, detail) * 0.74 + fbm(p * 2.3 + 3.1, detail - 1.0) * 0.26;
    float hx = fbm((p + vec2(e, 0.0)) * 0.7, detail) * 0.74 + fbm((p + vec2(e, 0.0)) * 2.3 + 3.1, detail - 1.0) * 0.26;
    float hy = fbm((p + vec2(0.0, e)) * 0.7, detail) * 0.74 + fbm((p + vec2(0.0, e)) * 2.3 + 3.1, detail - 1.0) * 0.26;
    vec3 n = normalize(vec3(h - hx, 0.055, h - hy));
    vec3 L = normalize(vec3((uSunPos.x - 0.5) * 1.4, 0.55, -0.6));
    float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);
    float cover = smoothstep(0.30, 0.60, h);
    vec3 cloud = mix(uCloudShadow, uCloudLit, pow(diff, 1.35));
    cloud += uSun * pow(diff, 5.0) * 0.45;
    // đỉnh mây bắt sáng thêm — phần cao nhất luôn sáng hơn khe
    cloud = mix(cloud, uCloudLit, smoothstep(0.55, 0.8, h) * 0.35);
    vec3 valley = mix(uCloudShadow, uSkyTop, 0.4) * 0.8;
    col = mix(valley, cloud, cover);
    // sương về phía chân trời — cũng che răng cưa ở xa
    float fog = clamp(pow(1.0 - depth / horizon, 2.6), 0.0, 1.0);
    col = mix(col, uSkyHorizon + uSun * glow * 0.15, fog * 0.9);
  }

  // vignette nhẹ + dither chống dải màu
  float vig = smoothstep(1.35, 0.35, length((uv - 0.5) * vec2(1.15, 1.0)));
  col *= mix(0.82, 1.0, vig);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * (1.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`

type Vec3 = [number, number, number]
type State = {
  skyTop: Vec3; skyHorizon: Vec3; cloudLit: Vec3; cloudShadow: Vec3; sun: Vec3
  sunPos: [number, number]; offset: [number, number]
}

function toState(t: Tone): State {
  return {
    skyTop: hexToRgb(t.skyTop), skyHorizon: hexToRgb(t.skyHorizon), cloudLit: hexToRgb(t.cloudLit),
    cloudShadow: hexToRgb(t.cloudShadow), sun: hexToRgb(t.sun), sunPos: [t.sunPos[0], t.sunPos[1]], offset: [t.offset[0], t.offset[1]],
  }
}
function mixState(a: State, b: State, k: number): State {
  const v3 = (x: Vec3, y: Vec3): Vec3 => [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)]
  const v2 = (x: [number, number], y: [number, number]): [number, number] => [lerp(x[0], y[0], k), lerp(x[1], y[1], k)]
  return {
    skyTop: v3(a.skyTop, b.skyTop), skyHorizon: v3(a.skyHorizon, b.skyHorizon), cloudLit: v3(a.cloudLit, b.cloudLit),
    cloudShadow: v3(a.cloudShadow, b.cloudShadow), sun: v3(a.sun, b.sun), sunPos: v2(a.sunPos, b.sunPos), offset: v2(a.offset, b.offset),
  }
}

const TONE_MS = 1700
const DRIFT_MS = 2400

export function CloudSea({ tone, reducedMotion }: { tone: Tone; reducedMotion: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const target = useRef<Tone>(tone)
  const toneRef = useRef<Tone>(tone)

  useEffect(() => { target.current = tone }, [tone])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    if (!gl) { canvas.style.background = 'linear-gradient(180deg, #2A3C4A, #0D161E)'; return }
    const g = gl
    const cv = canvas

    const compile = (type: number, src: string) => {
      const s = g.createShader(type)!
      g.shaderSource(s, src); g.compileShader(s)
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) || 'shader compile failed (no log)')
      return s
    }
    const prog = g.createProgram()!
    try {
      g.attachShader(prog, compile(g.VERTEX_SHADER, VERT))
      g.attachShader(prog, compile(g.FRAGMENT_SHADER, FRAG))
      g.linkProgram(prog)
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(prog) || 'link failed')
    } catch (err) {
      // Không ném tiếp: mất nền mây thì trang vẫn phải đọc được. Nhưng phải nói lý do.
      console.error('[CloudSea] không dựng được shader, rơi về gradient:', err)
      cv.style.background = 'linear-gradient(180deg, #2A3C4A, #0D161E)'
      return
    }
    g.useProgram(prog)
    const buf = g.createBuffer()
    g.bindBuffer(g.ARRAY_BUFFER, buf)
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW)
    const loc = g.getAttribLocation(prog, 'a')
    g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)
    const U = (n: string) => g.getUniformLocation(prog, n)
    const u = {
      res: U('uRes'), time: U('uTime'), offset: U('uOffset'), skyTop: U('uSkyTop'), skyHorizon: U('uSkyHorizon'),
      cloudLit: U('uCloudLit'), cloudShadow: U('uCloudShadow'), sun: U('uSun'), sunPos: U('uSunPos'), horizon: U('uHorizon'),
    }

    // Trạng thái tween: from → to, hai đồng hồ riêng cho tone và vùng mây.
    let from = toState(toneRef.current)
    let to = from
    let toneStart = 0, driftStart = 0
    let fromOffset = from.offset, toOffset = from.offset
    let current = from

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5) * 0.8
      const w = Math.floor(cv.clientWidth * dpr), h = Math.floor(cv.clientHeight * dpr)
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; g.viewport(0, 0, w, h) }
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas)

    let raf = 0
    let visible = true
    const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) raf = requestAnimationFrame(frame) }
    document.addEventListener('visibilitychange', onVis)

    const t0 = performance.now()
    function frame(now: number) {
      if (!visible) return
      const tgt = target.current
      if (tgt !== toneRef.current) {
        // Bắt đầu tween từ trạng thái ĐANG hiển thị, không từ palette cũ —
        // đổi màn giữa chừng thì không giật.
        from = current
        to = toState(tgt)
        toneStart = now
        fromOffset = current.offset; toOffset = to.offset
        driftStart = now
        toneRef.current = tgt
      }
      const kt = reducedMotion ? 1 : easeInOutCubic(clamp01((now - toneStart) / TONE_MS))
      const kd = reducedMotion ? 1 : easeInOutCubic(clamp01((now - driftStart) / DRIFT_MS))
      current = mixState(from, to, kt)
      current.offset = [lerp(fromOffset[0], toOffset[0], kd), lerp(fromOffset[1], toOffset[1], kd)]

      const time = reducedMotion ? 0 : (now - t0) / 1000
      g.uniform2f(u.res, cv.width, cv.height)
      g.uniform1f(u.time, time)
      g.uniform2f(u.offset, current.offset[0], current.offset[1])
      g.uniform3fv(u.skyTop, current.skyTop); g.uniform3fv(u.skyHorizon, current.skyHorizon)
      g.uniform3fv(u.cloudLit, current.cloudLit); g.uniform3fv(u.cloudShadow, current.cloudShadow)
      g.uniform3fv(u.sun, current.sun); g.uniform2f(u.sunPos, current.sunPos[0], current.sunPos[1])
      g.uniform1f(u.horizon, 0.56)
      g.drawArrays(g.TRIANGLES, 0, 3)

      const settled = kt >= 1 && kd >= 1
      if (!(reducedMotion && settled)) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis)
      // KHÔNG loseContext ở đây: StrictMode mount hai lần và getContext trả
      // lại đúng context đã mất — mọi shader compile sau đó hỏng với log rỗng.
    }
  }, [reducedMotion])

  return <canvas ref={ref} className="sky" aria-hidden="true" />
}
