import { useState, useRef, useCallback } from 'react';
import { blobToBase64 } from '@/lib/audio-utils';

export interface AudioRecorderHook {
  isRecording: boolean;
  recordingDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ audioData: string; mimeType: string; duration: number; transcription?: string } | null>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export function useAudioRecorder(): AudioRecorderHook {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const [transcription, setTranscription] = useState<string>('');

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      audioStreamRef.current = stream;
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (isRecording) return;

    // Request permission if not already granted
    if (!audioStreamRef.current) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      audioChunksRef.current = [];
      setTranscription('');
      
      // Set up speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            }
          }
          if (finalTranscript) {
            setTranscription(prev => prev + finalTranscript);
          }
        };
        
        recognitionRef.current.start();
      }
      
      // Determine the best available MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let the browser choose
          }
        }
      }

      mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current!, {
        mimeType: mimeType || undefined
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [isRecording, requestPermission]);

  const stopRecording = useCallback(async (): Promise<{ audioData: string; mimeType: string; duration: number; transcription?: string } | null> => {
    if (!isRecording || !mediaRecorderRef.current) return null;

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    return new Promise((resolve) => {
      mediaRecorderRef.current!.onstop = async () => {
        try {
          const finalDuration = recordingDuration;
          const mimeType = mediaRecorderRef.current!.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const audioData = await blobToBase64(audioBlob);
          
          resolve({
            audioData,
            mimeType,
            duration: finalDuration,
            transcription: transcription.trim() || undefined
          });
        } catch (error) {
          console.error('Error processing recording:', error);
          resolve(null);
        }
      };

      mediaRecorderRef.current!.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });
  }, [isRecording, recordingDuration, transcription]);

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    hasPermission,
    requestPermission,
  };
}
