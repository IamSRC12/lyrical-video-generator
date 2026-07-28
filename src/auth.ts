export async function auth() {
  return {
    user: {
      name: "Local Studio User",
      email: "user@local.studio"
    }
  };
}

export const handlers = {
  GET: async () => new Response("Auth disabled", {status: 200}),
  POST: async () => new Response("Auth disabled", {status: 200})
};

export async function signIn() {}
export async function signOut() {}
