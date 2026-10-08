/** localhost and loopback addresses open Sunroom only on the computer it runs on, never from a
 * phone, so the wall screen doesn't print them as the address to open. */
export function isLoopbackAddress(address: string): boolean {
  let host: string;
  try {
    host = new URL(address).hostname;
  } catch {
    return false;
  }
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    host.startsWith("127.")
  );
}
