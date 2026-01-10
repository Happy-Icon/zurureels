import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, X, MapPin, Clock, Tag, Copy, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Recommendation {
  activity: string;
  why_it_fits: string;
  best_time: string;
  tags: string[];
}

interface MoodDiscoveryResponse {
  type: "mood_discovery";
  mood: string;
  suggested_tags: string[];
  description: string;
}

interface ConciergeResponse {
  type: "city_concierge";
  city: string;
  recommendations: Recommendation[];
}

interface ReelCaptionResponse {
  type: "reel_caption";
  caption: string;
  cta: string;
  hashtags: string[];
}

interface ReviewSummaryResponse {
  type: "review_summary";
  summary: string;
  highlight: string;
}

interface ScheduleItem {
  time: string;
  activity: string;
  note: string;
}

interface MicroItineraryResponse {
  type: "micro_itinerary";
  schedule: ScheduleItem[];
}

interface SafetyNoteResponse {
  type: "safety_note";
  note: string;
}

interface UserContextResponse {
  type: "user_context";
  travel_style: string;
  group_type: string;
  energy_level: string;
  content_goal: string;
}

interface ActivityScoreResponse {
  type: "activity_score";
  activity: string;
  reel_score: number;
  effort_level: string;
  crowd_level: string;
}

type ParsedResponse = ConciergeResponse | MoodDiscoveryResponse | ReelCaptionResponse | ReviewSummaryResponse | MicroItineraryResponse | SafetyNoteResponse | UserContextResponse | ActivityScoreResponse;

