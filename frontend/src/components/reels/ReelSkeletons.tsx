/**
 * Skeleton Loaders for Reel Feed
 */

export const ReelCardSkeleton = () => {
  return (
    <div className="aspect-[3/4] rounded-2xl bg-muted animate-pulse overflow-hidden relative">
      {/* Video area */}
      <div className="w-full h-full bg-gradient-to-b from-muted to-muted/50" />
      
      {/* Info area at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 space-y-2">
        <div className="h-4 bg-muted/40 rounded w-3/4" />
        <div className="h-3 bg-muted/40 rounded w-1/2" />
      </div>
    </div>
  );
};

export const FullScreenReelSkeleton = () => {
  return (
    <div className="w-full h-screen bg-muted flex flex-col items-center justify-center animate-pulse">
      <div className="w-12 h-12 rounded-full bg-muted mb-4" />
      <div className="h-4 bg-muted rounded w-32 mb-2" />
      <div className="h-3 bg-muted rounded w-24" />
    </div>
  );
};

export const VideoLoaderSpinner = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
  );
};
