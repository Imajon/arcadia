import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

const MODEL_URL = 'https://vladmandic.github.io/face-api/model/';

const EXPRESSION_COLORS: Record<string, string> = {
  neutral: '#9CA3AF', // gray-400
  happy: '#00FFD1', // cyan
  sad: '#4f46e5', // indigo
  angry: '#FF3B3B', // red
  fearful: '#A855F7', // purple
  disgusted: '#10B981', // emerald
  surprised: '#F97316', // orange
};

const TECH_EMOTES: Record<string, string[]> = {
  neutral: ['SYS.IDLE', '0_0', '-_-', '///', '😐', '😶', '💭'],
  happy: ['^__^', 'SYS.JOY', ':)', '+++', '#FF', '😀', '✨', '😊', '🌟'],
  sad: ['T_T', 'ERR.SAD', ';_;', '...', '0x00', '😢', '💧', '🌧️', '💔'],
  angry: ['>_<', 'ERR.RAGE', '!!!', 'X_X', '#!', '😡', '💥', '🤬', '🔥'],
  fearful: ['O_O', 'WARN', '?!', '\\\\\\', '!0!', '😨', '⚠️', '😱', '🕸️'],
  disgusted: ['x_x', 'ERR.DSG', '~~~', '><', 'ERR', '🤢', '☣️', '🤮', '🦠'],
  surprised: ['!_!', 'SYS.ALRT', '???', 'O.O', '1x1', '😲', '⚡', '🤯', '❗️'],
};

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  scale: number;
  color: string;
  zigzagOffset: number;
}

