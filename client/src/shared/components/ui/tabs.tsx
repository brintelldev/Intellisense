import * as React from "react";
import { cn } from "../../lib/utils";

interface TabsContextValue { value: string; onChange: (v: string) => void; }
const TabsContext = React.createContext<TabsContextValue>({ value: "", onChange: () => {} });

function Tabs({ value, defaultValue, onValueChange, children, className }: {
  value?: string; defaultValue?: string; onValueChange?: (v: string) => void;
  children: React.ReactNode; className?: string;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const controlled = value !== undefined;
  return (
    <TabsContext.Provider value={{ value: controlled ? value! : internal, onChange: (v) => { if (!controlled) setInternal(v); onValueChange?.(v); } }}>
      <div className={cn("", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex gap-1 border-b border-slate-200 mb-4", className)}>{children}</div>;
}

function TabsTrigger({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onChange(value)}
      className={cn(
        "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
        active ? "border-[#293b83] text-[#293b83]" : "border-transparent text-slate-500 hover:text-slate-700",
        className
      )}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <div className={cn("", className)}>{children}</div>;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
