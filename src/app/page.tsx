import TopNav from "@/components/TopNav";
import PresentationForm from "@/components/PresentationForm";

export default function Home() {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <TopNav projectName="Engagement_Q3_Strategy.pptx" />
      <div className="flex-1 min-h-0 overflow-hidden">
        <PresentationForm />
      </div>
    </div>
  );
}
