import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure the worker for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PDFEngine {
  constructor(options = {}) {
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.numPages = 0;
    this.currentPage = 1;
    this.scale = 1.25; // Default crisp reading scale
    this.onPageRendered = options.onPageRendered || (() => {});
    this.onPageChanged = options.onPageChanged || (() => {});
    this.onDocumentLoaded = options.onDocumentLoaded || (() => {});
    this.pageViewports = new Map(); // pageNum -> viewport
  }

  /**
   * Load PDF data from an ArrayBuffer or Uint8Array
   */
  async loadDocument(data, filename = 'documento.pdf') {
    this.pdfBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    
    // Copy bytes so pdfjs doesn't detach buffer if transferred
    const dataCopy = new Uint8Array(this.pdfBytes);
    
    const loadingTask = pdfjsLib.getDocument({ data: dataCopy });
    this.pdfDoc = await loadingTask.promise;
    this.numPages = this.pdfDoc.numPages;
    this.currentPage = 1;
    this.filename = filename;

    this.onDocumentLoaded({
      numPages: this.numPages,
      filename: this.filename,
    });

    return this.pdfDoc;
  }

  /**
   * Set zoom scale and trigger re-render
   */
  setScale(newScale) {
    // Clamp between 50% and 300%
    this.scale = Math.min(Math.max(newScale, 0.5), 3.0);
    return this.scale;
  }

  getScale() {
    return this.scale;
  }

  /**
   * Render a specific page to a canvas inside a container
   */
  async renderPage(pageNum, containerEl, canvasEl) {
    if (!this.pdfDoc) return null;
    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });
    this.pageViewports.set(pageNum, viewport);

    const outputScale = window.devicePixelRatio || 1;

    canvasEl.width = Math.floor(viewport.width * outputScale);
    canvasEl.height = Math.floor(viewport.height * outputScale);
    canvasEl.style.width = `${Math.floor(viewport.width)}px`;
    canvasEl.style.height = `${Math.floor(viewport.height)}px`;

    containerEl.style.width = `${Math.floor(viewport.width)}px`;
    containerEl.style.height = `${Math.floor(viewport.height)}px`;

    const ctx = canvasEl.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Scale context for HiDPI
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      transform: transform,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    this.onPageRendered({
      pageNum,
      viewport,
      scale: this.scale,
      containerEl,
    });

    return viewport;
  }

  /**
   * Render a page thumbnail for the sidebar
   */
  async renderThumbnail(pageNum, canvasEl) {
    if (!this.pdfDoc) return;
    const page = await this.pdfDoc.getPage(pageNum);
    const initialViewport = page.getViewport({ scale: 1 });
    
    // Target thumbnail width around 180px
    const thumbScale = 180 / initialViewport.width;
    const viewport = page.getViewport({ scale: thumbScale });

    canvasEl.width = Math.floor(viewport.width);
    canvasEl.height = Math.floor(viewport.height);

    const ctx = canvasEl.getContext('2d');
    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;
  }

  /**
   * Convert screen coordinates on a page container back to standard PDF points (72 DPI)
   */
  screenToPdfCoords(pageNum, screenX, screenY) {
    const viewport = this.pageViewports.get(pageNum);
    if (!viewport) return { x: screenX, y: screenY };

    // In PDF coordinates: (0,0) is bottom-left, y goes up.
    // In viewport: (0,0) is top-left, y goes down.
    const pdfX = screenX / this.scale;
    const pdfY = (viewport.height - screenY) / this.scale;
    return { x: pdfX, y: pdfY };
  }

  /**
   * Convert PDF points back to screen pixels on the current page container
   */
  pdfToScreenCoords(pageNum, pdfX, pdfY) {
    const viewport = this.pageViewports.get(pageNum);
    if (!viewport) return { x: pdfX, y: pdfY };

    const screenX = pdfX * this.scale;
    const screenY = viewport.height - (pdfY * this.scale);
    return { x: screenX, y: screenY };
  }

  getPageCount() {
    return this.numPages;
  }

  getCurrentPage() {
    return this.currentPage;
  }

  setCurrentPage(num) {
    this.currentPage = Math.min(Math.max(num, 1), this.numPages);
    this.onPageChanged(this.currentPage);
  }
}
