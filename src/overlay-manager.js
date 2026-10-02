/**
 * OverlayManager manages all visual annotations placed on top of the PDF:
 * - Freeform text boxes
 * - Checkmarks (✓) and Crosses (✕)
 * - Signatures and stamps
 * - Date stamps
 * - Whiteout rectangles
 * Supports drag-to-move, resize, styling, selection, and Undo/Redo.
 */
export class OverlayManager {
  constructor(pdfEngine, options = {}) {
    this.pdfEngine = pdfEngine;
    this.elements = []; // List of all overlay items in PDF points
    this.selectedElementId = null;
    this.activeTool = 'select';
    
    // Default style properties
    this.currentFontSize = 14;
    this.currentColor = '#0f172a';
    this.currentBg = 'transparent'; // or '#ffffff'

    // History for Undo/Redo
    this.undoStack = [];
    this.redoStack = [];

    // Dragging / Resizing State
    this.dragState = null;
    this.resizeState = null;

    this.onSelectionChanged = options.onSelectionChanged || (() => {});
    this.onHistoryChanged = options.onHistoryChanged || (() => {});
    this.onElementAdded = options.onElementAdded || (() => {});

    this.bindGlobalEvents();
  }

  setTool(tool) {
    this.activeTool = tool;
    if (tool !== 'select') {
      this.deselect();
    }
    document.body.dataset.activeTool = tool;
    document.querySelectorAll('.pdf-page-container').forEach(container => {
      container.dataset.activeTool = tool;
    });
  }

  getTool() {
    return this.activeTool;
  }

  setFontSize(size) {
    this.currentFontSize = parseInt(size, 10);
    const selected = this.getSelectedElement();
    if (selected && (selected.type === 'text' || selected.type === 'date')) {
      this.pushHistory();
      selected.fontSize = this.currentFontSize;
      this.updateElementDom(selected);
    }
  }

  setColor(color) {
    this.currentColor = color;
    const selected = this.getSelectedElement();
    if (selected) {
      this.pushHistory();
      selected.color = color;
      this.updateElementDom(selected);
    }
  }

  toggleBackground() {
    this.currentBg = this.currentBg === 'transparent' ? '#ffffff' : 'transparent';
    const selected = this.getSelectedElement();
    if (selected && selected.type === 'text') {
      this.pushHistory();
      selected.bg = this.currentBg;
      this.updateElementDom(selected);
    }
    return this.currentBg;
  }

