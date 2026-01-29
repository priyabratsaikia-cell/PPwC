"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const iconClass = "w-5 h-5 shrink-0";

const Icons = {
  logo: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 17L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
    </svg>
  ),
  new: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  slides: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  chat: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  templates: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
  ),
  files: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  help: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  profile: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

const navItems = [
  { href: "/", label: "NEW", icon: Icons.new },
  { href: "/slides", label: "SLIDES", icon: Icons.slides },
  { href: "/templates", label: "TEMPLATES", icon: Icons.templates },
  { href: "/files", label: "FILES", icon: Icons.files },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  const linkBase = "flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg text-[10px] font-semibold uppercase tracking-wide no-underline transition-colors w-full";
  const linkActive = "bg-[#3d3d3d] text-[#D04A02] [&_svg]:text-[#D04A02]";
  const linkInactive = "text-[#9ca3af] hover:bg-[#353535] hover:text-[#d1d5db] [&_svg]:text-current";

  return (
    <aside className="w-[72px] shrink-0 flex flex-col bg-[#252525] items-center py-3">
      <div className="mb-4 shrink-0">
        <Link href="/" className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-[#353535] text-[#D04A02] no-underline [&_svg]:text-[#D04A02]">
          {Icons.logo}
        </Link>
      </div>
      <nav className="flex-1 flex flex-col gap-0.5 w-full px-2" aria-label="Main">
        {navItems.map(({ href, label, icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${linkBase} ${isActive ? linkActive : linkInactive}`}
            >
              {icon}
              <span className="text-center leading-tight">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-0.5 w-full px-2 pt-2 border-t border-[#3d3d3d] shrink-0">
        <button type="button" className={`${linkBase} ${linkInactive} cursor-pointer bg-transparent border-0`} aria-label="Help">
          {Icons.help}
        </button>
        <Link href="/profile" className={`${linkBase} ${linkInactive}`}>
          {Icons.profile}
          <span className="text-center leading-tight">Profile</span>
        </Link>
      </div>
    </aside>
  );
}
