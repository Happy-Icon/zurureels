import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HostStatus {
  id: string;
  userId: string;
  mediaType: "text" | "image" | "video";
  mediaUrl?: string;
  textContent?: string;
  backgroundGradient?: string;
  caption?: string;
  createdAt: string;
  expiresAt: string;
}

// 24-hour default mock statuses for development and testing
const getMockStatuses = (hostId: string): HostStatus[] => {
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 19 * 60 * 60 * 1000).toISOString();

  if (hostId === "host-watamu-id" || hostId === "mock-1") {
    return [
      {
        id: "mock-status-1",
        userId: hostId,
        mediaType: "text",
        textContent: "Stunning morning dhow sailing! ⛵ Booking spaces open for tomorrow morning.",
        backgroundGradient: "from-orange-500 to-rose-500 text-white",
        createdAt: fiveHoursAgo,
        expiresAt: tomorrow,
      },
      {
        id: "mock-status-2",
        userId: hostId,
        mediaType: "image",
        mediaUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&fit=crop",
        caption: "Our guest captain for today! 🦁 Watamu is beautiful.",
        createdAt: threeHoursAgo,
        expiresAt: tomorrow,
      }
    ];
  }

  if (hostId === "host-safari-id" || hostId === "mock-2") {
    return [
      {
        id: "mock-status-3",
        userId: hostId,
        mediaType: "image",
        mediaUrl: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&fit=crop",
        caption: "Spotted this beautiful pride just 30 mins ago in Tsavo! 🐆",
        createdAt: threeHoursAgo,
        expiresAt: tomorrow,
      }
    ];
  }

  if (hostId === "host-skydive-id" || hostId === "mock-air") {
    return [
      {
        id: "mock-status-4",
        userId: hostId,
        mediaType: "text",
        textContent: "PERFECT winds today in Diani. Slots starting from 2:00 PM are available! 🪂",
        backgroundGradient: "from-indigo-600 to-purple-600 text-white",
        createdAt: fiveHoursAgo,
        expiresAt: tomorrow,
      }
    ];
  }

  return [];
};

export const useHostStatuses = (hostIds: string[] = []) => {
  const [statuses, setStatuses] = useState<Record<string, HostStatus[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      setLoading(true);

      // Clean hostIds to query in DB
      const dbHostIds = hostIds.filter(
        (id) => id && !id.startsWith("mock-") && !id.startsWith("host-") && id !== "00000000-0000-0000-0000-000000000000"
      );

      const dbStatusesMap: Record<string, HostStatus[]> = {};

      if (dbHostIds.length > 0) {
        // Query statuses table
        const { data, error: queryError } = await supabase
          .from("host_statuses" as any)
          .select("*")
          .in("user_id", dbHostIds)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: true });

        if (queryError) {
          // If the relation doesn't exist yet, we catch it gracefully
          console.warn("host_statuses table not found or query error, using fallback:", queryError);
        } else if (data) {
          data.forEach((status: any) => {
            const mapped: HostStatus = {
              id: status.id,
              userId: status.user_id,
              mediaType: status.media_type,
              mediaUrl: status.media_url,
              textContent: status.text_content,
              backgroundGradient: status.background_gradient,
              caption: status.caption,
              createdAt: status.created_at,
              expiresAt: status.expires_at,
            };

            if (!dbStatusesMap[mapped.userId]) {
              dbStatusesMap[mapped.userId] = [];
            }
            dbStatusesMap[mapped.userId].push(mapped);
          });
        }
      }

      // Add mock statuses for mock host IDs for testing
      const finalMap: Record<string, HostStatus[]> = { ...dbStatusesMap };
      hostIds.forEach((id) => {
        if (!finalMap[id]) {
          const mocks = getMockStatuses(id);
          if (mocks.length > 0) {
            finalMap[id] = mocks;
          }
        }
      });

      setStatuses(finalMap);
      setError(null);
    } catch (err) {
      console.error("Error in useHostStatuses:", err);
      setError(err);

      // Fallback: Populate purely with mock statuses if query fails
      const fallbackMap: Record<string, HostStatus[]> = {};
      hostIds.forEach((id) => {
        const mocks = getMockStatuses(id);
        if (mocks.length > 0) {
          fallbackMap[id] = mocks;
        }
      });
      setStatuses(fallbackMap);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(hostIds)]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const addStatus = async (
    mediaType: "text" | "image" | "video",
    content: {
      mediaUrl?: string;
      textContent?: string;
      backgroundGradient?: string;
      caption?: string;
    }
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const insertData = {
        user_id: user.id,
        media_type: mediaType,
        media_url: content.mediaUrl || null,
        text_content: content.textContent || null,
        background_gradient: content.backgroundGradient || null,
        caption: content.caption || null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      };

      const { data, error: insertError } = await supabase
        .from("host_statuses" as any)
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success("Status published successfully!");
      fetchStatuses();
      return data;
    } catch (err: any) {
      console.error("Failed to add status:", err);
      toast.error(err.message || "Failed to publish status. Database might need migration.");
      throw err;
    }
  };

  const deleteStatus = async (statusId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("host_statuses" as any)
        .delete()
        .eq("id", statusId);

      if (deleteError) throw deleteError;

      toast.success("Status deleted.");
      fetchStatuses();
    } catch (err: any) {
      console.error("Failed to delete status:", err);
      toast.error(err.message || "Failed to delete status");
      throw err;
    }
  };

  return {
    statuses,
    loading,
    error,
    refetch: fetchStatuses,
    addStatus,
    deleteStatus,
  };
};
