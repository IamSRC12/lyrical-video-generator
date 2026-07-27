import {auth} from "@/auth";
import {redirect} from "next/navigation";
import {EditorWorkspace} from "@/components/editor/EditorWorkspace";

export default async function EditorPage() {
  if (!(await auth())) redirect("/");

  return <EditorWorkspace />;
}