interface Point { x: number; y: number }
interface Connection {
  expression: string;
  p1: Point;
  p2: Point;
  lastSeen: number;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export default function WebcamExpressions() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeConnectionsRef = useRef<Connection[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.load(MODEL_URL),
          faceapi.nets.faceExpressionNet.load(MODEL_URL)
        ]);
        setIsModelsLoaded(true);
      } catch (err) {
        console.error("Error loading models", err);
        setError("Failed to load AI models. Please check your internet connection.");
      }
    };
    loadModels();
  }, []);

  const startVideo = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } 
      });
      videoRef.current.srcObject = stream;
      setError(null);
    } catch (err) {
      console.error("Error accessing webcam", err);
      setError("Unable to access the camera. Please allow camera permissions.");
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsPlaying(false);
    }
  };

  const handleVideoOnPlay = () => {
    setIsPlaying(true);
    if (!videoRef.current || !canvasRef.current) return;

    const displaySize = { 
      width: videoRef.current.videoWidth, 
      height: videoRef.current.videoHeight 
    };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    const renderLoop = async () => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 }))
        .withFaceExpressions();

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = performance.now();

      // Extract faces and their expressions
      const faces = resizedDetections.map(d => {
        const sorted = Object.entries(d.expressions).sort((a, b) => b[1] - a[1]);
        const dominantExpression = sorted[0][0];
        const { x, y, width, height } = d.detection.box;
        return {
          p: { x: x + width / 2, y: y + height / 2 },
          box: { x, y, width, height },
          expression: dominantExpression
        };
      });

      // --- COLOR CLOUD (TREND) ---
      const expCounts: Record<string, number> = {};
      faces.forEach(f => {
        expCounts[f.expression] = (expCounts[f.expression] || 0) + 1;
      });

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const baseRadius = Math.max(canvas.width, canvas.height) * 0.7;
      Object.entries(expCounts).forEach(([exp, count], index) => {
        if (count === 0) return;
        const colorHEX = EXPRESSION_COLORS[exp] || '#FFFFFF';
        
        const r = parseInt(colorHEX.slice(1, 3), 16) || 255;
        const g = parseInt(colorHEX.slice(3, 5), 16) || 255;
        const b = parseInt(colorHEX.slice(5, 7), 16) || 255;
        
        const t = now / 2000 + index * Math.PI;
        const cx = canvas.width / 2 + Math.cos(t) * 100;
        const cy = canvas.height / 2 + Math.sin(t) * 100;
        
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.15 + (count * 0.05)})`);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });
      ctx.restore();

      // Highlight faces based on expression
      faces.forEach(f => {
        const color = EXPRESSION_COLORS[f.expression] || '#FFFFFF';
        
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(f.box.x, f.box.y, f.box.width, f.box.height, 16);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = color;
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`EXPRESSION: ${f.expression.toUpperCase()}`, f.box.x, f.box.y - 12);
        
        // Spawn particles for this expression
        if (Math.random() < 0.25) {
          const textOptions = TECH_EMOTES[f.expression] || ['?'];
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 3 + 1;
          particlesRef.current.push({
            id: Math.random(),
            x: f.box.x + f.box.width / 2,
            y: f.box.y + f.box.height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 100,
            maxLife: 100,
            text: textOptions[Math.floor(Math.random() * textOptions.length)],
            scale: 0.8 + Math.random() * 1.2,
            color: color,
            zigzagOffset: Math.random() * Math.PI * 2
          });
        }
      });

      // Find pairs and update connections
      for (let i = 0; i < faces.length; i++) {
        for (let j = i + 1; j < faces.length; j++) {
          if (faces[i].expression === faces[j].expression) {
            const exp = faces[i].expression;
            const p1 = faces[i].p;
            const p2 = faces[j].p;
            
            let matched = false;
            for (const conn of activeConnectionsRef.current) {
              if (conn.expression !== exp) continue;
              
              const d11 = dist(p1, conn.p1);
              const d22 = dist(p2, conn.p2);
              const d12 = dist(p1, conn.p2);
              const d21 = dist(p2, conn.p1);

              if ((d11 < 150 && d22 < 150) || (d12 < 150 && d21 < 150)) {
                conn.p1 = p1;
                conn.p2 = p2;
                conn.lastSeen = now;
                matched = true;
                break;
              }
            }
            if (!matched) {
              activeConnectionsRef.current.push({ expression: exp, p1, p2, lastSeen: now });
            }
          }
        }
      }

      // Draw fading connections
      activeConnectionsRef.current = activeConnectionsRef.current.filter(conn => now - conn.lastSeen < 10000);
      
      activeConnectionsRef.current.forEach(conn => {
        const age = now - conn.lastSeen;
        const opacity = Math.max(0, 1 - age / 10000); // 10 seconds fade
        
        ctx.save();
        const hexColor = EXPRESSION_COLORS[conn.expression] || '#FFFFFF';
        // Convert hex to rgba for opacity
        const r = parseInt(hexColor.slice(1, 3), 16) || 255;
        const g = parseInt(hexColor.slice(3, 5), 16) || 255;
        const b = parseInt(hexColor.slice(5, 7), 16) || 255;
        
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.8})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        const midX = (conn.p1.x + conn.p2.x) / 2;
        const midY = (conn.p1.y + conn.p2.y) / 2 - 40;
        ctx.moveTo(conn.p1.x, conn.p1.y);
        ctx.quadraticCurveTo(midX, midY, conn.p2.x, conn.p2.y);
        ctx.stroke();

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(conn.p1.x, conn.p1.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(conn.p2.x, conn.p2.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx + Math.sin((100 - p.life) / 10 + p.zigzagOffset) * 2;
        p.y += p.vy;
        p.life -= 1;
        return p.life > 0;
      });

      particlesRef.current.forEach(p => {
        const opacity = Math.min(1, p.life / 20); // fade out at the end
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${20 * p.scale}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      });

      // DRAW MATCH HIGHLIGHT
      const recentMatches = activeConnectionsRef.current.filter(c => now - c.lastSeen < 2000);
      if (recentMatches.length > 0) {
        const match = recentMatches[0];
        const hexColor = EXPRESSION_COLORS[match.expression] || '#FFFFFF';
        
        ctx.save();
        const r = parseInt(hexColor.slice(1, 3), 16) || 255;
        const g = parseInt(hexColor.slice(3, 5), 16) || 255;
        const b = parseInt(hexColor.slice(5, 7), 16) || 255;

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
        ctx.shadowColor = hexColor;
        ctx.shadowBlur = 50;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const scale = 1 + Math.sin(now / 150) * 0.05;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        
        // Pulsing background rect
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
        ctx.fillRect(-220, -90, 440, 180);
        
        ctx.fillStyle = hexColor;
        ctx.font = '900 80px "JetBrains Mono", monospace';
        ctx.fillText('MATCH', 0, -10);
        
        ctx.font = 'bold 24px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`[ ${match.expression.toUpperCase()} SYNC ]`, 0, 50);
        ctx.restore();
      }

      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  return (
    <div className="relative w-full h-screen bg-[#050505] text-gray-100 font-mono overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-[#0a0a0f] via-[#11111a] to-[#0a0a0f]"></div>

      {/* Main Content Area */}
      <div className="absolute inset-0 flex items-center justify-center p-12 z-10">
        <div className="relative w-full h-full border border-white/5 rounded-2xl bg-black/50 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center flex-col text-white/30 z-10 text-xs font-bold tracking-widest uppercase">
              <Camera className="w-8 h-8 mb-4 stroke-[1]" />
              <p>Camera Offline</p>
            </div>
          )}
          
          <video
            ref={videoRef}
            onPlay={handleVideoOnPlay}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${isPlaying ? 'opacity-80' : 'opacity-0'}`} 
            muted
            playsInline
            autoPlay
          />
          
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full z-20 pointer-events-none"
          />
        </div>
      </div>

      <div className="absolute top-0 left-0 p-8 flex justify-between w-full items-start z-20 pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-black tracking-tighter text-white">EMOTION_NET<span className="text-[#00FFD1]">.AI</span></h1>
          <p className="text-white/40 text-[10px] mt-1 tracking-widest uppercase">FACIAL KINSHIP MAPPING SYSTEM // BUILT-IN WEBCAM ACTIVE</p>
        </div>
        <div className="flex space-x-6 pointer-events-auto">
          <div className="text-right">
            <div className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Neural Engine</div>
            {isModelsLoaded ? (
              <div className="text-xl font-bold text-[#00FFD1] italic">READY</div>
            ) : (
              <div className="text-[10px] font-bold text-amber-500 animate-pulse mt-1">LOADING...</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] text-white/40 uppercase tracking-[0.2em]">System Status</div>
            <div className="text-xl font-bold text-white italic">{isPlaying ? 'ACTIVE' : 'IDLE'}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-red-500/90 text-white px-6 py-3 rounded text-[10px] font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(255,0,0,0.4)] backdrop-blur-md">
          {error}
        </div>
      )}

      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end z-20 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 rounded-lg flex space-x-8 pointer-events-auto">
          <div>
            <div className="text-[9px] text-[#00FFD1] uppercase font-bold mb-1">Link Decay (10s)</div>
            <div className="w-32 h-1.5 bg-gray-900 rounded-full overflow-hidden">
              <div className="w-full h-full bg-[#00FFD1] animate-[pulse_2s_ease-in-out_infinite]"></div>
            </div>
          </div>
          <div>
            <div className="text-[9px] text-white/40 uppercase mb-1">Process Threads</div>
            <div className="flex space-x-1 h-3 items-end">
              <div className="w-1 h-3 bg-[#00FFD1]"></div>
              <div className="w-1 h-3 bg-[#00FFD1]"></div>
              <div className="w-1 h-1.5 bg-gray-700"></div>
              <div className="w-1 h-1 bg-gray-700"></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2 pointer-events-auto">
          <div className="flex space-x-2">
            <button
              onClick={isPlaying ? stopVideo : startVideo}
              disabled={!isModelsLoaded}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                !isModelsLoaded ? 'opacity-50 cursor-not-allowed border border-white/20 text-white' :
                isPlaying 
                  ? 'border border-white/20 text-[#FF3B3B] hover:bg-white/5' 
                  : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
              }`}
            >
              {isPlaying ? 'Stop Camera' : 'Start Camera'}
            </button>
          </div>
          <div className="text-[9px] text-white/30 uppercase mt-2">Resolution: HD 720p // FPS: Adaptive</div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none border-[30px] border-transparent shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] z-50"></div>
    </div>
  );
}
