/**
 * Picture uploads: the one place the app calls the API without the generated client, because the
 * body is the image itself (the server reads raw bytes, so OpenAPI describes no body). Shrunk on
 * the phone first; the server re-encodes them as WebP without metadata (ADR 0009).
 */
import { ApiError } from "../api/client";

export async function uploadPicture<T>(
  path: string,
  method: "POST" | "PUT",
  file: File,
  maxSide: number,
): Promise<T> {
  let body: Blob = file;
  try {
    body = await shrink(file, maxSide);
  } catch {
    // The browser couldn't decode it (HEIC on some phones): the server reads the original.
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      body,
      credentials: "same-origin",
      headers: { "Content-Type": body.type || "image/jpeg", "X-Sunroom": "1" },
    });
  } catch {
    throw new ApiError(0, "offline", "Not saved — you're offline. Try again when you have signal.");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; pin?: boolean } } | null)
      ?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "error",
      error?.message ?? "That photo couldn't be saved. Try again.",
      error?.pin === true,
    );
  }
  return payload as T;
}

async function shrink(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("couldn't encode"));
      },
      "image/jpeg",
      0.88,
    );
  });
}
