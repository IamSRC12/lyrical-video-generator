import {auth} from "@/auth";
import {redirect} from "next/navigation";
import {UploadAndAlign} from "@/components/UploadAndAlign";

export default async function UploadPage() {
  if (!(await auth())) redirect("/");

  return (
    <main className="min-h-screen p-8">
      <UploadAndAlign />
    </main>
  );
}
