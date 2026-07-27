import {auth} from "@/auth";

export async function requireUser() {
  const session = await auth();

  if (!session?.user) {
    throw new Response("Unauthorized", {status: 401});
  }

  return session.user;
}
