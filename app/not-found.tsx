export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <h1 className="text-lg font-semibold">Page not found.</h1>
      <a href="/" className="rounded bg-gray-800 px-4 py-2 text-sm text-white">
        Back to start
      </a>
    </main>
  );
}
