import fs from "fs";
import path from "path";
import crypto from "crypto";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function extFromContentType(contentType = "") {
  const value = String(contentType).toLowerCase();
  if (value.includes("image/jpeg")) return ".jpg";
  if (value.includes("image/png")) return ".png";
  if (value.includes("image/webp")) return ".webp";
  if (value.includes("image/gif")) return ".gif";
  return ".jpg";
}

function sanitizeSlug(slug = "") {
  return String(slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function cacheRemoteImage({ imageUrl, slug, type = "deals" }) {
  if (!imageUrl || !slug) return "";

  const safeSlug = sanitizeSlug(slug);
  const targetDir = path.join("docs", "assets", type);
  ensureDir(targetDir);

  const hash = crypto.createHash("md5").update(imageUrl).digest("hex").slice(0, 8);

  try {
    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PochifyBot/1.0; +https://pochify.com)"
      }
    });

    if (!res.ok) {
      console.error(`❌ Failed to download image: ${res.status} ${imageUrl}`);
      return "";
    }

    const contentType = res.headers.get("content-type") || "";
    const ext = extFromContentType(contentType);
    const filename = `${safeSlug}-${hash}${ext}`;
    const filePath = path.join(targetDir, filename);

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    return `/assets/${type}/${filename}`;
  } catch (error) {
    console.error(`❌ cacheRemoteImage failed for ${imageUrl}:`, error.message);
    return "";
  }
}
