import { Card, CardContent } from "@/components/ui/card";

interface HostStatsProps {
    totalReels: number;
    totalViews: number;
    bookings: number;
    loading?: boolean;
}

export const HostStats = ({ totalReels, totalViews, bookings, loading }: HostStatsProps) => {
    const formatNumber = (n: number) => {
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n;
    };

    return (
        <div className="grid grid-cols-3 gap-3 mb-6">
            <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                    {loading ? (
                        <div className="h-8 w-12 mx-auto bg-muted animate-pulse rounded" />
                    ) : (
                        <p className="text-2xl font-display font-semibold">{totalReels}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Reels</p>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                    {loading ? (
                        <div className="h-8 w-12 mx-auto bg-muted animate-pulse rounded" />
                    ) : (
                        <p className="text-2xl font-display font-semibold">
                            {formatNumber(totalViews)}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">Likes</p>
                </CardContent>
            </Card>
            <Card className="bg-card border-border">
                <CardContent className="p-4 text-center">
                    {loading ? (
                        <div className="h-8 w-12 mx-auto bg-muted animate-pulse rounded" />
                    ) : (
                        <p className="text-2xl font-display font-semibold">{bookings}</p>
                    )}
                    <p className="text-xs text-muted-foreground">Bookings</p>
                </CardContent>
            </Card>
        </div>
    );
};
