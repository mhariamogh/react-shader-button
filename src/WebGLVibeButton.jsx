// src/WebGLVibeButton.jsx
import React, { useEffect, useRef, useState } from "react";

export default function WebGLVibeButton({
  label = "Let's go",
  hoverLabel = "1 day to go",
  width = 300,
  height = 80,
  speed,      // optional controlled
  streaks,    // optional controlled
  initialSpeed = 1.0,
  initialStreaks = 4,
  style = {},
  onClick,
}) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const bufferRef = useRef(null);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const initializedRef = useRef(false);

  // uniforms as refs (RAF reads live values)
  const isHoveredRef = useRef(false);
  const speedRef = useRef(typeof speed === "number" ? speed : initialSpeed);
  const streaksRef = useRef(typeof streaks === "number" ? streaks : initialStreaks);

  // update refs if controlled props change
  useEffect(() => { if (typeof speed === "number") speedRef.current = speed; }, [speed]);
  useEffect(() => { if (typeof streaks === "number") streaksRef.current = streaks; }, [streaks]);

  // UI label swap
  const [isHoveredUI, setIsHoveredUI] = useState(false);

  const vertexShaderSource = `
    attribute vec4 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_uv;
    void main(){ gl_Position=a_position; v_uv=a_texCoord; }
  `;

  // **Exact fragment shader from the working HTML** (glitch draws only when hovered)
  const fragmentShaderSource = `
    precision highp float;
    uniform float u_time; uniform vec2 u_resolution; uniform float u_hover; uniform float u_speed; uniform float u_streaks; varying vec2 v_uv;
    float hash(float n){ return fract(sin(n) * 43758.5453); }
    vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
    float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); float a=hash(dot(i, vec2(1.0,57.0))); float b=hash(dot(i+vec2(1.0,0.0), vec2(1.0,57.0))); float c=hash(dot(i+vec2(0.0,1.0), vec2(1.0,57.0))); float d=hash(dot(i+vec2(1.0,1.0), vec2(1.0,57.0))); return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
    float fbm(vec2 p){ float value=0.0; float amplitude=0.5; for(int i=0; i<4; i++){ value+=amplitude*noise(p); p*=2.0; amplitude*=0.5; } return value; }
    void main(){ vec2 uv=v_uv; vec3 color=vec3(0.0); if(u_hover>0.5){ float time=u_time*u_speed; float glitchFrame=floor(time*4.0); float staticNoise=noise(uv*200.0 + time*50.0); color+=vec3(staticNoise*0.05); for(int i=0;i<10;i++){ if(float(i)>=u_streaks) break; float scanY=hash(float(i)*7.23+glitchFrame)*0.8+0.1; float corruption=hash(float(i)*12.34+glitchFrame); if(corruption>0.7){ float lineThickness=0.004 + hash(corruption*100.0)*0.008; float scanLine=exp(-abs(uv.y - scanY)/lineThickness*40.0); vec3 corruptColor; if(corruption>0.95){ corruptColor=vec3(1.0,0.0,1.0);} else if(corruption>0.9){ corruptColor=vec3(0.0,1.0,0.0);} else if(corruption>0.85){ corruptColor=vec3(0.0,1.0,1.0);} else if(corruption>0.8){ corruptColor=vec3(1.0,1.0,0.0);} else { corruptColor=vec3(0.9,0.9,1.0);} color += corruptColor * scanLine * 1.5; } } float bandY=fract(uv.y*3.0 + time*0.7); float bandNoise=hash(floor(uv.y*3.0) + glitchFrame*0.5); if(bandNoise>0.8){ float displacement=(hash(bandNoise*50.0)-0.5)*0.1; vec2 displacedUV=vec2(uv.x + displacement, uv.y); color.r += hash(displacedUV.x*100.0 + glitchFrame)*0.3; color.g -= 0.1; } vec2 blockUV=floor(uv*vec2(20.0,12.0))/vec2(20.0,12.0); float blockCorrupt=hash(dot(blockUV, vec2(12.9898,78.233)) + glitchFrame); if(blockCorrupt>0.9){ vec2 blockCenter=blockUV + vec2(0.025,0.04); if(abs(uv.x-blockCenter.x)<0.05 && abs(uv.y-blockCenter.y)<0.08){ float blockIntensity=hash(blockCorrupt*200.0); if(blockIntensity>0.5){ color=vec3(blockIntensity*0.8, blockIntensity*0.3, blockIntensity*0.6);} else { color*=0.2; } } } if(hash(glitchFrame*0.2)>0.75){ float separation=hash(glitchFrame*0.3)*0.01; color.r += hash(uv.x + separation + time)*0.2; color.b += hash(uv.x - separation + time)*0.2; color.g *= 0.9; } float dropout=hash(floor(uv.y*6.0) + glitchFrame*0.7); if(dropout>0.85){ float dropoutIntensity=(dropout-0.85)*6.0; color *= (1.0 - dropoutIntensity); } float interlace=step(0.5, fract(uv.y*40.0 + time*2.0)); color *= 0.95 + interlace*0.1; float frameRoll=hash(glitchFrame*0.1); if(frameRoll>0.9){ float rollOffset=sin(time*30.0)*0.02; color *= 1.0 + rollOffset; } float interference=sin(uv.y*100.0 + time*25.0 + noise(vec2(time*2.0,0.0))*10.0); if(abs(interference)>0.7){ color += vec3(0.6,0.6,0.7) * (abs(interference)-0.7)*2.0; } float tvContrast=0.8 + sin(time*3.0)*0.2 + hash(glitchFrame*0.05)*0.3; color = pow(color*tvContrast, vec3(1.1)); color = min(color, vec3(1.5)); } gl_FragColor = vec4(color, 1.0); }
  `;

  const disposeGL = () => {
    const gl = glRef.current; if(!gl) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (bufferRef.current) gl.deleteBuffer(bufferRef.current);
    if (programRef.current) gl.deleteProgram(programRef.current);
    glRef.current=null; programRef.current=null; bufferRef.current=null; rafRef.current=null; initializedRef.current=false;
  };

  useEffect(() => {
    const canvas = canvasRef.current; if(!canvas || initializedRef.current) return; initializedRef.current = true;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const gl = canvas.getContext("webgl"); if(!gl){ console.warn("WebGL not supported"); return; }
    glRef.current = gl;

    const compile = (type, src) => { const sh=gl.createShader(type); gl.shaderSource(sh,src); gl.compileShader(sh); if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){ const err=gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error(err);} return sh; };
    const vsh = compile(gl.VERTEX_SHADER, vertexShaderSource);
    const fsh = compile(gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram(); gl.attachShader(program, vsh); gl.attachShader(program, fsh); gl.linkProgram(program); if(!gl.getProgramParameter(program, gl.LINK_STATUS)){ throw new Error(gl.getProgramInfoLog(program)); }
    programRef.current = program;

    const aPos = gl.getAttribLocation(program, "a_position");
    const aUV = gl.getAttribLocation(program, "a_texCoord");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uHover = gl.getUniformLocation(program, "u_hover");
    const uSpeed = gl.getUniformLocation(program, "u_speed");
    const uStreaks = gl.getUniformLocation(program, "u_streaks");

    const positions = new Float32Array([
      -1,-1,0,0,
       1,-1,1,0,
      -1, 1,0,1,
       1, 1,1,1,
    ]);
    const buf = gl.createBuffer(); bufferRef.current = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    gl.viewport(0,0,canvas.width,canvas.height);
    startedAtRef.current = Date.now();

    const render = () => {
      const time = (Date.now() - startedAtRef.current) * 0.001;
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(aUV);  gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uHover, isHoveredRef.current ? 1.0 : 0.0);
      gl.uniform1f(uSpeed, speedRef.current);
      gl.uniform1f(uStreaks, streaksRef.current);
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => { disposeGL(); };
  }, [width, height]);

  const containerStyle = {
    position: "relative",
    width: `${width}px`,
    height: `${height}px`,
    background: "#000",
    borderRadius: 20,
    border: "1px solid #333",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.3)",
    cursor: "pointer",
    overflow: "hidden",
    transition: "transform 0.2s ease",
    ...style,
  };

  const canvasStyle = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 20 };
  const labelStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "white", fontSize: 24, fontWeight: 600, pointerEvents: "none", zIndex: 2, textShadow: "0 1px 3px rgba(0,0,0,0.5)" };

  return (
    <div
      style={containerStyle}
      onMouseEnter={() => { isHoveredRef.current = true; setIsHoveredUI(true); }}
      onMouseLeave={() => { isHoveredRef.current = false; setIsHoveredUI(false); }}
      onClick={onClick}
    >
      <canvas ref={canvasRef} style={canvasStyle} width={width} height={height} />
      <div style={labelStyle}>{isHoveredUI ? hoverLabel : label}</div>
    </div>
  );
}