/**
 * Resolve the user-facing message for a failed `supabase.functions.invoke` call.
 *
 * functions-js reports every non-2xx response as a FunctionsHttpError whose
 * `message` is always "Edge Function returned a non-2xx status code"; the
 * server's own `{ error }` body lives on `error.context` (a Response).
 */
export async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
    } catch {
      // Body was not JSON; fall through to the status line.
    }
    return `Edge Function returned status ${context.status}`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong.";
}
