import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface FoldControlData {
    compression: number; // 0 to 1
    tiltX: number;
    tiltY: number;
}

interface ConnectedFoldingWallProps {
  texture: THREE.Texture;
  width: number;
  height: number;
  strips: number;
  controlRef: React.MutableRefObject<FoldControlData>;
}

export const ConnectedFoldingWall: React.FC<ConnectedFoldingWallProps> = ({ 
  texture, 
  width, 
  height,
  strips,
  controlRef
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport, pointer } = useThree();
  
  // Create geometry once. 
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, strips, 1);
    return geo;
  }, [width, height, strips]);

  // Store random offsets for each fold to create "inconsistent" movement
  const noiseOffsets = useMemo(() => {
    return new Float32Array(Array.from({ length: strips }, () => Math.random()));
  }, [strips]);

  // Internal state for smooth interpolation
  const currentStats = useRef({ compression: 0, tiltX: 0, tiltY: 0 });

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const geo = meshRef.current.geometry;
    const positionAttribute = geo.attributes.position;
    const time = state.clock.getElapsedTime();
    
    // --- INPUT HANDLING ---
    const targetCompression = controlRef.current.compression;
    const targetTiltX = controlRef.current.tiltX; // Hand X maps to Rotation Y
    const targetTiltY = controlRef.current.tiltY; // Hand Y maps to Rotation X

    // Smooth Interpolation (Lerp) for Hand Inputs
    currentStats.current.compression = THREE.MathUtils.lerp(currentStats.current.compression, targetCompression, 0.1);
    currentStats.current.tiltX = THREE.MathUtils.lerp(currentStats.current.tiltX, targetTiltX, 0.05);
    currentStats.current.tiltY = THREE.MathUtils.lerp(currentStats.current.tiltY, targetTiltY, 0.05);

    // --- HYBRID CONTROL LOGIC ---
    // We combine Hand and Mouse inputs using Math.max for compression.
    // This ensures that "whichever input is folding more" takes precedence.
    // If hand is flat (0), mouse (0-1) controls fully. 
    // If hand is fist (1), mouse doesn't flatten it (which makes physical sense).
    
    // Mouse X distance from center controls compression
    const mouseCompression = Math.abs(pointer.x);
    
    // Effective Compression is the stronger of the two inputs
    const effectiveCompression = Math.max(currentStats.current.compression, mouseCompression);

    // --- PHYSICS CALCULATION ---
    
    const segWidth = width / strips;
    let currentX = 0;
    const xPositions: number[] = [0];
    const zPositions: number[] = [0];
    
    for (let i = 0; i < strips; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const noise = noiseOffsets[i];
      const wave = Math.sin(time * 1.5 + i * 0.3) * 0.15;
      
      // Base calculation
      // High Compression -> Sharp Angle
      // Low Compression -> Flat
      const baseAngle = (effectiveCompression * 1.3 + wave * 0.1);
      
      // Clamp angle to prevent self-intersection visual glitches
      const angle = dir * Math.min(Math.PI / 2.05, baseAngle + (noise * 0.1 * effectiveCompression));
      
      const dx = segWidth * Math.cos(angle);
      const dz = segWidth * Math.sin(angle);
      
      currentX += dx;
      xPositions.push(currentX);
      zPositions.push(zPositions[zPositions.length - 1] + dz);
    }
    
    const totalCurrentWidth = xPositions[xPositions.length - 1];
    const offsetX = -totalCurrentWidth / 2;
    
    for (let i = 0; i <= strips; i++) {
      const x = xPositions[i] + offsetX;
      const z = zPositions[i];
      // Update top and bottom vertices for this strip boundary
      positionAttribute.setXYZ(i, x, height / 2, z);
      positionAttribute.setXYZ(i + strips + 1, x, -height / 2, z);
    }
    
    positionAttribute.needsUpdate = true;
    meshRef.current.geometry.computeBoundingSphere();
    
    // --- ROTATION CONTROL ---
    // Combine Hand Tilt and Mouse Position for rotation
    // Additive mixing allows subtle adjustments with mouse even when hand is active
    
    // Mouse Y influences Tilt X (Up/Down)
    const combinedTiltX = currentStats.current.tiltY + (pointer.y * 0.3); 
    
    // Mouse X influences Tilt Y (Left/Right) slightly
    const combinedTiltY = currentStats.current.tiltX + (pointer.x * 0.2);

    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, combinedTiltX * 0.5, 0.1);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, combinedTiltY * 0.5, 0.1);
  });

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      castShadow 
      receiveShadow
    >
      <meshStandardMaterial 
        map={texture} 
        side={THREE.DoubleSide}
        flatShading={true} 
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
};