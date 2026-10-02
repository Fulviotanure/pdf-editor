import { PDFEngine } from './pdf-engine.js';
import { FormEngine } from './form-engine.js';
import { OverlayManager } from './overlay-manager.js';
import { SignaturePad } from './signature-pad.js';
import { createSampleFormPDF } from './sample-pdf.js';
import { exportFilledPDF } from './exporter.js';

// Application State
let currentPdfBytes = null;
let currentFilename = 'documento.pdf';
let isRendering = false;

// Toast Notification Manager
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Initialize Engines
const pdfEngine = new PDFEngine({
  onDocumentLoaded: ({ numPages, filename }) => {
    document.getElementById('pdf-filename-display').textContent = filename;
    document.getElementById('page-count-display').textContent = numPages;
    const pageNumInput = document.getElementById('input-page-num');
    if (pageNumInput) {
      pageNumInput.max = numPages;
      pageNumInput.value = 1;
    }
  },
  onPageChanged: (pageNum) => {
    const pageNumInput = document.getElementById('input-page-num');
    if (pageNumInput) pageNumInput.value = pageNum;

    // Update active thumbnail
    document.querySelectorAll('.thumbnail-item').forEach(item => {
      item.classList.toggle('active', parseInt(item.dataset.page, 10) === pageNum);
    });
  }
});

