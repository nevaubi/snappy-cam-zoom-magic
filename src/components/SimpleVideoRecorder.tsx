import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Square, Download, Video, VideoOff } from 'lucide-react';

const SimpleVideoRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>('');
  const [showWebcam, setShowWebcam] = useState(true);
  const [error, setError] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      setError('');
      
      // Get screen capture
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Get webcam if enabled
      let webcamStream = null;
      if (showWebcam) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = webcamStream;
          }
        } catch (err) {
          console.warn('Webcam access failed:', err);
        }
      }

      streamRef.current = screenStream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(screenStream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (err) {
      setError('Failed to start recording. Please allow screen capture.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (webcamVideoRef.current?.srcObject) {
        const webcamStream = webcamVideoRef.current.srcObject as MediaStream;
        webcamStream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const downloadVideo = () => {
    if (recordedVideoUrl) {
      const a = document.createElement('a');
      a.href = recordedVideoUrl;
      a.download = `recording-${new Date().toISOString().slice(0, 19)}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6">Video Recorder</h1>
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <div className="flex gap-4 mb-6">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              size="lg"
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>

            <Button
              onClick={() => setShowWebcam(!showWebcam)}
              variant="outline"
            >
              {showWebcam ? (
                <>
                  <VideoOff className="w-4 h-4 mr-2" />
                  Hide Webcam
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Show Webcam
                </>
              )}
            </Button>

            {recordedVideoUrl && (
              <Button onClick={downloadVideo} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Webcam Preview */}
            {showWebcam && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Webcam Preview</h3>
                <video
                  ref={webcamVideoRef}
                  autoPlay
                  muted
                  className="w-full h-48 bg-muted rounded-lg object-cover"
                />
              </div>
            )}

            {/* Recorded Video Playback */}
            {recordedVideoUrl && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Recorded Video</h3>
                <video
                  src={recordedVideoUrl}
                  controls
                  className="w-full h-48 bg-muted rounded-lg"
                />
              </div>
            )}
          </div>

          {isRecording && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording in progress...
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SimpleVideoRecorder;