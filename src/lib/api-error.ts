
/**
 * Standardized API error response helper.
 */
export function apiError(
  message: string,
  status: number = 500
): Response {
  return Response.json({message}, {status});
}

/**
 * Wraps an async API handler to catch and format errors consistently.
 */
export async function withApiErrorHandling(
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) return error;

    console.error("API error:", error);

    return apiError(
      error instanceof Error ? error.message : "An unexpected error occurred.",
      500
    );
  }
}


