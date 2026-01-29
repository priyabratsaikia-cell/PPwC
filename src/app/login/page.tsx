import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="h-full flex flex-col items-center justify-center bg-white p-6">
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold text-[#1a1a1a]">Logout</h1>
        <p className="text-sm text-[#4a4a4a] mt-2">You have been logged out.</p>
        <Link
          href="/"
          className="mt-6 inline-block px-6 py-3 bg-[#D04A02] hover:bg-[#b03e02] text-white font-medium rounded-lg transition text-sm no-underline"
        >
          Back to New
        </Link>
      </div>
    </main>
  );
}
