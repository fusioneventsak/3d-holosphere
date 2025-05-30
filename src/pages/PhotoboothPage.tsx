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
    }

    setLoading(true);
    setError(null);

    try {
      // Get video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId}`
        }));
      
      setDevices(videoDevices);

      // If no deviceId provided, use first available or default
      const constraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false
      };

      // Get media stream
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      setStream(mediaStream);

      // If no device was previously selected, select the current one
      if (!selectedDevice && videoDevices.length > 0) {
        const currentDevice = videoDevices.find(d => d.deviceId === deviceId) || videoDevices[0];
        setSelectedDevice(currentDevice.deviceId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to access camera');
      console.error('Camera access error:', err);
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
      }
    };
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      startCamera(selectedDevice);
    }
  }, [selectedDevice]);

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
          <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-200">
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