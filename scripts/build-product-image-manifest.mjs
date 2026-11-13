#!/usr/bin/env node
/**
 * يبني فهرس صور المنتجات من مجلد:
 *   client/public/product-images/
 *
 * أسماء الملفات المدعومة:
 *   free-fire.webp                 → يطابق اسم المنتج «Free Fire»
 *   فري-فاير.png                    → يطابق الاسم العربي
 *   id-12345.png                    → يطابق معرّف المنتج لدى المورد (externalId)
 *   games/free-fire.png             → مجلد فرعي اختياري لترجيح القسم
 *
 * يُشغَّل تلقائيًا قبل `pnpm build`، ويمكن تشغيله يدويًا بـ:
 *   pnpm images:index
 */
import { readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const IMAGES_DIR = path.join(ROOT, "client", "public", "product-images");
const OUT_DIR = path.join(ROOT, "client", "src", "generated");
const OUT_FILE = path.join(OUT_DIR, "product-images.json");
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"]);
const SECTION_FOLDERS = {
  games: "الألعاب",
  game: "الألعاب",
  ألعاب: "الألعاب",
  العاب: "الألعاب",
  apps: "التطبيقات",
  app: "التطبيقات",
  تطبيقات: "التطبيقات",
};

export function normalizeImageKey(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function walk(dir) {
  const out = [];
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...(await walk(full)));
    else if (EXTENSIONS.has(path.extname(item.name).toLowerCase())) out.push(full);
  }
  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  if (!existsSync(IMAGES_DIR)) {
    await mkdir(IMAGES_DIR, { recursive: true });
  }

  const files = (await walk(IMAGES_DIR)).sort((a, b) => a.localeCompare(b, "ar"));
  const entries = [];
  const seen = new Map();

  for (const full of files) {
    const rel = path.relative(IMAGES_DIR, full).split(path.sep).join("/");
    const dirName = path.dirname(rel) === "." ? "" : path.dirname(rel).split("/")[0];
    const stem = path.basename(rel, path.extname(rel));
    const idMatch = stem.match(/^(?:id|#)[-_ ]?([A-Za-z0-9-]+)$/i);
    const id = idMatch ? idMatch[1] : undefined;
    const key = normalizeImageKey(idMatch ? "" : stem);
    const tokens = key ? key.split(" ").filter((t) => t.length > 1 || /\d/.test(t)) : [];

    if (!id && !key) {
      console.warn(`[images] تم تجاهل ملف بلا اسم صالح: ${rel}`);
      continue;
    }

    const signature = id ? `id:${id}` : `key:${key}`;
    if (seen.has(signature)) {
      console.warn(`[images] تكرار «${rel}» يطابق نفس المنتج مثل «${seen.get(signature)}»؛ سيُستخدم الأول.`);
      continue;
    }
    seen.set(signature, rel);

    entries.push({
      file: `/product-images/${rel}`,
      key,
      ...(id ? { id } : {}),
      ...(dirName && SECTION_FOLDERS[dirName.toLowerCase()]
        ? { section: SECTION_FOLDERS[dirName.toLowerCase()] }
        : {}),
      tokens,
    });
  }

  entries.sort((a, b) => (a.key || a.id || "").localeCompare(b.key || b.id || "", "ar"));

  // بلا طابع زمني: الملف لا يتغيّر إلا عند إضافة/حذف صورة، فلا يلوّث git.
  const payload = {
    count: entries.length,
    entries,
  };

  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    entries.length
      ? `[images] تم فهرسة ${entries.length} صورة → ${path.relative(ROOT, OUT_FILE)}`
      : `[images] لا توجد صور بعد في client/public/product-images (سيُستخدم البديل البصري).`
  );
}

main().catch((error) => {
  console.error("[images] تعذر بناء فهرس الصور:", error);
  process.exitCode = 1;
});
