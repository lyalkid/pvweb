const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SVG_MIME_TYPE = 'image/svg+xml;charset=utf-8';

export function downloadTextFile(content: string, fileName: string, mimeType = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob([content], { type: mimeType }), fileName);
}

export function exportSvgElement(
  source: SVGSVGElement,
  fileName: string,
  backgroundColor: string
): void {
  const svgContent = serializeSvg(source, backgroundColor);
  downloadTextFile(svgContent, fileName, SVG_MIME_TYPE);
}

export async function exportPngElement(
  source: SVGSVGElement,
  fileName: string,
  backgroundColor: string
): Promise<void> {
  const dimensions = getSvgDimensions(source);
  const blob = new Blob([serializeSvg(source, backgroundColor)], { type: SVG_MIME_TYPE });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(objectUrl);
    const scale = resolveRasterScale(dimensions.width, dimensions.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(dimensions.width * scale));
    canvas.height = Math.max(1, Math.round(dimensions.height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    context.scale(scale, scale);
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    const pngBlob = await canvasToBlob(canvas);
    downloadBlob(pngBlob, fileName);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function serializeSvg(source: SVGSVGElement, backgroundColor: string): string {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const dimensions = getSvgDimensions(source);
  clone.setAttribute('xmlns', SVG_NAMESPACE);
  clone.setAttribute('width', String(dimensions.width));
  clone.setAttribute('height', String(dimensions.height));

  const background = document.createElementNS(SVG_NAMESPACE, 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', '100%');
  background.setAttribute('height', '100%');
  background.setAttribute('fill', backgroundColor);
  clone.insertBefore(background, clone.firstChild);

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

function getSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || svg.width.baseVal.value || svg.clientWidth || 1;
  const height = viewBox.height || svg.height.baseVal.value || svg.clientHeight || 1;
  return { width, height };
}

function resolveRasterScale(width: number, height: number): number {
  const maxPixels = 32_000_000;
  return Math.min(2, Math.sqrt(maxPixels / Math.max(1, width * height)));
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to render SVG for PNG export.'));
    image.src = source;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to encode PNG export.'));
      }
    }, 'image/png');
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
