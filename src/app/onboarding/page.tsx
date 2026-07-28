"use client";

import { ApiKeyOnboarding } from "@/components/ApiKeyOnboarding";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function OnboardingPage() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);

  return (
    <main className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center">
      <ApiKeyOnboarding
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          router.push("/");
        }}
      />
    </main>
  );
}
