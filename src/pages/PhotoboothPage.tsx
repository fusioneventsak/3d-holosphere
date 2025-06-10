import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, Download, Send, X, RefreshCw } from 'lucide-react';
import { useCollageStore } from '../store/collageStore';
import Layout from '../components/layout/Layout';

type VideoDevice = {
  deviceId: string;
  label: string;
};

const PhotoboothPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const { currentCollage, fetchCollageByCode, uploadPhoto } = useCollageStore();

  // Define all functions before useEffect hooks
  const startCamera = async (deviceId?: string) => {
    // Force cleanup of any existing streams
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.pause();
      }
      setStream(null);
    }

    // Also check for any lingering streams globally
    try {
      const existingStream = videoRef.current?.srcObject as MediaStream;
      if (existingStream) {
        existingStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        videoRef.current!.srcObject = null;
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    setLoading(true);
    setError(null);
    setCameraStarted(false);

    // Longer delay to ensure camera is fully released
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Check if we're on desktop or mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // For desktop, enumerate devices but use simpler constraints
      if (!isMobile) {
        // First, get all video devices for desktop too (so users can switch cameras)
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId}`
          }));
        
        setDevices(videoDevices);

        // Determine which device to use
        let targetDeviceId = deviceId;
        if (!targetDeviceId && videoDevices.length > 0) {
          targetDeviceId = videoDevices[0].deviceId;
        }

        // Try multiple constraint sets from most basic to more advanced
        const constraintSets = [
          // Most basic - just video with device if specified
          targetDeviceId 
            ? { video: { deviceId: { exact: targetDeviceId } }, audio: false }
            : { video: true, audio: false },
          // Basic with resolution preference
          targetDeviceId 
            ? { 
                video: { 
                  deviceId: { exact: targetDeviceId },
                  width: { ideal: 1280 }, 
                  height: { ideal: 720 } 
                }, 
                audio: false 
              }
            : { 
                video: { 
                  width: { ideal: 1280 }, 
                  height: { ideal: 720 } 
                }, 
                audio: false 
              },
          // Higher resolution if basic works
          targetDeviceId 
            ? { 
                video: { 
                  deviceId: { exact: targetDeviceId },
                  width: { ideal: 1920 }, 
                  height: { ideal: 1080 } 
                }, 
                audio: false 
              }
            : { 
                video: { 
                  width: { ideal: 1920 }, 
                  height: { ideal: 1080 } 
                }, 
                audio: false 
              }
        ];

        let mediaStream: MediaStream | null = null;
        let lastError: any = null;

        for (const constraints of constraintSets) {
          try {
            console.log('Trying desktop camera constraints:', constraints);
            mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('Desktop camera success with constraints:', constraints);
            break; // Success, exit loop
          } catch (err) {
            lastError = err;
            console.warn('Desktop camera constraint failed, trying next:', err);
            // Wait a bit before trying next constraint
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        if (!mediaStream) {
          console.error('All desktop camera constraints failed:', lastError);
          throw lastError || new Error('All camera constraints failed');
        }
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          
          // Wait for video to be ready
          await new Promise<void>((resolve, reject) => {
            if (!videoRef.current) return reject(new Error('Video element not found'));
            
            const handleLoad = () => {
              videoRef.current!.removeEventListener('loadedmetadata', handleLoad);
              videoRef.current!.removeEventListener('error', handleError);
              console.log('Desktop camera video loaded successfully');
              resolve();
            };
            
            const handleError = (e: any) => {
              videoRef.current!.removeEventListener('loadedmetadata', handleLoad);
              videoRef.current!.removeEventListener('error', handleError);
              console.error('Desktop camera video load error:', e);
              reject(new Error('Video failed to load'));
            };
            
            videoRef.current.addEventListener('loadedmetadata', handleLoad);
            videoRef.current.addEventListener('error', handleError);
            
            // Fallback timeout
            setTimeout(() => {
              if (videoRef.current && videoRef.current.readyState >= 2) {
                console.log('Desktop camera video ready via timeout');
                handleLoad();
              } else {
                console.warn('Desktop camera video not ready after timeout');
              }
            }, 3000);
          });
          
          await videoRef.current.play();
          console.log('Desktop camera video playing');
        }

        setStream(mediaStream);
        if (targetDeviceId) {
          setSelectedDevice(targetDeviceId);
        }
        setError(null);
        setCameraStarted(true);
        return;
      }

      // Mobile device handling with front camera prioritization
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId}`
        }));
      
      setDevices(videoDevices);
      
      if (videoDevices.length === 0) {
        throw new Error('No cameras detected. Please check your camera connection and refresh the page.');
      }

      let targetDeviceId = deviceId;
      
      // CRITICAL FIX: Always prioritize front camera on mobile if no specific device requested
      if (!targetDeviceId) {
        const frontCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('front') || 
          device.label.toLowerCase().includes('user') ||
          device.label.toLowerCase().includes('selfie') ||
          device.label.toLowerCase().includes('facetime')
        );
        
        if (frontCamera) {
          targetDeviceId = frontCamera.deviceId;
          setSelectedDevice(frontCamera.deviceId);
          console.log('Mobile: Auto-selected front camera on startup:', frontCamera.label);
        } else {
          targetDeviceId = videoDevices[0].deviceId;
          setSelectedDevice(videoDevices[0].deviceId);
          console.log('Mobile: No front camera found, using first available:', videoDevices[0].label);
        }
      } else if (!videoDevices.find(d => d.deviceId === targetDeviceId)) {
        // If specified device doesn't exist, fall back to front camera
        const frontCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('front') || 
          device.label.toLowerCase().includes('user') ||
          device.label.toLowerCase().includes('selfie') ||
          device.label.toLowerCase().includes('facetime')
        );
        
        if (frontCamera) {
          targetDeviceId = frontCamera.deviceId;
          setSelectedDevice(frontCamera.deviceId);
          console.log('Mobile: Specified device not found, falling back to front camera:', frontCamera.label);
        } else {
          targetDeviceId = videoDevices[0].deviceId;
          setSelectedDevice(videoDevices[0].deviceId);
          console.log('Mobile: Specified device not found, using first available:', videoDevices[0].label);
        }
      }

      // Try multiple approaches for mobile camera initialization
      let mediaStream: MediaStream | null = null;
      
      // Approach 1: Try with specific device ID and front-facing preference
      if (targetDeviceId) {
        try {
          console.log('Mobile: Trying specific device with front preference:', targetDeviceId);
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              facingMode: "user",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            },
            audio: false
          });
          console.log('Mobile: Success with specific device and front preference');
        } catch (err) {
          console.warn('Mobile: Specific device with front preference failed:', err);
        }
      }
      
      // Approach 2: Try with just facingMode user (let browser pick front camera)
      if (!mediaStream) {
        try {
          console.log('Mobile: Trying facingMode user preference');
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
          console.log('Mobile: Success with facingMode user');
        } catch (err) {
          console.warn('Mobile: FacingMode user failed:', err);
        }
      }
      
      // Approach 3: Try with specific device ID only
      if (!mediaStream && targetDeviceId) {
        try {
          console.log('Mobile: Trying specific device only:', targetDeviceId);
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
          console.log('Mobile: Success with specific device only');
        } catch (err) {
          console.warn('Mobile: Specific device only failed:', err);
        }
      }
      
      // Approach 4: Final fallback to any camera
      if (!mediaStream) {
        console.log('Mobile: Final fallback to any available camera');
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        console.log('Mobile: Success with fallback');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject();
          videoRef.current.onloadedmetadata = () => {
            console.log('Mobile: Video metadata loaded');
            resolve();
          };
          videoRef.current.onerror = () => reject(new Error('Failed to initialize video'));
        });
        
        await videoRef.current.play();
        console.log('Mobile: Video playing');
      }

      setStream(mediaStream);
      setSelectedDevice(targetDeviceId);
      setError(null);
      setCameraStarted(true);

    } catch (err: any) {
      let errorMessage = 'Failed to access camera';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera access in your browser settings and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (err.name === 'NotReadableError' || err.message?.includes('in use')) {
        errorMessage = 'Camera is busy. Please refresh the page to reset the camera connection.';
        // Auto-refresh suggestion
        setTimeout(() => {
          if (confirm('Camera is still busy. Would you like to refresh the page to fix this?')) {
            window.location.reload();
          }
        }, 3000);
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not supported. Trying basic camera access...';
        
        // Final fallback: try with absolute minimal constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            await videoRef.current.play();
          }
          setStream(fallbackStream);
          setError(null);
          setCameraStarted(true);
          return;
        } catch (fallbackErr) {
          errorMessage = 'Camera not compatible with this browser.';
        }
      }
      
      setError(errorMessage);
      console.warn('Camera access warning:', err);
      setCameraStarted(false);
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Get original video dimensions
        const originalWidth = video.videoWidth;
        const originalHeight = video.videoHeight;
        
        // Calculate portrait crop dimensions (9:16 aspect ratio)
        const targetAspectRatio = 9 / 16;
        let cropWidth, cropHeight, cropX, cropY;
        
        // Determine if we need to crop to portrait
        const currentAspectRatio = originalWidth / originalHeight;
        
        if (currentAspectRatio > targetAspectRatio) {
          // Image is too wide, crop width to fit portrait
          cropHeight = originalHeight;
          cropWidth = cropHeight * targetAspectRatio;
          cropX = (originalWidth - cropWidth) / 2; // Center crop
          cropY = 0;
        } else {
          // Image is already portrait or square, crop height if needed
          cropWidth = originalWidth;
          cropHeight = cropWidth / targetAspectRatio;
          cropX = 0;
          cropY = Math.max(0, (originalHeight - cropHeight) / 2); // Center crop
        }
        
        // Set canvas to portrait dimensions
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        // Draw cropped video frame
        context.drawImage(
          video,
          cropX, cropY, cropWidth, cropHeight, // Source crop area
          0, 0, cropWidth, cropHeight // Destination (full canvas)
        );

        // Add text if present - prioritize showing full text by scaling down
        if (text) {
          // Calculate text area - bottom 33% of entire photo
          const textAreaHeight = cropHeight * 0.33;
          const textAreaStart = cropHeight * 0.67;
          
          // Add padding within text area
          const padding = textAreaHeight * 0.1; // 10% padding
          const availableHeight = textAreaHeight - (padding * 2);
          const maxTextWidth = cropWidth * 0.9;
          
          // Set initial text styling
          context.fillStyle = 'white';
          context.strokeStyle = 'black';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.shadowColor = 'rgba(0, 0, 0, 0.8)';
          context.shadowOffsetX = 3;
          context.shadowOffsetY = 3;
          
          // Start with a reasonable font size
          let fontSize = Math.min(cropWidth, cropHeight) * 0.08; // Start smaller for better fitting
          fontSize = Math.max(fontSize, 20); // Minimum font size
          
          // Function to wrap text at a specific font size - NO TRUNCATION
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
                // Current line is full, start new line
                if (currentLine) wrappedLines.push(currentLine);
                currentLine = word;
              }
            }
            
            // Add the final line
            if (currentLine) {
              wrappedLines.push(currentLine);
            }
            
            return wrappedLines;
          };
          
          // Function to check if all text fits (both width and height)
          const allTextFits = (text: string, size: number): boolean => {
            const lines = wrapTextAtFontSize(text, size);
            
            // Check if we have more than 2 lines
            if (lines.length > 2) {
              return false;
            }
            
            // Check if height fits
            const lineHeight = size * 1.4;
            const totalTextHeight = lines.length * lineHeight;
            
            return totalTextHeight <= availableHeight;
          };
          
          // Find the largest font size where ALL text fits in 2 lines
          let finalFontSize = fontSize;
          
          // Start from a reasonable size and work our way down
          for (let testSize = fontSize; testSize >= 15; testSize -= 1) {
            if (allTextFits(text, testSize)) {
              finalFontSize = testSize;
              break;
            }
          }
          
          // If even at minimum size we can't fit all text, then truncate as last resort
          let lines = wrapTextAtFontSize(text, finalFontSize);
          
          if (lines.length > 2) {
            // Last resort: truncate the second line only if we absolutely must
            lines = lines.slice(0, 2);
            
            // Try to fit more words in the second line by reducing font slightly more
            let truncationFontSize = finalFontSize;
            while (truncationFontSize > 12 && lines.length === 2) {
              truncationFontSize -= 1;
              const testLines = wrapTextAtFontSize(text, truncationFontSize);
              if (testLines.length <= 2) {
                lines = testLines;
                finalFontSize = truncationFontSize;
                break;
              }
            }
            
            // If we still have overflow after trying smaller fonts, then add ellipsis
            if (lines.length === 2) {
              context.font = `900 ${finalFontSize}px Arial, sans-serif`;
              let secondLine = lines[1];
              const remainingWords = text.split(' ').slice(
                lines[0].split(' ').length + lines[1].split(' ').length
              );
              
              if (remainingWords.length > 0) {
                // There are more words, so add ellipsis
                while (context.measureText(secondLine + '...').width > maxTextWidth && secondLine.length > 0) {
                  const words = secondLine.split(' ');
                  words.pop();
                  secondLine = words.join(' ');
                }
                if (secondLine) {
                  lines[1] = secondLine + '...';
                }
              }
            }
          }
          
          // Ensure we have valid lines
          if (lines.length === 0) {
            lines = [text.substring(0, 10) + '...'];
            finalFontSize = 20;
          }
          
          // Set final styling
          context.font = `900 ${finalFontSize}px Arial, sans-serif`;
          context.lineWidth = Math.max(2, finalFontSize * 0.05);
          context.shadowBlur = finalFontSize * 0.1;
          
          // Calculate positioning to center text in available area
          const lineHeight = finalFontSize * 1.4;
          const totalTextHeight = lines.length * lineHeight;
          const textStartY = textAreaStart + padding + (availableHeight - totalTextHeight) / 2;
          
          // Draw each line
          lines.forEach((line, index) => {
            const textY = textStartY + (lineHeight / 2) + (index * lineHeight);
            const textX = cropWidth / 2;
            
            // Draw with strokes for visibility
            context.strokeText(line, textX, textY);
            context.strokeText(line, textX, textY);
            context.fillText(line, textX, textY);
          });
          
          // Reset shadow
          context.shadowColor = 'transparent';
          context.shadowBlur = 0;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;
          
          // Debug: Log what we rendered
          console.log(`Rendered ${lines.length} lines at ${finalFontSize}px:`, lines);
        }

        // Convert to data URL with maximum quality for crisp text
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        setPhoto(dataUrl);
      }
    }
  };

  const uploadToCollage = async () => {
    if (!photo || !currentCollage) return;

    setUploading(true);
    setError(null);

    try {
      // Convert data URL to Blob
      const response = await fetch(photo);
      const blob = await response.blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      // Upload photo
      const result = await uploadPhoto(currentCollage.id, file);
      if (result) {
        // Clear the current photo and text to start fresh
        setPhoto(null);
        setText('');
        
        // Show success message briefly
        setError('Photo uploaded successfully! Take another photo.');
        
        // Clear the success message after 2 seconds
        setTimeout(() => {
          setError(null);
        }, 2000);
        
        // CRITICAL FIX: Force camera restart after successful upload
        // This ensures the camera is properly reinitialized
        // For mobile, ensure we restart with front camera preference
        setTimeout(async () => {
          console.log('Restarting camera after upload');
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          if (isMobile) {
            // On mobile, restart without specifying device ID to trigger front camera auto-selection
            console.log('Mobile: Restarting with front camera preference after upload');
            await startCamera(); // Don't pass device ID to trigger auto front camera selection
          } else {
            await startCamera(selectedDevice);
          }
        }, 200);
        
      } else {
        throw new Error('Failed to upload photo');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const downloadPhoto = () => {
    if (!photo) return;

    const link = document.createElement('a');
    link.href = photo;
    link.download = 'photobooth.jpg';
    link.click();
  };

  const retakePhoto = () => {
    setPhoto(null);
    setText('');
    
    // CRITICAL FIX: Restart camera immediately after clearing photo
    // This ensures camera is available for users
    // For mobile, ensure we restart with front camera preference
    setTimeout(async () => {
      console.log('Restarting camera after retake');
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (!stream || !cameraStarted) {
        if (isMobile) {
          // On mobile, restart without specifying device ID to trigger front camera auto-selection
          console.log('Mobile: Restarting with front camera preference after retake');
          await startCamera(); // Don't pass device ID to trigger auto front camera selection
        } else {
          await startCamera(selectedDevice);
        }
      }
    }, 200);
  };

  // Now all useEffect hooks after function definitions
  useEffect(() => {
    if (code) {
      fetchCollageByCode(code);
    }
  }, [code, fetchCollageByCode]);

  useEffect(() => {
    startCamera();

    return () => {
      // Enhanced cleanup on component unmount
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.pause();
        }
        setStream(null);
        setCameraStarted(false);
      }
    };
  }, []);

  // Handle page visibility changes to release camera when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && stream) {
        // Release camera when tab becomes hidden
        stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setStream(null);
        setCameraStarted(false);
      } else if (!document.hidden && !stream && !photo) {
        // Restart camera when tab becomes visible again (only if not showing a photo)
        startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stream, photo]);

  // Handle device selection for both mobile and desktop
  useEffect(() => {
    if (selectedDevice && !stream && devices.length > 0) {
      console.log('Device selection changed, starting camera with device:', selectedDevice);
      startCamera(selectedDevice);
    }
  }, [selectedDevice, devices.length, stream]);

  // Auto-select front camera on mobile when devices are loaded
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Only run this effect on mobile and only if we don't already have a selected device
    if (isMobile && devices.length > 0 && !selectedDevice) {
      // Try to find and auto-select front camera
      const frontCamera = devices.find(device => 
        device.label.toLowerCase().includes('front') || 
        device.label.toLowerCase().includes('user') ||
        device.label.toLowerCase().includes('selfie') ||
        device.label.toLowerCase().includes('facetime')
      );
      
      if (frontCamera) {
        console.log('Mobile: Auto-selecting front camera from devices:', frontCamera.label);
        setSelectedDevice(frontCamera.deviceId);
      } else {
        console.log('Mobile: No front camera found in devices, selecting first available');
        setSelectedDevice(devices[0].deviceId);
      }
    }
  }, [devices, selectedDevice]);

  // CRITICAL FIX: Enhanced effect to restart camera when needed
  useEffect(() => {
    // If we don't have a photo showing, no active stream, not loading, and camera hasn't started
    if (!photo && !stream && !loading && !cameraStarted) {
      console.log('Starting camera because: no photo, no stream, not loading, camera not started');
      // Add a small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        startCamera(selectedDevice);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [photo, stream, loading, cameraStarted, selectedDevice]);

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

        {devices.length > 1 && (
          <div className="mb-2">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
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

        <div className="bg-black rounded-lg overflow-hidden aspect-[9/16] relative md:max-h-[70vh] max-h-[85vh]">
          {!photo ? (
            <>
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-white border-t-transparent"></div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
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
                    disabled={!stream || !cameraStarted}
                    className="flex-1 flex items-center justify-center px-2 py-2 bg-white text-black rounded hover:bg-gray-100 transition-colors font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </button>
                  {/* Manual refresh button for troubleshooting */}
                  <button
                    onClick={() => startCamera(selectedDevice)}
                    className="px-2 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
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
            {!cameraStarted && !loading && ' Camera is starting...'}
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