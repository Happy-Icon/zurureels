import { ReactNode } from "react";

export interface ReelRequirement {
    id: string;
    title: string;
    description: string;
    maxDuration: number;
    icon: ReactNode;
    required: boolean;
    uploaded: boolean;
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
    guestName: string;
    guestImage?: string;
    experienceTitle: string;
    date: string;
    time: string;
    guests: number;
    totalPrice: number;
    status: "pending" | "approved" | "declined";
    message?: string;
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
