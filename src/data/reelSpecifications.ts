// Experience-Specific Reel Specifications

// Shot Type Enum Reference
export const SHOT_TYPES = [
  "pov_entry",
  "wide_environment",
  "close_up_detail",
  "motion_action",
  "human_reaction",
  "signature_moment",
  "calm_contrast",
  "end_frame",
  "transition_effect"
] as const;

export type ShotType = typeof SHOT_TYPES[number];

// Base Reel Spec Schema
export interface BaseReelSpec {
  type: "reel_spec";
  experience_category: string;
  experience_subtype?: string;
  duration_seconds: number;
  required_elements: string[];
  timeline: ReelSegment[];
  validation_rules: ReelValidationRules;
  scoring_weights?: Record<string, number>;
}

export interface ReelSegment {
  segment: "intro" | "peak" | "close";
  time_range_seconds: string;
  purpose: string;
  required_shot_types: string[];
  human_presence_required?: boolean;
  motion_required?: boolean;
  optional_audio_cue?: string;
}

export interface ReelValidationRules {
  must_have_motion: boolean;
  must_have_human_presence: boolean;
  max_static_segments?: number;
  hook_within_seconds?: number;
  signature_moment_required: boolean;
  subtitles_recommended?: boolean;
  water_visibility_min_seconds?: number;
}

// Scoring Weights Schema
export interface ScoringWeights {
  hook_strength: number;
  motion_quality: number;
  human_emotion: number;
  visual_clarity: number;
  signature_moment: number;
  viral_potential: number;
}

// Generic Scoring Weights (Base Defaults)
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  hook_strength: 0.25,
  motion_quality: 0.25,
  human_emotion: 0.20,
  visual_clarity: 0.15,
  signature_moment: 0.10,
  viral_potential: 0.05
};

export interface ExperienceReelSpec {
  experience_category: string;
  required_elements: string[];
  timeline: ReelSegment[];
  validation_rules: ReelValidationRules;
}

export const boatsReelSpec: ExperienceReelSpec = {
  experience_category: "boats",
  required_elements: ["motion", "water", "human_presence"],
  timeline: [
    {
      segment: "intro",
      time_range_seconds: "0-5",
      purpose: "Hook with pov_entry on water",
      required_shot_types: ["pov_entry"],
      motion_required: true
    },
    {
      segment: "peak",
      time_range_seconds: "6-15",
      purpose: "Show speed/splash signature moment",
      required_shot_types: ["motion_action", "signature_moment"],
      human_presence_required: true
    },
    {
      segment: "close",
      time_range_seconds: "16-20",
      purpose: "Calm end with human reaction or scenic float",
      required_shot_types: ["human_reaction", "calm_contrast"]
    }
  ],
  validation_rules: {
    must_have_motion: true,
    must_have_human_presence: true,
    signature_moment_required: true,
    water_visibility_min_seconds: 10
  }
};

export const foodReelSpec: ExperienceReelSpec = {
  experience_category: "food",
  required_elements: ["food_motion", "texture", "human_reaction"],
  timeline: [
    {
      segment: "intro",
      time_range_seconds: "0-5",
      purpose: "Close-up steam/sizzle hook",
      required_shot_types: ["close_up_detail"],
      optional_audio_cue: "ASMR crunch or sizzle"
    },
    {
      segment: "peak",
      time_range_seconds: "6-15",
      purpose: "Bite / taste reaction",
      required_shot_types: ["human_reaction", "motion_action"]
    },
    {
      segment: "close",
      time_range_seconds: "16-20",
      purpose: "Plated reveal or final bite",
      required_shot_types: ["wide_environment", "close_up_detail"]
    }
  ],
  validation_rules: {
    must_have_motion: true,
    must_have_human_presence: true,
    signature_moment_required: true
  }
};

export const drinksReelSpec: ExperienceReelSpec = {
  experience_category: "drinks",
  required_elements: ["pour", "atmosphere", "social_energy"],
  timeline: [
    {
      segment: "intro",
      time_range_seconds: "0-5",
      purpose: "Pour or glass clink hook",
      required_shot_types: ["close_up_detail", "motion_action"],
      optional_audio_cue: "ASMR pour or ice clink"
    },
    {
      segment: "peak",
      time_range_seconds: "6-15",
      purpose: "Sip / cheers reaction in vibrant setting",
      required_shot_types: ["human_reaction", "wide_environment"]
    },
    {
      segment: "close",
      time_range_seconds: "16-20",
      purpose: "Ambient nightlife vibe or final toast",
      required_shot_types: ["calm_contrast", "end_frame"]
    }
  ],
  validation_rules: {
    must_have_motion: true,
    must_have_human_presence: true,
    max_static_segments: 1,
    signature_moment_required: true
  }
};

