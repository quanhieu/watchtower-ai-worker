import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { ModeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { beep } from '@/utils/audio';
import { Camera, FlipHorizontal, PersonStanding, Video, Volume2 } from 'lucide-react';
import { toast } from "sonner";
import { drawOnCanvas } from '@/utils/draw';
import { Rings } from 'react-loader-spinner';
import RenderFeatureHighlightsSectionComponent from '@/components/home-page/feature-highlights-section';
import { base64toBlob, formatDate, resizeCanvas } from '@/utils';

let stopTimeout: any = null;
let worker: Worker | null = null;

export default function HomeComponent() {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mirrored, setMirrored] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [autoRecordEnabled, setAutoRecordEnabled] = useState<boolean>(false);
  const [volume, setVolume] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const toggleMirrored = useCallback(() => {
    setMirrored(prev => !prev)
  }, []);

  // Initialize the media recorder
  useEffect(() => {
    if (webcamRef && webcamRef.current) {
      const stream = (webcamRef.current.video as any).captureStream();
      if (stream) {
        mediaRecorderRef.current = new MediaRecorder(stream);

        mediaRecorderRef.current.ondataavailable = (e) => {
          if (e.data.size > 0) {
            const recordedBlob = new Blob([e.data], { type: 'video/webm' });
            const videoURL = URL.createObjectURL(recordedBlob);
            const a = document.createElement('a');
            a.href = videoURL;
            a.download = `${formatDate(new Date())}.webm`;
            a.click();
          }
        };
        mediaRecorderRef.current.onstart = () => setIsRecording(true);
        mediaRecorderRef.current.onstop = () => setIsRecording(false);
      }
    }
  }, []);

    const startRecording = useCallback((doBeep: boolean) => {
    if (webcamRef.current && mediaRecorderRef.current?.state !== 'recording') {
      mediaRecorderRef.current?.start();
      if (doBeep) beep(volume);

      stopTimeout = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    }
  }, [volume])

  const handleWorkerMessages = useCallback((e: MessageEvent) => {
    const { type, predictions, mirrored } = e.data;

    if (type === 'modelLoaded') {
      setLoading(false);
    }

    if (type === 'predictions') {
      resizeCanvas(canvasRef, webcamRef);
      drawOnCanvas(mirrored, predictions, canvasRef.current?.getContext('2d'));

      if (predictions.some((prediction: any) => prediction.class === 'person' && autoRecordEnabled)) {
        startRecording(true);
      }
    }
  }, [autoRecordEnabled, startRecording]);

  // Initialize the worker and load the model
  const initWorker = useCallback(() => {
    worker = new Worker(new URL('../../worker/tensorflowWorker.js', import.meta.url));
    worker.onmessage = handleWorkerMessages;
    worker.postMessage({ type: 'loadModel' });
  }, [])


  useEffect(() => {
    setLoading(true);
    initWorker();
  }, []);

  const runPrediction = useCallback(() => {
    if (
      worker &&
      webcamRef.current &&
      webcamRef.current.video?.readyState === 4
    ) {
      const video = webcamRef.current.video as HTMLVideoElement;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage({ type: 'predict', imageData, mirrored });
      }
    }
  }, [mirrored, autoRecordEnabled]);
  
  useEffect(() => {
    const interval = setInterval(runPrediction, 100); // Reduce the frequency to 500ms

    return () => clearInterval(interval);
  }, [runPrediction]);

  const userPromptScreenshot = useCallback(() => {
    if (!webcamRef.current) {
      toast('Camera not found. Please refresh');
    } else {
      const imgSrc = webcamRef.current.getScreenshot();
      const blob = base64toBlob(imgSrc);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatDate(new Date())}.png`;
      a.click();
    }
  }, [])

  const userPromptRecord = useCallback(() => {
    if (!webcamRef.current) {
      toast('Camera is not found. Please refresh.');
    }

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.requestData();
      clearTimeout(stopTimeout);
      mediaRecorderRef.current.stop();
      toast('Recording saved to downloads');
    } else {
      startRecording(false);
    }
  }, [startRecording])

  const toggleAutoRecord = useCallback(() => {
    setAutoRecordEnabled(prev => !prev);
    toast(autoRecordEnabled ? 'Autorecord disabled' : 'Autorecord enabled');
  }, [autoRecordEnabled])

  return (
    <div className='flex h-screen'>
      {/* Left division - webcam and Canvas */}
      <div className='relative'>
        <div className='relative h-screen w-full'>
          <Webcam ref={webcamRef}
            mirrored={mirrored}
            className='h-full w-full object-contain p-2'
          />
          <canvas ref={canvasRef}
            className='absolute top-0 left-0 h-full w-full object-contain'
          ></canvas>
        </div>
      </div>

      {/* Right division - container for button panel and wiki section */}
      <div className='flex flex-row flex-1'>
        <div className='border-primary/5 border-2 max-w-xs flex flex-col gap-2 justify-between shadow-md rounded-md p-4'>
          {/* Top section */}
          <div className='flex flex-col gap-2'>
            <ModeToggle />
            <Button
              variant={'outline'} size={'icon'}
              onClick={() => toggleMirrored()}
            >
              <FlipHorizontal />
            </Button>
            <Separator className='my-2' />
          </div>

          {/* Middle section */}
          <div className='flex flex-col gap-2'>
            <Separator className='my-2' />
            <Button
              variant={'outline'} size={'icon'}
              onClick={userPromptScreenshot}
            >
              <Camera />
            </Button>
            <Button
              variant={isRecording ? 'destructive' : 'outline'} size={'icon'}
              onClick={userPromptRecord}
            >
              <Video />
            </Button>
            <Separator className='my-2' />
            <Button
              variant={autoRecordEnabled ? 'destructive' : 'outline'}
              size={'icon'}
              onClick={toggleAutoRecord}
            >
              {autoRecordEnabled ? <Rings color='white' height={45} /> : <PersonStanding />}
            </Button>
          </div>

          {/* Bottom Section */}
          <div className='flex flex-col gap-2'>
            <Separator className='my-2' />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} size={'icon'}>
                  <Volume2 />
                </Button>
              </PopoverTrigger>
              <PopoverContent>
                <Slider
                  max={1}
                  min={0}
                  step={0.2}
                  defaultValue={[volume]}
                  onValueCommit={(val) => {
                    setVolume(val[0]);
                    beep(val[0]);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className='h-full flex-1 py-4 px-2 overflow-y-scroll'>
          <RenderFeatureHighlightsSectionComponent
            toggleMirrored={toggleMirrored}
            userPromptScreenshot={userPromptScreenshot}
            userPromptRecord={userPromptRecord}
            isRecording={isRecording}
            autoRecordEnabled={autoRecordEnabled}
            toggleAutoRecord={toggleAutoRecord}
          />
        </div>
      </div>
      {loading && (
        <div className='z-50 absolute w-full h-full flex items-center justify-center bg-primary-foreground'>
          Getting things ready . . . <Rings height={50} color='red' />
        </div>
      )}
    </div>
  );
}