// Try to parse JSON from content
function parseAIResponse(content: string): ParsedResponse | null {
  try {
    // Try to find JSON in the content (might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                      content.match(/(\{[\s\S]*"type"\s*:\s*"(?:city_concierge|mood_discovery|reel_caption|review_summary|micro_itinerary|safety_note|user_context|activity_score)"[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const parsed = JSON.parse(jsonStr);
    
    if (parsed.type === "city_concierge" && Array.isArray(parsed.recommendations)) {
      return parsed as ConciergeResponse;
    }
    if (parsed.type === "mood_discovery" && Array.isArray(parsed.suggested_tags)) {
      return parsed as MoodDiscoveryResponse;
    }
    if (parsed.type === "reel_caption" && parsed.caption && parsed.cta) {
      return parsed as ReelCaptionResponse;
    }
    if (parsed.type === "review_summary" && parsed.summary) {
      return parsed as ReviewSummaryResponse;
    }
    if (parsed.type === "micro_itinerary" && Array.isArray(parsed.schedule)) {
      return parsed as MicroItineraryResponse;
    }
    if (parsed.type === "safety_note" && parsed.note) {
      return parsed as SafetyNoteResponse;
    }
    if (parsed.type === "user_context" && parsed.travel_style) {
      return parsed as UserContextResponse;
    }
    if (parsed.type === "activity_score" && parsed.activity && typeof parsed.reel_score === "number") {
      return parsed as ActivityScoreResponse;
    }
  } catch {
    // Not JSON or not a structured response
  }
  return null;
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="bg-background border border-border rounded-lg p-3 space-y-2">
      <h4 className="font-semibold text-sm text-foreground">{rec.activity}</h4>
      <p className="text-xs text-muted-foreground">{rec.why_it_fits}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {rec.best_time}
        </span>
      </div>
      {rec.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {rec.tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MoodDiscoveryCard({ data }: { data: MoodDiscoveryResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">✨</span>
        <span className="font-medium text-sm capitalize">Feeling {data.mood}</span>
      </div>
      <p className="text-xs text-muted-foreground">{data.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {data.suggested_tags.map((tag, i) => (
          <span
            key={i}
            className="px-3 py-1.5 bg-primary/15 text-primary text-xs font-medium rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReelCaptionCard({ data }: { data: ReelCaptionResponse }) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const allHashtags = data.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎬</span>
        <span className="font-medium text-sm">Reel Content Ready</span>
      </div>
      
      {/* Caption */}
      <div className="bg-background border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Caption</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => copyToClipboard(data.caption, "Caption")}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-sm">{data.caption}</p>
      </div>
      
      {/* CTA */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-primary font-medium">Call to Action</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={() => copyToClipboard(data.cta, "CTA")}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <p className="text-sm font-medium text-primary">{data.cta}</p>
      </div>
      
      {/* Hashtags */}
      {data.hashtags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
              <Hash className="h-3 w-3" /> Hashtags
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={() => copyToClipboard(allHashtags, "Hashtags")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {data.hashtags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-secondary text-secondary-foreground text-[10px] rounded-full"
              >
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewSummaryCard({ data }: { data: ReviewSummaryResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">⭐</span>
        <span className="font-medium text-sm">Review Summary</span>
      </div>
      <div className="bg-background border border-border rounded-lg p-3 space-y-2">
        <p className="text-sm italic">"{data.summary}"</p>
        {data.highlight && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Highlight:</span>
            <span className="px-2 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-medium rounded-full">
              {data.highlight}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SafetyNoteCard({ data }: { data: SafetyNoteResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <span className="font-medium text-sm">Safety & Expectations</span>
      </div>
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <p className="text-sm text-foreground">{data.note}</p>
      </div>
    </div>
  );
}

const contextLabels: Record<string, Record<string, { icon: string; label: string }>> = {
  travel_style: {
    adventurous: { icon: "🏔️", label: "Adventurous" },
    relaxed: { icon: "🌴", label: "Relaxed" },
    cultural: { icon: "🏛️", label: "Cultural" },
    luxury: { icon: "✨", label: "Luxury" },
    budget: { icon: "💰", label: "Budget-Friendly" },
  },
  group_type: {
    solo: { icon: "🚶", label: "Solo" },
    couple: { icon: "💑", label: "Couple" },
    family: { icon: "👨‍👩‍👧‍👦", label: "Family" },
    friends: { icon: "👯", label: "Friends" },
    business: { icon: "💼", label: "Business" },
  },
  energy_level: {
    high: { icon: "⚡", label: "High Energy" },
    medium: { icon: "🔋", label: "Moderate" },
    low: { icon: "😌", label: "Easy-Going" },
  },
  content_goal: {
    photos: { icon: "📸", label: "Photo Spots" },
    reels: { icon: "🎬", label: "Reel-Worthy" },
    memories: { icon: "💭", label: "Memory Making" },
    relaxation: { icon: "🧘", label: "Relaxation" },
  },
};

function UserContextCard({ data }: { data: UserContextResponse }) {
  const getLabel = (category: string, value: string) => {
    const normalized = value.toLowerCase().trim();
    return contextLabels[category]?.[normalized] || { icon: "•", label: value };
  };

  const items = [
    { category: "travel_style", value: data.travel_style, title: "Style" },
    { category: "group_type", value: data.group_type, title: "Group" },
    { category: "energy_level", value: data.energy_level, title: "Energy" },
    { category: "content_goal", value: data.content_goal, title: "Goal" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">👤</span>
        <span className="font-medium text-sm">Your Travel Profile</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const { icon, label } = getLabel(item.category, item.value);
          return (
            <div
              key={item.category}
              className="bg-primary/10 border border-primary/20 rounded-lg p-2 text-center"
            >
              <span className="text-lg">{icon}</span>
              <p className="text-[10px] text-muted-foreground mt-1">{item.title}</p>
              <p className="text-xs font-medium">{label}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        I'll tailor my recommendations based on your profile!
      </p>
    </div>
  );
}

function ActivityScoreCard({ data }: { data: ActivityScoreResponse }) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 5) return "text-yellow-500";
    return "text-red-500";
  };

  const getEffortIcon = (level: string) => {
    const normalized = level.toLowerCase();
    if (normalized === "low") return { icon: "🟢", label: "Easy" };
    if (normalized === "medium") return { icon: "🟡", label: "Moderate" };
    return { icon: "🔴", label: "Challenging" };
  };

  const getCrowdIcon = (level: string) => {
    const normalized = level.toLowerCase();
    if (normalized === "quiet") return { icon: "🧘", label: "Quiet" };
    if (normalized === "moderate") return { icon: "👥", label: "Moderate" };
    return { icon: "🎉", label: "Busy" };
  };

  const effort = getEffortIcon(data.effort_level);
  const crowd = getCrowdIcon(data.crowd_level);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎬</span>
        <span className="font-medium text-sm">Reel Score</span>
      </div>
      <div className="bg-background border border-border rounded-lg p-3 space-y-3">
        <div className="text-center">
          <p className="text-sm font-medium mb-1">{data.activity}</p>
          <div className="flex items-center justify-center gap-1">
            <span className={`text-3xl font-bold ${getScoreColor(data.reel_score)}`}>
              {data.reel_score}
            </span>
            <span className="text-muted-foreground text-sm">/10</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Reel-Worthiness</p>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <span className="text-lg">{effort.icon}</span>
            <p className="text-[10px] text-muted-foreground">Effort</p>
            <p className="text-xs font-medium">{effort.label}</p>
          </div>
          <div className="text-center">
            <span className="text-lg">{crowd.icon}</span>
            <p className="text-[10px] text-muted-foreground">Crowds</p>
            <p className="text-xs font-medium">{crowd.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MicroItineraryCard({ data }: { data: MicroItineraryResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">📅</span>
        <span className="font-medium text-sm">Your Itinerary</span>
      </div>
      <div className="space-y-1">
        {data.schedule.map((item, i) => (
          <div 
            key={i} 
            className="flex gap-3 bg-background border border-border rounded-lg p-3"
          >
            <div className="flex-shrink-0 w-16">
              <span className="text-xs font-semibold text-primary">{item.time}</span>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{item.activity}</p>
              {item.note && (
                <p className="text-[11px] text-muted-foreground">{item.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const parsed = parseAIResponse(content);
  
  if (parsed?.type === "city_concierge") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Here are some recommendations for {parsed.city}:
        </p>
        {parsed.recommendations.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))}
      </div>
    );
  }
  
  if (parsed?.type === "mood_discovery") {
    return <MoodDiscoveryCard data={parsed} />;
  }
  
  if (parsed?.type === "reel_caption") {
    return <ReelCaptionCard data={parsed} />;
  }
  
  if (parsed?.type === "review_summary") {
    return <ReviewSummaryCard data={parsed} />;
  }
  
  if (parsed?.type === "micro_itinerary") {
    return <MicroItineraryCard data={parsed} />;
  }
  
  if (parsed?.type === "safety_note") {
    return <SafetyNoteCard data={parsed} />;
  }
  
  if (parsed?.type === "user_context") {
    return <UserContextCard data={parsed} />;
  }
  
  if (parsed?.type === "activity_score") {
    return <ActivityScoreCard data={parsed} />;
  }
  
  return <>{content}</>;
}

interface AIChatBoxProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClose: () => void;
  placeholder?: string;
  quickPrompts?: string[];
}

const defaultQuickPrompts = [
  "Best restaurants nearby",
  "Boat rentals today",
  "Tonight's events",
  "Top-rated villas",
];

export function AIChatBox({
  messages,
  isLoading,
  onSendMessage,
  onClose,
  placeholder = "What should I do today?",
  quickPrompts = defaultQuickPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="fixed bottom-20 right-4 left-4 md:left-auto md:right-6 md:w-96 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-primary/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Ask Zuru</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="h-72 overflow-y-auto p-3 space-y-3 bg-background/50">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-4">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary/50" />
            <p className="font-medium">Hey! I'm Zuru</p>
            <p className="text-xs mt-1 mb-4">Ask me about boats, restaurants, events & more</p>
            
            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(prompt)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 rounded-full transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-xl px-3 py-2 text-sm",
              msg.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            )}
          >
            <MessageContent content={msg.content} />
          </div>
        ))}
        {isLoading && (
          <div className="bg-secondary text-secondary-foreground max-w-[85%] rounded-xl px-3 py-2 text-sm">
            <span className="inline-flex gap-1">
              <span className="animate-bounce">●</span>
              <span className="animate-bounce [animation-delay:0.1s]">●</span>
              <span className="animate-bounce [animation-delay:0.2s]">●</span>
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
