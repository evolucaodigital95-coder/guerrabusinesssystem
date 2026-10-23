/**
 * Fotos dos heros (Unsplash, licença gratuita para uso comercial).
 * Para trocar por fotos próprias, basta mudar o `id` ou apontar `src` para /public.
 */
type HeroImage = { id: string; alt: string };

export const HERO_IMAGES = {
  /** Plateia com as mãos levantadas sob luz quente. Foto: Edwin Andrade. */
  login: { id: "1477281765962-ef34e8bb0967", alt: "Plateia com as mãos levantadas" },
  /** Plateia atenta em uma conferência. Foto: Product School. */
  today: { id: "1540575467063-178a50c2df87", alt: "Plateia em uma conferência" },
} satisfies Record<string, HeroImage>;

export function heroSrc(img: HeroImage, width: number) {
  return `https://images.unsplash.com/photo-${img.id}?auto=format&fit=crop&q=75&w=${width}`;
}

export function heroSrcSet(img: HeroImage) {
  return [800, 1280, 1920, 2560].map((w) => `${heroSrc(img, w)} ${w}w`).join(", ");
}
