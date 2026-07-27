import {auth, signIn, signOut} from "@/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="grid min-h-screen place-items-center p-8">
      <section className="panel-3d max-w-2xl p-12 text-center">
        <div className="mb-3 text-sm font-bold uppercase tracking-[.35em] text-violet-600">
          Lyrical Studio
        </div>

        <h1 className="text-5xl font-black tracking-tight">
          AI lyrical videos with precise word synchronization
        </h1>

        <p className="mt-5 text-slate-600">
          Transcribe, align, edit, animate and export from one workspace.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <Link className="button-primary" href="/onboarding">
            Open studio
          </Link>
        </div>
      </section>
    </main>
  );
}
