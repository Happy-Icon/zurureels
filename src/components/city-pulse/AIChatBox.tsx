import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, X, MapPin, Clock, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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

interface ConciergeResponse {
  type: "city_concierge";
  city: string;
  recommendations: Recommendation[];
}

// Try to parse JSON from content, return null if not valid concierge response
function parseConciergeResponse(content: string): ConciergeResponse | null {
  try {
    // Try to find JSON in the content (might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || 
                      content.match(/(\{[\s\S]*"type"\s*:\s*"city_concierge"[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    const parsed = JSON.parse(jsonStr);
    
    if (parsed.type === "city_concierge" && Array.isArray(parsed.recommendations)) {
      return parsed as ConciergeResponse;
    }
  } catch {
    // Not JSON or not a concierge response
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

function MessageContent({ content }: { content: string }) {
  const concierge = parseConciergeResponse(content);
  
  if (concierge) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-2">
          Here are some recommendations for {concierge.city}:
        </p>
        {concierge.recommendations.map((rec, i) => (
          <RecommendationCard key={i} rec={rec} />
        ))}
      </div>
    );
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
