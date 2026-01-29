import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PPT Agent - AI Presentation Generator",
  description: "Generate professional PowerPoint presentations using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden bg-[#fafafa]">
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
