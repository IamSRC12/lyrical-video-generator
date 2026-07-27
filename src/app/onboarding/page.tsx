import {auth} from "@/auth";
import {ApiKeyOnboarding} from "@/components/ApiKeyOnboarding";
import {redirect} from "next/navigation";

export default async function OnboardingPage() {
  if (!(await auth())) redirect("/");

  return (
    <main className="min-h-screen p-8">
      <ApiKeyOnboarding />
    </main>
  );
}
