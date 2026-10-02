import { PDFDocument, rgb, StandardFonts, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';

/**
 * Utility to convert hex color string (#rrggbb) to pdf-lib rgb(r, g, b)
 */
function hexToPdfRgb(hex = '#000000') {
  if (!hex || hex === 'transparent') return rgb(0, 0, 0);
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

/**
 * Exporter merges original PDF bytes, filled AcroForm fields,
 * and visual overlay annotations (text, checkmarks, signatures, whiteout)
 * into a high-quality downloadable PDF.
 */
export async function exportFilledPDF({ pdfBytes, formValues, overlayElements, filename = 'documento-preenchido.pdf' }) {
  if (!pdfBytes) {
    throw new Error('Nenhum documento carregado para exportar.');
  }

  // Load the PDF into pdf-lib
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 1. Fill AcroForm native fields
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    for (const field of fields) {
      const name = field.getName();
      if (formValues && name in formValues) {
        const val = formValues[name];
        if (field instanceof PDFTextField) {
          field.setText(String(val || ''));
        } else if (field instanceof PDFCheckBox) {
          if (val) {
            field.check();
          } else {
            field.uncheck();
          }
        } else if (field instanceof PDFDropdown) {
          if (val) {
            field.select(String(val));
          }
        } else if (field instanceof PDFRadioGroup) {
          if (val) {
            field.select(String(val));
          }
        }
      }
    }
  } catch (err) {
    console.warn('Exporter: Não foi possível preencher campos de formulário nativos:', err);
  }

  // 2. Draw visual annotations onto respective pages
  for (const elem of overlayElements) {
    const pageIndex = (elem.pageNum || 1) - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];

    const textColor = hexToPdfRgb(elem.color);

    if (elem.type === 'text' || elem.type === 'date') {
      // Optional background rectangle
      if (elem.bg && elem.bg !== 'transparent') {
        const bgColor = hexToPdfRgb(elem.bg);
        page.drawRectangle({
          x: elem.x,
          y: elem.y - elem.height,
          width: elem.width,
          height: elem.height,
          color: bgColor,
        });
      }

      const text = elem.text || '';
      // Support multi-line text
      const lines = text.split('\n');
      const fontSize = elem.fontSize || 12;
      let lineY = elem.y - fontSize + 1;

      for (const line of lines) {
        page.drawText(line, {
          x: elem.x + 3,
          y: lineY,
          size: fontSize,
          font: fontRegular,
          color: textColor,
        });
        lineY -= fontSize * 1.25;
      }

    } else if (elem.type === 'check') {
      // Crisp vector checkmark lines
      const size = elem.fontSize || 18;
      const thickness = Math.max(1.8, size * 0.1);
      const midX = elem.x + size * 0.35;
      const botY = elem.y - size * 0.85;

      page.drawLine({
        start: { x: elem.x + 2, y: elem.y - size * 0.52 },
        end: { x: midX, y: botY },
        thickness: thickness,
        color: textColor,
      });
      page.drawLine({
        start: { x: midX, y: botY },
        end: { x: elem.x + size - 1, y: elem.y - size * 0.08 },
        thickness: thickness,
        color: textColor,
      });

    } else if (elem.type === 'cross') {
      // Crisp vector cross lines
      const size = elem.fontSize || 18;
      const thickness = Math.max(1.8, size * 0.1);
      page.drawLine({
        start: { x: elem.x + 2, y: elem.y - 2 },
        end: { x: elem.x + size - 2, y: elem.y - size + 2 },
        thickness: thickness,
        color: textColor,
      });
      page.drawLine({
        start: { x: elem.x + 2, y: elem.y - size + 2 },
        end: { x: elem.x + size - 2, y: elem.y - 2 },
        thickness: thickness,
        color: textColor,
      });

    } else if (elem.type === 'signature') {
      if (elem.dataUrl) {
        try {
          const pngImage = await pdfDoc.embedPng(elem.dataUrl);
          page.drawImage(pngImage, {
            x: elem.x,
            y: elem.y - elem.height,
            width: elem.width,
            height: elem.height,
          });
        } catch (imgErr) {
          console.error('Erro ao embutir assinatura PNG:', imgErr);
        }
      }

    } else if (elem.type === 'whiteout') {
      page.drawRectangle({
        x: elem.x,
        y: elem.y - elem.height,
        width: elem.width,
        height: elem.height,
        color: rgb(1, 1, 1),
      });
    }
  }

  // 3. Serialize and trigger browser download
  const outputBytes = await pdfDoc.save();
  const blob = new Blob([outputBytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  const downloadLink = document.createElement('a');
  downloadLink.href = blobUrl;
  downloadLink.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  return outputBytes;
}
