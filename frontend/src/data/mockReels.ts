import { ReelData } from "@/components/reels/ReelCard";
import { subDays } from "date-fns";

const daysAgo = (days: number) => subDays(new Date(), days).toISOString();

// 3 distinct Cloudinary demo videos (no transformation suffix — direct MP4)
const V = [
  "https://res.cloudinary.com/demo/video/upload/samples/sea-turtle.mp4",
  "https://res.cloudinary.com/demo/video/upload/samples/elephants.mp4",
  "https://res.cloudinary.com/demo/video/upload/samples/cld-sample-video.mp4",
];

export const mockReels: ReelData[] = [
  {
    id: "mock-1",
    videoUrl: V[0],
    thumbnailUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=1200&fit=crop",
    title: "Traditional Dhow Cruise",
    location: "Watamu Marine Park, Kenya",
    category: "boats",
    price: 12000,
    priceUnit: "day",
    rating: 4.95,
    likes: 3456,
    saved: false,
    hostName: "Watamu Marine",
    hostAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    postedAt: daysAgo(2),
  },
  {
    id: "mock-2",
    videoUrl: V[1],
    thumbnailUrl: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800&h=1200&fit=crop",
    title: "Tsavo Safari Day Trip",
    location: "Tsavo East National Park",
    category: "adventure",
    price: 18000,
    priceUnit: "person",
    rating: 4.95,
    likes: 5678,
    saved: true,
    hostName: "Safari Kings",
    hostAvatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
    postedAt: daysAgo(5),
  },
  {
    id: "mock-3",
    videoUrl: V[2],
    thumbnailUrl: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=1200&fit=crop",
    title: "Oceanfront Luxury Suite",
    location: "Diani Beach, Kenya",
    category: "hotel",
    price: 45000,
    priceUnit: "night",
    rating: 4.9,
    likes: 2340,
    saved: false,
    hostName: "Diani Reef Resort",
    hostAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    postedAt: daysAgo(10),
  },
];

export const mockEvents = [
  {
    id: "e1",
    title: "Live Band at Shela Beach",
    date: "Tonight, 8 PM",
    location: "Lamu Island",
    category: "Nightlife",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop",
    attendees: 234,
  },
  {
    id: "e2",
    title: "Swahili Food Festival",
    date: "Sat, Dec 21",
    location: "Mombasa Old Town",
    category: "Food",
    imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
    attendees: 1200,
  },
  {
    id: "e3",
    title: "Coastal Art Exhibition",
    date: "Sun, Dec 22",
    location: "Kilifi Creatives",
    category: "Culture",
    imageUrl: "https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=400&h=300&fit=crop",
    attendees: 89,
  },
  {
    id: "e4",
    title: "Beach Yoga at Sunrise",
    date: "Mon, Dec 23",
    location: "Diani Beach",
    category: "Wellness",
    imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop",
    attendees: 45,
  },
];

export const mockBookings = [
  {
    id: "b1",
    title: "Oceanfront Luxury Suite",
    location: "Diani Beach",
    checkIn: "2024-01-15",
    checkOut: "2024-01-20",
    status: "upcoming" as const,
    imageUrl: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=300&fit=crop",
    totalPrice: 225000,
  },
  {
    id: "b2",
    title: "Marine Safari Adventure",
    location: "Malindi",
    checkIn: "2024-02-10",
    checkOut: "2024-02-12",
    status: "upcoming" as const,
    imageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&h=300&fit=crop",
    totalPrice: 17000,
  },
  {
    id: "b3",
    title: "Swahili Heritage Villa",
    location: "Lamu Island",
    checkIn: "2023-09-05",
    checkOut: "2023-09-10",
    status: "completed" as const,
    imageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop",
    totalPrice: 340000,
  },
];
