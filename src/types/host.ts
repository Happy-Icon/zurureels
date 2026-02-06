import { ReactNode } from "react";

export interface ReelRequirement {
    id: string;
    title: string;
    description: string;
    maxDuration: number;
    icon: ReactNode;
    required: boolean;
    uploaded: boolean;
    videoUrl?: string;
    lat?: number;
    lng?: number;
}

export interface AccommodationData {
    bedrooms: number;
    units: number;
    amenities: string[];
    reels: ReelRequirement[];
}

export type AccommodationType = "hotel" | "villa" | "apartment";

export interface ScoreBreakdown {
    visuals: number;
    audio: number;
    pacing: number;
    story: number;
}

export interface BookingRequest {
    id: string;
    guestId: string;
    guestName: string;
    guestImage?: string;
    experienceId: string;
    experienceTitle: string;
    experienceImage?: string;
    checkIn: string;
    checkOut: string;
    guests: number;
    totalPrice: number;
    status: "pending" | "paid" | "cancelled" | "approved" | "declined";
    paymentReference?: string;
    createdAt: string;
}

export interface ReelData {
    id: string;
    title: string;
    location: string;
    category: string;
    price: number;
    views: number;
    status: "published" | "draft";
    thumbnail: string;
    expiresAt?: string;
}
