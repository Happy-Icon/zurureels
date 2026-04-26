import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  User, 
  MapPin, 
  Calendar, 
  Zap,
  Loader2,
  Command as CommandIcon
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: 'experience' | 'profile' | 'event';
  title: string;
  subtitle: string;
  image_url?: string;
  metadata?: any;
}

export function UnifiedSearch({ variant = "default" }: { variant?: "default" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search logic
  const performSearch = useCallback(async (val: string) => {
    if (!val || val.length < 2) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('unified_search', {
        search_query: val
      });

      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const onSelect = (item: SearchResult) => {
    setOpen(false);
    if (item.type === 'experience') {
      navigate(`/discover?id=${item.id}`);
    } else if (item.type === 'profile') {
      navigate(`/profile/${item.id}`);
    } else if (item.type === 'event') {
      navigate(`/events?id=${item.id}`);
    }
  };

  const experiences = results.filter(r => r.type === 'experience');
  const profiles = results.filter(r => r.type === 'profile');
  const events = results.filter(r => r.type === 'event');

  const isIconOnly = variant === "icon" || isMobile;

  return (
    <>
      {/* Visual Trigger */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 transition-all duration-200 group",
          isIconOnly
            ? "p-2 rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground"
            : "px-4 py-2 text-sm text-muted-foreground bg-secondary/50 hover:bg-secondary border border-border rounded-full w-full md:min-w-[200px] lg:min-w-[300px]"
        )}
      >
        <Search className={cn("h-4 w-4 group-hover:text-primary transition-colors", isIconOnly ? "h-5 w-5" : "")} />
        {!isIconOnly && (
          <>
            <span className="flex-1 text-left truncate">Search Coastal Kenya...</span>
            <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </>
        )}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search for reels, hosts, or events..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[70vh] md:max-h-[500px]">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          
          {!loading && results.length === 0 && query.length >= 2 && (
            <CommandEmpty>No results found for "{query}".</CommandEmpty>
          )}

          {!loading && results.length === 0 && query.length < 2 && (
            <div className="py-12 text-center text-muted-foreground">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-full bg-secondary">
                   <CommandIcon className="h-6 w-6" />
                </div>
              </div>
              <p className="text-sm">Search by title, location, category or host</p>
            </div>
          )}

          {experiences.length > 0 && (
            <CommandGroup heading="Experiences & Reels">
              {experiences.map((item) => (
                <CommandItem key={item.id} onSelect={() => onSelect(item)} className="gap-3 py-3">
                  <div className="h-10 w-10 rounded overflow-hidden bg-secondary shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Zap className="h-full w-full p-2 text-primary" />
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold text-sm truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                       <MapPin className="h-3 w-3" /> {item.subtitle}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {item.metadata?.category || 'Listing'}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {profiles.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Users & Hosts">
                {profiles.map((item) => (
                  <CommandItem key={item.id} onSelect={() => onSelect(item)} className="gap-3 py-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-secondary shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-full w-full p-2 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-semibold text-sm truncate">{item.title}</span>
                      <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                    </div>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0 text-[10px]">
                      Host
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {events.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Upcoming Events">
                {events.map((item) => (
                  <CommandItem key={item.id} onSelect={() => onSelect(item)} className="gap-3 py-3">
                    <div className="h-10 w-10 rounded overflow-hidden bg-secondary shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Calendar className="h-full w-full p-2 text-orange-500" />
                      )}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-semibold text-sm truncate">{item.title}</span>
                      <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {item.subtitle}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