export const rentalsReelSpec: ExperienceReelSpec = {
  experience_category: "rentals",
  required_elements: ["vehicle_motion", "rider_presence", "terrain"],
  timeline: [
    {
      segment: "intro",
      time_range_seconds: "0-5",
      purpose: "POV start or rider mounting",
      required_shot_types: ["pov_entry"],
      motion_required: true
    },
    {
      segment: "peak",
      time_range_seconds: "6-15",
      purpose: "Riding action on terrain",
      required_shot_types: ["motion_action", "signature_moment"],
      human_presence_required: true
    },
    {
      segment: "close",
      time_range_seconds: "16-20",
      purpose: "Stop / rider reaction",
      required_shot_types: ["human_reaction", "end_frame"]
    }
  ],
  validation_rules: {
    must_have_motion: true,
    must_have_human_presence: true,
    max_static_segments: 0,
    signature_moment_required: true
  }
};

export const adventureReelSpec: ExperienceReelSpec = {
  experience_category: "adventure",
  required_elements: ["adrenaline", "height_or_speed", "human_reaction"],
  timeline: [
    {
      segment: "intro",
      time_range_seconds: "0-5",
      purpose: "Setup / anticipation hook",
      required_shot_types: ["wide_environment"]
    },
    {
      segment: "peak",
      time_range_seconds: "6-15",
      purpose: "Peak action (drop, jump, climb)",
      required_shot_types: ["motion_action", "signature_moment"],
      human_presence_required: true,
      motion_required: true
    },
    {
      segment: "close",
      time_range_seconds: "16-20",
      purpose: "Relief / celebration reaction",
      required_shot_types: ["human_reaction", "calm_contrast"]
    }
  ],
  validation_rules: {
    must_have_motion: true,
    must_have_human_presence: true,
    hook_within_seconds: 3,
    signature_moment_required: true
  }
};

export const parksCampsReelSpec: ExperienceReelSpec = {
  experience_category: "parks_camps",
  required_elements: ["nature", "space", "calm_human_presence"],
  timeline: [
    {
      segment: "intro",
      time_range_seconds: "0-5",
      purpose: "Wide nature reveal",
      required_shot_types: ["wide_environment"]
    },
    {
      segment: "peak",
      time_range_seconds: "6-15",
      purpose: "Explore / relax moment",
      required_shot_types: ["motion_action", "human_reaction"]
    },
    {
      segment: "close",
      time_range_seconds: "16-20",
      purpose: "Serene end frame",
      required_shot_types: ["calm_contrast", "end_frame"]
    }
  ],
  validation_rules: {
    must_have_motion: false,
    must_have_human_presence: false,
    max_static_segments: 2,
    signature_moment_required: true
  }
};

export const toursReelSpec: ExperienceReelSpec = {
  experience_category: "tours",
  required_elements: ["movement", "landmark", "guide_context"],
  timeline: [
    {
      segment: "intro",
      time_range_seconds: "0-5",
      purpose: "Starting point / landmark hook",
      required_shot_types: ["wide_environment"]
    },
    {
      segment: "peak",
      time_range_seconds: "6-15",
      purpose: "Movement between stops + guide insight",
      required_shot_types: ["motion_action", "human_reaction"],
      motion_required: true
    },
    {
      segment: "close",
      time_range_seconds: "16-20",
      purpose: "Final landmark or group moment",
      required_shot_types: ["end_frame"]
    }
  ],
  validation_rules: {
    must_have_motion: true,
    must_have_human_presence: false,
    subtitles_recommended: true,
    signature_moment_required: true
  }
};

// Export all specifications as a map for easy lookup
export const reelSpecifications: Record<string, ExperienceReelSpec> = {
  boats: boatsReelSpec,
  food: foodReelSpec,
  drinks: drinksReelSpec,
  rentals: rentalsReelSpec,
  adventure: adventureReelSpec,
  parks_camps: parksCampsReelSpec,
  tours: toursReelSpec
};

// Helper to get spec by category
export function getReelSpecByCategory(category: string): ExperienceReelSpec | undefined {
  return reelSpecifications[category.toLowerCase()];
}

// Helper to validate timeline coverage
export function getTimelineDuration(spec: ExperienceReelSpec): { start: number; end: number } {
  const segments = spec.timeline;
  const lastSegment = segments[segments.length - 1];
  const [, endStr] = lastSegment.time_range_seconds.split("-");
  return { start: 0, end: parseInt(endStr, 10) };
}
