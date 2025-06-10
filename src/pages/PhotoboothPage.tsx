import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Download, Send, X, RefreshCw } from 'lucide-react';
import { useCollageStore, Photo } from '../store/collageStore';
import Layout from '../components/layout/Layout';

type VideoDevice = {
  deviceId: string;
  label: string;
};

type CameraState = 'idle' | 'starting' | 'active' | 'error';

const PhotoboothPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isInitializingRef = useRef(false);
  
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  
  const { currentCollage, fetchCollageByCode, uploadPhoto, setupRealtimeSubscription, cleanupRealtimeSubscription } = useCollageStore();

  const cleanupCamera = useCallback(() => {
    console.log('🧹 Cleaning up camera...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }
    
    setCameraState('idle');
  }, []);

  const getVideoDevices = useCallback(async (): Promise<VideoDevice[]> => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId}`
        }));
      
      console.log('📹 Available video devices:', videoDevices);
      return videoDevices;
    } catch (error) {
      console.warn('⚠️ Could not enumerate devices:', error);
      return [];
    }
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    // Prevent multiple simultaneous initializations
    if (isInitializingRef.current) {
      console.log('🔄 Camera initialization already in progress, skipping...');
      return;
    }

    console.log('🎥 Starting camera initialization with device:', deviceId);
    isInitializingRef.current = true;
    setCameraState('starting');
    setError(null);

    try {
      // Clean up any existing camera first
      cleanupCamera();

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Detect platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = isIOS || isAndroid;
      
      console.log('📱 Platform detected:', { isIOS, isAndroid, isMobile });
      
      // Build constraints based on platform
      let constraints: MediaStreamConstraints;
      
      if (deviceId) {
        constraints = {
          video: {
            deviceId: { exact: deviceId },
            ...(isMobile ? { facingMode: "user" } : {}),
            ...(isIOS ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            } : {})
          },
          audio: false
        };
      } else {
        constraints = {
          video: isMobile ? { facingMode: "user" } : true,
          audio: false
        };
      }
      
      console.log('🔧 Using constraints:', constraints);
      
      // Get user media
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Got media stream:', mediaStream.active);
      
      // Update devices list after getting permission
      const videoDevices = await getVideoDevices();
      setDevices(videoDevices);
      
      // Auto-select front camera on mobile if not already selected
      if (!selectedDevice && videoDevices.length > 0 && isMobile) {
        const frontCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('front') ||
          device.label.toLowerCase().includes('user') ||
          device.label.toLowerCase().includes('selfie') ||
          device.label.toLowerCase().includes('facetime')
        );
        
        if (frontCamera) {
          console.log('📱 Auto-selecting front camera:', frontCamera.label);
          setSelectedDevice(frontCamera.deviceId);
        } else {
          setSelectedDevice(videoDevices[0].deviceId);
        }
      }
      
      // Set up video element
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }
      
      const video = videoRef.current;
      
      // Configure video element
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.controls = false;
      
      if (isIOS) {
        video.setAttribute('webkit-playsinline', 'true');
        video.setAttribute('playsinline', 'true');
      }
      
      // Set media stream
      video.srcObject = mediaStream;
      
      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('⏰ Video load timeout, but continuing anyway');
          resolve(); // Don't reject on timeout for mobile compatibility
        }, 10000);
        
        const handleLoadedMetadata = () => {
          console.log('📐 Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('error', handleError);
          resolve();
        };
        
        const handleError = (e: any) => {
          console.error('❌ Video error:', e);
          clearTimeout(timeout);
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('error', handleError);
          reject(new Error(`Video failed to load: ${e.message || 'Unknown error'}`));
        };
        
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('error', handleError);
        
        // Check if already loaded
        if (video.readyState >= 1) {
          handleLoadedMetadata();
        }
      });
      
      // Try to play video
      try {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        console.log('▶️ Video playing successfully');
      } catch (playError) {
        console.warn('⚠️ Video play failed (common on mobile):', playError);
        // Don't fail completely on mobile play errors
      }
      
      // Success!
      streamRef.current = mediaStream;
      setCameraState('active');
      setError(null);
      console.log('🎉 Camera initialization complete');
      
    } catch (err: any) {
      console.error('❌ Camera initialization failed:', err);
      
      let errorMessage = 'Failed to access camera';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera access and refresh the page.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please check your camera and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is busy. Please close other apps using the camera and try again.';
      } else if (err.name === 'OverconstrainedError') {
        // Try fallback constraints
        try {
          console.log('🔄 Trying fallback constraints...');
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, 
            audio: false 
          });
          
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
            streamRef.current = fallbackStream;
            setCameraState('active');
            setError(null);
            console.log('✅ Fallback camera working');
            return;
          }
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          errorMessage = 'Camera not compatible with this device.';
        }
      } else {
        errorMessage = `Camera error: ${err.message}`;
      }
      
      setError(errorMessage);
      setCameraState('error');
      cleanupCamera();
    } finally {
      isInitializingRef.current = false;
    }
  }, [cleanupCamera, getVideoDevices, selectedDevice]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || cameraState !== 'active') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Get original video dimensions
    const originalWidth = video.videoWidth;
    const originalHeight = video.videoHeight;
    
    // Calculate portrait crop dimensions (9:16 aspect ratio)
    const targetAspectRatio = 9 / 16;
    let cropWidth, cropHeight, cropX, cropY;
    
    const currentAspectRatio = originalWidth / originalHeight;
    
    if (currentAspectRatio > targetAspectRatio) {
      // Image is too wide, crop width to fit portrait
      cropHeight = originalHeight;
      cropWidth = cropHeight * targetAspectRatio;
      cropX = (originalWidth - cropWidth) / 2;
      cropY = 0;
    } else {
      // Image is already portrait or square, crop height if needed
      cropWidth = originalWidth;
      cropHeight = cropWidth / targetAspectRatio;
      cropX = 0;
      cropY = Math.max(0, (originalHeight - cropHeight) / 2);
    }
    
    // Set canvas to portrait dimensions
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw cropped video frame
    context.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

    // Add text if present
    if (text.trim()) {
      const textAreaHeight = cropHeight * 0.33;
      const textAreaStart = cropHeight * 0.67;
      const padding = textAreaHeight * 0.1;
      const availableHeight = textAreaHeight - (padding * 2);
      const maxTextWidth = cropWidth * 0.9;
      
      context.fillStyle = 'white';
      context.strokeStyle = 'black';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = 'rgba(0, 0, 0, 0.8)';
      context.shadowOffsetX = 3;
      context.shadowOffsetY = 3;
      
      let fontSize = Math.min(cropWidth, cropHeight) * 0.08;
      fontSize = Math.max(fontSize, 20);
      
      const wrapTextAtFontSize = (text: string, size: number): string[] => {
        context.font = `900 ${size}px Arial, sans-serif`;
        const words = text.split(' ');
        let wrappedLines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const testWidth = context.measureText(testLine).width;
          
          if (testWidth <= maxTextWidth || currentLine === '') {
            currentLine = testLine;
          } else {
            if (currentLine) wrappedLines.push(currentLine);
            currentLine = word;
          }
        }
        
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
        
        return wrappedLines;
      };
      
      const allTextFits = (text: string, size: number): boolean => {
        const lines = wrapTextAtFontSize(text, size);
        if (lines.length > 2) return false;
        
        const lineHeight = size * 1.4;
        const totalTextHeight = lines.length * lineHeight;
        return totalTextHeight <= availableHeight;
      };
      
      let finalFontSize = fontSize;
      for (let testSize = fontSize; testSize >= 15; testSize -= 1) {
        if (allTextFits(text, testSize)) {
          finalFontSize = testSize;
          break;
        }
      }
      
      let lines = wrapTextAtFontSize(text, finalFontSize);
      
      if (lines.length > 2) {
        lines = lines.slice(0, 2);
        if (lines.length === 2) {
          const secondLine = lines[1];
          const words = secondLine.split(' ');
          if (context.measureText(secondLine + '...').width > maxTextWidth) {
            while (words.length > 0 && context.measureText(words.join(' ') + '...').width > maxTextWidth) {
              words.pop();
            }
            lines[1] = words.join(' ') + '...';
          }
        }
      }
      
      context.font = `900 ${finalFontSize}px Arial, sans-serif`;
      context.lineWidth = Math.max(2, finalFontSize * 0.05);
      context.shadowBlur = finalFontSize * 0.1;
      
      const lineHeight = finalFontSize * 1.4;
      const totalTextHeight = lines.length * lineHeight;
      const textStartY = textAreaStart + padding + (availableHeight - totalTextHeight) / 2;
      
      lines.forEach((line, index) => {
        const textY = textStartY + (lineHeight / 2) + (index * lineHeight);
        const textX = cropWidth / 2;
        
        context.strokeText(line, textX, textY);
        context.fillText(line, textX, textY);
      });
      
      // Reset shadow
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    setPhoto(dataUrl);
    
    // Stop camera after taking photo to free up resources
    cleanupCamera();
  }, [text, cameraState, cleanupCamera]);

  const uploadToCollage = useCallback(async () => {
    if (!photo || !currentCollage) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(photo);
      const blob = await response.blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      const result = await uploadPhoto(currentCollage.id, file);
      if (result) {        
        // Reset state
        setPhoto(null);
        setText('');
        
        // Show success message
        setError('Photo uploaded successfully! Your photo will appear in the collage automatically.');
        setTimeout(() => setError(null), 3000);
        
        // Restart camera after a brief delay
        setTimeout(() => {
          console.log('🔄 Restarting camera after upload...');
          startCamera(selectedDevice);
        }, 500);
        
      } else {
        throw new Error('Failed to upload photo');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }, [photo, currentCollage, uploadPhoto, startCamera, selectedDevice]);

  const downloadPhoto = useCallback(() => {
    if (!photo) return;
    const link = document.createElement('a');
    link.href = photo;
    link.download = 'photobooth.jpg';
    link.click();
  }, [photo]);

  const retakePhoto = useCallback(() => {
    setPhoto(null);
    setText('');
    
    // Restart camera immediately
    setTimeout(() => {
      console.log('🔄 Restarting camera after retake...');
      startCamera(selectedDevice);
    }, 100);
  }, [startCamera, selectedDevice]);

  const handleDeviceChange = useCallback((newDeviceId: string) => {
    if (newDeviceId === selectedDevice) return;
    
    setSelectedDevice(newDeviceId);
    
    // Only restart camera if we're currently showing the camera view
    if (!photo && cameraState !== 'starting') {
      console.log('📱 Device changed, restarting camera...');
      startCamera(newDeviceId);
    }
  }, [selectedDevice, photo, cameraState, startCamera]);

  const switchCamera = useCallback(() => {
    if (devices.length <= 1) return;
    
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    handleDeviceChange(devices[nextIndex].deviceId);
  }, [devices, selectedDevice, handleDeviceChange]);

  // Load collage on mount
  useEffect(() => {
    if (code) {
      fetchCollageByCode(code);
    }
  }, [code, fetchCollageByCode]);

  // Setup realtime subscription when collage is loaded
  useEffect(() => {
    if (currentCollage?.id) {
      console.log('🔄 Setting up realtime subscription in photobooth for collage:', currentCollage.id);
      setupRealtimeSubscription(currentCollage.id);
    }
    
    return () => {
      cleanupRealtimeSubscription();
    };
  }, [currentCollage?.id, setupRealtimeSubscription, cleanupRealtimeSubscription]);

  // Initialize camera when component mounts and when returning from photo view
  useEffect(() => {
    if (!photo && cameraState === 'idle' && !isInitializingRef.current) {
      console.log('🚀 Initializing camera...');
      const timer = setTimeout(() => {
        startCamera(selectedDevice);
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [photo, cameraState, startCamera, selectedDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      cleanupCamera();
    };
  }, [cleanupCamera]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('👁️ Page hidden, stopping camera...');
        cleanupCamera();
      } else if (!document.hidden && !photo && cameraState === 'idle') {
        console.log('👁️ Page visible, restarting camera...');
        setTimeout(() => startCamera(selectedDevice), 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [photo, cameraState, startCamera, selectedDevice, cleanupCamera]);

  if (!currentCollage) {
    return (
      <Layout>
        <div className="min-h-[calc(100vh-160px)] flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading collage...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return (
    <Layout>
      <div className="max-w-lg mx-auto px-4 py-3">
        <div className="mb-3">
          <h1 className="text-lg font-bold text-white mb-1">
            {currentCollage.name}
          </h1>
          <p className="text-gray-400 text-xs">
            Take a photo to add to the collage
          </p>
        </div>

        {error && (
          <div className={`mb-3 p-2 rounded text-xs whitespace-pre-line ${
            error.includes('successfully') 
              ? 'bg-green-500/20 border border-green-500/50 text-green-200' 
              : 'bg-red-500/20 border border-red-500/50 text-red-200'
          }`}>
            {error}
            {error.includes('Camera is busy') && (
              <div className="mt-1">
                <button
                  onClick={() => window.location.reload()}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            )}
          </div>
        )}

        {/* Camera device selector - desktop */}
        {!isMobile && devices.length > 1 && (
          <div className="mb-2">
            <select
              value={selectedDevice}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs"
            >
              <option value="">Select Camera</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mobile camera flip button */}
        {isMobile && devices.length > 1 && !photo && (
          <div className="mb-2 flex justify-center">
            <button
              onClick={switchCamera}
              disabled={cameraState === 'starting'}
              className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-xs hover:bg-white/20 transition-colors flex items-center gap-2 disabled:opacity-50"
              title="Switch Camera"
            >
              <RefreshCw className="w-4 h-4" />
              Flip Camera
            </button>
          </div>
        )}

        <div className="bg-black rounded-lg overflow-hidden aspect-[9/16] relative md:max-h-[70vh] max-h-[85vh]">
          {!photo ? (
            <>
              {cameraState === 'starting' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent mx-auto mb-2"></div>
                    <p className="text-white text-xs">Starting camera...</p>
                  </div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls={false}
                  className="w-full h-full object-cover"
                />
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add text to your photo..."
                  className="w-full mb-2 px-2 py-1 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400 text-xs"
                  maxLength={120}
                />
                <div className="flex gap-2">
                  <button
                    onClick={takePhoto}
                    disabled={cameraState !== 'active'}
                    className="flex-1 flex items-center justify-center px-2 py-2 bg-white text-black rounded hover:bg-gray-100 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </button>
                  <button
                    onClick={() => startCamera(selectedDevice)}
                    disabled={cameraState === 'starting'}
                    className="px-2 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
                    title="Refresh Camera"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <img
                src={photo}
                alt="Photo preview with text"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={retakePhoto}
                    className="flex items-center justify-center px-2 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Retake
                  </button>
                  <button
                    onClick={downloadPhoto}
                    className="flex items-center justify-center px-2 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs"
                    title="Download"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={uploadToCollage}
                    disabled={uploading}
                    className="flex items-center justify-center px-2 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 text-xs font-semibold"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Send className="w-3 h-3 mr-1" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="mt-2 p-2 bg-white/5 rounded border border-white/10">
          <p className="text-gray-300 text-xs">
            <strong>Tips:</strong> Text automatically scales to fit. Photos are cropped to portrait (9:16).
            {cameraState === 'starting' && ' Camera is starting...'}
            {cameraState === 'error' && ' Camera error - try refresh button.'}
          </p>
        </div>

        <div className="mt-2 text-center">
          <button
            onClick={() => navigate(`/collage/${code}`)}
            className="text-purple-400 hover:text-purple-300 text-xs underline transition-colors"
          >
            View Collage →
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default PhotoboothPage;