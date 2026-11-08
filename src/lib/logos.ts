import sharp from "sharp";
import { AppError } from "./security";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export async function boundedBody(req: Request, limit: number) {
  const claimed = Number(req.headers.get("content-length"));
  if (claimed > limit) throw new AppError("FILE_TOO_LARGE", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new AppError("INVALID_INPUT", 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("FILE_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function processLogo(bytes: Buffer, type: string) {
  if (bytes.length > MAX_LOGO_BYTES) throw new AppError("FILE_TOO_LARGE", 413);
  const formats: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (!formats[type]) throw new AppError("INVALID_LOGO", 422);
  // Reject other file signatures before invoking a decoder, including SVG and PDF.
  const signature = bytes.subarray(0, 12);
  const validSignature =
    type === "image/jpeg"
      ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
      : type === "image/png"
        ? signature
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : signature.subarray(0, 4).toString() === "RIFF" &&
          signature.subarray(8, 12).toString() === "WEBP";
  if (!validSignature) throw new AppError("INVALID_LOGO", 422);
  try {
    const source = sharp(bytes, {
      limitInputPixels: 16000000,
      failOn: "warning",
    });
    const info = await source.metadata();
    if (info.format !== formats[type] || (info.pages || 1) !== 1)
      throw new Error("Unsupported image");
    // Re-encoding strips original metadata and keeps database/storage traffic small.
    const result = await source
      .rotate()
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    if (result.length > 98304) throw new Error("Logo too complex");
    return result;
  } catch {
    throw new AppError("INVALID_LOGO", 422);
  }
}
