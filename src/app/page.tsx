import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

export default function Home() {
  return (
    <div className="app">
      <Suspense>
        <AppShell />
      </Suspense>
    </div>
  );
}
