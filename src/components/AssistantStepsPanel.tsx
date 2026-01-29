"use client";

export interface TodoItem {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
}

interface AssistantStepsPanelProps {
  topic: string;
  tone: string;
  todos: TodoItem[];
  onSlideClick?: (index: number) => void;
  canGoToSlide?: (index: number) => boolean;
  children?: React.ReactNode;
}

function getSlideIndex(id: string): number {
  const m = id.match(/^slide-(\d+)$/);
  return m ? parseInt(m[1], 10) : -1;
}

export default function AssistantStepsPanel({
  topic,
  tone,
  todos,
  onSlideClick,
  canGoToSlide,
  children,
}: AssistantStepsPanelProps) {
  const showStages = todos.length > 0;

  return (
    <div className="w-[320px] shrink-0 flex flex-col min-h-0 bg-[#f0f0f0] border-r border-[#e5e5e5]">
      <div className="flex-1 min-h-0 overflow-auto overflow-y-scroll p-4 steps-panel-no-scrollbar">
        {children}
        {showStages && !children && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a4a4a] mb-1">
                Presentation
              </p>
              <p className="font-semibold text-[#1a1a1a] text-sm break-words">{topic}</p>
              <p className="text-xs text-[#4a4a4a] mt-1">Tone: {tone}</p>
            </div>
            <div className="rounded-lg border border-[#e5e5e5] bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4a4a4a] mb-3">
                Stages
              </p>
              <ul className="space-y-2">
                {todos.map((todo) => {
                  const slideIndex = getSlideIndex(todo.id);
                  const canGo = typeof canGoToSlide === "function" ? canGoToSlide(slideIndex) : false;
                  const clickable = slideIndex >= 0 && canGo && typeof onSlideClick === "function";
                  return (
                    <li
                      key={todo.id}
                      className={`flex items-center gap-2.5 text-sm py-1.5 px-2 rounded-md ${
                        clickable ? "cursor-pointer hover:bg-[#f5f5f5]" : ""
                      } ${todo.current ? "bg-[#fef3ef]" : ""}`}
                      onClick={clickable ? () => onSlideClick!(slideIndex) : undefined}
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSlideClick!(slideIndex);
                              }
                            }
                          : undefined
                      }
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                    >
                      {todo.done ? (
                        <span className="text-[#D04A02] shrink-0" aria-hidden>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : todo.current ? (
                        <span className="w-4 h-4 border-2 border-[#D04A02] border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-[#e5e5e5] shrink-0" />
                      )}
                      <span
                        className={
                          todo.current ? "text-[#D04A02] font-medium" : todo.done ? "text-[#1a1a1a]" : "text-[#4a4a4a]"
                        }
                      >
                        {todo.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 py-2 text-[10px] text-[#9ca3af] border-t border-[#e5e5e5] bg-[#f0f0f0]">
        MODEL: gemini-3-pro-preview
      </div>
    </div>
  );
}
