import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { 
    Send, 
    Search, 
    ShieldAlert, 
    Calendar, 
    MessageCircle,
    ChevronLeft,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

interface Conversation {
    id: string;
    participant_one: string;
    participant_two: string;
    last_message_at: string;
    other_participant: {
        id: string;
        full_name: string;
        username: string;
        avatar_url?: string;
    };
}

interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    is_read: boolean;
    is_flagged: boolean;
    created_at: string;
}

export const MessagingSystem = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch conversations
    useEffect(() => {
        if (!user) return;

        const fetchConversations = async () => {
            const { data, error } = await supabase
                .from("conversations")
                .select(`
                    id,
                    participant_one,
                    participant_two,
                    last_message_at
                `)
                .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
                .order("last_message_at", { ascending: false });

            if (error) {
                console.error("Error fetching conversations:", error);
                return;
            }

            // Enrich with participant details
            const enriched = await Promise.all(data.map(async (conv) => {
                const otherId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("id, full_name, username, metadata")
                    .eq("id", otherId)
                    .single();

                return {
                    ...conv,
                    other_participant: {
                        id: profile?.id || otherId,
                        full_name: profile?.full_name || "Zuru User",
                        username: profile?.username || "user",
                        avatar_url: profile?.metadata?.avatar_url
                    }
                };
            }));

            setConversations(enriched as Conversation[]);
            setIsLoading(false);
        };

        fetchConversations();
    }, [user]);

    // Fetch messages for selected conversation
    useEffect(() => {
        if (!selectedConv) return;

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", selectedConv.id)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
                return;
            }

            setMessages(data as Message[]);
            
            // Mark as read
            await supabase
                .from("messages")
                .update({ is_read: true })
                .eq("conversation_id", selectedConv.id)
                .neq("sender_id", user?.id);
        };

        fetchMessages();

        // Subscribe to real-time messages
        const channel = supabase
            .channel(`conv_${selectedConv.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `conversation_id=eq.${selectedConv.id}`
                },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as Message]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedConv, user?.id]);

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConv || !user || isSending) return;

        setIsSending(true);
        const content = newMessage.trim();
        setNewMessage("");

        const { error } = await supabase
            .from("messages")
            .insert({
                conversation_id: selectedConv.id,
                sender_id: user.id,
                content: content
            });

        if (error) {
            toast.error("Failed to send message");
            console.error(error);
        }
        setIsSending(false);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading your messages...</p>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] bg-background border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Sidebar: Conversations List */}
            <div className={cn(
                "w-full md:w-80 border-r border-border flex flex-col bg-card/50",
                selectedConv && "hidden md:flex"
            )}>
                <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                    <h2 className="text-lg font-display font-semibold mb-3">Messages</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search people..." className="pl-9 bg-background/50 border-none focus-visible:ring-primary/20" />
                    </div>
                </div>
                
                <ScrollArea className="flex-1">
                    {conversations.length === 0 ? (
                        <div className="p-8 text-center space-y-3">
                            <div className="h-12 w-12 bg-secondary rounded-full flex items-center justify-center mx-auto">
                                <MessageCircle className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">No conversations yet</p>
                            <p className="text-xs text-muted-foreground/60">Start chatting with hosts to plan your trips!</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {conversations.map((conv) => (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedConv(conv)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group",
                                        selectedConv?.id === conv.id 
                                            ? "bg-primary text-primary-foreground shadow-md scale-[1.01]" 
                                            : "hover:bg-secondary/80"
                                    )}
                                >
                                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                        <AvatarImage src={conv.other_participant.avatar_url} />
                                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                            {conv.other_participant.full_name[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-sm truncate leading-tight">
                                                {conv.other_participant.full_name}
                                            </p>
                                            <span className={cn(
                                                "text-[10px] whitespace-nowrap opacity-60",
                                                selectedConv?.id === conv.id ? "text-primary-foreground" : "text-muted-foreground"
                                            )}>
                                                {format(new Date(conv.last_message_at), "HH:mm")}
                                            </span>
                                        </div>
                                        <p className={cn(
                                            "text-xs truncate opacity-70",
                                            selectedConv?.id === conv.id ? "text-primary-foreground/80" : "text-muted-foreground"
                                        )}>
                                            @{conv.other_participant.username}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Chat Area */}
            <div className={cn(
                "flex-1 flex flex-col bg-background relative",
                !selectedConv && "hidden md:flex items-center justify-center p-12 text-center"
            )}>
                {!selectedConv ? (
                    <div className="max-w-xs animate-in fade-in zoom-in duration-500">
                        <div className="h-20 w-20 bg-primary/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-12">
                            <MessageCircle className="h-10 w-10 text-primary" />
                        </div>
                        <h3 className="text-xl font-display font-semibold mb-2">Select a conversation</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Connect with hosts to ask questions about villas, tours, and bookings.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="p-3 border-b border-border flex items-center justify-between bg-card/30 backdrop-blur-md sticky top-0 z-20">
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="md:hidden rounded-full"
                                    onClick={() => setSelectedConv(null)}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Avatar className="h-10 w-10 border border-border">
                                    <AvatarImage src={selectedConv.other_participant.avatar_url} />
                                    <AvatarFallback>{selectedConv.other_participant.full_name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-bold text-sm leading-none mb-1">
                                        {selectedConv.other_participant.full_name}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Active Now
                                    </div>
                                </div>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="hidden sm:flex gap-2 rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary transition-all active:scale-95"
                                onClick={() => toast.info("Booking flow coming soon to chat!")}
                            >
                                <Calendar className="h-4 w-4" />
                                Book Experience
                            </Button>
                        </div>

                        {/* Security Banner */}
                        <div className="bg-orange-500/5 border-b border-orange-500/10 p-2.5 px-4 flex items-start gap-3">
                            <ShieldAlert className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] leading-tight text-orange-600/80 font-medium">
                                For your security, always keep payments on ZuruSasa. 
                                <span className="font-bold"> Off-platform bookings are not protected.</span>
                            </p>
                        </div>

                        {/* Messages List */}
                        <ScrollArea className="flex-1 p-4 md:p-6 bg-secondary/5">
                            <div className="space-y-4">
                                {messages.map((msg, idx) => {
                                    const isMe = msg.sender_id === user?.id;
                                    const showTimestamp = idx === 0 || 
                                        new Date(msg.created_at).getTime() - new Date(messages[idx-1].created_at).getTime() > 300000;

                                    return (
                                        <div key={msg.id} className="space-y-1">
                                            {showTimestamp && (
                                                <div className="flex justify-center my-4">
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest bg-background px-3 py-1 rounded-full border border-border/50">
                                                        {format(new Date(msg.created_at), "MMM d, HH:mm")}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={cn(
                                                "flex flex-col max-w-[85%] md:max-w-[70%] space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                                isMe ? "ml-auto items-end" : "mr-auto items-start"
                                            )}>
                                                <div className={cn(
                                                    "px-4 py-2.5 rounded-[1.25rem] text-sm shadow-sm",
                                                    isMe 
                                                        ? "bg-[#EE7D30] text-white rounded-br-none" 
                                                        : "bg-card text-foreground border border-border/50 rounded-bl-none"
                                                )}>
                                                    {msg.content}
                                                </div>
                                                
                                                {msg.is_flagged && (
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse">
                                                        <ShieldAlert className="h-3 w-3" />
                                                        Safety Warning: Off-Platform Link Detected
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-4 bg-background border-t border-border">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <Input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    className="rounded-full bg-secondary/50 border-none px-6 focus-visible:ring-primary/20"
                                />
                                <Button 
                                    type="submit" 
                                    size="icon" 
                                    disabled={!newMessage.trim() || isSending}
                                    className="rounded-full shrink-0 h-10 w-10 shadow-lg shadow-primary/10 active:scale-95 transition-transform"
                                >
                                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
