import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Loader2, TrendingUp, Users, Heart, Calendar } from "lucide-react";
import { format } from "date-fns";

export const HostAnalytics = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any[]>([]);
    const [kpis, setKpis] = useState({
        views: 0,
        likes: 0,
        saves: 0,
        bookings: 0,
        shares: 0,
        followers: 0,
        profile_views: 0
    });

    useEffect(() => {
        if (!user) return;

        const fetchAnalytics = async () => {
            setLoading(true);
            try {
                // Fetch daily stats from the RPC
                const { data, error } = await supabase.rpc("get_host_daily_stats", {
                    host_uuid: user.id,
                    days_back: 30
                });

                if (error) {
                    console.error("RPC Error:", error);
                    // Do not fallback to mock data; handle empty state naturally based on the platform
                    setLoading(false);
                    return;
                }

                if (data) {
                    const formattedData = data.map((d: any) => ({
                        date: format(new Date(d.date), "MMM dd"),
                        views: Number(d.views),
                        likes: Number(d.likes),
                        saves: Number(d.saves),
                        bookings: Number(d.bookings),
                        shares: Number(d.shares || 0),
                        followers: Number(d.followers || 0),
                        profile_views: Number(d.profile_views || 0),
                        engagementRate: d.views > 0 ? (((Number(d.likes) + Number(d.saves) + Number(d.shares)) / Number(d.views)) * 100).toFixed(1) : 0,
                        bookingRate: d.views > 0 ? ((Number(d.bookings) / Number(d.views)) * 100).toFixed(1) : 0
                    }));
                    setStats(formattedData);

                    setKpis({ 
                        views: formattedData.reduce((acc: number, curr: any) => acc + curr.views, 0),
                        likes: formattedData.reduce((acc: number, curr: any) => acc + curr.likes, 0),
                        saves: formattedData.reduce((acc: number, curr: any) => acc + curr.saves, 0),
                        bookings: formattedData.reduce((acc: number, curr: any) => acc + curr.bookings, 0),
                        shares: formattedData.reduce((acc: number, curr: any) => acc + curr.shares, 0),
                        followers: formattedData.reduce((acc: number, curr: any) => acc + curr.followers, 0),
                        profile_views: formattedData.reduce((acc: number, curr: any) => acc + curr.profile_views, 0)
                    });
                }
            } catch (error) {
                console.error("Error fetching analytics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [user]);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <Card className="bg-card/50 backdrop-blur-sm border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Views</div>
                    <div className="text-xl font-bold font-display">{kpis.views.toLocaleString()}</div>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Likes</div>
                    <div className="text-xl font-bold font-display">{kpis.likes.toLocaleString()}</div>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Followers</div>
                    <div className="text-xl font-bold font-display">{kpis.followers.toLocaleString()}</div>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Shares</div>
                    <div className="text-xl font-bold font-display">{kpis.shares.toLocaleString()}</div>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Profile</div>
                    <div className="text-xl font-bold font-display">{kpis.profile_views.toLocaleString()}</div>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Saves</div>
                    <div className="text-xl font-bold font-display">{kpis.saves.toLocaleString()}</div>
                </Card>
                <Card className="bg-card/50 backdrop-blur-sm border-border p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 text-primary">Bookings</div>
                    <div className="text-xl font-bold font-display text-primary">{kpis.bookings.toLocaleString()}</div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card/50 backdrop-blur-sm border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="font-display text-lg">Views & Engagement</CardTitle>
                        <CardDescription className="text-xs">Daily views, likes, and profile clicks.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} minTickGap={20} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                />
                                <Area type="monotone" dataKey="views" stroke="#ec4899" fillOpacity={1} fill="url(#colorViews)" />
                                <Area type="monotone" dataKey="likes" stroke="#a855f7" fillOpacity={0} strokeWidth={2} />
                                <Area type="monotone" dataKey="profile_views" stroke="#3b82f6" fillOpacity={0} strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-border">
                    <CardHeader className="pb-2">
                        <CardTitle className="font-display text-lg">Reach & Conversions</CardTitle>
                        <CardDescription className="text-xs">Daily bookings, saves, and shares.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} minTickGap={20} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                    cursor={{ fill: 'hsl(var(--muted))' }}
                                />
                                <Bar dataKey="saves" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="shares" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="bookings" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-card/50 backdrop-blur-sm border-border">
                <CardHeader className="pb-2">
                    <CardTitle className="font-display text-lg">Performance Insights</CardTitle>
                    <CardDescription className="text-xs">Conversion rates and engagement efficiency.</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} minTickGap={20} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} unit="%" />
                            <Tooltip 
                                contentStyle={{ borderRadius: '12px', backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                            />
                            <Area type="monotone" dataKey="engagementRate" name="Eng. Rate %" stroke="#f43f5e" fillOpacity={0.1} fill="#f43f5e" strokeWidth={2} />
                            <Area type="monotone" dataKey="bookingRate" name="Booking Rate %" stroke="#10b981" fillOpacity={0.1} fill="#10b981" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
};