const formEngine = new FormEngine(pdfEngine);
const overlayManager = new OverlayManager(pdfEngine, {
  onSelectionChanged: (selectedElem) => {
    const deleteBtn = document.getElementById('btn-delete-selected');
    const colorInput = document.getElementById('prop-color');
    const fontSizeSelect = document.getElementById('prop-font-size');
    const bgBtn = document.getElementById('prop-bg-toggle');

    if (selectedElem) {
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
      if (selectedElem.color && colorInput) colorInput.value = selectedElem.color;
      if (selectedElem.fontSize && fontSizeSelect) fontSizeSelect.value = selectedElem.fontSize;
      if (bgBtn) {
        bgBtn.classList.toggle('active', selectedElem.bg && selectedElem.bg !== 'transparent');
      }
    } else {
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
  },
  onHistoryChanged: ({ canUndo, canRedo }) => {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  },
  onElementAdded: (elem) => {
    if (elem.type === 'text') {
      showToast('Texto inserido! Digite o conteúdo desejado.', 'info');
    } else if (elem.type === 'check') {
      showToast('Visto (✓) inserido!', 'success');
    } else if (elem.type === 'cross') {
      showToast('Marcação (✕) inserida!', 'success');
    } else if (elem.type === 'date') {
      showToast('Data inserida!', 'success');
    } else if (elem.type === 'whiteout') {
      showToast('Tarja branca de cobertura inserida!', 'info');
    }
  }
});

const signaturePad = new SignaturePad({
  onApplySignature: (sigData) => {
    overlayManager.addSignature(sigData, pdfEngine.getCurrentPage());
    showToast('Assinatura inserida no documento!', 'success');
  }
});

// Render all pages of current document
async function renderFullDocument() {
  if (!currentPdfBytes || isRendering) return;
  isRendering = true;

  const pagesContainer = document.getElementById('pages-container');
  const welcomeScreen = document.getElementById('welcome-screen');
  const thumbsContainer = document.getElementById('thumbnails-list');

  welcomeScreen.style.display = 'none';
  pagesContainer.style.display = 'flex';
  pagesContainer.innerHTML = '';
  thumbsContainer.innerHTML = '';

  const numPages = pdfEngine.getPageCount();

  for (let p = 1; p <= numPages; p++) {
    // 1. Create page container
    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'pdf-page-container';
    pageWrapper.id = `page-container-${p}`;
    pageWrapper.dataset.page = p;
    pageWrapper.dataset.activeTool = overlayManager.getTool();

    // Canvas layer
    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-page-canvas';
    canvas.id = `canvas-page-${p}`;
    pageWrapper.appendChild(canvas);

    // Interactive AcroForm layer
    const acroLayer = document.createElement('div');
    acroLayer.className = 'pdf-acroform-layer';
    acroLayer.id = `acroform-layer-${p}`;
    pageWrapper.appendChild(acroLayer);

    // Visual Overlay layer
    const overlayLayer = document.createElement('div');
    overlayLayer.className = 'pdf-overlay-layer';
    overlayLayer.id = `overlay-layer-${p}`;
    pageWrapper.appendChild(overlayLayer);

    // Attach click listener on page container (catches any click on the page canvas or layers)
    pageWrapper.addEventListener('click', (e) => {
      overlayManager.handlePageClick(p, e, pageWrapper);
    });

    pagesContainer.appendChild(pageWrapper);

    // Render page canvas with PDF.js
    await pdfEngine.renderPage(p, pageWrapper, canvas);

    // Render native form fields
    formEngine.renderFieldsForPage(p, acroLayer);

    // Render freeform overlay elements
    overlayManager.renderElementsForPage(p, overlayLayer);

    // Render thumbnail in sidebar
    renderThumbnailItem(p, thumbsContainer);
  }

  // Populate form fields sidebar summary
  updateFieldsSidebar();

  isRendering = false;
}

// Render Thumbnail in left sidebar
async function renderThumbnailItem(pageNum, container) {
  const item = document.createElement('div');
  item.className = `thumbnail-item ${pageNum === 1 ? 'active' : ''}`;
  item.dataset.page = pageNum;

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.className = 'thumbnail-canvas';
  item.appendChild(thumbCanvas);

  const label = document.createElement('span');
  label.className = 'thumbnail-label';
  label.textContent = `Página ${pageNum}`;
  item.appendChild(label);

  item.addEventListener('click', () => {
    scrollToPage(pageNum);
  });

  container.appendChild(item);
  await pdfEngine.renderThumbnail(pageNum, thumbCanvas);
}

// Scroll to specific page in viewport
function scrollToPage(pageNum) {
  const pageEl = document.getElementById(`page-container-${pageNum}`);
  if (pageEl) {
    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pdfEngine.setCurrentPage(pageNum);
  }
}

// Populate Sidebar Form Fields Tab
function updateFieldsSidebar() {
  const countBadge = document.getElementById('fields-badge-count');
  const fieldsList = document.getElementById('form-fields-list');
  if (!countBadge || !fieldsList) return;

  const fields = formEngine.fields;
  countBadge.textContent = fields.length;

  if (fields.length === 0) {
    fieldsList.innerHTML = `
      <div class="empty-state text-xs text-muted" style="padding: 12px; text-align: center;">
        Nenhum campo interativo detectado.<br>Você pode usar a ferramenta <strong>Texto (T)</strong> para preencher qualquer linha!
      </div>
    `;
    return;
  }

  fieldsList.innerHTML = '';
  for (const f of fields) {
    const card = document.createElement('div');
    card.className = 'field-summary-card';
    card.innerHTML = `
      <div class="field-summary-title">${f.name}</div>
      <div class="field-summary-type">${f.type}</div>
    `;

    card.addEventListener('click', () => {
      const widget = document.querySelector(`[name="${f.name}"]`);
      if (widget) {
        widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
        widget.focus();
        widget.classList.add('focused');
        setTimeout(() => widget.classList.remove('focused'), 2000);
      }
    });

    fieldsList.appendChild(card);
  }
}

// Load Document Handler
async function loadPdfBuffer(buffer, filename) {
  try {
    currentFilename = filename;
    currentPdfBytes = new Uint8Array(buffer);

    showToast('Carregando documento...', 'info');

    // Load in PDFEngine
    await pdfEngine.loadDocument(currentPdfBytes, filename);

    // Inspect AcroForms
    await formEngine.loadForm(currentPdfBytes);

    // Clear previous overlays
    overlayManager.clear();

    // Render all pages
    await renderFullDocument();

    showToast(`"${filename}" carregado com sucesso!`, 'success');
  } catch (err) {
    console.error('Erro ao carregar PDF:', err);
    showToast('Falha ao abrir PDF: ' + err.message, 'error');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // File Open
  const fileInput = document.getElementById('pdf-file-input');
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const buffer = await file.arrayBuffer();
      await loadPdfBuffer(buffer, file.name);
    }
  });



  // Drag and Drop PDF onto browser window (only for real external OS files)
  const dragDropZone = document.getElementById('drag-drop-zone');

  window.addEventListener('dragover', (e) => {
    const isFileDrag = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    if (!isFileDrag) return;

    e.preventDefault();
    dragDropZone?.classList.add('active');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || e.clientX <= 0 || e.clientY <= 0) {
      dragDropZone?.classList.remove('active');
    }
  });

  window.addEventListener('drop', async (e) => {
    dragDropZone?.classList.remove('active');
    const isFileDrag = e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    if (!isFileDrag) return;

    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && files[0].type === 'application/pdf') {
      const buffer = await files[0].arrayBuffer();
      await loadPdfBuffer(buffer, files[0].name);
    }
  });

  // Tools Selection
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;

      if (tool === 'signature') {
        signaturePad.open();
        return;
      }

      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      overlayManager.setTool(tool);
    });
  });

  // Properties: Font Size, Color, Background, Delete
  document.getElementById('prop-font-size')?.addEventListener('change', (e) => {
    overlayManager.setFontSize(e.target.value);
  });

  document.getElementById('prop-color')?.addEventListener('input', (e) => {
    overlayManager.setColor(e.target.value);
  });

  document.getElementById('prop-bg-toggle')?.addEventListener('click', () => {
    const bg = overlayManager.toggleBackground();
    document.getElementById('prop-bg-toggle').classList.toggle('active', bg !== 'transparent');
  });

  document.getElementById('btn-delete-selected')?.addEventListener('click', () => {
    overlayManager.deleteSelected();
  });

  // Undo / Redo
  document.getElementById('btn-undo')?.addEventListener('click', () => overlayManager.undo());
  document.getElementById('btn-redo')?.addEventListener('click', () => overlayManager.redo());

  // Zoom Controls
  const updateZoomDisplay = () => {
    const scale = pdfEngine.getScale();
    document.getElementById('zoom-level-text').textContent = `${Math.round(scale * 100)}%`;
  };

  document.getElementById('btn-zoom-in')?.addEventListener('click', async () => {
    pdfEngine.setScale(pdfEngine.getScale() + 0.2);
    updateZoomDisplay();
    await renderFullDocument();
  });

  document.getElementById('btn-zoom-out')?.addEventListener('click', async () => {
    pdfEngine.setScale(pdfEngine.getScale() - 0.2);
    updateZoomDisplay();
    await renderFullDocument();
  });

  document.getElementById('btn-fit-width')?.addEventListener('click', async () => {
    pdfEngine.setScale(1.25);
    updateZoomDisplay();
    await renderFullDocument();
  });

  // Page navigation stepper
  document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    const current = pdfEngine.getCurrentPage();
    if (current > 1) scrollToPage(current - 1);
  });

  document.getElementById('btn-next-page')?.addEventListener('click', () => {
    const current = pdfEngine.getCurrentPage();
    if (current < pdfEngine.getPageCount()) scrollToPage(current + 1);
  });

  document.getElementById('input-page-num')?.addEventListener('change', (e) => {
    const page = parseInt(e.target.value, 10);
    if (!isNaN(page)) scrollToPage(page);
  });

  // Highlight all fields toggle
  document.getElementById('btn-highlight-fields')?.addEventListener('click', () => {
    const isHighlighted = formEngine.toggleHighlight();
    document.getElementById('btn-highlight-fields').textContent = isHighlighted ? 'Desativar Destaque' : 'Destacar Tudo';
  });

  // Sidebar toggle
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
    const sidebar = document.getElementById('app-sidebar');
    sidebar?.classList.toggle('collapsed');
  });

  // Sidebar tabs
  const sidebarTabs = document.querySelectorAll('.sidebar-tab');
  sidebarTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sidebarTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => {
        p.classList.toggle('active', p.id === `pane-${target}`);
      });
    });
  });

  // Help Modal
  const helpModal = document.getElementById('help-modal');
  document.getElementById('btn-help')?.addEventListener('click', () => {
    if (helpModal) helpModal.style.display = 'flex';
  });
  document.getElementById('btn-close-help-modal')?.addEventListener('click', () => {
    if (helpModal) helpModal.style.display = 'none';
  });
  document.getElementById('btn-ok-help')?.addEventListener('click', () => {
    if (helpModal) helpModal.style.display = 'none';
  });

  // Download Filled PDF
  const downloadPdf = async () => {
    if (!currentPdfBytes) {
      showToast('Abra um PDF primeiro antes de exportar.', 'warning');
      return;
    }

    try {
      showToast('Exportando PDF preenchido...', 'info');
      const formValues = formEngine.getAllValues();
      const overlayElements = overlayManager.getAllElements();

      const outName = currentFilename.replace(/\.pdf$/i, '') + '-preenchido.pdf';
      await exportFilledPDF({
        pdfBytes: currentPdfBytes,
        formValues,
        overlayElements,
        filename: outName,
      });

      showToast(`PDF "${outName}" baixado com sucesso!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao exportar PDF: ' + err.message, 'error');
    }
  };

  document.getElementById('btn-download-pdf')?.addEventListener('click', downloadPdf);

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.target.isContentEditable) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        downloadPdf();
      }
    } else {
      switch (e.key.toLowerCase()) {
        case 'v':
          document.getElementById('tool-select')?.click();
          break;
        case 't':
          document.getElementById('tool-text')?.click();
          break;
        case 'c':
          document.getElementById('tool-check')?.click();
          break;
        case 'x':
          document.getElementById('tool-cross')?.click();
          break;
        case 's':
          signaturePad.open();
          break;
        case 'd':
          document.getElementById('tool-date')?.click();
          break;
        case 'w':
          document.getElementById('tool-whiteout')?.click();
          break;
      }
    }
  });

  // Track scroll position to update current page indicator
  const wrapper = document.getElementById('viewport-canvas-wrapper');
  wrapper?.addEventListener('scroll', () => {
    const pages = document.querySelectorAll('.pdf-page-container');
    const wrapperTop = wrapper.scrollTop + wrapper.offsetTop + 100;

    for (const page of pages) {
      const pageTop = page.offsetTop;
      const pageBottom = pageTop + page.offsetHeight;
      if (wrapperTop >= pageTop && wrapperTop <= pageBottom) {
        const pageNum = parseInt(page.dataset.page, 10);
        if (pdfEngine.getCurrentPage() !== pageNum) {
          pdfEngine.setCurrentPage(pageNum);
        }
        break;
      }
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});
