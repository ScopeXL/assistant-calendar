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

/**
 * An address on the home network, as far as its own words say (a photo library's "This server is
 * on your home network" starts ticked for one, ADR 0036): localhost, a private or link-local IP
 * (10., 172.16–31., 192.168., 169.254., fc00::/7, fe80::/10), or a name with no dots or ending in
 * .local, .lan, .home or .internal. Only a starting point: the switch stays the family's, and the
 * server's guard decides.
 */
export function isHomeAddress(address: string): boolean {
  const text = address.trim();
  if (!text) return false;
  let host: string;
  try {
    host = new URL(text.includes("://") ? text : `http://${text}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  host = host.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  if (host.includes(":")) return host === "::1" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  return !host.includes(".") || /\.(local|lan|home|internal)$/.test(host);
}
