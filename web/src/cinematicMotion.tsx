import {useEffect,useRef} from 'react';
type MotionMode='thinking'|'rendering'|'queued'|'paused'|'ready';

/** Decorative motion. State/progress are always passed from the existing job. */
export function MotionEmblem({mode,progress}:{mode:MotionMode;progress?:number}){
 const amount=Math.max(0,Math.min(100,Number.isFinite(progress)?Number(progress):0));
 return <span className={'motion-emblem motion-'+mode} aria-hidden="true">
  <svg className="motion-orbit" viewBox="0 0 44 44">
   <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="1.5"/>
   <circle className="motion-trace" cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" pathLength="100" strokeDasharray={mode==='rendering'?amount+' 100':mode==='ready'?'100 0':'24 76'}/>
  </svg>
  <img src="/galingtosh-icon.webp" alt="" draggable={false}/>
 </span>;
}

/** A single lightweight WebGL scene. No network dependencies, no input interception.
 * The short scene rests after its introduction, and never blocks authentication. */
export function CinematicStage(){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=canvasRef.current;
  if(!canvas||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});
  if(!gl)return;
  const vertex=gl.createShader(gl.VERTEX_SHADER),fragment=gl.createShader(gl.FRAGMENT_SHADER),program=gl.createProgram(),buffer=gl.createBuffer();
  if(!vertex||!fragment||!program||!buffer){
   if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);return;
  }
  const dispose=()=>{gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);};
  gl.shaderSource(vertex,`
   attribute vec2 a_point;
   uniform vec4 u_orbit;
   uniform float u_aspect;
   void main(){
    float x=a_point.x*u_orbit.x;
    float y=a_point.y*u_orbit.x*cos(u_orbit.y);
    float z=a_point.y*u_orbit.x*sin(u_orbit.y);
    float c=cos(u_orbit.z),s=sin(u_orbit.z);
    vec2 p=vec2(x*c-y*s,x*s+y*c);
    float perspective=1.0/(1.0+z*0.38);
    gl_Position=vec4(p.x*perspective/u_aspect,p.y*perspective,0.0,1.0);
   }`);
  gl.shaderSource(fragment,`
   precision mediump float;
   uniform vec4 u_color;
   void main(){gl_FragColor=u_color;}`);
  gl.compileShader(vertex);gl.compileShader(fragment);
  if(!gl.getShaderParameter(vertex,gl.COMPILE_STATUS)||!gl.getShaderParameter(fragment,gl.COMPILE_STATUS)){dispose();return;}
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){dispose();return;}
  const point=gl.getAttribLocation(program,'a_point'),orbit=gl.getUniformLocation(program,'u_orbit'),aspect=gl.getUniformLocation(program,'u_aspect'),color=gl.getUniformLocation(program,'u_color');
  if(point<0||!orbit||!aspect||!color){dispose();return;}
  const count=128,points=new Float32Array(count*2);
  for(let i=0;i<count;i++){const a=i*2*Math.PI/count;points[2*i]=Math.cos(a);points[2*i+1]=Math.sin(a);}
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);
  gl.useProgram(program);gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  let raf=0,start=0,elapsed=0,ended=false,lost=false;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const draw=(t:number)=>{
   if(lost)return;
   const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
   const dpr=Math.min(window.devicePixelRatio||1,1.5,720/w);
   const pw=Math.max(1,Math.round(w*dpr)),ph=Math.max(1,Math.round(h*dpr));
   if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
   gl.viewport(0,0,pw,ph);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(aspect,w/h);
   const ease=1-Math.pow(1-Math.min(1,t/1.65),3);
   for(let i=0;i<5;i++){
    const radius=(.46+i*.115)*(.68+.32*ease);
    gl.uniform4f(orbit,radius,.34+i*.24+.16*Math.sin(t*.65+i),i*1.16+t*(.27+i*.07),0);
    gl.uniform4f(color,.64+i*.045,.30+i*.045,1,.35+i*.07);
    gl.drawArrays(gl.LINE_LOOP,0,count);
   }
  };
  const tick=(now:number)=>{raf=0;if(lost||document.hidden||reduced.matches)return;
   if(!start)start=now-elapsed;elapsed=Math.min(4100,now-start);draw(elapsed/1000);
   if(elapsed<4100)raf=requestAnimationFrame(tick);else ended=true;
  };
  const stop=()=>{if(raf)cancelAnimationFrame(raf);raf=0;start=0;};
  const resume=()=>{if(!raf&&!ended&&!lost&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(tick);};
  const visibility=()=>{if(document.hidden)stop();else resume();};
  const preference=()=>{if(reduced.matches){stop();gl.clear(gl.COLOR_BUFFER_BIT);}else{draw(elapsed/1000);resume();}};
  const resize=()=>{if(!reduced.matches)draw(elapsed/1000);};
  const contextLost=()=>{lost=true;stop();};
  canvas.addEventListener('webglcontextlost',contextLost);document.addEventListener('visibilitychange',visibility);
  reduced.addEventListener('change',preference);window.addEventListener('resize',resize);
  draw(0);resume();
  return()=>{stop();canvas.removeEventListener('webglcontextlost',contextLost);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);window.removeEventListener('resize',resize);dispose();};
 },[]);
 return <div className="auth-cinema-stage motion-stage" aria-hidden="true">
  <div className="motion-stage-light"/>
  <div className="motion-stage-grid"/>
  <canvas ref={canvasRef} className="motion-stage-canvas"/>
  <div className="motion-stage-emblem"><img src="/galingtosh-icon.webp" alt="" draggable={false}/></div>
  <div className="motion-stage-title">GALINGTOSH <span> / </span> STUDIO CRÉATIF</div>
  <div className="motion-stage-footer"><span>01 · IDÉE</span><i/><span>02 · SCÉNARIO</span><i/><span>03 · FILM</span></div>
 </div>;
}
