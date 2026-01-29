import PresentationForm from "@/components/PresentationForm";

export default function Home() {
  return (
    <main className="h-screen flex flex-col overflow-hidden bg-[#fafafa]">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden bg-white border-b border-[#e5e5e5]">
          <PresentationForm />
        </div>
        <footer className="shrink-0 py-2 text-center text-sm text-[#4a4a4a] border-t border-[#e5e5e5] bg-white">
          <p>Development version for internal POC</p>
        </footer>
      </div>
    </main>
  );
}
