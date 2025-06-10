// src/pages/PhotoboothPage.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Camera, SwitchCamera, Download, Upload, RotateCcw, Type, ArrowLeft, Settings } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
import { useCameraStore } from '../store/cameraStore';

const PhotoboothPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const { currentCollage, fetchCollageByCode, uploadPhoto, setupRealtimeSubscription, cleanupRealtimeSubscription } = useCollageStore();
  const { 
    videoRef, 
    canvasRef, 
    cameraState, 
    devices, 
    selectedDevice, 
    setSelectedDevice,
    startCamera, 
    cleanupCamera
  } = useCameraStore();

  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitializingRef = useRef(false);

  const switchCamera = useCallback(() => {
    if (devices.length <= 1) return;
    
    const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    handleDeviceChange(devices[nextIndex].deviceId);
  }, [devices, selectedDevice]);

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
        console.log('📱 Page hidden, pausing camera...');
      } else {
        console.log('📱 Page visible, resuming camera...');
        if (!photo && cameraState === 'idle') {
          setTimeout(() => startCamera(selectedDevice), 100);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [photo, cameraState, startCamera, selectedDevice]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || cameraState !== 'active') return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Add text overlay if provided
    if (text.trim()) {
      const fontSize = Math.min(canvas.width, canvas.height) * 0.08;
      context.font = `bold ${fontSize}px Arial`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      // Add shadow for better readability
      context.shadowColor = 'rgba(0,0,0,0.8)';
      context.shadowBlur = 4;
      context.shadowOffsetX = 2;
      context.shadowOffsetY = 2;
      
      // White text with black outline
      context.strokeStyle = 'black';
      context.lineWidth = fontSize * 0.1;
      context.fillStyle = 'white';
      
      // Split text into lines if too long
      const maxWidth = canvas.width * 0.9;
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      // Draw each line
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = (canvas.height - totalHeight) / 2 + fontSize / 2;

      lines.forEach((line, index) => {
        const textY = startY + index * lineHeight;
        const textX = canvas.width / 2;
        
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
      const file = new File([blob], 'photobooth.jpg', { type: 'image/jpeg' });

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

  if (!currentCollage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
          <p className="text-white">Loading photobooth...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="bg-black/80 backdrop-blur-sm border-b border-gray-800 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link 
              to={`/collage/${currentCollage.code}`}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">📸 Photobooth</h1>
              <p className="text-gray-400 text-sm">{currentCollage.name}</p>
            </div>
          </div>
          
          {/* Camera Controls */}
          {!photo && devices.length > 1 && (
            <button
              onClick={switchCamera}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              title="Switch Camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Error Display */}
        {error && (
          <div className={`mb-4 p-4 rounded-lg ${
            error.includes('successfully') 
              ? 'bg-green-900/30 border border-green-500/50 text-green-200'
              : 'bg-red-900/30 border border-red-500/50 text-red-200'
          }`}>
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera/Photo View */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              {photo ? (
                /* Photo Preview */
                <div className="relative">
                  <img 
                    src={photo} 
                    alt="Captured photo" 
                    className="w-full h-auto"
                  />
                  
                  {/* Photo Controls Overlay */}
                  <div className="absolute bottom-4 left-4 right-4 flex justify-center space-x-3">
                    <button
                      onClick={retakePhoto}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Retake</span>
                    </button>
                    
                    <button
                      onClick={downloadPhoto}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download</span>
                    </button>
                    
                    <button
                      onClick={uploadToCollage}
                      disabled={uploading}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Upload to Collage</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Camera View */
                <div className="relative aspect-video bg-gray-800">
                  {/* Video Element */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Camera State Overlay */}
                  {cameraState !== 'active' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center text-white">
                        {cameraState === 'starting' && (
                          <>
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                            <p>Starting camera...</p>
                          </>
                        )}
                        {cameraState === 'error' && (
                          <>
                            <Camera className="w-12 h-12 mx-auto mb-4 text-red-400" />
                            <p className="text-red-200">Camera unavailable</p>
                            <button
                              onClick={() => startCamera(selectedDevice)}
                              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                              Retry
                            </button>
                          </>
                        )}
                        {cameraState === 'idle' && (
                          <>
                            <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            <p>Camera not started</p>
                            <button
                              onClick={() => startCamera(selectedDevice)}
                              className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                            >
                              Start Camera
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Text Overlay Preview */}
                  {text.trim() && cameraState === 'active' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div 
                        className="text-white font-bold text-center px-4 py-2 bg-black/50 rounded-lg max-w-[90%]"
                        style={{ 
                          fontSize: 'clamp(1rem, 4vw, 2rem)',
                          textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                        }}
                      >
                        {text}
                      </div>
                    </div>
                  )}
                  
                  {/* Capture Button */}
                  {cameraState === 'active' && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                      <button
                        onClick={capturePhoto}
                        className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center"
                      >
                        <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {/* Hidden Canvas for Photo Processing */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>

          {/* Controls Panel */}
          <div className="space-y-6">
            {/* Text Overlay */}
            <div className="bg-gray-900 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Type className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">Add Text</h3>
              </div>
              
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Add text to your photo..."
                className="w-full h-24 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-purple-500"
                maxLength={100}
              />
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-400">
                  {text.length}/100 characters
                </span>
                {text && (
                  <button
                    onClick={() => setText('')}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Camera Settings */}
            {devices.length > 0 && (
              <div className="bg-gray-900 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Camera</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Camera
                    </label>
                    <select
                      value={selectedDevice}
                      onChange={(e) => handleDeviceChange(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      {devices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-300 mb-3">Instructions</h3>
              <ul className="text-sm text-blue-200 space-y-2">
                <li>• Position yourself in the camera view</li>
                <li>• Add optional text overlay</li>
                <li>• Click the capture button to take a photo</li>
                <li>• Upload your photo to add it to the collage</li>
                <li>• Photos appear in the collage automatically!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoboothPage;