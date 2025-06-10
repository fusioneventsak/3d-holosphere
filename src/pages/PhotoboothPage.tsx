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

  const startCamera = async (deviceId?: string) => {
    console.log('=== Starting camera initialization ===');
    console.log('Device ID requested:', deviceId);
    
    // Force cleanup of any existing streams
    if (stream) {
      console.log('Cleaning up existing stream');
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

    setLoading(true);
    setError(null);
    setCameraStarted(false);

    try {
      console.log('Requesting camera permissions...');
      
      // Detect platform
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isMobile = isIOS || isAndroid;
      
      console.log('Platform detected:', { isIOS, isAndroid, isMobile });
      
      let constraints;
      
      if (isIOS) {
        // iOS-specific constraints
        console.log('Using iOS-specific constraints');
        if (deviceId) {
          constraints = {
            video: {
              deviceId: { exact: deviceId },
              facingMode: "user",
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            },
            audio: false
          };
        } else {
          // For iOS, always start with front camera
          constraints = {
            video: {
              facingMode: "user",
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 }
            },
            audio: false
          };
        }
      } else if (isAndroid) {
        // Android-specific constraints
        console.log('Using Android-specific constraints');
        if (deviceId) {
          constraints = {
            video: {
              deviceId: { exact: deviceId },
              facingMode: "user"
            },
            audio: false
          };
        } else {
          constraints = {
            video: {
              facingMode: "user"
            },
            audio: false
          };
        }
      } else {
        // Desktop constraints
        console.log('Using desktop constraints');
        if (deviceId) {
          constraints = {
            video: {
              deviceId: { exact: deviceId }
            },
            audio: false
          };
        } else {
          constraints = {
            video: true,
            audio: false
          };
        }
      }
      
      console.log('Using constraints:', constraints);
      
      // Get user media
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Got media stream:', mediaStream);
      console.log('Stream active:', mediaStream.active);
      console.log('Video tracks:', mediaStream.getVideoTracks().length);
      
      // Get devices after we have permission
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId}`
          }));
        
        console.log('Available video devices:', videoDevices);
        setDevices(videoDevices);
        
        // Set selected device if we don't have one
        if (!selectedDevice && videoDevices.length > 0) {
          if (isIOS || isAndroid) {
            // Try to find front camera
            const frontCamera = videoDevices.find(device => 
              device.label.toLowerCase().includes('front') ||
              device.label.toLowerCase().includes('user') ||
              device.label.toLowerCase().includes('selfie') ||
              device.label.toLowerCase().includes('facetime')
            );
            
            if (frontCamera) {
              console.log('Auto-selecting front camera:', frontCamera.label);
              setSelectedDevice(frontCamera.deviceId);
            } else {
              console.log('No front camera found, using first device');
              setSelectedDevice(videoDevices[0].deviceId);
            }
          } else {
            console.log('Desktop: using first available device');
            setSelectedDevice(videoDevices[0].deviceId);
          }
        }
      } catch (deviceError) {
        console.warn('Could not enumerate devices:', deviceError);
      }
      
      // Set up video element
      if (videoRef.current && mediaStream) {
        console.log('Setting up video element...');
        
        const video = videoRef.current;
        
        // Clear any existing source first
        if (video.srcObject) {
          video.srcObject = null;
        }
        
        // iOS-specific video setup
        if (isIOS) {
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          video.autoplay = true;
          video.controls = false;
          video.style.objectFit = 'cover';
        } else {
          video.muted = true;
          video.autoplay = true;
          video.playsInline = true;
          video.controls = false;
        }
        
        // Set the media stream
        video.srcObject = mediaStream;
        
        console.log('Video element configured');
        console.log('Video readyState:', video.readyState);
        console.log('Video srcObject:', video.srcObject);
        
        // Wait for video to load
        await new Promise<void>((resolve, reject) => {
          const handleLoadedMetadata = () => {
            console.log('Video metadata loaded');
            console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
            console.log('Video readyState:', video.readyState);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('error', handleError);
            video.removeEventListener('loadeddata', handleLoadedData);
            resolve();
          };
          
          const handleLoadedData = () => {
            console.log('Video data loaded');
            if (video.readyState >= 2) {
              handleLoadedMetadata();
            }
          };
          
          const handleError = (e: any) => {
            console.error('Video error during setup:', e);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('error', handleError);
            video.removeEventListener('loadeddata', handleLoadedData);
            reject(new Error(`Video failed to load: ${e.message || 'Unknown error'}`));
          };
          
          video.addEventListener('loadedmetadata', handleLoadedMetadata);
          video.addEventListener('loadeddata', handleLoadedData);
          video.addEventListener('error', handleError);
          
          // Check if already loaded
          if (video.readyState >= 1) {
            console.log('Video already has metadata, readyState:', video.readyState);
            handleLoadedMetadata();
          }
          
          // Timeout fallback - be more generous for mobile
          setTimeout(() => {
            console.log('Timeout check - readyState:', video.readyState);
            if (video.readyState >= 1) {
              console.log('Video ready via timeout');
              handleLoadedMetadata();
            } else {
              console.warn('Video not ready after timeout, readyState:', video.readyState);
              // Don't reject on timeout for iOS - sometimes it works anyway
              if (isIOS) {
                console.log('iOS: Proceeding despite timeout');
                handleLoadedMetadata();
              } else {
                reject(new Error('Video load timeout'));
              }
            }
          }, 8000); // Increased timeout for mobile
        });
        
        // Try to play
        try {
          console.log('Attempting to play video...');
          console.log('Video paused state:', video.paused);
          console.log('Video ready state before play:', video.readyState);
          
          const playPromise = video.play();
          
          if (playPromise !== undefined) {
            await playPromise;
            console.log('Video playing successfully via promise');
          } else {
            console.log('Video play() returned undefined - checking if playing');
            // Wait a bit and check if it's actually playing
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!video.paused) {
              console.log('Video is playing despite undefined promise');
            }
          }
        } catch (playError) {
          console.warn('Video play failed:', playError);
          
          // For iOS, sometimes we need user interaction, but don't fail completely
          if (isIOS) {
            console.log('iOS play failed - this is common and may not be a real error');
            // Check if video is actually playing despite the error
            setTimeout(() => {
              if (!video.paused) {
                console.log('Video is actually playing despite play() error');
              }
            }, 1000);
          } else {
            // For desktop, play errors are more serious
            console.error('Desktop video play failed, this is a real error');
            throw playError;
          }
        }
        
        console.log('Final video state:');
        console.log('- paused:', video.paused);
        console.log('- readyState:', video.readyState);
        console.log('- videoWidth:', video.videoWidth);
        console.log('- videoHeight:', video.videoHeight);
        
        setStream(mediaStream);
        setError(null);
        setCameraStarted(true);
        console.log('Camera initialization complete');
        
      } else {
        const errorMsg = !videoRef.current ? 'Video element not found' : 'Media stream not available';
        console.error('Setup failed:', errorMsg);
        console.log('videoRef.current:', videoRef.current);
        console.log('mediaStream:', mediaStream);
        throw new Error(errorMsg);
      }

    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      let errorMessage = 'Failed to access camera';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera access and refresh the page.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please check your camera and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is busy. Please close other apps using the camera and try again.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera settings not supported. Trying basic settings...';
        
        // Fallback for overconstrained error
        try {
          console.log('Trying fallback constraints...');
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, 
            audio: false 
          });
          
          if (videoRef.current) {
            const video = videoRef.current;
            video.srcObject = fallbackStream;
            video.muted = true;
            video.autoplay = true;
            video.playsInline = true;
            
            try {
              await video.play();
              console.log('Fallback camera working');
              setStream(fallbackStream);
              setError(null);
              setCameraStarted(true);
              return;
            } catch (fallbackPlayError) {
              console.warn('Fallback play failed:', fallbackPlayError);
            }
          }
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          errorMessage = 'Camera not compatible with this device.';
        }
      } else {
        errorMessage = `Camera error: ${err.message}`;
      }
      
      setError(errorMessage);
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

        // Add text if present
        if (text) {
          // Calculate text area - bottom 33% of entire photo
          const textAreaHeight = cropHeight * 0.33;
          const textAreaStart = cropHeight * 0.67;
          
          // Add padding within text area
          const padding = textAreaHeight * 0.1;
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
          let fontSize = Math.min(cropWidth, cropHeight) * 0.08;
          fontSize = Math.max(fontSize, 20);
          
          // Function to wrap text at a specific font size
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
          
          // Function to check if all text fits
          const allTextFits = (text: string, size: number): boolean => {
            const lines = wrapTextAtFontSize(text, size);
            
            if (lines.length > 2) {
              return false;
            }
            
            const lineHeight = size * 1.4;
            const totalTextHeight = lines.length * lineHeight;
            
            return totalTextHeight <= availableHeight;
          };
          
          // Find the largest font size where ALL text fits in 2 lines
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
            
            if (lines.length === 2) {
              context.font = `900 ${finalFontSize}px Arial, sans-serif`;
              let secondLine = lines[1];
              const remainingWords = text.split(' ').slice(
                lines[0].split(' ').length + lines[1].split(' ').length
              );
              
              if (remainingWords.length > 0) {
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
          
          if (lines.length === 0) {
            lines = [text.substring(0, 10) + '...'];
            finalFontSize = 20;
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
            context.strokeText(line, textX, textY);
            context.fillText(line, textX, textY);
          });
          
          context.shadowColor = 'transparent';
          context.shadowBlur = 0;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;
        }

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
      const response = await fetch(photo);
      const blob = await response.blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      const result = await uploadPhoto(currentCollage.id, file);
      if (result) {
        setPhoto(null);
        setText('');
        
        setError('Photo uploaded successfully! Take another photo.');
        
        setTimeout(() => {
          setError(null);
        }, 2000);
        
        setTimeout(async () => {
          console.log('Restarting camera after upload');
          console.log('videoRef.current after upload:', videoRef.current);
          
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isAndroid = /Android/.test(navigator.userAgent);
          
          // Ensure we have a video element before trying to start camera
          if (!videoRef.current) {
            console.log('Video element not ready yet after upload, waiting...');
            // Wait for React to render the video element
            setTimeout(async () => {
              console.log('Second attempt after upload - videoRef.current:', videoRef.current);
              if (videoRef.current) {
                if (isIOS || isAndroid) {
                  console.log('Mobile: Restarting with front camera preference after upload');
                  await startCamera();
                } else {
                  await startCamera(selectedDevice);
                }
              } else {
                console.error('Video element still not available after upload');
                setError('Camera initialization failed. Please refresh the page.');
              }
            }, 500);
          } else {
            if (isIOS || isAndroid) {
              console.log('Mobile: Restarting with front camera preference after upload');
              await startCamera();
            } else {
              await startCamera(selectedDevice);
            }
          }
        }, 100); // Reduced delay but with fallback
        
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
    
    // Wait for React to re-render and show the video element before starting camera
    setTimeout(async () => {
      console.log('Restarting camera after retake');
      console.log('videoRef.current after retake:', videoRef.current);
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      // Ensure we have a video element before trying to start camera
      if (!videoRef.current) {
        console.log('Video element not ready yet, waiting longer...');
        // Wait a bit more for React to render the video element
        setTimeout(async () => {
          console.log('Second attempt - videoRef.current:', videoRef.current);
          if (videoRef.current) {
            if (isIOS || isAndroid) {
              console.log('Mobile: Restarting with front camera preference after retake');
              await startCamera();
            } else {
              await startCamera(selectedDevice);
            }
          } else {
            console.error('Video element still not available after waiting');
            setError('Camera initialization failed. Please refresh the page.');
          }
        }, 500);
      } else {
        if (isIOS || isAndroid) {
          console.log('Mobile: Restarting with front camera preference after retake');
          await startCamera();
        } else {
          await startCamera(selectedDevice);
        }
      }
    }, 100); // Small delay to let React re-render
  };

  useEffect(() => {
    if (code) {
      fetchCollageByCode(code);
    }
  }, [code, fetchCollageByCode]);

  useEffect(() => {
    console.log('Component mounted, starting camera initialization');
    const timer = setTimeout(() => {
      startCamera();
    }, 100);
    
    return () => {
      clearTimeout(timer);
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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && stream) {
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
        startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [stream, photo]);

  useEffect(() => {
    if (selectedDevice && devices.length > 0 && !stream && cameraStarted) {
      console.log('Device selection changed by user, starting camera with device:', selectedDevice);
      startCamera(selectedDevice);
    }
  }, [selectedDevice]);

  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if ((isIOS || isAndroid) && devices.length > 0 && !selectedDevice) {
      const frontCamera = devices.find(device => 
        device.label.toLowerCase().includes('front') ||
        device.label.toLowerCase().includes('user') ||
        device.label.toLowerCase().includes('selfie') ||
        device.label.toLowerCase().includes('facetime')
      );
      
      if (frontCamera) {
        console.log('Setting front camera as selected device:', frontCamera.label);
        setSelectedDevice(frontCamera.deviceId);
      } else if (devices.length > 0) {
        console.log('No front camera found, setting first available');
        setSelectedDevice(devices[0].deviceId);
      }
    }
  }, [devices, selectedDevice]);

  useEffect(() => {
    if (!photo && !stream && !loading && !cameraStarted) {
      console.log('Starting camera because: no photo, no stream, not loading, camera not started');
      console.log('videoRef.current in effect:', videoRef.current);
      
      // Make sure we have a video element before starting
      if (videoRef.current) {
        const timer = setTimeout(() => {
          startCamera();
        }, 500);
        return () => clearTimeout(timer);
      } else {
        console.log('Video element not ready in effect, will retry...');
        // If video element not ready, retry after a longer delay
        const timer = setTimeout(() => {
          console.log('Retry - videoRef.current:', videoRef.current);
          if (videoRef.current) {
            startCamera();
          } else {
            console.error('Video element still not available in effect retry');
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [photo, stream, loading, cameraStarted]);

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

        {/* Camera device selector - show on both mobile and desktop when multiple cameras available */}
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

        {/* Mobile camera flip button - only show on mobile when multiple cameras available */}
        {(() => {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          return isMobile && devices.length > 1 && (
            <div className="mb-2 flex justify-center">
              <button
                onClick={() => {
                  // Find the next camera (cycle through available cameras)
                  const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice);
                  const nextIndex = (currentIndex + 1) % devices.length;
                  setSelectedDevice(devices[nextIndex].deviceId);
                }}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-xs hover:bg-white/20 transition-colors flex items-center gap-2"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
                Flip Camera
              </button>
            </div>
          );
        })()}

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
                  muted
                  controls={false}
                  className="w-full h-full object-cover"
                  onCanPlay={() => console.log('Video can play')}
                  onPlay={() => console.log('Video started playing')}
                  onError={(e) => console.error('Video error:', e)}
                  onLoadedMetadata={() => console.log('Video metadata loaded')}
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
                  {/* Manual refresh button for troubleshooting - desktop and mobile */}
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