import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Gamepad2, Package, Smartphone, Sparkles } from "lucide-react";
import { monogramFor, resolveProductImage, toneFor } from "@/lib/productImage";

type ProductArtworkProps = {
  name: string;
  category?: string | null;
  subcategory?: string | null;
  imageUrl?: string | null;
  externalId?: string | null;
  /** contain مناسب لشعارات التطبيقات، وcover مناسب لصور الأجهزة والإكسسوارات. */
  fit?: "contain" | "cover";
  variant?: "card" | "chip";
  className?: string;
};

type ArtworkStatus = "loading" | "ready" | "error";

function GlyphFor({ category, size }: { category?: string | null; size: number }) {
  if (category === "الألعاب") return <Gamepad2 size={size} strokeWidth={1.6} />;
  if (category === "التطبيقات") return <Package size={size} strokeWidth={1.6} />;
  if (category === "الهواتف" || category === "الإكسسوارات") {
    return <Smartphone size={size} strokeWidth={1.6} />;
  }
  return <Sparkles size={size} strokeWidth={1.6} />;
}

export default function ProductArtwork({
  name,
  category,
  subcategory,
  imageUrl,
  externalId,
  fit = "contain",
  variant = "card",
  className = "",
}: ProductArtworkProps) {
  const src = useMemo(
    () =>
      resolveProductImage({
        name,
        category,
        subcategory,
        imageUrl,
        externalId,
      }),
    [name, category, subcategory, imageUrl, externalId]
  );

  const [status, setStatus] = useState<ArtworkStatus>(src ? "loading" : "error");

  useEffect(() => {
    setStatus(src ? "loading" : "error");
  }, [src]);

  const tone = toneFor(`${name} ${subcategory ?? ""}`);
  const monogram = monogramFor(name);

  const style = {
    "--pa-from": tone.from,
    "--pa-to": tone.to,
    "--pa-glow": tone.glow,
  } as CSSProperties;

  return (
    <div
      className={`pa pa-${variant} pa-${status} ${fit === "cover" ? "is-cover" : ""} ${className}`.trim()}
      style={style}
    >
      <div className="pa-fallback" aria-hidden="true">
        {variant === "chip" ? (
          <span className="pa-chip-glyph">
            <GlyphFor category={category} size={14} />
          </span>
        ) : (
          <>
            <div className="pa-glyph">
              <GlyphFor category={category} size={22} />
            </div>
            <div className="pa-tile">
              <div className="pa-monogram" data-len={monogram.length}>
                {monogram}
              </div>
            </div>
          </>
        )}
      </div>

      {src && status !== "error" ? (
        <img
          className="pa-media"
          src={src}
          alt=""
          role="presentation"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
        />
      ) : null}
    </div>
  );
}
