import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const THICKNESS = 30;
const GAME_DURATION = 60;
const TARGET_INTERVAL = 10;
const BALL_SPAWN_INTERVAL = 1500; // ms

const BONE_PAIRS = [
  [7, 8], [7, 11], [8, 12],     // Tête (oreilles) et cou
  [11, 12],                     // Épaules
  [11, 13], [13, 15],           // Bras gauche
  [12, 14], [14, 16]            // Bras droit
];

interface GameScreenProps {
  onGameOver: (score: number) => void;
}

export default function GameScreen({ onGameOver }: GameScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [loadingMsg, setLoadingMsg] = useState("Accès à la caméra...");
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const timeLeftRef = useRef(GAME_DURATION);
  
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const targetRef = useRef<Matter.Body | null>(null);
  const bonesRef = useRef<Matter.Body[]>([]);
  
  const reqRef = useRef<number>(0);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const lastVideoTimeRef = useRef(-1);
  
  const targetTimerRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const ballSpawnTimerRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function initGame() {
      try {
        // 1. Get Camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" }
        });
        
        if (!active) return;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            videoRef.current!.onloadedmetadata = () => {
              videoRef.current!.play();
              resolve(true);
            };
          });
        }
        
        setLoadingMsg("Chargement de l'Intelligence Artificielle...");

        // 2. Load MediaPipe
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        if (!active) return;

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 2,
        });
        
        if (!active) return;
        landmarkerRef.current = landmarker;
        setLoadingMsg("");

        // 3. Setup Matter.js
        if (!containerRef.current || !canvasRef.current || !videoRef.current) return;
        
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;

        const engine = Matter.Engine.create();
        // Lower gravity for floatier balls
        engine.gravity.y = 0.5;
        engineRef.current = engine;
        
        const render = Matter.Render.create({
          canvas: canvasRef.current,
          engine: engine,
          options: {
            width,
            height,
            wireframes: false,
            background: 'transparent'
          }
        });
        renderRef.current = render;

        // Static bounds (walls)
        Matter.World.add(engine.world, [
          Matter.Bodies.rectangle(width / 2, height + 50, width * 2, 100, { isStatic: true, label: 'bottom_wall' }),
          Matter.Bodies.rectangle(-50, height / 2, 100, height * 2, { isStatic: true }),
          Matter.Bodies.rectangle(width + 50, height / 2, 100, height * 2, { isStatic: true })
        ]);

        // Create target
        const target = Matter.Bodies.circle(width / 2, height / 2, 80, {
          isStatic: true,
          isSensor: true,
          label: 'target',
          render: { fillStyle: 'rgba(190, 242, 100, 0.1)', strokeStyle: '#bef264', lineWidth: 4 }
        });
        targetRef.current = target;
        Matter.World.add(engine.world, target);

        // Create bones pool
        const bones: Matter.Body[] = [];
        for(let i=0; i<24; i++) { // 12 bones * 2 people
          const bone = Matter.Bodies.rectangle(-1000, -1000, 100, THICKNESS, {
            isStatic: true,
            label: 'bone',
            render: { fillStyle: 'rgba(34, 211, 238, 0.2)', strokeStyle: '#22d3ee', lineWidth: 2 }
          });
          // use plugin object to store original unscaled length
          (bone as any).plugin.length = 100;
          bones.push(bone);
        }
        bonesRef.current = bones;
        Matter.World.add(engine.world, bones);

        // Score logic
        Matter.Events.on(engine, 'collisionStart', (event) => {
          event.pairs.forEach((pair) => {
            const { bodyA, bodyB } = pair;
            let ballBody: Matter.Body | null = null;
            
            if (bodyA.label === 'target' && bodyB.label === 'ball') {
              ballBody = bodyB;
            } else if (bodyB.label === 'target' && bodyA.label === 'ball') {
              ballBody = bodyA;
            }

            // Cleanup balls that hit bottom
            if (bodyA.label === 'bottom_wall' && bodyB.label === 'ball') {
              Matter.World.remove(engine.world, bodyB);
            } else if (bodyB.label === 'bottom_wall' && bodyA.label === 'ball') {
              Matter.World.remove(engine.world, bodyA);
            }

            if (ballBody) {
              Matter.World.remove(engine.world, ballBody);
              scoreRef.current += 1;
              setScore(scoreRef.current);
            }
          });
        });

        Matter.Render.run(render);
        
        lastTimeRef.current = Date.now();
        tick();

      } catch (err) {
        console.error("Game init error:", err);
        if (active) setLoadingMsg("Erreur d'accès à la caméra ou chargement de l'IA.");
      }
    }

    const moveTarget = () => {
      if (!containerRef.current || !targetRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const nx = 100 + Math.random() * (w - 200);
      const ny = 100 + Math.random() * (h - 300); // don't spawn too low
      Matter.Body.setPosition(targetRef.current, { x: nx, y: ny });
    };

    const spawnBall = () => {
      if (!containerRef.current || !engineRef.current) return;
      const w = containerRef.current.clientWidth;
      const ball = Matter.Bodies.circle(50 + Math.random() * (w - 100), -50, 30, {
        restitution: 0.9,
        friction: 0.05,
        density: 0.04,
        label: 'ball',
        render: { 
          fillStyle: '#ffffff',
          strokeStyle: '#3b82f6',
          lineWidth: 4
        }
      });
      Matter.World.add(engineRef.current.world, ball);
    };

    const tick = () => {
      if (!active) return;
      reqRef.current = requestAnimationFrame(tick);

      const now = Date.now();
      const dt = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Ensure dimensions are correct
      if (containerRef.current && canvasRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (canvasRef.current.width !== w || canvasRef.current.height !== h) {
          canvasRef.current.width = w;
          canvasRef.current.height = h;
          if (renderRef.current) {
            renderRef.current.options.width = w;
            renderRef.current.options.height = h;
          }
        }
      }

      // Physics step
      if (engineRef.current) {
        Matter.Engine.update(engineRef.current, 1000 / 60);
      }

      // Custom Timers
      targetTimerRef.current += dt;
      if (targetTimerRef.current > TARGET_INTERVAL * 1000) {
        targetTimerRef.current = 0;
        moveTarget();
      }

      ballSpawnTimerRef.current += dt;
      if (ballSpawnTimerRef.current > BALL_SPAWN_INTERVAL) {
        ballSpawnTimerRef.current = 0;
        spawnBall();
      }

      // Game Timer
      if (timeLeftRef.current > 0) {
        // use rough ms counting to update UI every second
        const newTimeLeft = GAME_DURATION - Math.floor((now - (lastTimeRef.current - dt)) / 1000); // Wait, this doesn't track properly. 
        // We probably should just store tracking variable.
      }

      // Mediapipe
      if (videoRef.current && landmarkerRef.current && videoRef.current.readyState >= 2) {
        const startTimeMs = performance.now();
        if (lastVideoTimeRef.current !== videoRef.current.currentTime) {
          lastVideoTimeRef.current = videoRef.current.currentTime;
          const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
          
          let boneIdx = 0;
          if (results.landmarks) {
             const cw = canvasRef.current?.width || window.innerWidth;
             const ch = canvasRef.current?.height || window.innerHeight;

             results.landmarks.forEach(person => {
               BONE_PAIRS.forEach(pair => {
                 if (boneIdx >= bonesRef.current.length) return;
                 const p1 = person[pair[0]];
                 const p2 = person[pair[1]];

                 // MediaPipe outputs high visibility if landmark is valid.
                 if (p1 && p2 && p1.visibility && p2.visibility && p1.visibility > 0.4 && p2.visibility > 0.4) {
                    // map to canvas (mirror X)
                    const x1 = (1 - p1.x) * cw;
                    const y1 = p1.y * ch;
                    const x2 = (1 - p2.x) * cw;
                    const y2 = p2.y * ch;
                    
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    const dist = Math.max(Math.hypot(dx, dy), 1);
                    const cx = (x1 + x2) / 2;
                    const cy = (y1 + y2) / 2;
                    const angle = Math.atan2(dy, dx);
                    
                    const b = bonesRef.current[boneIdx];
                    const p = b as any;
                    const currentLen = p.plugin.length;
                    const scaleChange = dist / currentLen;
                    
                    Matter.Body.scale(b, scaleChange, 1);
                    p.plugin.length = dist;
                    Matter.Body.setPosition(b, { x: cx, y: cy });
                    Matter.Body.setAngle(b, angle);
                    
                    boneIdx++;
                 }
               });
             });
          }

          // Move unused bones offscreen
          for(let i=boneIdx; i<bonesRef.current.length; i++) {
             Matter.Body.setPosition(bonesRef.current[i], { x: -1000, y: -1000 });
          }
        }
      }
    };

    initGame();

    return () => {
      active = false;
      cancelAnimationFrame(reqRef.current);
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current);
        if (renderRef.current) {
           Matter.Render.stop(renderRef.current);
           renderRef.current.canvas.remove();
        }
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Proper timer effect
  useEffect(() => {
    let interval = setInterval(() => {
       if (!loadingMsg) {
         timeLeftRef.current -= 1;
         setTimeLeft(timeLeftRef.current);
         if (timeLeftRef.current <= 0) {
           clearInterval(interval);
           onGameOver(scoreRef.current);
         }
       }
    }, 1000);
    return () => clearInterval(interval);
  }, [loadingMsg, onGameOver]);

  return (
    <div className="relative w-full h-full overflow-hidden" ref={containerRef}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover -scale-x-100 opacity-30 mix-blend-screen"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 w-full h-full pointer-events-none"
      />

      {loadingMsg ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#020617]/80 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_#22d3ee]" />
          <h2 className="text-xl font-mono uppercase tracking-[0.2em] text-cyan-400">{loadingMsg}</h2>
        </div>
      ) : (
        <div className="absolute top-0 inset-x-0 z-20 flex justify-between items-start p-8 pointer-events-none">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse drop-shadow-[0_0_8px_#22d3ee]"></div>
              <span className="text-xs uppercase tracking-[0.3em] text-cyan-400 font-mono">Score</span>
            </div>
            <div className="text-5xl font-bold tracking-tighter text-white drop-shadow-md">
              {score} <span className="text-lg opacity-40 font-normal">PTS</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-8 py-4 text-center shadow-lg">
              <div className="text-xs uppercase tracking-widest text-slate-400 mb-1 font-mono">Temps Restant</div>
              <div className="text-6xl font-black text-white tabular-nums tracking-tight">
                00:{timeLeft.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="mt-4 flex items-center space-x-2 bg-lime-500/10 border border-lime-500/30 px-4 py-1 rounded-full shadow-[0_0_15px_rgba(190,242,100,0.2)]">
              <div className="w-2 h-2 rounded-full bg-lime-400"></div>
              <span className="text-[10px] uppercase font-bold text-lime-400 tracking-widest">
                Capture de mouvement active
              </span>
            </div>
          </div>
          
          <div className="space-y-1 text-right opacity-0 md:opacity-100">
            <div className="flex items-center justify-end space-x-3">
              <span className="text-xs uppercase tracking-[0.3em] text-pink-400 font-mono">Joueur 2</span>
              <div className="w-3 h-3 rounded-full bg-pink-400 drop-shadow-[0_0_8px_#f472b6]"></div>
            </div>
            <div className="text-5xl font-bold tracking-tighter text-white drop-shadow-md">
               - <span className="text-lg opacity-40 font-normal">PTS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
