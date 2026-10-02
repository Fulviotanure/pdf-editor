/**
 * SignaturePad handles creating, drawing, typing, and uploading digital signatures.
 * Outputs clean transparent PNG data URLs ready to be placed on the document.
 */
export class SignaturePad {
  constructor(options = {}) {
    this.onApplySignature = options.onApplySignature || (() => {});
    this.modalEl = document.getElementById('signature-modal');
    this.canvasEl = document.getElementById('signature-canvas');
    this.ctx = this.canvasEl ? this.canvasEl.getContext('2d') : null;

    this.activeTab = 'draw';
    this.currentColor = '#0f172a';
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.hasDrawn = false;

    this.selectedFont = 'Caveat';
    this.uploadedImageData = null;

    this.init();
  }

  init() {
    if (!this.modalEl || !this.canvasEl) return;

    this.setupHiDPICanvas();
    this.bindEvents();
  }

  setupHiDPICanvas() {
    const rect = this.canvasEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvasEl.width = (rect.width || 600) * dpr;
    this.canvasEl.height = (rect.height || 200) * dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = this.currentColor;
  }

  bindEvents() {
    // Modal buttons
    document.getElementById('btn-close-sig-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-sig')?.addEventListener('click', () => this.close());
    document.getElementById('btn-apply-sig')?.addEventListener('click', () => this.apply());
    document.getElementById('btn-clear-sig')?.addEventListener('click', () => this.clearCanvas());

    // Tabs
    const tabs = this.modalEl.querySelectorAll('.sig-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.sigtab;
        this.switchTab(target);
      });
    });

    // Ink colors
    const inkBtns = this.modalEl.querySelectorAll('.ink-btn');
    inkBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        inkBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentColor = btn.dataset.color;
        this.ctx.strokeStyle = this.currentColor;
      });
    });

    // Canvas drawing (Pointer Events for Touch & Mouse)
    this.canvasEl.addEventListener('pointerdown', (e) => this.startDraw(e));
    this.canvasEl.addEventListener('pointermove', (e) => this.draw(e));
    window.addEventListener('pointerup', () => this.stopDraw());

    // Typed signature live preview
    const typeInput = document.getElementById('sig-type-input');
    typeInput?.addEventListener('input', (e) => {
      const text = e.target.value.trim() || 'Sua Assinatura';
      const previews = this.modalEl.querySelectorAll('.preview-sample');
      previews.forEach(p => p.textContent = text);
    });

    // Font selection cards
    const fontCards = this.modalEl.querySelectorAll('.font-preview-card');
    fontCards.forEach(card => {
      card.addEventListener('click', () => {
        fontCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedFont = card.dataset.font;
      });
    });

    // Upload Signature
    const uploadBox = document.getElementById('sig-upload-box');
    const fileInput = document.getElementById('sig-file-input');

    uploadBox?.addEventListener('click', (e) => {
      if (e.target.id === 'btn-remove-sig-img') return;
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.handleUploadedFile(file);
    });

    document.getElementById('btn-remove-sig-img')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.uploadedImageData = null;
      document.getElementById('sig-upload-prompt').style.display = 'block';
      document.getElementById('sig-upload-preview').style.display = 'none';
      if (fileInput) fileInput.value = '';
    });
  }

  startDraw(e) {
    e.preventDefault();
    this.isDrawing = true;
    const rect = this.canvasEl.getBoundingClientRect();
    this.lastX = e.clientX - rect.left;
    this.lastY = e.clientY - rect.top;
    this.hasDrawn = true;
  }

  draw(e) {
    if (!this.isDrawing) return;
    e.preventDefault();
    const rect = this.canvasEl.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(currentX, currentY);
    this.ctx.stroke();

    this.lastX = currentX;
    this.lastY = currentY;
  }

  stopDraw() {
    this.isDrawing = false;
  }

  clearCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvasEl.width / dpr, this.canvasEl.height / dpr);
    this.hasDrawn = false;
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    this.modalEl.querySelectorAll('.sig-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.sigtab === tabId);
    });
    this.modalEl.querySelectorAll('.sig-tab-content').forEach(p => {
      p.classList.toggle('active', p.id === `sig-pane-${tabId}`);
    });

    if (tabId === 'draw') {
      setTimeout(() => this.setupHiDPICanvas(), 50);
    }
  }

  handleUploadedFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to remove white background
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Make pure/light white transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          // If pixel is near white, make transparent
          if (r > 215 && g > 215 && b > 215) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);

        const transparentDataUrl = canvas.toDataURL('image/png');
        this.uploadedImageData = transparentDataUrl;

        const previewImg = document.getElementById('sig-uploaded-img');
        if (previewImg) previewImg.src = transparentDataUrl;

        document.getElementById('sig-upload-prompt').style.display = 'none';
        document.getElementById('sig-upload-preview').style.display = 'block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  open() {
    this.modalEl.style.display = 'flex';
    this.clearCanvas();
    setTimeout(() => this.setupHiDPICanvas(), 50);
  }

  close() {
    this.modalEl.style.display = 'none';
  }

  apply() {
    let signatureDataUrl = null;
    let width = 160;
    let height = 60;

    if (this.activeTab === 'draw') {
      if (!this.hasDrawn) {
        alert('Por favor, faça um traço ou desenho da sua assinatura antes de inserir.');
        return;
      }
      signatureDataUrl = this.canvasEl.toDataURL('image/png');
      width = 160;
      height = 55;
    } else if (this.activeTab === 'type') {
      const text = document.getElementById('sig-type-input')?.value.trim() || 'Assinatura';
      // Render text into an offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      ctx.font = `64px '${this.selectedFont}', cursive`;
      ctx.fillStyle = this.currentColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 20, 90);

      signatureDataUrl = canvas.toDataURL('image/png');
      width = 170;
      height = 55;
    } else if (this.activeTab === 'upload') {
      if (!this.uploadedImageData) {
        alert('Por favor, carregue uma imagem de assinatura antes de prosseguir.');
        return;
      }
      signatureDataUrl = this.uploadedImageData;
      width = 160;
      height = 65;
    }

    if (signatureDataUrl) {
      this.onApplySignature({
        dataUrl: signatureDataUrl,
        width,
        height,
      });
      this.close();
    }
  }
}
