import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Camera, StopCircle, RefreshCw, AlertCircle, MapPin } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface LiveVideoRecorderProps {
    onRecordingComplete: (file: File, location?: { lat: number; lng: number }) => void;
    onCancel?: () => void;
}

export const LiveVideoRecorder = ({ onRecordingComplete, onCancel }: LiveVideoRecorderProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [permissionError, setPermissionError] = useState(false);
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const timerRef = useRef<number | null>(null);

    const MAX_DURATION = 20; // seconds - strictly enforced for verified reels

    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { aspectRatio: 9 / 16, facingMode: "user" },
                audio: true
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setPermissionError(false);
        } catch (err) {
            console.error("Camera permission error:", err);
            setPermissionError(true);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const startRecording = async () => {
        if (!streamRef.current) return;

        // Request location when starting recording
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(coords);
            console.log("Verified location captured:", coords);
        } catch (err) {
            console.error("Location error:", err);
            toast.error("Location access is required for verified recording");
            return;
        }

        chunksRef.current = [];
        const mediaRecorder = new MediaRecorder(streamRef.current);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                chunksRef.current.push(e.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: "video/webm" });
            const file = new File([blob], "verified-recording.webm", { type: "video/webm" });
            onRecordingComplete(file, location || undefined);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);

        // Timer
        let seconds = 0;
        setRecordingTime(0);
        timerRef.current = window.setInterval(() => {
            seconds += 1;
            setRecordingTime(seconds);
            if (seconds >= MAX_DURATION) {
                stopRecording();
            }
        }, 1000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    if (permissionError) {
        return (
            <div className="flex flex-col items-center justify-center bg-black text-white h-full p-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Camera Access Required</h3>
                <p className="text-sm text-gray-400 mb-6">
                    To record a reel, please allow access to your camera and microphone.
                </p>
                <Button onClick={startCamera} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Access
                </Button>
            </div>
        );
    }

    return (
        <div className="relative h-full w-full bg-black flex flex-col items-center justify-center overflow-hidden">
            {/* Live Preview */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlays */}
            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                <div className="flex flex-col gap-4">
                    {/* Timer Progress */}
                    <div className="flex items-center gap-2 text-white text-sm font-medium mb-1">
                        <div className="flex items-center gap-1.5 mr-auto">
                            <div className={cn("h-2 w-2 rounded-full", isRecording ? "bg-red-500 animate-pulse" : "bg-white/40")} />
                            {isRecording ? "REC" : "READY"}
                            {location && <MapPin className="h-3 w-3 text-green-400 ml-2" />}
                        </div>
                        <span>{recordingTime}s</span>
                        <Progress value={(recordingTime / MAX_DURATION) * 100} className="h-2 w-32 bg-white/20" />
                        <span>{MAX_DURATION}s</span>
                    </div>

                    <div className="flex items-center justify-center gap-6">
                        {!isRecording ? (
                            <Button
                                size="icon"
                                variant="destructive"
                                className="h-16 w-16 rounded-full border-4 border-white/30 hover:scale-105 transition-transform"
                                onClick={startRecording}
                            >
                                <Camera className="h-8 w-8" />
                            </Button>
                        ) : (
                            <Button
                                size="icon"
                                variant="destructive"
                                className="h-16 w-16 rounded-full animate-pulse border-4 border-white"
                                onClick={stopRecording}
                            >
                                <StopCircle className="h-8 w-8" />
                            </Button>
                        )}
                    </div>

                    {!isRecording && onCancel && (
                        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onCancel}>
                            Cancel
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
