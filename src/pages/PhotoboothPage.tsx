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
  const { currentCollage, fetchCollageByCode, uploadPhoto } = useCollageStore();

  const startCamera = async (deviceId?: string) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    }

    setLoading(true);
    setError(null);

    // Add delay to ensure previous stream is fully cleaned up
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // First check if we have permission
      const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (permissions.state === 'denied') {
        throw new Error('Camera access is blocked. Please allow camera access in your browser settings and refresh the page.');
      }
      
      // Get list of video devices
      const allDevices = await navigator.mediaDevices.enumerateDevices()
        .catch(() => []);
      
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map(device => {
          return {
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId}`
          };
        });
      
      setDevices(videoDevices);
      
      if (videoDevices.length === 0) {
        throw new Error('No cameras detected. Please check your camera connection and refresh the page.');
      }

      let targetDeviceId = deviceId;
      if (!targetDeviceId || !videoDevices.find(d => d.deviceId === targetDeviceId)) {
        targetDeviceId = videoDevices[0].deviceId;
      }

      // Try to release any existing tracks
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      const constraints = {
        video: {
          deviceId: { exact: targetDeviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "user",
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      let mediaStream: MediaStream;
      try {
        mediaStream = await Promise.race([
          navigator.mediaDevices.getUserMedia(constraints),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Camera access timed out')), 10000)
          )
        ]);
      } catch (err) {
        // Try again with default constraints if specific device failed
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await Promise.race([
            new Promise<void>((resolve, reject) => {
              if (!videoRef.current) return reject();
              videoRef.current.onloadedmetadata = () => resolve();
              videoRef.current.onerror = () => reject(new Error('Failed to initialize video'));
            }),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Video initialization timed out')), 5000)
            )
          ]);
          
          await videoRef.current.play();
        } catch (err) {
          throw new Error('Failed to initialize video stream. Please refresh and try again.');
        }
      }

      setStream(mediaStream as MediaStream);
      setSelectedDevice(targetDeviceId);
      setError(null);
    } catch (err: any) {
      let errorMessage = 'Failed to access camera';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera access denied. Please allow camera access in your browser settings and try again.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera found. Please connect a camera and try again.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application or timed out. Please:\n' +
          '1. Close other apps using your camera\n' +
          '2. Refresh the page\n' +
          '3. Try selecting a different camera if available';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Could not find a camera matching the requested settings. Please try a different camera.';
      } else if (err.message.includes('timed out')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      console.warn('Camera access warning:', err);
      
      // Clean up any partial streams
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setStream(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) {
      fetchCollageByCode(code);
    }
  }, [code, fetchCollageByCode]);

  useEffect(() => {
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setStream(null);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedDevice && !stream) {
      startCamera(selectedDevice);
    } else if (devices.length > 0) {
      setSelectedDevice(devices[0].deviceId);
    }
  }, [selectedDevice, devices.length, stream]);

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

        // Add text if present - optimized for portrait layout with dynamic scaling
        if (text) {
          // Start with larger base font size for short text
          let baseFontSize = Math.min(cropWidth, cropHeight) * 0.1; // Start at 10% for maximum impact
          let fontSize = Math.max(baseFontSize, 70); // Minimum 70px for portrait
          
          // Set initial text styling
          context.fillStyle = 'white';
          context.strokeStyle = 'black';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          
          // Enhanced shadow for visibility
          context.shadowColor = 'rgba(0, 0, 0, 0.8)';
          context.shadowOffsetX = 3;
          context.shadowOffsetY = 3;
          
          // Calculate text area - bottom 33% of entire photo
          const textAreaHeight = cropHeight * 0.33; // 33% of total photo height
          const textAreaStart = cropHeight * 0.67; // Start at 67% down (bottom third)
          
          // Calculate maximum text width (90% of portrait width)
          const maxTextWidth = cropWidth * 0.9;
          
          // Function to measure text width with current font
          const measureText = (text: string, size: number) => {
            context.font = `900 ${size}px Arial, sans-serif`;
            return context.measureText(text).width;
          };
          
          // Function to wrap text and return lines
          const wrapText = (text: string, size: number) => {
            const words = text.split(' ');
            let lines: string[] = [];
            let currentLine = '';
            
            for (const word of words) {
              const testLine = currentLine + (currentLine ? ' ' : '') + word;
              if (measureText(testLine, size) <= maxTextWidth || currentLine === '') {
                currentLine = testLine;
              } else {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
                if (lines.length >= 2) break; // Limit to 2 lines
              }
            }
            if (currentLine) lines.push(currentLine);
            
            // Handle overflow on second line
            if (lines.length > 2) {
              lines = lines.slice(0, 2);
              let secondLine = lines[1];
              while (measureText(secondLine + '...', size) > maxTextWidth && secondLine.length > 0) {
                secondLine = secondLine.slice(0, -1);
              }
              lines[1] = secondLine + '...';
            }
            
            return lines;
          };
          
          // Function to check if text fits in area
          const textFitsInArea = (lines: string[], size: number) => {
            const lineHeight = size * 1.2;
            const totalHeight = lines.length * lineHeight;
            return totalHeight <= textAreaHeight;
          };
          
          // Dynamic font sizing - scale down until text fits
          let lines = wrapText(text, fontSize);
          
          // Scale down font size until text fits in the allocated area
          while (!textFitsInArea(lines, fontSize) && fontSize > 30) {
            fontSize -= 2; // Reduce by 2px increments
            lines = wrapText(text, fontSize);
          }
          
          // Minimum font size check
          if (fontSize < 30) {
            fontSize = 30;
            lines = wrapText(text, fontSize);
          }
          
          // Set final font and styling
          context.font = `900 ${fontSize}px Arial, sans-serif`;
          context.lineWidth = Math.max(3, fontSize * 0.06);
          context.shadowBlur = fontSize * 0.1;
          
          // Calculate final positioning
          const lineHeight = fontSize * 1.2;
          const totalTextHeight = lines.length * lineHeight;
          const startY = textAreaStart + (textAreaHeight - totalTextHeight) / 2 + lineHeight / 2;
          
          // Draw each line
          lines.forEach((line, index) => {
            const textY = startY + (index * lineHeight);
            const textX = cropWidth / 2;
            
            // Double stroke for extra thickness
            context.strokeText(line, textX, textY);
            context.strokeText(line, textX, textY);
            context.fillText(line, textX, textY);
          });
          
          // Reset shadow
          context.shadowColor = 'transparent';
          context.shadowBlur = 0;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;
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
        // Navigate to collage viewer
        navigate(`/collage/${code}`);
      } else {
        throw new Error('Failed to upload photo');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
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
  };

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
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            {currentCollage.name}
          </h1>
          <p className="text-gray-400">
            Take a photo to add to the collage
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-200 whitespace-pre-line">
            {error}
          </div>
        )}

        {/* Camera device selector */}
        {devices.length > 1 && (
          <div className="mb-4">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded text-white"
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="bg-black rounded-lg overflow-hidden aspect-[9/16] relative">
          {!photo ? (
            <>
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Add text to your photo (automatically sizes to fit)..."
                  className="w-full mb-4 px-4 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400"
                  maxLength={120}
                />
                <div className="flex space-x-2">
                  {devices.length > 0 && (
                    <button
                      onClick={() => startCamera(selectedDevice)}
                      className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      title="Refresh camera"
                    >
                      <RefreshCw className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={takePhoto}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-semibold"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Take Photo
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
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex space-x-2">
                  <button
                    onClick={retakePhoto}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Retake
                  </button>
                  <button
                    onClick={downloadPhoto}
                    className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    title="Download photo"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={uploadToCollage}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Upload to Collage
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Instructions */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-gray-300 text-sm">
            <strong>Tips:</strong> Add text to your photo using the input field above. 
            Photos are automatically cropped to portrait format (9:16) and text automatically scales to fit up to 2 lines in the bottom third of the photo. Longer text will be smaller but still readable in the 3D collage.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default PhotoboothPage;