import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

/**
 * Hook for managing reel interactions: likes, saves, follows
 * Persists all interactions to Supabase with optimistic UI updates.
 */
export function useReelInteractions(reelId: string, hostUserId?: string) {
    const { user } = useAuth();

    // Like state
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);

    // Save state
    const [isSaved, setIsSaved] = useState(false);

    // Follow state
    const [isFollowing, setIsFollowing] = useState(false);

    // Loading
    const [loaded, setLoaded] = useState(false);

    // Helper to check if a string is a valid UUID
    const isUUID = (id: string) => {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return regex.test(id);
    };

    // Fetch initial state
    useEffect(() => {
        if (!reelId) return;

        const fetchState = async () => {
            // For mock IDs (non-UUIDs), just use the initial state or local persistence
            if (!isUUID(reelId)) {
                setLoaded(true);
                return;
            }

            try {
                // 1. Count likes for this reel
                const { count: likes } = await supabase
                    .from("reel_likes")
                    .select("*", { count: "exact", head: true })
                    .eq("reel_id", reelId);

                setLikeCount(likes || 0);

                if (!user) {
                    setLoaded(true);
                    return;
                }

                // 2. Check if current user liked this reel
                const { data: likeData } = await supabase
                    .from("reel_likes")
                    .select("id")
                    .eq("reel_id", reelId)
                    .eq("user_id", user.id)
                    .maybeSingle();

                setIsLiked(!!likeData);

                // 3. Check if current user saved this reel
                const { data: saveData } = await supabase
                    .from("reel_saves")
                    .select("id")
                    .eq("reel_id", reelId)
                    .eq("user_id", user.id)
                    .maybeSingle();

                setIsSaved(!!saveData);

                // 4. Check if current user follows the host
                if (hostUserId && hostUserId !== user.id) {
                    const { data: followData } = await supabase
                        .from("user_follows")
                        .select("id")
                        .eq("follower_id", user.id)
                        .eq("following_id", hostUserId)
                        .maybeSingle();

                    setIsFollowing(!!followData);
                }
            } catch (err) {
                console.error("Error fetching reel interactions:", err);
            } finally {
                setLoaded(true);
            }
        };

        fetchState();
    }, [reelId, user, hostUserId]);

    // Toggle like
    const toggleLike = useCallback(async () => {
        if (!user) {
            toast.error("Sign in to like reels");
            return;
        }

        // Optimistic update
        const wasLiked = isLiked;
        setIsLiked(!wasLiked);
        setLikeCount((prev) => (wasLiked ? prev - 1 : prev + 1));

        // Skip DB for mocks
        if (!isUUID(reelId)) return;

        try {
            if (wasLiked) {
                const { error } = await supabase
                    .from("reel_likes")
                    .delete()
                    .eq("reel_id", reelId)
                    .eq("user_id", user.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("reel_likes")
                    .insert({ reel_id: reelId, user_id: user.id });
                if (error) throw error;
            }
        } catch (err: any) {
            // Revert on error
            setIsLiked(wasLiked);
            setLikeCount((prev) => (wasLiked ? prev + 1 : prev - 1));
            console.error("Like error:", err);
            if (err?.code === "23505") {
                // Duplicate — state was out of sync, just set to liked
                setIsLiked(true);
            } else {
                toast.error("Couldn't update like. Please try again.");
            }
        }
    }, [user, isLiked, reelId]);

    // Toggle save
    const toggleSave = useCallback(async () => {
        if (!user) {
            toast.error("Sign in to save reels");
            return;
        }

        const wasSaved = isSaved;
        setIsSaved(!wasSaved);

        // Skip DB for mocks
        if (!isUUID(reelId)) {
            toast.success(wasSaved ? "Removed from saved" : "Saved!");
            return;
        }

        try {
            if (wasSaved) {
                const { error } = await supabase
                    .from("reel_saves")
                    .delete()
                    .eq("reel_id", reelId)
                    .eq("user_id", user.id);
                if (error) throw error;
                toast.success("Removed from saved");
            } else {
                const { error } = await supabase
                    .from("reel_saves")
                    .insert({ reel_id: reelId, user_id: user.id });
                if (error) throw error;
                toast.success("Saved!");
            }
        } catch (err: any) {
            setIsSaved(wasSaved);
            console.error("Save error:", err);
            if (err?.code === "23505") {
                setIsSaved(true);
            } else {
                toast.error("Couldn't save reel. Please try again.");
            }
        }
    }, [user, isSaved, reelId]);

    // Toggle follow
    const toggleFollow = useCallback(async () => {
        if (!user) {
            toast.error("Sign in to follow hosts");
            return;
        }

        if (!hostUserId || hostUserId === user.id) return;

        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);

        // Skip DB for mocks (detecting if hostUserId is a UUID)
        if (!isUUID(hostUserId)) {
            toast.success(wasFollowing ? "Unfollowed" : "Following!");
            return;
        }

        try {
            if (wasFollowing) {
                const { error } = await supabase
                    .from("user_follows")
                    .delete()
                    .eq("follower_id", user.id)
                    .eq("following_id", hostUserId);
                if (error) throw error;
                toast.success("Unfollowed");
            } else {
                const { error } = await supabase
                    .from("user_follows")
                    .insert({ follower_id: user.id, following_id: hostUserId });
                if (error) throw error;
                toast.success("Following!");
            }
        } catch (err: any) {
            setIsFollowing(wasFollowing);
            console.error("Follow error:", err);
            if (err?.code === "23505") {
                setIsFollowing(true);
            } else {
                toast.error("Couldn't update follow. Please try again.");
            }
        }
    }, [user, isFollowing, hostUserId]);

    return {
        isLiked,
        likeCount,
        isSaved,
        isFollowing,
        loaded,
        toggleLike,
        toggleSave,
        toggleFollow,
    };
}
