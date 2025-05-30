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
        // Set canvas size to match video aspect ratio (9:16)
        const width = video.videoWidth;
        const height = (width * 16) / 9;
        canvas.width = width;
        canvas.height = height;

        // Draw video frame
        context.drawImage(video, 0, 0, width, height);

        // Add text if present
        if (text) {
          context.font = 'bold 48px Arial';
          context.fillStyle = 'white';
          context.strokeStyle = 'black';
          context.lineWidth = 2;
          context.textAlign = 'center';
          context.strokeText(text, width / 2, height - 50);
          context.fillText(text, width / 2, height - 50);
        }

        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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
                  placeholder="Add text to your photo..."
                  className="w-full mb-4 px-4 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-gray-400"
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
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
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
                alt="Preview"
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
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={uploadToCollage}
                    disabled={uploading}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
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
      </div>
    </Layout>
  );
};

export default PhotoboothPage;