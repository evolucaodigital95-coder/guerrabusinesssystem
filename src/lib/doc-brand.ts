/**
 * Identidade visual dos documentos/PDFs do GBS.
 *
 * Este módulo é PURAMENTE DE APRESENTAÇÃO. Ele resolve nome, logo e cores
 * da organização ativa para uso nos geradores de documentos existentes.
 * Nenhum cálculo financeiro, snapshot ou regra de comissão depende daqui.
 *
 * Quando a organização não possui identidade própria configurada, o padrão
 * histórico do Grupo Guerra é preservado integralmente.
 */
import grupoGuerraMark from "@/assets/grupo-guerra-mark.png";
import grupoGuerraMonogram from "@/assets/grupo-guerra-monogram.png";

export type RGB = [number, number, number];

/** Proporção real da marca (599 x 375) — usada para nunca distorcer a logo. */
export const GUERRA_MARK_RATIO = 599 / 375;
/** Proporção do monograma GG isolado (242 x 269). */
export const GUERRA_MONOGRAM_RATIO = 242 / 269;

export const DEFAULT_NAVY: RGB = [15, 39, 71];
export const DEFAULT_GOLD: RGB = [200, 164, 90];

const __imageCache = new Map<string, Promise<string | null>>();

export function loadImageDataUrl(url: string): Promise<string | null> {
  const cached = __imageCache.get(url);
  if (cached) return cached;
  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  })();
  __imageCache.set(url, p);
  return p;
}

/** Marca completa (monograma + wordmark) do Grupo Guerra. */
export function loadGuerraLogoDataUrl(): Promise<string | null> {
  return loadImageDataUrl(grupoGuerraMark);
}

/** Monograma GG isolado — usado quando o wordmark já aparece em texto. */
export function loadGuerraMonogramDataUrl(): Promise<string | null> {
  return loadImageDataUrl(grupoGuerraMonogram);
}

const __ratioCache = new Map<string, Promise<number | null>>();
function loadImageRatio(dataUrl: string, key: string): Promise<number | null> {
  const cached = __ratioCache.get(key);
  if (cached) return cached;
  const p = new Promise<number | null>((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
  __ratioCache.set(key, p);
  return p;
}

export function hexToRgb(hex?: string | null): RGB | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex(rgb: RGB) {
  return "#" + rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
}

export type DocBrand = {
  /** Nome institucional impresso no cabeçalho. */
  name: string;
  /** Linha de apoio abaixo do nome. */
  tagline: string;
  logoDataUrl: string | null;
  logoRatio: number;
  monogramDataUrl: string | null;
  monogramRatio: number;
  primary: RGB;
  accent: RGB;
  /** true quando nenhuma identidade própria foi configurada (padrão Grupo Guerra). */
  isDefault: boolean;
};

export type BrandingInput = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export const GUERRA_DOC_BRAND: DocBrand = {
  name: "GRUPO GUERRA",
  tagline: "GUERRA BUSINESS SYSTEM · GBS",
  logoDataUrl: null,
  logoRatio: GUERRA_MARK_RATIO,
  monogramDataUrl: null,
  monogramRatio: GUERRA_MONOGRAM_RATIO,
  primary: DEFAULT_NAVY,
  accent: DEFAULT_GOLD,
  isDefault: true,
};

/**
 * Resolve a identidade a ser impressa nos documentos.
 * Sem branding configurado → identidade Grupo Guerra (comportamento atual).
 */
export async function resolveDocBrand(input?: BrandingInput | null): Promise<DocBrand> {
  const name = input?.name?.trim();
  const logoUrl = input?.logoUrl?.trim();
  const primary = hexToRgb(input?.primaryColor);
  const accent = hexToRgb(input?.secondaryColor);
  const hasOwnIdentity = !!(logoUrl || primary || accent || (name && !/grupo\s*guerra/i.test(name)));

  if (!hasOwnIdentity) {
    const [logo, mono] = await Promise.all([loadGuerraLogoDataUrl(), loadGuerraMonogramDataUrl()]);
    return {
      ...GUERRA_DOC_BRAND,
      name: (name || "Grupo Guerra").toUpperCase(),
      logoDataUrl: logo,
      monogramDataUrl: mono ?? logo,
    };
  }

  let logoDataUrl: string | null = null;
  let logoRatio = GUERRA_MARK_RATIO;
  if (logoUrl) {
    logoDataUrl = await loadImageDataUrl(logoUrl);
    if (logoDataUrl) {
      const r = await loadImageRatio(logoDataUrl, logoUrl);
      if (r && Number.isFinite(r) && r > 0) logoRatio = r;
    }
  }

  return {
    name: (name || "ORGANIZAÇÃO").toUpperCase(),
    tagline: `${(name || "GBS").toUpperCase()} · GBS`,
    logoDataUrl,
    logoRatio,
    monogramDataUrl: logoDataUrl,
    monogramRatio: logoRatio,
    primary: primary ?? DEFAULT_NAVY,
    accent: accent ?? DEFAULT_GOLD,
    isDefault: false,
  };
}
