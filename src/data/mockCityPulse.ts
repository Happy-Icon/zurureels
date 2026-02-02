export interface BoatRental {
  id: string;
  name: string;
  type: string;
  price: number;
  priceUnit: string;
  location: string;
  imageUrl: string;
  rating: number;
  available: boolean;
}

export interface RestaurantSpecial {
  id: string;
  restaurant: string;
  special: string;
  originalPrice: number;
  discountPrice: number;
  location: string;
  imageUrl: string;
  validUntil: string;
}

export interface ClubEvent {
  id: string;
  venue: string;
  event: string;
  time: string;
  dj?: string;
  entryFee: number;
  location: string;
  imageUrl: string;
}

export interface ChefSpecial {
  id: string;
  chef: string;
  dish: string;
  description: string;
  price: number;
  restaurant: string;
  location: string;
  imageUrl: string;
}

export interface BikeRental {
  id: string;
  provider: string;
  type: string;
  pricePerHour: number;
  pricePerDay: number;
  location: string;
  imageUrl: string;
  available: number;
}

export interface DailyActivity {
  id: string;
  name: string;
  type: string;
  time: string;
  duration: string;
  price: number;
  location: string;
  imageUrl: string;
  spotsLeft: number;
}

export interface DrinkOfTheDay {
  id: string;
  name: string;
  bar: string;
  originalPrice: number;
  specialPrice: number;
  location: string;
  imageUrl: string;
}

export const mockBoatRentals: BoatRental[] = [
  {
    id: "boat1",
    name: "Glass Bottom Boat Tour",
    type: "Glass Bottom",
    price: 3500,
    priceUnit: "person",
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
    rating: 4.8,
    available: true,
  },
  {
    id: "boat2",
    name: "Traditional Dhow Sunset Cruise",
    type: "Dhow",
    price: 8000,
    priceUnit: "person",
    location: "Lamu Island",
    imageUrl: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=400&h=300&fit=crop",
    rating: 4.9,
    available: true,
  },
  {
    id: "boat3",
    name: "Sport Fishing Charter",
    type: "Fishing Boat",
    price: 45000,
    priceUnit: "half day",
    location: "Watamu",
    imageUrl: "https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=400&h=300&fit=crop",
    rating: 4.7,
    available: true,
  },
  {
    id: "boat4",
    name: "Snorkeling Excursion",
    type: "Speed Boat",
    price: 5500,
    priceUnit: "person",
    location: "Malindi",
    imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=300&fit=crop",
    rating: 4.6,
    available: false,
  },
];

export const mockRestaurantSpecials: RestaurantSpecial[] = [
  {
    id: "rest1",
    restaurant: "Sails Beach Bar",
    special: "Seafood Platter for 2",
    originalPrice: 4500,
    discountPrice: 3200,
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
    validUntil: "Tonight only",
  },
  {
    id: "rest2",
    restaurant: "Tamarind Mombasa",
    special: "Swahili Curry Feast",
    originalPrice: 2800,
    discountPrice: 1900,
    location: "Mombasa",
    imageUrl: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop",
    validUntil: "Lunch special",
  },
  {
    id: "rest3",
    restaurant: "Peponi Hotel",
    special: "Fresh Catch of the Day",
    originalPrice: 3500,
    discountPrice: 2500,
    location: "Lamu Island",
    imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=300&fit=crop",
    validUntil: "All day",
  },
];

export const mockClubEvents: ClubEvent[] = [
  {
    id: "club1",
    venue: "Forty Thieves Beach Bar",
    event: "Reggae Night",
    time: "9 PM - Late",
    dj: "DJ Mzungu",
    entryFee: 500,
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=400&h=300&fit=crop",
  },
  {
    id: "club2",
    venue: "Casaurina Nightclub",
    event: "Bongo Flava Party",
    time: "10 PM - 4 AM",
    dj: "DJ Kalonje",
    entryFee: 1000,
    location: "Mombasa",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=300&fit=crop",
  },
  {
    id: "club3",
    venue: "Kilifi Beach House",
    event: "Full Moon Party",
    time: "8 PM - Sunrise",
    entryFee: 2000,
    location: "Kilifi",
    imageUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop",
  },
];