  /**
   * Universal click handler on a page container or overlay layer
   */
  handlePageClick(pageNum, e, containerEl) {
    // 1. If clicking inside an existing overlay element, let it handle its own interaction
    if (e.target.closest('.overlay-element')) return;

    // 2. If in select mode and clicking an AcroForm field, let user focus the field
    if (this.activeTool === 'select' && e.target.closest('.acro-field')) return;

    // 3. If in select mode and clicking blank canvas/space, deselect current element
    if (this.activeTool === 'select') {
      this.deselect();
      return;
    }

    // 4. In insertion tool mode: calculate position on the page
    const pageContainer = containerEl.closest('.pdf-page-container') || containerEl;
    const rect = pageContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scale = this.pdfEngine.getScale();
    const pdfCoords = this.pdfEngine.screenToPdfCoords(pageNum, clickX, clickY);

    if (this.activeTool === 'text') {
      this.pushHistory();
      const newElem = {
        id: 'elem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        pageNum,
        type: 'text',
        x: pdfCoords.x,
        y: pdfCoords.y,
        width: 150,
        height: 28,
        text: 'Clique para digitar',
        fontSize: this.currentFontSize,
        color: this.currentColor,
        bg: this.currentBg,
      };
      this.elements.push(newElem);
      this.renderElementsForPage(pageNum);
      this.selectElement(newElem.id);
      this.onElementAdded(newElem);

      // Focus and select text immediately
      setTimeout(() => {
        const domEl = document.getElementById(newElem.id);
        const textSpan = domEl?.querySelector('.overlay-element-text');
        if (textSpan) {
          textSpan.focus();
          try {
            const range = document.createRange();
            range.selectNodeContents(textSpan);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (_) {
            document.execCommand('selectAll', false, null);
          }
        }
      }, 40);

    } else if (this.activeTool === 'check') {
      this.pushHistory();
      const size = 18;
      const newElem = {
        id: 'elem_' + Date.now(),
        pageNum,
        type: 'check',
        x: pdfCoords.x - (size / 2),
        y: pdfCoords.y + (size / 2),
        width: size,
        height: size,
        fontSize: size,
        color: this.currentColor,
      };
      this.elements.push(newElem);
      this.renderElementsForPage(pageNum);
      this.selectElement(newElem.id);
      this.onElementAdded(newElem);

    } else if (this.activeTool === 'cross') {
      this.pushHistory();
      const size = 18;
      const newElem = {
        id: 'elem_' + Date.now(),
        pageNum,
        type: 'cross',
        x: pdfCoords.x - (size / 2),
        y: pdfCoords.y + (size / 2),
        width: size,
        height: size,
        fontSize: size,
        color: this.currentColor,
      };
      this.elements.push(newElem);
      this.renderElementsForPage(pageNum);
      this.selectElement(newElem.id);
      this.onElementAdded(newElem);

    } else if (this.activeTool === 'date') {
      this.pushHistory();
      const now = new Date();
      const formattedDate = now.toLocaleDateString('pt-BR');
      const newElem = {
        id: 'elem_' + Date.now(),
        pageNum,
        type: 'date',
        x: pdfCoords.x,
        y: pdfCoords.y,
        width: 100,
        height: 24,
        text: formattedDate,
        fontSize: this.currentFontSize,
        color: this.currentColor,
        bg: this.currentBg,
      };
      this.elements.push(newElem);
      this.renderElementsForPage(pageNum);
      this.selectElement(newElem.id);
      this.onElementAdded(newElem);

    } else if (this.activeTool === 'whiteout') {
      this.pushHistory();
      const newElem = {
        id: 'elem_' + Date.now(),
        pageNum,
        type: 'whiteout',
        x: pdfCoords.x,
        y: pdfCoords.y,
        width: 120,
        height: 26,
      };
      this.elements.push(newElem);
      this.renderElementsForPage(pageNum);
      this.selectElement(newElem.id);
      this.onElementAdded(newElem);
    }
  }

  handleLayerClick(pageNum, e, layerEl) {
    this.handlePageClick(pageNum, e, layerEl);
  }

  /**
   * Add a signature onto the currently visible page
   */
  addSignature(sigData, pageNum = 1) {
    this.pushHistory();
    const scale = this.pdfEngine.getScale();
    const viewport = this.pdfEngine.pageViewports.get(pageNum);

    // Center signature in viewport if possible or place in validation area
    const screenX = viewport ? (viewport.width / 2) - (sigData.width / 2) : 100;
    const screenY = viewport ? (viewport.height / 2) - (sigData.height / 2) : 200;
    const pdfCoords = this.pdfEngine.screenToPdfCoords(pageNum, screenX, screenY);

    const newElem = {
      id: 'elem_sig_' + Date.now(),
      pageNum,
      type: 'signature',
      x: pdfCoords.x,
      y: pdfCoords.y,
      width: sigData.width / scale,
      height: sigData.height / scale,
      dataUrl: sigData.dataUrl,
    };

    this.elements.push(newElem);
    this.renderElementsForPage(pageNum);
    this.selectElement(newElem.id);
    this.onElementAdded(newElem);
  }

  renderElementsForPage(pageNum, layerEl) {
    if (!layerEl) {
      layerEl = document.getElementById(`overlay-layer-${pageNum}`);
    }
    if (!layerEl) return;
    layerEl.innerHTML = '';
    const pageElems = this.elements.filter(e => e.pageNum === pageNum);

    for (const elem of pageElems) {
      const el = this.createDomElement(elem);
      layerEl.appendChild(el);
    }
  }

  createDomElement(elem) {
    const scale = this.pdfEngine.getScale();
    const screenCoords = this.pdfEngine.pdfToScreenCoords(elem.pageNum, elem.x, elem.y);
    const screenWidth = elem.width * scale;
    const screenHeight = elem.height * scale;

    const div = document.createElement('div');
    div.id = elem.id;
    div.className = `overlay-element overlay-element-${elem.type} ${elem.id === this.selectedElementId ? 'selected' : ''}`;
    div.style.left = `${screenCoords.x}px`;
    div.style.top = `${screenCoords.y}px`;
    div.style.width = `${screenWidth}px`;
    div.style.height = `${screenHeight}px`;

    // Prevent native browser dragging of element or text
    div.draggable = false;
    div.addEventListener('dragstart', (e) => e.preventDefault());

    // Move Handle Bar (appears on top of selected element)
    const moveBar = document.createElement('div');
    moveBar.className = 'element-move-bar';
    moveBar.title = 'Clique e arraste para mover';
    moveBar.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg><span>Mover</span>`;
    div.appendChild(moveBar);

    if (elem.type === 'text' || elem.type === 'date') {
      const textSpan = document.createElement('div');
      textSpan.className = 'overlay-element-text';
      textSpan.contentEditable = 'true';
      textSpan.draggable = false;
      textSpan.addEventListener('dragstart', (e) => e.preventDefault());
      textSpan.textContent = elem.text;
      textSpan.style.fontSize = `${elem.fontSize * (scale / 1.25)}px`;
      textSpan.style.color = elem.color;
      if (elem.bg && elem.bg !== 'transparent') {
        textSpan.style.backgroundColor = elem.bg;
      }

      textSpan.addEventListener('input', () => {
        elem.text = textSpan.textContent;
      });

      textSpan.addEventListener('blur', () => {
        if (!elem.text.trim()) {
          elem.text = 'Texto';
          textSpan.textContent = elem.text;
        }
      });

      div.appendChild(textSpan);
    } else if (elem.type === 'check') {
      div.innerHTML = `<span style="font-size: ${elem.fontSize * (scale / 1.25)}px; color: ${elem.color};">✓</span>`;
    } else if (elem.type === 'cross') {
      div.innerHTML = `<span style="font-size: ${elem.fontSize * (scale / 1.25)}px; color: ${elem.color};">✕</span>`;
    } else if (elem.type === 'signature') {
      const img = document.createElement('img');
      img.src = elem.dataUrl;
      img.alt = 'Assinatura';
      div.appendChild(img);
    } else if (elem.type === 'whiteout') {
      div.classList.add('overlay-element-whiteout');
    }

    // Add resize handles for resizable elements (signature, whiteout, text)
    const handles = ['se', 'sw', 'ne', 'nw'];
    for (const h of handles) {
      const handle = document.createElement('div');
      handle.className = `resize-handle handle-${h}`;
      handle.dataset.handle = h;
      div.appendChild(handle);
    }

    // Mouse / Pointer drag start
    div.addEventListener('pointerdown', (e) => this.onElementPointerDown(e, elem));

    return div;
  }

  updateElementDom(elem) {
    const scale = this.pdfEngine.getScale();
    const dom = document.getElementById(elem.id);
    if (!dom) return;

    const screenCoords = this.pdfEngine.pdfToScreenCoords(elem.pageNum, elem.x, elem.y);
    dom.style.left = `${screenCoords.x}px`;
    dom.style.top = `${screenCoords.y}px`;
    dom.style.width = `${elem.width * scale}px`;
    dom.style.height = `${elem.height * scale}px`;

    if (elem.type === 'text' || elem.type === 'date') {
      const textSpan = dom.querySelector('.overlay-element-text');
      if (textSpan) {
        textSpan.style.fontSize = `${elem.fontSize * (scale / 1.25)}px`;
        textSpan.style.color = elem.color;
        textSpan.style.backgroundColor = elem.bg || 'transparent';
      }
    } else if (elem.type === 'check' || elem.type === 'cross') {
      const span = dom.querySelector('span');
      if (span) {
        span.style.fontSize = `${elem.fontSize * (scale / 1.25)}px`;
        span.style.color = elem.color;
      }
    }
  }

  selectElement(id) {
    this.selectedElementId = id;
    document.querySelectorAll('.overlay-element').forEach(el => {
      el.classList.toggle('selected', el.id === id);
    });

    const elem = this.getSelectedElement();
    this.onSelectionChanged(elem);
  }

  deselect() {
    this.selectedElementId = null;
    document.querySelectorAll('.overlay-element').forEach(el => {
      el.classList.remove('selected');
    });
    this.onSelectionChanged(null);
  }

  getSelectedElement() {
    return this.elements.find(e => e.id === this.selectedElementId);
  }

  deleteSelected() {
    if (!this.selectedElementId) return;
    this.pushHistory();
    const id = this.selectedElementId;
    this.elements = this.elements.filter(e => e.id !== id);
    const dom = document.getElementById(id);
    dom?.remove();
    this.deselect();
  }

  // Pointer interactions: Dragging & Resizing
  onElementPointerDown(e, elem) {
    e.stopPropagation();

    if (e.target.classList.contains('resize-handle')) {
      // Start resizing
      this.pushHistory();
      this.resizeState = {
        elem,
        handle: e.target.dataset.handle,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: elem.width,
        startHeight: elem.height,
        startPdfX: elem.x,
        startPdfY: elem.y,
      };
      this.selectElement(elem.id);
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      return;
    }

    // Dragging / Moving: if user clicked the move bar or border or background of element
    if (e.target.closest('.element-move-bar') || !e.target.classList.contains('overlay-element-text')) {
      this.pushHistory();
      this.selectElement(elem.id);
      this.dragState = {
        elem,
        startX: e.clientX,
        startY: e.clientY,
        startPdfX: elem.x,
        startPdfY: elem.y,
      };

      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
      return;
    }

    if (e.target.classList.contains('overlay-element-text')) {
      // Editing text
      this.selectElement(elem.id);
      return;
    }

    // Start moving
    this.pushHistory();
    this.selectElement(elem.id);
    this.dragState = {
      elem,
      startX: e.clientX,
      startY: e.clientY,
      startPdfX: elem.x,
      startPdfY: elem.y,
    };

    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  onPointerMove = (e) => {
    const scale = this.pdfEngine.getScale();

    if (this.dragState) {
      const dx = (e.clientX - this.dragState.startX) / scale;
      const dy = (e.clientY - this.dragState.startY) / scale;

      // In PDF coordinates, y goes UP, while screen y goes DOWN
      this.dragState.elem.x = this.dragState.startPdfX + dx;
      this.dragState.elem.y = this.dragState.startPdfY - dy;

      this.updateElementDom(this.dragState.elem);
    } else if (this.resizeState) {
      const dx = (e.clientX - this.resizeState.startX) / scale;
      const dy = (e.clientY - this.resizeState.startY) / scale;
      const { elem, handle, startWidth, startHeight } = this.resizeState;

      if (handle === 'se') {
        elem.width = Math.max(20, startWidth + dx);
        elem.height = Math.max(15, startHeight + dy);
      } else if (handle === 'sw') {
        const newW = Math.max(20, startWidth - dx);
        elem.width = newW;
        elem.height = Math.max(15, startHeight + dy);
      } else if (handle === 'ne') {
        elem.width = Math.max(20, startWidth + dx);
        elem.height = Math.max(15, startHeight - dy);
      } else if (handle === 'nw') {
        elem.width = Math.max(20, startWidth - dx);
        elem.height = Math.max(15, startHeight - dy);
      }

      this.updateElementDom(elem);
    }
  };

  onPointerUp = () => {
    this.dragState = null;
    this.resizeState = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  };

  // Undo / Redo
  pushHistory() {
    this.undoStack.push(JSON.stringify(this.elements));
    this.redoStack = []; // clear redo on new action
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.onHistoryChanged({
      canUndo: this.undoStack.length > 0,
      canRedo: false,
    });
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.elements));
    const previous = JSON.parse(this.undoStack.pop());
    this.elements = previous;
    this.refreshAllPages();
    this.onHistoryChanged({
      canUndo: this.undoStack.length > 0,
      canRedo: true,
    });
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.elements));
    const next = JSON.parse(this.redoStack.pop());
    this.elements = next;
    this.refreshAllPages();
    this.onHistoryChanged({
      canUndo: true,
      canRedo: this.redoStack.length > 0,
    });
  }

  refreshAllPages() {
    const numPages = this.pdfEngine.getPageCount();
    for (let p = 1; p <= numPages; p++) {
      const layer = document.getElementById(`overlay-layer-${p}`);
      if (layer) this.renderElementsForPage(p, layer);
    }
  }

  bindGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing inside an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.target.isContentEditable) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelected();
      } else if (e.key === 'Escape') {
        this.deselect();
        this.setTool('select');
      } else if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          this.undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          this.redo();
        }
      }
    });
  }

  clear() {
    this.elements = [];
    this.undoStack = [];
    this.redoStack = [];
    this.deselect();
    this.onHistoryChanged({ canUndo: false, canRedo: false });
  }

  getAllElements() {
    return this.elements;
  }
}
