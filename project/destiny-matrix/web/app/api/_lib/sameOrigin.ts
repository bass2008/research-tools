/** Behind nginx `req.url` carries the server's own address (0.0.0.0:3000), so the check
 * compares Origin with the host the browser addressed. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
