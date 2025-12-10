import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

interface HandControlData {
  compression: number; // 0 (flat) to 1 (folded)
  x: number; // -1 to 1
  y: number; // -1 to 1
  isTracking: boolean;
}

interface HandControllerProps {
  onUpdate: (data: HandControlData) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const setupMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        // Start Webcam
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480, facingMode: "user" } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", predictWebcam);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error initializing Hand Controller:", err);
        setLoading(false);
      }
    };

    let lastVideoTime = -1;
    
    const predictWebcam = async () => {
      if (!handLandmarker || !videoRef.current) return;
      
      const video = videoRef.current;
      
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const startTimeMs = performance.now();
        
        const results = handLandmarker.detectForVideo(video, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          
          // 1. Calculate Openness (Distance between Wrist [0] and Middle Finger Tip [12])
          // We normalize this somewhat based on hand size (Wrist to Middle Finger MCP [9])
          const wrist = landmarks[0];
          const middleTip = landmarks[12];
          const middleMcp = landmarks[9]; // Knuckle
          
          const handSize = Math.sqrt(
            Math.pow(middleMcp.x - wrist.x, 2) + Math.pow(middleMcp.y - wrist.y, 2)
          );
          
          const extension = Math.sqrt(
            Math.pow(middleTip.x - wrist.x, 2) + Math.pow(middleTip.y - wrist.y, 2)
          );
          
          // Ratio: ~1.8 is fully open, ~0.8 is closed fist (approximate)
          const ratio = extension / handSize;
          
          // Map Ratio to Compression (Closed = High Compression)
          // Open (Ratio > 1.6) -> Compression 0
          // Closed (Ratio < 1.0) -> Compression 1
          let compression = 1 - Math.max(0, Math.min(1, (ratio - 0.9) / 0.8));
          
          // 2. Calculate Position (Center of palm approx)
          // x is 0-1 (left-right), y is 0-1 (top-bottom)
          // We want -1 to 1
          // Mirror X because it's a selfie camera
          const x = (1 - landmarks[9].x) * 2 - 1; 
          const y = -(landmarks[9].y * 2 - 1); // Invert Y for standard 3D controls (Up is positive)

          onUpdate({
            compression,
            x,
            y,
            isTracking: true
          });
        } else {
            // No hand detected
            onUpdate({ compression: 0, x: 0, y: 0, isTracking: false });
        }
      }
      
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    setupMediaPipe();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      if (handLandmarker) handLandmarker.close();
      cancelAnimationFrame(animationFrameId);
    };
  }, [onUpdate]);

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
       {/* Hidden video for processing, or small preview for debug */}
       <video 
         ref={videoRef} 
         className={`w-32 h-24 object-cover rounded-lg border-2 border-indigo-500/50 opacity-50 transform -scale-x-100 ${loading ? 'hidden' : 'block'}`}
         autoPlay 
         playsInline
         muted
       />
       {loading && <div className="text-xs text-indigo-400 animate-pulse">Initializing Hand Tracking...</div>}
       {!loading && <div className="text-[10px] text-indigo-300 mt-1 bg-black/50 px-2 rounded">Hand Control Active</div>}
    </div>
  );
};