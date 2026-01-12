// Experience-Specific Reel Specifications

export interface ReelSegment {
  segment: "intro" | "peak" | "close";
  time_range_seconds: string;
  purpose: string;
  required_shot_types: string[];
  motion_required?: boolean;
  human_presence_required?: boolean;
}

export interface ReelValidationRules {
  must_have_motion: boolean;
  must_have_human_presence: boolean;
  signature_moment_required: boolean;
  water_visibility_min_seconds?: number;
}

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

// Export all specifications as a map for easy lookup
export const reelSpecifications: Record<string, ExperienceReelSpec> = {
  boats: boatsReelSpec
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
