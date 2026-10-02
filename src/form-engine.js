import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';

/**
 * FormEngine handles native PDF AcroForm fields.
 * It parses the fields from the PDF, maps their coordinates to the UI layers,
 * renders interactive HTML inputs, and tracks user inputs for export.
 */
export class FormEngine {
  constructor(pdfEngine) {
    this.pdfEngine = pdfEngine;
    this.pdfDoc = null;
    this.form = null;
    this.fields = []; // Parsed metadata about fields
    this.fieldValues = new Map(); // fieldName -> currentValue
    this.fieldWidgets = []; // list of widget locations
    this.isHighlighted = false;
    this.onValuesChanged = () => {};
  }

  /**
   * Load and parse form fields from original PDF bytes using pdf-lib
   */
  async loadForm(pdfBytes) {
    this.fieldValues.clear();
    this.fields = [];
    this.fieldWidgets = [];

    try {
      this.pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      this.form = this.pdfDoc.getForm();
      const rawFields = this.form.getFields();

      for (const field of rawFields) {
        const name = field.getName();
        let type = 'unknown';
        let value = '';

        if (field instanceof PDFTextField) {
          type = 'text';
          value = field.getText() || '';
        } else if (field instanceof PDFCheckBox) {
          type = 'checkbox';
          value = field.isChecked();
        } else if (field instanceof PDFDropdown) {
          type = 'dropdown';
          const selected = field.getSelected();
          value = selected ? selected[0] : '';
        } else if (field instanceof PDFRadioGroup) {
          type = 'radio';
          value = field.getSelected() || '';
        }

        this.fieldValues.set(name, value);

        // Extract widgets & coordinates
        const widgets = field.acroField.getWidgets();
        for (const widget of widgets) {
          const rect = widget.getRectangle();
          // Find page index
          let pageIndex = 0;
          const pages = this.pdfDoc.getPages();
          const widgetRef = widget.dict.get(widget.dict.context.obj('P'));
          if (widgetRef) {
            const idx = pages.findIndex(p => p.ref === widgetRef);
            if (idx !== -1) pageIndex = idx;
          }

          let options = [];
          if (field instanceof PDFDropdown) {
            options = field.getOptions();
          }

          this.fieldWidgets.push({
            name,
            type,
            pageIndex,
            pageNum: pageIndex + 1,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            options,
          });
        }

        this.fields.push({
          name,
          type,
          value,
        });
      }
    } catch (err) {
      console.warn('FormEngine: Nenhum AcroForm ou erro ao inspecionar campos:', err);
      this.fields = [];
      this.fieldWidgets = [];
    }

    return {
      count: this.fields.length,
      fields: this.fields,
    };
  }

  /**
   * Render HTML inputs inside the page's .pdf-acroform-layer
   */
  renderFieldsForPage(pageNum, layerEl) {
    layerEl.innerHTML = '';
    const pageIndex = pageNum - 1;
    const widgetsForPage = this.fieldWidgets.filter(w => w.pageIndex === pageIndex);

    const scale = this.pdfEngine.getScale();
    const viewport = this.pdfEngine.pageViewports.get(pageNum);
    if (!viewport) return;

    for (const widget of widgetsForPage) {
      const { rect, name, type, options } = widget;
      
      // Convert PDF points (bottom-left) to HTML overlay pixels (top-left)
      const left = rect.x * scale;
      const top = viewport.height - ((rect.y + rect.height) * scale);
      const width = rect.width * scale;
      const height = rect.height * scale;

      const fieldEl = document.createElement('div');
      fieldEl.className = `acro-field acro-field-${type} ${this.isHighlighted ? 'highlighted' : ''}`;
      fieldEl.id = `acro-widget-${name}-${pageNum}`;
      fieldEl.style.left = `${left}px`;
      fieldEl.style.top = `${top}px`;
      fieldEl.style.width = `${width}px`;
      fieldEl.style.height = `${height}px`;

      const currentValue = this.fieldValues.get(name);

      if (type === 'text') {
        const isMulti = height > 32;
        let input;
        if (isMulti) {
          input = document.createElement('textarea');
          input.value = currentValue || '';
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.value = currentValue || '';
        }
        input.name = name;
        input.style.fontSize = `${Math.max(10, Math.min(14, height * 0.55))}px`;
        input.placeholder = name;

        input.addEventListener('input', (e) => {
          this.setValue(name, e.target.value);
        });

        fieldEl.appendChild(input);
      } else if (type === 'checkbox') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = name;
        checkbox.checked = Boolean(currentValue);

        checkbox.addEventListener('change', (e) => {
          this.setValue(name, e.target.checked);
        });

        fieldEl.appendChild(checkbox);
      } else if (type === 'dropdown') {
        const select = document.createElement('select');
        select.name = name;
        select.style.fontSize = `${Math.max(10, Math.min(13, height * 0.55))}px`;

        for (const opt of options) {
          const optEl = document.createElement('option');
          optEl.value = opt;
          optEl.textContent = opt;
          if (opt === currentValue) optEl.selected = true;
          select.appendChild(optEl);
        }

        select.addEventListener('change', (e) => {
          this.setValue(name, e.target.value);
        });

        fieldEl.appendChild(select);
      }

      layerEl.appendChild(fieldEl);
    }
  }

  setValue(name, value) {
    this.fieldValues.set(name, value);
    // Update any duplicate widgets on screen
    const inputs = document.querySelectorAll(`[name="${name}"]`);
    for (const input of inputs) {
      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else {
        if (input.value !== value) input.value = value;
      }
    }
    this.onValuesChanged(name, value);
  }

  getValue(name) {
    return this.fieldValues.get(name);
  }

  getAllValues() {
    return Object.fromEntries(this.fieldValues.entries());
  }

  toggleHighlight() {
    this.isHighlighted = !this.isHighlighted;
    const allWidgets = document.querySelectorAll('.acro-field');
    for (const w of allWidgets) {
      if (this.isHighlighted) {
        w.classList.add('highlighted');
      } else {
        w.classList.remove('highlighted');
      }
    }
    return this.isHighlighted;
  }
}
