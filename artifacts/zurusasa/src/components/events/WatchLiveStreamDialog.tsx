import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { ZuruEvent } from "@/types/events";
import { useAuth } from "@/components/AuthProvider";
import { 
    Tv, Users, Heart, Share2, Send, MessageSquare, 
    Volume2, VolumeX, X, AlertCircle, ShoppingBag 
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WatchLiveStreamDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: ZuruEvent | null;
    onBook?: (event: ZuruEvent) => void;
}

interface ChatMessage {
    id: string;
    user_name: string;
    text: string;
    timestamp: Date;
}



export const WatchLiveStreamDialog = ({ open, onOpenChange, event, onBook }: WatchLiveStreamDialogProps) => {
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<any>(null);

    const [isMuted, setIsMuted] = useState(false); // Play unmuted by default
    const [isPlaying, setIsPlaying] = useState(true);
    const [viewers, setViewers] = useState(0);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [likesCount, setLikesCount] = useState(0);
    const [showHeartAnimation, setShowHeartAnimation] = useState(false);
    
    const channelRef = useRef<any>(null);
    const [isHlsActive, setIsHlsActive] = useState(false);

    // WebRTC connection refs for real-time webcam streaming from host
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const guestIdRef = useRef(Math.random().toString(36).substring(7));

    // Swipe down to close on mobile
    const touchStartY = useRef(0);
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY.current;
        if (diff > 0) {
            setDragOffsetY(diff);
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (dragOffsetY > 150) {
            if (window.confirm("Are you sure you want to leave the live stream?")) {
                onOpenChange(false);
            }
        }
        setDragOffsetY(0);
    };

    // Setup Video Player (HLS or Fallback MP4)
    useEffect(() => {
        if (!open || !event || !videoRef.current) return;

        const video = videoRef.current;
        // Determine stream URL: if host matches live-stream-mock, we can simulate with a sample MP4
        // Otherwise use the event's live_stream_url
        const streamUrl = event.live_stream_url && event.live_stream_url !== "mock-realtime-webcam"
            ? event.live_stream_url
            : "https://www.w3schools.com/html/movie.mp4"; // Sample travel loop

        const isHls = streamUrl.endsWith(".m3u8");
        setIsHlsActive(isHls);

        // Reset video muted state
        video.muted = isMuted;

        if (isHls) {
            // Load HLS dynamically
            import("hls.js").then((HlsModule) => {
                const Hls = HlsModule.default;
                if (Hls.isSupported()) {
                    if (hlsRef.current) hlsRef.current.destroy();
                    const hls = new Hls();
                    hlsRef.current = hls;
                    hls.loadSource(streamUrl);
                    hls.attachMedia(video);
                    video.play().catch(err => {
                        console.warn("HLS autoplay unmuted blocked, falling back to muted:", err);
                        video.muted = true;
                        setIsMuted(true);
                        video.play().catch(e => console.error("Muted HLS autoplay failed:", e));
                    });
                } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                    video.src = streamUrl;
                    video.play().catch(err => {
                        console.warn("Native HLS autoplay unmuted blocked, falling back to muted:", err);
                        video.muted = true;
                        setIsMuted(true);
                        video.play().catch(e => console.error("Muted native HLS autoplay failed:", e));
                    });
                }
            });
        } else {
            video.src = streamUrl;
            video.loop = true;
            video.play().catch(err => {
                console.warn("Autoplay unmuted blocked, falling back to muted:", err);
                video.muted = true;
                setIsMuted(true);
                video.play().catch(e => console.error("Muted fallback autoplay failed:", e));
            });
        }

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            if (video) {
                video.pause();
                video.removeAttribute("src");
                video.srcObject = null; // Clean up WebRTC stream object
                video.load();
            }
        };
    }, [open, event]);

    // Setup Supabase Realtime Channels for chat & viewers count sync (using Presence) + WebRTC Signaling
    useEffect(() => {
        if (open && event) {
            const channelId = `event_chat_${event.id}`;
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
                .on("broadcast", { event: "stream_ended" }, () => {
                    console.log("Stream ended by host");
                    toast.info("The host has ended the live stream.");
                    onOpenChange(false);
                })
                .on("broadcast", { event: "webrtc_signal" }, async (payload) => {
                    const { target, sender, type, desc, candidate } = payload.payload;
                    
                    // Only process signals intended for this guest
                    if (target !== guestIdRef.current) return;

                    if (type === "offer") {
                        console.log("Guest received WebRTC SDP offer from host");

                        if (peerConnectionRef.current) {
                            peerConnectionRef.current.close();
                        }

                        const pc = new RTCPeerConnection({
                            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
                        });
                        peerConnectionRef.current = pc;

                        // Send local candidate to host
                        pc.onicecandidate = (e) => {
                            if (e.candidate && channelRef.current) {
                                channelRef.current.send({
                                    type: "broadcast",
                                    event: "webrtc_signal",
                                    payload: {
                                        target: "host",
                                        sender: guestIdRef.current,
                                        type: "candidate",
                                        candidate: e.candidate
                                    }
                                });
                            }
                        };

                        // When remote track (host webcam) is received, attach to player
                        pc.ontrack = (e) => {
                            console.log("Guest received remote video/audio track from host webcam");
                            if (videoRef.current) {
                                videoRef.current.srcObject = e.streams[0];
                                // Force play the new stream
                                videoRef.current.play().catch(err => {
                                    console.warn("WebRTC stream autoplay unmuted blocked, playing muted:", err);
                                    if (videoRef.current) {
                                        videoRef.current.muted = true;
                                        setIsMuted(true);
                                        videoRef.current.play().catch(e => console.error("WebRTC muted play failed:", e));
                                    }
                                });
                            }
                        };

                        await pc.setRemoteDescription(new RTCSessionDescription(desc));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);

                        channelRef.current.send({
                            type: "broadcast",
                            event: "webrtc_signal",
                            payload: {
                                target: "host",
                                sender: guestIdRef.current,
                                type: "answer",
                                desc: answer
                            }
                        });
                    } else if (type === "candidate") {
                        if (peerConnectionRef.current) {
                            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                    }
                })
                .on("presence", { event: "sync" }, () => {
                    const state = channel.presenceState();
                    const activeCount = Object.keys(state).length;
                    setViewers(activeCount);
                })
                .subscribe(async (status) => {
                    if (status === "SUBSCRIBED") {
                        console.log("Guest joined live chat channel:", channelId);
                        // Track guest presence in the channel
                        await channel.track({
                            user_id: user?.id || "anonymous",
                            online_at: new Date().toISOString()
                        });

                        // Notify host that guest has joined, asking for WebRTC stream
                        channel.send({
                            type: "broadcast",
                            event: "webrtc_signal",
                            payload: {
                                sender: guestIdRef.current,
                                type: "join",
                                target: "host"
                            }
                        });
                    }
                });

            return () => {
                supabase.removeChannel(channel);
                channelRef.current = null;
                if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                    peerConnectionRef.current = null;
                }
            };
        }
    }, [open, event, user]);

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const handleSendMessage = () => {
        if (!newMessage.trim() || !channelRef.current || !event) return;

        const userName = user?.email?.split("@")[0] || "Guest_" + Math.floor(Math.random() * 900 + 100);
        const myMsg: ChatMessage = {
            id: Math.random().toString(),
            user_name: userName,
            text: newMessage.trim(),
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, myMsg]);
        setNewMessage("");

        // Broadcast msg to host and other guests in real-time
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

    const handleLikeClick = () => {
        setLikesCount(prev => prev + 1);
        setShowHeartAnimation(true);
        setTimeout(() => setShowHeartAnimation(false), 800);

        if (channelRef.current) {
            channelRef.current.send({
                type: "broadcast",
                event: "chat_msg",
                payload: {
                    id: Math.random().toString(),
                    user_name: user?.email?.split("@")[0] || "Guest",
                    text: "liked the stream! ❤️"
                }
            });
        }
    };

    const handleShare = async () => {
        if (!event) return;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Live: ${event.title}`,
                    text: `Watch the live stream for ${event.title} on ZuruSasa!`,
                    url: window.location.origin + `/event/${event.id}`,
                });
            } else {
                await navigator.clipboard.writeText(window.location.origin + `/event/${event.id}`);
                toast.success("Stream link copied!");
            }
        } catch (err) {}
    };

    if (!event) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                style={{ 
                    transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined, 
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out' 
                }}
                className="w-full h-[100dvh] md:h-auto md:max-h-[90vh] md:max-w-4xl rounded-none md:rounded-3xl bg-black text-white border-none md:border-white/10 shadow-2xl p-0 overflow-hidden grid grid-cols-1 md:grid-cols-3 aspect-auto max-h-[100dvh]"
            >
                
                {/* Left Stream Area */}
                <div 
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="md:col-span-2 relative bg-zinc-950 flex flex-col justify-between p-4 h-full min-h-0 md:min-h-[500px]"
                >
                    
                    {/* Top Overlay HUD */}
                    <div className="flex justify-between items-start z-10 w-full">
                        <div className="flex flex-col gap-1.5">
                            <span className="flex items-center gap-1.5 bg-red-600 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded-full tracking-wider animate-pulse shadow-md w-fit">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                                </span>
                                Live Stream
                            </span>
                            <h2 className="text-sm font-bold bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 truncate max-w-[200px] sm:max-w-[260px] drop-shadow-md">
                                {event.title}
                            </h2>
                        </div>

                        <div className="flex gap-2">
                            {/* Viewer counter */}
                            <div className="flex items-center gap-1 bg-black/60 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-full backdrop-blur-md border border-white/5 shadow-lg">
                                <Users size={11} className="text-primary animate-pulse" />
                                {viewers} watching
                            </div>
                            
                            {/* Share button */}
                            <Button 
                                size="icon" 
                                variant="outline" 
                                onClick={handleShare}
                                className="h-8 w-8 rounded-full bg-black/60 hover:bg-white/10 border-white/5 backdrop-blur-md"
                            >
                                <Share2 size={13} className="text-white" />
                            </Button>
                        </div>
                    </div>

                    {/* Stream Video Player */}
                    <div className="absolute inset-0 z-0 bg-black">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted={isMuted}
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover"
                        />
                        
                        {/* Audio status hint */}
                        {isMuted && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                                <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase text-white border border-white/10">
                                    Tap speaker to unmute
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile Chat Overlay (Only visible on mobile) */}
                    <div className="md:hidden flex flex-col justify-end z-10 w-full max-w-[85%] absolute bottom-28 left-4 space-y-2 pointer-events-none">
                        <div className="max-h-[160px] overflow-y-auto space-y-2 no-scrollbar flex flex-col justify-end pointer-events-auto">
                            {chatMessages.slice(-8).map((msg) => (
                                <div key={msg.id} className="text-xs bg-black/45 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/5 w-fit break-words shadow-md max-w-full">
                                    <span className={cn(
                                        "font-bold mr-1.5",
                                        msg.user_name.includes("Host") ? "text-primary" : "text-orange-400"
                                    )}>
                                        @{msg.user_name}:
                                    </span>
                                    <span className="text-zinc-200">{msg.text}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </div>

                    {/* Hearts animation overlay */}
                    {showHeartAnimation && (
                        <div className="absolute bottom-28 right-4 z-20 pointer-events-none animate-bounce">
                            <Heart size={36} className="text-red-500 fill-red-500 drop-shadow-lg" />
                        </div>
                    )}

                    {/* Bottom controls HUD */}
                    <div className="w-full flex flex-col gap-3 z-10 pt-4 bg-gradient-to-t from-black/90 to-transparent p-4 absolute bottom-0 left-0">
                        {/* Mobile input field (only visible on mobile) */}
                        <div className="md:hidden flex gap-2 w-full">
                            <Input
                                placeholder="Say something..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                                className="bg-black/50 border-white/10 rounded-xl h-9 text-xs focus:ring-primary backdrop-blur-sm text-white placeholder-zinc-400 flex-1"
                            />
                            <Button
                                size="icon"
                                disabled={!newMessage.trim()}
                                onClick={handleSendMessage}
                                className="rounded-xl bg-primary hover:bg-primary/90 text-white h-9 w-9 shrink-0"
                            >
                                <Send size={14} />
                            </Button>
                        </div>

                        {/* Control buttons */}
                        <div className="w-full flex justify-between items-center">
                            {/* Sound Toggle */}
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={() => setIsMuted(!isMuted)}
                                className="rounded-xl h-10 w-10 border-white/10 bg-black/40 text-white hover:bg-white/10"
                            >
                                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </Button>

                            {/* Interactive Hearts Trigger & Booking Link */}
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleLikeClick}
                                    className="rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-bold flex items-center gap-1.5 h-10 px-4 hover:bg-red-500/30 active:scale-95 transition-transform"
                                >
                                    <Heart size={16} className="fill-current text-red-500" />
                                    <span>{likesCount > 0 ? likesCount : "Like"}</span>
                                </Button>

                                {onBook && (
                                    <Button
                                        onClick={() => onBook(event)}
                                        className="rounded-xl bg-primary hover:bg-primary/95 text-white font-bold flex items-center gap-1.5 h-10 px-5 shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                                    >
                                        <ShoppingBag size={16} />
                                        <span>Book Spot</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Chat Panel (Desktop only) */}
                <div className="hidden md:flex border-l border-white/10 bg-zinc-950 flex-col h-full overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                        <div>
                            <h4 className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Live Chat</h4>
                            <h3 className="font-bold text-sm truncate max-w-[200px]" title={event.location}>
                                📍 {event.location}
                            </h3>
                        </div>
                        <MessageSquare size={16} className="text-primary" />
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <div className="text-[10px] text-zinc-500 text-center py-1 border border-dashed border-white/5 rounded-lg bg-white/[0.01]">
                            Welcome to the live chat room! Keep messages respectful.
                        </div>
                        
                        {chatMessages.map((msg) => (
                            <div key={msg.id} className="text-xs space-y-0.5 animate-fade-in">
                                <span className={cn(
                                    "font-bold mr-1.5",
                                    msg.user_name.includes("Host") ? "text-primary" : "text-orange-400"
                                )}>
                                    @{msg.user_name}:
                                </span>
                                <span className="text-zinc-300 break-words">{msg.text}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-3 border-t border-white/10 bg-black/40 flex gap-2">
                        <Input
                            placeholder="Send a chat message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSendMessage(); }}
                            className="bg-zinc-900 border-white/10 rounded-xl h-9 text-xs focus:ring-primary"
                        />
                        <Button
                            size="icon"
                            disabled={!newMessage.trim()}
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
