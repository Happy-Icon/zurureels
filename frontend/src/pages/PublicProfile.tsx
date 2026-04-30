import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { 
    MapPin, 
    Star, 
    Users, 
    Calendar, 
    ShieldCheck, 
    ChevronLeft,
    MessageCircle,
    Heart,
    Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { RatingModal } from "@/components/profile/RatingModal";
import { formatDistanceToNow } from "date-fns";

interface HostProfile {
    id: string;
    full_name: string;
    username: string;
    bio?: string;
    avatar_url?: string;
    verification_status: string;
    joined_at: string;
    rating: number;
    review_count: number;
    total_bookings: number;
}

interface HostListing {
    id: string;
    title: string;
    thumbnail_url: string;
    price: number;
    category: string;
    rating: number;
}

interface Review {
    id: string;
    reviewer: {
        full_name: string;
        username: string;
        avatar_url?: string;
    };
    rating: number;
    comment: string;
    created_at: string;
}

export default function PublicProfile() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<HostProfile | null>(null);
    const [listings, setListings] = useState<HostListing[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [showRatingModal, setShowRatingModal] = useState(false);

    useEffect(() => {
        const fetchHostData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // 1. Fetch Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name, username, verification_status, created_at, metadata')
                    .eq('id', id)
                    .single();

                if (profileError) throw profileError;

                const hostProfile: HostProfile = {
                    id: profileData.id,
                    full_name: profileData.full_name || "Zuru Host",
                    username: profileData.username || "host",
                    bio: profileData.metadata?.bio || "Passionate host sharing unique experiences on ZuruSasa.",
                    avatar_url: profileData.metadata?.avatar_url,
                    verification_status: profileData.verification_status,
                    joined_at: profileData.created_at,
                    rating: 4.9, // Hardcoded for now
                    review_count: 128, // Hardcoded for now
                    total_bookings: 450 // Hardcoded for now
                };

                setProfile(hostProfile);

                // 2. Fetch Listings (Reels + Experience data)
                const { data: reelsData, error: reelsError } = await supabase
                    .from('reels')
                    .select(`
                        id,
                        thumbnail_url,
                        category,
                        experience:experiences (
                            title,
                            current_price,
                            metadata
                        )
                    `)
                    .eq('user_id', id)
                    .eq('status', 'active');

                if (reelsError) throw reelsError;

                const hostListings: HostListing[] = (reelsData || []).map((item: any) => ({
                    id: item.id,
                    title: item.experience?.title || "Untitled Experience",
                    thumbnail_url: item.thumbnail_url || "",
                    price: item.experience?.current_price || 0,
                    category: item.category,
                    rating: item.experience?.metadata?.rating || 5.0
                }));

                setListings(hostListings);

                // 3. Fetch Reviews
                const { data: reviewsData, error: reviewsError } = await supabase
                    .from('host_reviews')
                    .select(`
                        id,
                        rating,
                        comment,
                        created_at,
                        reviewer:profiles!host_reviews_reviewer_id_fkey (
                            full_name,
                            username,
                            metadata
                        )
                    `)
                    .eq('host_id', id)
                    .order('created_at', { ascending: false });

                if (reviewsError) throw reviewsError;

                const formattedReviews: Review[] = (reviewsData || []).map((item: any) => ({
                    id: item.id,
                    reviewer: {
                        full_name: item.reviewer?.full_name || "Zuru User",
                        username: item.reviewer?.username || "user",
                        avatar_url: item.reviewer?.metadata?.avatar_url
                    },
                    rating: item.rating,
                    comment: item.comment,
                    created_at: item.created_at
                }));

                setReviews(formattedReviews);
            } catch (error) {
                console.error("Error fetching host profile:", error);
                toast.error("Could not load host profile");
            } finally {
                setLoading(false);
            }
        };

        fetchHostData();
    }, [id]);

    const handleMessage = async () => {
        if (!user) {
            toast.error("Please login to message the host");
            navigate("/auth");
            return;
        }
        if (user.id === id) {
            toast.error("You cannot message yourself");
            return;
        }

        try {
            const participants = [user.id, id!].sort();
            const { data: conv, error: fetchError } = await supabase
                .from("conversations")
                .select("id")
                .eq("participant_one", participants[0])
                .eq("participant_two", participants[1])
                .maybeSingle();

            if (fetchError) throw fetchError;

            let convId = conv?.id;

            if (!convId) {
                const { data: newConv, error: createError } = await supabase
                    .from("conversations")
                    .insert({
                        participant_one: participants[0],
                        participant_two: participants[1]
                    })
                    .select("id")
                    .single();
                
                if (createError) throw createError;
                convId = newConv.id;
            }

            navigate(`/profile/messages?convId=${convId}`);
        } catch (err) {
            console.error("Error initiating chat:", err);
            toast.error("Failed to start conversation");
        }
    };

    if (loading && !profile) {
        return (
            <MainLayout>
                <div className="pb-20 md:pb-8">
                    <div className="h-32 bg-muted animate-pulse md:h-48 md:rounded-b-[2.5rem]" />
                    <div className="px-5 -mt-16 md:-mt-24">
                        <div className="bg-background rounded-[2rem] p-6 shadow-xl border border-border/50">
                            <div className="flex flex-col md:flex-row gap-6">
                                <div className="h-32 w-32 md:h-40 md:w-40 rounded-full bg-muted animate-pulse border-4 border-background" />
                                <div className="flex-1 space-y-4 pt-4">
                                    <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
                                    <div className="h-4 w-32 bg-muted animate-pulse rounded-md" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    if (!profile) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
                    <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl font-bold">Profile not found</h2>
                    <p className="text-muted-foreground mt-2">The host you are looking for might have removed their account.</p>
                    <Button className="mt-6" onClick={() => navigate(-1)}>Go Back</Button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="pb-20 md:pb-8">
                {/* Profile Header Card */}
                <div className="relative">
                    {/* Header Background */}
                    <div className="h-32 bg-gradient-to-r from-primary/20 via-orange-500/10 to-blue-500/10 md:h-48 md:rounded-b-[2.5rem]" />
                    
                    {/* Navigation */}
                    <div className="absolute top-4 left-4 z-10">
                        <Button 
                            variant="secondary" 
                            size="icon" 
                            className="rounded-full bg-background/80 backdrop-blur-md shadow-md"
                            onClick={() => navigate(-1)}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="px-5 -mt-16 md:-mt-24">
                        <div className="bg-background rounded-[2rem] p-6 shadow-xl shadow-black/5 border border-border/50">
                            <div className="flex flex-col md:flex-row gap-6 md:items-end md:justify-between">
                                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 text-center md:text-left">
                                    <div className="relative">
                                        <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-2xl">
                                            <AvatarImage src={profile.avatar_url} />
                                            <AvatarFallback className="text-4xl bg-secondary">{profile.full_name[0]}</AvatarFallback>
                                        </Avatar>
                                        {profile.verification_status === 'verified' && (
                                            <div className="absolute bottom-2 right-2 bg-blue-500 text-white p-1.5 rounded-full border-2 border-background shadow-lg">
                                                <ShieldCheck className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2 md:pb-2">
                                        <h1 className="text-2xl md:text-4xl font-display font-bold">{profile.full_name}</h1>
                                        <div className="flex flex-wrap justify-center md:justify-start items-center gap-3">
                                            <Badge variant="secondary" className="font-bold text-xs">@{profile.username}</Badge>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                                                <Calendar className="h-3.5 w-3.5" />
                                                Joined {new Date(profile.joined_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    <Button 
                                        onClick={handleMessage}
                                        className="flex-1 md:flex-none gap-2 rounded-2xl h-12 px-8 font-bold bg-primary hover:bg-primary/90"
                                    >
                                        <MessageCircle className="h-5 w-5" />
                                        Message
                                    </Button>
                                    <Button 
                                        onClick={() => setShowRatingModal(true)}
                                        variant="outline"
                                        className="flex-1 md:flex-none gap-2 rounded-2xl h-12 px-8 font-bold border-primary text-primary hover:bg-primary/5"
                                    >
                                        <Star className="h-5 w-5" />
                                        Rate Host
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        size="icon"
                                        className="rounded-2xl h-12 w-12 border-border/50 hidden md:flex"
                                    >
                                        <Heart className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-2 md:gap-4 mt-8 pt-8 border-t border-border/50">
                                <div className="text-center space-y-1">
                                    <div className="flex items-center justify-center gap-1.5 text-orange-600 font-bold">
                                        <Star className="h-4 w-4 fill-current" />
                                        <span className="text-lg md:text-xl">{profile.rating}</span>
                                    </div>
                                    <p className="text-[10px] md:text-xs uppercase font-bold text-muted-foreground tracking-widest">Rating</p>
                                </div>
                                <div className="text-center space-y-1 border-x border-border/50 px-2">
                                    <p className="text-lg md:text-xl font-bold">{profile.review_count}</p>
                                    <p className="text-[10px] md:text-xs uppercase font-bold text-muted-foreground tracking-widest">Reviews</p>
                                </div>
                                <div className="text-center space-y-1">
                                    <div className="flex items-center justify-center gap-1.5 text-blue-600 font-bold">
                                        <Users className="h-4 w-4" />
                                        <span className="text-lg md:text-xl">{profile.total_bookings}</span>
                                    </div>
                                    <p className="text-[10px] md:text-xs uppercase font-bold text-muted-foreground tracking-widest">Bookings</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* About & Listings Section */}
                <div className="px-5 mt-8 space-y-10">
                    {/* About Section */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-display font-bold flex items-center gap-2">
                            About {profile.full_name.split(' ')[0]}
                        </h3>
                        <div className="p-5 rounded-[1.5rem] bg-muted/30 border border-border/50 leading-relaxed text-foreground/80">
                            {profile.bio}
                        </div>
                        
                        {profile.verification_status === 'verified' && (
                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                                <ShieldCheck className="h-5 w-5 text-blue-500" />
                                <div className="text-xs">
                                    <p className="font-bold text-blue-700">Verified Identity</p>
                                    <p className="text-blue-600/70">ZuruSasa has verified this host's identity and professional credentials.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Listings Grid */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-display font-bold">Listings & Experiences</h3>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{listings.length} items</span>
                        </div>
                        
                        {listings.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {listings.map((item) => (
                                    <div 
                                        key={item.id} 
                                        className="group cursor-pointer space-y-2.5"
                                        onClick={() => navigate(`/discover?id=${item.id}`)}
                                    >
                                        <div className="relative aspect-[3/4] rounded-[1.5rem] overflow-hidden bg-muted shadow-md group-hover:shadow-lg transition-all duration-300">
                                            {item.thumbnail_url ? (
                                                <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="h-full w-full bg-gradient-to-br from-primary/10 to-secondary flex items-center justify-center">
                                                    <Play className="h-10 w-10 text-primary/20" />
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                                            <div className="absolute top-2.5 left-2.5">
                                                <Badge className="bg-white/20 backdrop-blur-md border-white/20 text-white text-[10px] font-bold h-5 px-2">
                                                    {item.category}
                                                </Badge>
                                            </div>
                                            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                                                <div className="bg-black/40 backdrop-blur-sm rounded-full p-1.5 border border-white/10">
                                                    <Play className="h-3 w-3 text-white fill-white" />
                                                </div>
                                                <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 text-white text-[10px] font-bold">
                                                    <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
                                                    {item.rating}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-1">
                                            <h4 className="text-sm font-bold truncate leading-tight group-hover:text-primary transition-colors">{item.title}</h4>
                                            <p className="text-xs font-semibold text-muted-foreground mt-0.5">KES {item.price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-muted/20 rounded-[2rem] border border-dashed border-border/50">
                                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">No public listings yet</p>
                            </div>
                        )}
                    </div>

                    {/* Reviews Section */}
                    <div className="space-y-8 pt-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-display font-bold">What guests are saying</h3>
                            <div className="flex items-center gap-1.5 bg-primary/5 px-3 py-1.5 rounded-full text-primary font-bold text-sm">
                                <Star className="h-4 w-4 fill-current" />
                                {profile.rating} • {reviews.length} reviews
                            </div>
                        </div>

                        {reviews.length > 0 ? (
                            <div className="grid gap-6 md:grid-cols-2">
                                {reviews.map((review) => (
                                    <div key={review.id} className="p-6 rounded-[2rem] bg-card border border-border/50 space-y-4 shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border border-primary/10">
                                                    <AvatarImage src={review.reviewer.avatar_url} />
                                                    <AvatarFallback>{review.reviewer.full_name[0]}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-bold text-sm leading-none">{review.reviewer.full_name}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-wider">@{review.reviewer.username}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star 
                                                        key={i} 
                                                        className={cn(
                                                            "h-3 w-3",
                                                            i < review.rating ? "fill-primary text-primary" : "text-muted-foreground/20"
                                                        )} 
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-sm leading-relaxed text-foreground/80 italic">"{review.comment}"</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">
                                            Rated {formatDistanceToNow(new Date(review.created_at))} ago
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-muted/20 rounded-[2rem] border border-dashed border-border/50">
                                <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">No reviews yet. Be the first to rate!</p>
                                <Button 
                                    variant="link" 
                                    className="text-primary font-bold mt-2"
                                    onClick={() => setShowRatingModal(true)}
                                >
                                    Leave a Review
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <RatingModal 
                isOpen={showRatingModal}
                onClose={() => setShowRatingModal(false)}
                hostId={profile.id}
                hostName={profile.full_name}
                onSuccess={() => window.location.reload()}
            />
        </MainLayout>
    );
}
