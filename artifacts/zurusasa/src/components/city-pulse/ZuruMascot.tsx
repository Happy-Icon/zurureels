import { cn } from "@/lib/utils";

interface ZuruMascotProps {
  className?: string;
}

export function ZuruMascot({ className }: ZuruMascotProps) {
  return (
    <svg 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
    >
      {/* Robot Head / Body */}
      <rect x="8" y="16" width="48" height="40" rx="12" fill="white" />
      <rect x="8" y="16" width="48" height="40" rx="12" fill="url(#bot-gradient)" />
      
      {/* Screen Face */}
      <rect x="14" y="24" width="36" height="24" rx="6" fill="#1A1A1A" />
      
      {/* Eyes */}
      <circle cx="24" cy="34" r="4" fill="#4ADE80">
        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="40" cy="34" r="4" fill="#4ADE80">
        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
      </circle>
      
      {/* Antenna */}
      <rect x="30" y="8" width="4" height="8" rx="2" fill="white" />
      <circle cx="32" cy="6" r="4" fill="#EE7D30">
        <animate attributeName="r" values="4;5;4" dur="1s" repeatCount="indefinite" />
      </circle>

      <defs>
        <linearGradient id="bot-gradient" x1="8" y1="16" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.2" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
