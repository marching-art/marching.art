/**
 * Rasterize an inline SVG (the tour poster) to a PNG the director can keep.
 *
 * The poster is deliberately self-contained — every color is an attribute, no
 * stylesheet, no external image — because the browser renders a serialized SVG
 * in an isolated context: page CSS and webfonts do not follow it in. Text falls
 * back to the system sans/mono, which is why the poster's font stacks end in
 * generic families.
 *
 * Nothing here is fatal to the feature: if rasterization fails (older Safari
 * has bounced serialized SVGs before), callers fall back to copying the
 * itinerary as text.
 */

/** The poster renders at 2x so the PNG holds up when dropped into Discord. */
const EXPORT_SCALE = 2;

/** Serialize + rasterize the poster. Resolves with PNG bytes. */
export function posterToPngBlob(svg: SVGSVGElement | null, scale = EXPORT_SCALE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!svg) {
      reject(new Error('No poster to export'));
      return;
    }

    const viewBox = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    const width = viewBox[2] || svg.clientWidth || 1368;
    const height = viewBox[3] || svg.clientHeight || 816;

    // Serialize a clone with concrete pixel dimensions — the live node is sized
    // in percent so it can flex inside the modal, which an <img> cannot resolve.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    const source = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));

    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas is unavailable');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Could not encode the poster'));
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the poster'));
    };
    image.src = url;
  });
}

/** Trigger a browser download for a blob. */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick — Safari cancels the download if the URL dies first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A filesystem-safe file name, e.g. "blue-devils-tour-map.png". */
export function posterFilename(corpsName?: string | null): string {
  const slug =
    String(corpsName || 'corps')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'corps';
  return `${slug}-tour-map.png`;
}

/** Save the poster as a PNG. */
export async function downloadPoster(svg: SVGSVGElement | null, filename: string): Promise<void> {
  download(await posterToPngBlob(svg), filename);
}

/**
 * Share the poster as an image through the native share sheet, falling back to
 * a download where file sharing isn't supported (every desktop browser today).
 */
export async function sharePoster(
  svg: SVGSVGElement | null,
  { filename, title, text }: { filename: string; title?: string; text?: string }
): Promise<'shared' | 'downloaded' | 'dismissed'> {
  const blob = await posterToPngBlob(svg);
  const file = new File([blob], filename, { type: 'image/png' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      // The user closing the sheet is not a failure — don't then dump a file
      // into their downloads folder behind their back.
      if ((err as DOMException)?.name === 'AbortError') return 'dismissed';
    }
  }

  download(blob, filename);
  return 'downloaded';
}
