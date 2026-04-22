import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ChatLauncher from "./ChatLauncher";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <ChatLauncher />
    </div>
  );
}
