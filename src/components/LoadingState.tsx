"use client";

interface LoadingStateProps {
  message?: string;
  completedSlides?: number;
  totalSlides?: number;
}

export default function LoadingState({
  message = "Generating your presentation...",
  completedSlides,
  totalSlides,
}: LoadingStateProps) {
  const showSlideProgress = totalSlides != null && totalSlides > 0;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-purple-200 rounded-full animate-spin border-t-purple-600"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-purple-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
      </div>
      <p className="mt-4 text-lg font-medium text-gray-700">{message}</p>
      {showSlideProgress && (
        <p className="mt-2 text-sm text-purple-600 font-medium">
          Crafting HTML... {(completedSlides ?? 0)} of {totalSlides} slides ready
        </p>
      )}
      {!showSlideProgress && (
        <p className="mt-2 text-sm text-gray-500">Please wait...</p>
      )}
    </div>
  );
}
