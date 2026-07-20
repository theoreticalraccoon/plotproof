"use client";

/** Route-level error boundary — turns any thrown render/data error into an
 *  explainable card with a retry, instead of a blank screen or a stack trace. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold">Something went wrong on this screen.</h1>
      <p className="text-sm text-gray-600">
        Your captured plots are saved on this device and are safe. You can retry, or
        go back to the start.
      </p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded bg-gray-800 px-4 py-2 text-sm text-white">
          Try again
        </button>
        <a href="/" className="rounded bg-gray-200 px-4 py-2 text-sm">
          Home
        </a>
      </div>
    </main>
  );
}
