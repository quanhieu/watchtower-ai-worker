"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { ModeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { beep } from '@/utils/audio';
import { Camera, Divide, FlipHorizontal, MoonIcon, PersonStanding, SunIcon, Video, Volume2 } from 'lucide-react';
import { toast } from "sonner";
import { drawOnCanvas } from '@/utils/draw';
import SocialMediaLinks from '@/components/social-links';
import { Rings } from 'react-loader-spinner';

type Props = {}

let stopTimeout: any = null;
let worker: Worker | null = null;

const HomePage = (props: Props) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [mirrored, setMirrored] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [autoRecordEnabled, setAutoRecordEnabled] = useState<boolean>(false);
  const [volume, setVolume] = useState(0.8);
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Initialize the media recorder
  useEffect(() => {
    if (webcamRef.current) {
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

  useEffect(() => {
    setLoading(true);
    initWorker();
  }, []);

  // Initialize the worker and load the model
  const initWorker = () => {
    worker = new Worker(new URL('../tensorflowWorker.js', import.meta.url));
    worker.onmessage = handleWorkerMessages;
    worker.postMessage({ type: 'loadModel' });
  };

  const handleWorkerMessages = (e: MessageEvent) => {
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
  };

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

  const startRecording = (doBeep: boolean) => {
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
  };

  const userPromptScreenshot = () => {
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
  };

  const userPromptRecord = () => {
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
  };

  const toggleAutoRecord = () => {
    setAutoRecordEnabled(prev => !prev);
    toast(autoRecordEnabled ? 'Autorecord disabled' : 'Autorecord enabled');
  };

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
              onClick={() => setMirrored(prev => !prev)}
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
          <RenderFeatureHighlightsSection />
        </div>
      </div>
      {loading && (
        <div className='z-50 absolute w-full h-full flex items-center justify-center bg-primary-foreground'>
          Getting things ready . . . <Rings height={50} color='red' />
        </div>
      )}
    </div>
  );

  function RenderFeatureHighlightsSection() {
    return (
      <div className="text-xs text-muted-foreground">
        <ul className="space-y-4">
          <li>
            <strong>Dark Mode/Sys Theme 🌗</strong>
            <p>Toggle between dark mode and system theme.</p>
            <Button className="my-2 h-6 w-6" variant={"outline"} size={"icon"}>
              <SunIcon size={14} />
            </Button>
            {" "} / {" "}
            <Button className="my-2 h-6 w-6" variant={"outline"} size={"icon"}>
              <MoonIcon size={14} />
            </Button>
          </li>
          <li>
            <strong>Horizontal Flip ↔️</strong>
            <p>Adjust horizontal orientation.</p>
            <Button className='h-6 w-6 my-2'
              variant={'outline'} size={'icon'}
              onClick={() => setMirrored(prev => !prev)}
            >
              <FlipHorizontal size={14} />
            </Button>
          </li>
          <Separator />
          <li>
            <strong>Take Pictures 📸</strong>
            <p>Capture snapshots at any moment from the video feed.</p>
            <Button
              className='h-6 w-6 my-2'
              variant={'outline'} size={'icon'}
              onClick={userPromptScreenshot}
            >
              <Camera size={14} />
            </Button>
          </li>
          <li>
            <strong>Manual Video Recording 📽️</strong>
            <p>Manually record video clips as needed.</p>
            <Button className='h-6 w-6 my-2'
              variant={isRecording ? 'destructive' : 'outline'} size={'icon'}
              onClick={userPromptRecord}
            >
              <Video size={14} />
            </Button>
          </li>
          <Separator />
          <li>
            <strong>Enable/Disable Auto Record 🚫</strong>
            <p>Option to enable/disable automatic video recording whenever required.</p>
            <Button className='h-6 w-6 my-2'
              variant={autoRecordEnabled ? 'destructive' : 'outline'}
              size={'icon'}
              onClick={toggleAutoRecord}
            >
              {autoRecordEnabled ? <Rings color='white' height={30} /> : <PersonStanding size={14} />}
            </Button>
          </li>
          <li>
            <strong>Volume Slider 🔊</strong>
            <p>Adjust the volume level of the notifications.</p>
          </li>
          <li>
            <strong>Camera Feed Highlighting 🎨</strong>
            <p>Highlights persons in <span style={{ color: "#FF0F0F" }}>red</span> and other objects in <span style={{ color: "#00B612" }}>green</span>.</p>
          </li>
          <Separator />
          <li className="space-y-4">
            <strong>Share your thoughts 💬</strong>
            <SocialMediaLinks />
            <br />
            <br />
            <br />
          </li>
        </ul>
      </div>
    );
  }

  function resizeCanvas(canvasRef: React.RefObject<HTMLCanvasElement>, webcamRef: React.RefObject<Webcam>) {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;

    if (canvas && video) {
      const { videoWidth, videoHeight } = video;
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }
  }

  function formatDate(d: Date) {
    const formattedDate =
      [
        (d.getMonth() + 1).toString().padStart(2, "0"),
        d.getDate().toString().padStart(2, "0"),
        d.getFullYear(),
      ].join("-") +
      " " +
      [
        d.getHours().toString().padStart(2, "0"),
        d.getMinutes().toString().padStart(2, "0"),
        d.getSeconds().toString().padStart(2, "0"),
      ].join("-");
    return formattedDate;
  }

  function base64toBlob(base64Data: any) {
    const byteCharacters = atob(base64Data.split(",")[1]);
    const arrayBuffer = new ArrayBuffer(byteCharacters.length);
    const byteArray = new Uint8Array(arrayBuffer);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }

    return new Blob([arrayBuffer], { type: "image/png" });
  }
};

export default HomePage;
