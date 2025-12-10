import React, { useMemo, useRef, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, PerspectiveCamera, ContactShadows, SoftShadows } from '@react-three/drei';
import * as THREE from 'three';
import { ConnectedFoldingWall } from './FoldStrip';
import { HandController } from './HandController';

interface Scene3DProps {
  imageSrc: string;
  onReset: () => void;
}

// Inner component to handle Screenshot Logic via useThree
const ScreenshotHandler = ({ onSaveRef }: { onSaveRef: React.MutableRefObject<() => void> }) => {
    const { gl, scene, camera } = useThree();
    
    onSaveRef.current = useCallback(() => {
        gl.render(scene, camera);
        const screenshot = gl.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.setAttribute('download', 'folding-selfie-art.png');
        link.setAttribute('href', screenshot);
        link.click();
    }, [gl, scene, camera]);
    
    return null;
}

export const Scene3D: React.FC<Scene3DProps> = ({ imageSrc, onReset }) => {
  const texture = useMemo(() => {
    const t = new THREE.TextureLoader().load(imageSrc);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [imageSrc]);

  // Shared Ref for control data (performance optimization)
  // compression: 0 (flat) - 1 (folded)
  // tiltX/Y: -1 to 1
  const controlRef = useRef({ compression: 0.0, tiltX: 0, tiltY: 0 });
  const saveActionRef = useRef<() => void>(() => {});

  const handleHandUpdate = (data: { compression: number; x: number; y: number; isTracking: boolean }) => {
      if (data.isTracking) {
        controlRef.current.compression = data.compression;
        controlRef.current.tiltX = data.x;
        controlRef.current.tiltY = data.y;
      } else {
        // When hand tracking is lost, reset these values to 0.
        // This ensures the "effectiveCompression" in FoldStrip becomes purely determined by the Mouse.
        // If we didn't reset, the wall might get stuck in a "folded" state from the last known hand position.
        controlRef.current.compression = 0;
        controlRef.current.tiltX = 0;
        controlRef.current.tiltY = 0;
      }
  };

  return (
    <div className="relative w-full h-full bg-zinc-900">
      {/* Hand Tracking Controller (Outside Canvas) */}
      <HandController onUpdate={handleHandUpdate} />

      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 14]} fov={45} />
        <ScreenshotHandler onSaveRef={saveActionRef} />
        
        <color attach="background" args={['#050505']} />
        
        <SoftShadows size={15} samples={10} focus={0} />

        <ambientLight intensity={0.4} />
        
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={2} 
          castShadow 
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
        >
          <orthographicCamera attach="shadow-camera" args={[-10, 10, 10, -10]} />
        </directionalLight>

        <spotLight position={[-10, 0, -5]} intensity={5} color="#6366f1" angle={0.5} penumbra={1} />
        <spotLight position={[10, 0, -5]} intensity={5} color="#ec4899" angle={0.5} penumbra={1} />

        <ConnectedFoldingWall 
          texture={texture}
          width={16}
          height={10}
          strips={32} 
          controlRef={controlRef}
        />
        
        <ContactShadows 
          resolution={1024} 
          scale={50} 
          blur={3} 
          opacity={0.7} 
          far={10} 
          color="#000000" 
          position={[0, -6, 0]}
        />
        
        <Environment preset="city" blur={0.8} />
        
        {/* OrbitControls enables zoom but rotation is handled by our custom logic (Hand/Mouse) */}
        <OrbitControls 
          enableZoom={true} 
          minDistance={8} 
          maxDistance={25}
          maxPolarAngle={Math.PI / 1.5}
          minPolarAngle={Math.PI / 3}
          enableRotate={false} 
          enablePan={false}
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Overlay UI */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-10">
        <div className="text-white">
          <h2 className="text-xl font-bold uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-br from-white to-zinc-500">
            Folding Reality
          </h2>
          <div className="mt-2 space-y-1">
             <p className="text-xs text-zinc-400 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
               Open Hand / Center Mouse: Unfold
             </p>
             <p className="text-xs text-zinc-400 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
               Fist / Side Mouse: Fold & Compress
             </p>
             <p className="text-xs text-zinc-400 flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-white/50"></span>
               Move Hand / Mouse: Rotate View
             </p>
          </div>
        </div>
        
        <div className="flex gap-4 pointer-events-auto">
            <button 
                onClick={() => saveActionRef.current()}
                className="group px-6 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 backdrop-blur-md border border-indigo-500/50 rounded-full text-xs font-bold uppercase tracking-widest text-indigo-200 transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Save Art
            </button>
            <button 
            onClick={onReset}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-xs font-bold uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
            New Capture
            </button>
        </div>
      </div>
    </div>
  );
};