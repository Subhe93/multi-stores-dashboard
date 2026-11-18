import { BUNDLED_FLAGS, bundledFlagSrc, flagEmoji } from '@/lib/countryFlags';

/**
 * The flag of a country, next to its code or name.
 *
 * A flag that carries writing is drawn from the bundled official artwork
 * (public/flags/), whole and in its own proportions, or not drawn at all when
 * no file is bundled. Every other flag is the OS emoji, as plain text inside
 * the caller's own wrapper.
 *
 * Flags are never mirrored or cropped: no rounding, no object-cover and no
 * right-to-left flip on the image. `max-w-none` keeps a narrow parent from
 * squeezing the image out of its proportions.
 */
export function CountryFlag({ code }: { code: string }) {
  const src = bundledFlagSrc(code);
  if (src) {
    const { width, height } = BUNDLED_FLAGS[code.toUpperCase()];
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static same-origin SVG, drawn as is
      <img
        src={src}
        alt=""
        aria-hidden
        width={width}
        height={height}
        loading="lazy"
        style={{ height: '1em', width: 'auto' }}
        className="inline-block max-w-none shrink-0 align-[-0.125em]"
      />
    );
  }
  // A flag with writing that is not bundled: nothing is drawn.
  const emoji = flagEmoji(code);
  return emoji ? <>{emoji}</> : null;
}
