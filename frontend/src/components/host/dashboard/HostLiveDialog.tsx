import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { 
    Video, VideoOff, Mic, MicOff, Users, Play, Square, 
    MessageSquare, Send, RefreshCw, Sparkles, Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";

interface HostLiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    eventId: string;
    eventTitle: string;
    onSuccess: () => void;
}

interface ChatMessage {
    id: string;
    user_name: string;
    text: string;
    timestamp: Date;
}

const MOCK_NAMES = [
    "Amani_Ke", "John_Mombasa", "Fatuma254", "Mwangi_Travels", 
    "Sasa_Vibes", "Elena_Sunset", "Liam_Wild", "Zuru_Fan_1"
];

const MOCK_COMMENTS = [
    "This looks incredible! Wish I was there.",
    "What's the entry price for today?",
    "Which DJ is playing tonight?",
    "Just booked my ticket through Zuru!",
    "Amazing sunset vibes! 🌅",
    "Is the kitchen still open?",
    "Greetings from Nairobi! 🙌",
    "Looks like a full house tonight!"
];

export const HostLiveDialog = ({ open, onOpenChange, eventId, eventTitle, onSuccess }: HostLiveDialogProps) => {
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    const [isLive, setIsLive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [loading, setLoading] = useState(false);

    const [viewers, setViewers] = useState(0);
    const [duration, setDuration] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Chat
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const channelRef = useRef<any>(null);

    // Camera devices tracking for cycling / rotating
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [currentDeviceIndex, setCurrentDeviceIndex] = useState<number>(0);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

    // Initialize Camera Stream
    const startCamera = async (deviceId?: string, preferredFacingMode?: "user" | "environment") => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            const activeFacingMode = preferredFacingMode || facingMode;
            const videoConstraints: MediaTrackConstraints = deviceId 
                ? { deviceId: { exact: deviceId } } 
                : { facingMode: activeFacingMode };

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    ...videoConstraints,
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: true
            });
            
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }

            // Enumerate devices to allow switching/rotation
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === "videoinput");
            setVideoDevices(videoInputs);
            
            if (deviceId) {
                const idx = videoInputs.findIndex(d => d.deviceId === deviceId);
                if (idx !== -1) setCurrentDeviceIndex(idx);
            } else {
                const activeTrack = stream.getVideoTracks()[0];
                if (activeTrack) {
                    const settings = activeTrack.getSettings();
                    if (settings.deviceId) {
                        const idx = videoInputs.findIndex(d => d.deviceId === settings.deviceId);
                        if (idx !== -1) setCurrentDeviceIndex(idx);
                    }
                }
            }
        } catch (err: any) {
            console.error("Camera access failed:", err);
            toast.error("Failed to access camera/microphone. Check permissions.");
        }
    };

    const switchCamera = () => {
        if (videoDevices.length > 1) {
            const nextIndex = (currentDeviceIndex + 1) % videoDevices.length;
            const nextDevice = videoDevices[nextIndex];
            if (nextDevice) {
                startCamera(nextDevice.deviceId);
            }
        } else {
            const nextFacing = facingMode === "user" ? "environment" : "user";
            setFacingMode(nextFacing);
            startCamera(undefined, nextFacing);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    // Access camera when dialog opens
    useEffect(() => {
        if (open) {
            startCamera();
        } else {
            handleEndBroadcast();
            stopCamera();
        }
        return () => {
            stopCamera();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [open]);

    // Duration Timer
    useEffect(() => {
        if (isLive) {
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setDuration(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isLive]);

    // Setup Supabase Realtime Channels for chat & viewers count sync (using Presence)
    useEffect(() => {
        if (isLive && open) {
            const channelId = `event_chat_${eventId}`;
            const channel = supabase.channel(channelId);
            channelRef.current = channel;

            channel
                .on("broadcast", { event: "chat_msg" }, (payload) => {
                    const receivedMsg: ChatMessage = {
                        id: payload.payload.id || Math.random().toString(),
                        user_name: payload.payload.user_name || "Anonymous",
                        text: payload.payload.text || "",
                        timestamp: new Date()
                    };
                    setChatMessages(prev => [...prev, receivedMsg]);
                })
                .on("presence", { event: "sync" }, () => {
                    const state = channel.presenceState();
                    const activeCount = Object.keys(state).length;
                    setViewers(activeCount);
                })
                .subscribe(async (status) => {
                    if (status === "SUBSCRIBED") {
                        console.log("Joined real-time event channel successfully:", channelId);
                        // Track host presence in the channel
                        await channel.track({
                            user_id: user?.id || "host",
                            online_at: new Date().toISOString()
                        });
                    }
                });

            return () => {
                supabase.removeChannel(channel);
                channelRef.current = null;
            };
        }
    }, [isLive, eventId, open, user]);

    // Update Supabase event table viewer count so feed matches
    useEffect(() => {
        if (isLive) {
            supabase
                .from("events")
                .update({ viewer_count: viewers })
                .eq("id", eventId)
                .then();
        }
    }, [viewers, isLive, eventId]);

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const handleStartBroadcast = async () => {
        setLoading(true);
        try {
            // Update Supabase events status to is_live = true
            const { error } = await supabase
                .from("events")
                .update({ 
                    is_live: true, 
                    live_stream_url: "mock-realtime-webcam",
                    viewer_count: 10
                })
                .eq("id", eventId);

            if (error) throw error;

            setIsLive(true);
            toast.success("You are now LIVE streaming!");
            onSuccess();
        } catch (err: any) {
            console.error("Failed to start stream:", err);
            toast.error(err.message || "Failed to start live stream database update");
        } finally {
            setLoading(false);
        }
    };

    const handleEndBroadcast = async () => {
        if (!isLive) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from("events")
                .update({ 
                    is_live: false, 
                    viewer_count: 0
                })
                .eq("id", eventId);

            if (error) throw error;

            setIsLive(false);
            setChatMessages([]);
            toast.success("Broadcast ended successfully.");
            onSuccess();
        } catch (err: any) {
            console.error("Failed to end stream:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = () => {
        if (!newMessage.trim() || !channelRef.current) return;
        
        const myMsg: ChatMessage = {
            id: Math.random().toString(),
            user_name: "Host (You)",
            text: newMessage.trim(),
            timestamp: new Date()
        };
        
        setChatMessages(prev => [...prev, myMsg]);
        setNewMessage("");

        // Broadcast to guest viewers in real-time
        channelRef.current.send({
            type: "broadcast",
            event: "chat_msg",
            payload: {
                id: myMsg.id,
                user_name: myMsg.user_name,
                text: myMsg.text
            }
        });
    };

    const toggleAudio = () => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    // Format duration helper (hh:mm:ss)
    const formatDuration = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <Dialog open={open} onOpenChange={(val) => { if (!isLive) onOpenChange(val); else toast.warning("Please end your live stream before closing."); }}>
            <DialogContent className="sm:max-w-4xl rounded-3xl bg-black text-white border-white/10 shadow-2xl p-0 overflow-hidden grid grid-cols-1 md:grid-cols-3 aspect-auto max-h-[90vh]">
                
                {/* Left Stream Area (Webcam preview + overlay indicators) */}
                <div className="md:col-span-2 relative bg-zinc-950 flex flex-col justify-between p-4 min-h-[400px] md:min-h-[500px]">
                    
                    {/* Top Overlay Stats */}
                    <div className="flex justify-between items-center z-10 w-full">
                        <div className="flex items-center gap-2">
                            {isLive ? (
                                <span className="flex items-center gap-1 bg-red-600 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded-full tracking-wider animate-pulse shadow-md">
                                    <span className="h-1.5 w-1.5 bg-white rounded-full"></span>
                                    Live
                                </span>
                            ) : (
                                <span className="bg-zinc-800 text-zinc-300 font-bold text-[10px] uppercase px-2.5 py-1 rounded-full">
                                    Preview Mode
                                </span>
                            )}
                            {isLive && (
                                <span className="bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded-full backdrop-blur-md">
                                    {formatDuration(duration)}
                                </span>
                            )}
                        </div>

                        {isLive && (
                            <div className="flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md">
                                <Users size={12} className="text-primary" />
                                {viewers} watching
                            </div>
                        )}
                    </div>

                    {/* Camera Video Feed */}
                    <div className="absolute inset-0 z-0">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted // Always mute local video playback in dialog to prevent echo feedback
                            className={cn(
                                "w-full h-full object-cover transition-opacity duration-300",
                                isVideoOff ? "opacity-0" : "opacity-100"
                            )}
                        />
                        {isVideoOff && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 text-zinc-500">
                                <VideoOff size={48} className="mb-2" />
                                <span className="text-xs">Camera is turned off</span>
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Controls */}
                    <div className="w-full flex justify-between items-center z-10 pt-4 bg-gradient-to-t from-black/80 to-transparent p-4 absolute bottom-0 left-0">
                        <div className="flex gap-2">
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={toggleAudio}
                                className={cn(
                                    "rounded-xl h-10 w-10 border-white/10 hover:bg-white/10",
                                    isMuted ? "bg-red-500/20 text-red-500 border-red-500" : "bg-black/40 text-white"
                                )}
                            >
                                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                            </Button>
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={toggleVideo}
                                className={cn(
                                    "rounded-xl h-10 w-10 border-white/10 hover:bg-white/10",
                                    isVideoOff ? "bg-red-500/20 text-red-500 border-red-500" : "bg-black/40 text-white"
                                )}
                            >
                                {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                            </Button>
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={switchCamera}
                                title="Switch Camera"
                                className="rounded-xl h-10 w-10 border-white/10 hover:bg-white/10 bg-black/40 text-white"
                            >
                                <RefreshCw size={18} />
                            </Button>
                        </div>

                        <div>
                            {isLive ? (
                                <Button
                                    onClick={handleEndBroadcast}
                                    disabled={loading}
                                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-red-600/20"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                                    End Broadcast
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleStartBroadcast}
                                    disabled={loading}
                                    className="rounded-xl bg-primary hover:bg-primary/95 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-primary/20"
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-white" />}
                                    Start Live Stream
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Chat Panel */}
                <div className="border-t md:border-t-0 md:border-l border-white/10 bg-zinc-950 flex flex-col h-[300px] md:h-full">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                        <div>
                            <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Event Stream</h4>
                            <h3 className="font-bold text-sm truncate max-w-[200px]" title={eventTitle}>
                                {eventTitle}
                            </h3>
                        </div>
                        <MessageSquare size={16} className="text-primary" />
                    </div>

                    {/* Messages container */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-center px-4">
                                <MessageSquare size={24} className="opacity-20 mb-2" />
                                <p className="text-[11px] font-medium leading-normal">
                                    {isLive 
                                        ? "Live chat is open. Message updates will post here in real-time."
                                        : "Start live stream to launch realtime chat channel."}
                                </p>
                            </div>
                        ) : (
                            chatMessages.map((msg) => (
                                <div key={msg.id} className="text-xs space-y-0.5">
                                    <span className={cn(
                                        "font-bold mr-1.5",
                                        msg.user_name === "Host (You)" ? "text-primary" : "text-orange-400"
                                    )}>
                                        @{msg.user_name}:
                                    </span>
                                    <span className="text-zinc-300 break-words">{msg.text}</span>
                                </div>
                            ))
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-3 border-t border-white/10 bg-black/40 flex gap-2">
                        <Input
                            placeholder={isLive ? "Type a stream message..." : "Stream offline..."}
                            disabled={!isLive}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                            className="bg-zinc-900 border-white/10 rounded-xl h-9 text-xs focus:ring-primary"
                        />
                        <Button
                            size="icon"
                            disabled={!isLive || !newMessage.trim()}
                            onClick={handleSendMessage}
                            className="rounded-xl bg-primary hover:bg-primary/90 text-white h-9 w-9"
                        >
                            <Send size={14} />
                        </Button>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
};
