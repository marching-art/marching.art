// News feed loading skeletons. Extracted from NewsFeed.jsx.

function SkeletonPulse({ className }) {
  return (
    <div className={`animate-pulse bg-[#2a2a2a] ${className}`} />
  );
}

function HeroSkeleton() {
  return (
    <div className="mb-6 bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Hero Image Skeleton */}
      <SkeletonPulse className="aspect-[21/9]" />

      {/* Hero Content Skeleton */}
      <div className="p-5 lg:p-6">
        {/* Meta row */}
        <div className="flex items-center gap-3 mb-3">
          <SkeletonPulse className="w-20 h-6" />
          <SkeletonPulse className="w-24 h-4" />
        </div>

        {/* Headline */}
        <SkeletonPulse className="h-10 lg:h-12 w-full mb-2" />
        <SkeletonPulse className="h-10 lg:h-12 w-3/4 mb-4" />

        {/* Summary */}
        <SkeletonPulse className="h-5 w-full mb-2" />
        <SkeletonPulse className="h-5 w-5/6 mb-5" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#333]/50">
          <div className="flex items-center gap-3">
            <SkeletonPulse className="w-16 h-4" />
            <SkeletonPulse className="w-16 h-4" />
          </div>
          <SkeletonPulse className="w-8 h-8" />
        </div>
      </div>
    </div>
  );
}

function ImageGridCardSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden flex flex-col">
      {/* Image skeleton */}
      <SkeletonPulse className="aspect-[4/3]" />

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Headline */}
        <SkeletonPulse className="h-4 w-full mb-1" />
        <SkeletonPulse className="h-4 w-5/6 mb-1" />
        <SkeletonPulse className="h-4 w-3/4 mb-2" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#333]/50 mt-auto">
          <SkeletonPulse className="w-16 h-3" />
          <SkeletonPulse className="w-12 h-3" />
        </div>
      </div>
    </div>
  );
}

function NewsFeedSkeleton() {
  return (
    <div>
      {/* Hero Skeleton */}
      <HeroSkeleton />

      {/* Image Grid Skeletons - 4 column layout */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <SkeletonPulse className="w-4 h-4" />
          <SkeletonPulse className="w-24 h-4" />
          <div className="flex-1 h-px bg-[#333]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ImageGridCardSkeleton />
          <ImageGridCardSkeleton />
          <ImageGridCardSkeleton />
          <ImageGridCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export { SkeletonPulse, HeroSkeleton, ImageGridCardSkeleton, NewsFeedSkeleton };
