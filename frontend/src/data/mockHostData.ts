import { ReelData } from "@/types/host";

export const mockHostReels: ReelData[] = [
    {
        id: "h1",
        title: "Beachfront Paradise Villa",
        location: "Diani Beach",
        category: "villa",
        price: 280,
        views: 1234,
        status: "published",
        thumbnail: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
        expiresAt: "2026-05-01T00:00:00Z", // Future
    },
    {
        id: "h2",
        title: "Sunset Dhow Cruise",
        location: "Lamu Old Town",
        category: "boat",
        price: 150,
        views: 856,
        status: "published",
        thumbnail: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
        expiresAt: "2026-01-26T00:00:00Z", // Expiring soon
    },
    {
        id: "h3",
        title: "Coral Reef Diving Tour",
        location: "Watamu",
        category: "tour",
        price: 95,
        views: 423,
        status: "published",
        thumbnail: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=300&fit=crop",
        expiresAt: "2026-01-10T00:00:00Z", // Expired
    },
];