export const mockChefSpecials: ChefSpecial[] = [
  {
    id: "chef1",
    chef: "Chef Mwangi",
    dish: "Coconut Crab Linguine",
    description: "Fresh crab in a creamy coconut sauce with local spices",
    price: 2800,
    restaurant: "Ali Barbour's Cave",
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1579631542720-3a87824fff86?w=400&h=300&fit=crop",
  },
  {
    id: "chef2",
    chef: "Chef Amina",
    dish: "Grilled Lobster Tail",
    description: "Butter-grilled lobster with garlic herb butter",
    price: 4500,
    restaurant: "Moorings Restaurant",
    location: "Mombasa",
    imageUrl: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop",
  },
];

export const mockBikeRentals: BikeRental[] = [
  {
    id: "bike1",
    provider: "Diani Bikes",
    type: "Beach Cruiser",
    pricePerHour: 300,
    pricePerDay: 1500,
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
    available: 8,
  },
  {
    id: "bike2",
    provider: "Mombasa Riders",
    type: "Mountain Bike",
    pricePerHour: 500,
    pricePerDay: 2500,
    location: "Mombasa",
    imageUrl: "https://images.unsplash.com/photo-1544191696-102dbdaeeaa0?w=400&h=300&fit=crop",
    available: 5,
  },
  {
    id: "bike3",
    provider: "Lamu Explorers",
    type: "City Bike",
    pricePerHour: 200,
    pricePerDay: 1000,
    location: "Lamu Island",
    imageUrl: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400&h=300&fit=crop",
    available: 12,
  },
];

export const mockDailyActivities: DailyActivity[] = [
  {
    id: "act1",
    name: "Sunrise Yoga on the Beach",
    type: "Wellness",
    time: "6:00 AM",
    duration: "1.5 hours",
    price: 1500,
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop",
    spotsLeft: 6,
  },
  {
    id: "act2",
    name: "Dolphin Watching Tour",
    type: "Nature",
    time: "7:00 AM",
    duration: "3 hours",
    price: 4500,
    location: "Watamu",
    imageUrl: "https://images.unsplash.com/photo-1607153333879-c174d265f1d2?w=400&h=300&fit=crop",
    spotsLeft: 4,
  },
  {
    id: "act3",
    name: "Swahili Cooking Class",
    type: "Food",
    time: "10:00 AM",
    duration: "4 hours",
    price: 3500,
    location: "Mombasa Old Town",
    imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=300&fit=crop",
    spotsLeft: 8,
  },
  {
    id: "act4",
    name: "Snorkeling at Marine Park",
    type: "Water Sports",
    time: "9:00 AM",
    duration: "4 hours",
    price: 5500,
    location: "Malindi Marine Park",
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop",
    spotsLeft: 10,
  },
  {
    id: "act5",
    name: "Historical Walking Tour",
    type: "Culture",
    time: "4:00 PM",
    duration: "2 hours",
    price: 2000,
    location: "Lamu Old Town",
    imageUrl: "https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=400&h=300&fit=crop",
    spotsLeft: 12,
  },
];

export const mockDrinksOfTheDay: DrinkOfTheDay[] = [
  {
    id: "drink1",
    name: "Dawa Cocktail",
    bar: "Sails Beach Bar",
    originalPrice: 800,
    specialPrice: 500,
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=300&fit=crop",
  },
  {
    id: "drink2",
    name: "Fresh Passion Mojito",
    bar: "Forty Thieves",
    originalPrice: 700,
    specialPrice: 450,
    location: "Diani Beach",
    imageUrl: "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&h=300&fit=crop",
  },
  {
    id: "drink3",
    name: "Swahili Sunrise",
    bar: "Peponi Hotel",
    originalPrice: 900,
    specialPrice: 600,
    location: "Lamu Island",
    imageUrl: "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=400&h=300&fit=crop",
  },
];

export const coastalCities = [
  "Mombasa",
  "Diani",
  "Lamu",
  "Watamu",
  "Malindi",
  "Kilifi",
  "Nyali",
  "Bamburi",
];
