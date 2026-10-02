import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates an interactive sample PDF form with real AcroForm fields
 * and structured sections to demonstrate full form filling capabilities.
 */
export async function createSampleFormPDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size in points (72 DPI)
  const { width, height } = page.getSize();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.31, 0.27, 0.9); // Indigo
  const slateDark = rgb(0.06, 0.09, 0.16);
  const slateMuted = rgb(0.4, 0.45, 0.55);
  const borderLight = rgb(0.8, 0.84, 0.9);
  const bgLight = rgb(0.96, 0.97, 1.0);

  // Header Banner
  page.drawRectangle({
    x: 36,
    y: height - 100,
    width: width - 72,
    height: 64,
    color: bgLight,
    borderColor: borderLight,
    borderWidth: 1,
  });

  page.drawText('FORMULÁRIO DE CADASTRO & ADMISSÃO', {
    x: 52,
    y: height - 60,
    size: 16,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText('Documento Oficial de Registro de Dados Pessoais e Profissionais', {
    x: 52,
    y: height - 80,
    size: 9.5,
    font: fontRegular,
    color: slateMuted,
  });

  page.drawText('DOC-2026-BR', {
    x: width - 130,
    y: height - 60,
    size: 11,
    font: fontBold,
    color: slateDark,
  });

  // Section 1: Dados Pessoais
  let currentY = height - 125;
  page.drawText('1. DADOS PESSOAIS (Campos Interativos Nativos)', {
    x: 36,
    y: currentY,
    size: 12,
    font: fontBold,
    color: slateDark,
  });

  currentY -= 6;
  page.drawLine({
    start: { x: 36, y: currentY },
    end: { x: width - 36, y: currentY },
    thickness: 1,
    color: primaryColor,
  });

  const form = pdfDoc.getForm();

  // Field: Nome Completo
  currentY -= 26;
  page.drawText('Nome Completo:', { x: 36, y: currentY, size: 9.5, font: fontBold, color: slateDark });
  const nameField = form.createTextField('fullName');
  nameField.setText('Fulvio Henrique Silva');
  nameField.addToPage(page, {
    x: 36,
    y: currentY - 26,
    width: 320,
    height: 22,
    borderColor: borderLight,
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 1,
  });

  // Field: CPF / Documento
  page.drawText('CPF / R.G.:', { x: 370, y: currentY, size: 9.5, font: fontBold, color: slateDark });
  const docField = form.createTextField('documentNumber');
  docField.setText('123.456.789-00');
  docField.addToPage(page, {
    x: 370,
    y: currentY - 26,
    width: width - 370 - 36,
    height: 22,
    borderColor: borderLight,
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 1,
  });

  // Field: E-mail & Telefone
  currentY -= 54;
  page.drawText('E-mail Principal:', { x: 36, y: currentY, size: 9.5, font: fontBold, color: slateDark });
  const emailField = form.createTextField('emailAddress');
  emailField.setText('usuario@exemplo.com.br');
  emailField.addToPage(page, {
    x: 36,
    y: currentY - 26,
    width: 320,
    height: 22,
    borderColor: borderLight,
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 1,
  });

  page.drawText('Telefone / WhatsApp:', { x: 370, y: currentY, size: 9.5, font: fontBold, color: slateDark });
  const phoneField = form.createTextField('phoneNumber');
  phoneField.setText('(11) 98765-4321');
  phoneField.addToPage(page, {
    x: 370,
    y: currentY - 26,
    width: width - 370 - 36,
    height: 22,
    borderColor: borderLight,
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 1,
  });

  // Section 2: Informações do Cargo
  currentY -= 56;
  page.drawText('2. ATRIBUIÇÕES & PREFERÊNCIAS', {
    x: 36,
    y: currentY,
    size: 12,
    font: fontBold,
    color: slateDark,
  });

  currentY -= 6;
  page.drawLine({
    start: { x: 36, y: currentY },
    end: { x: width - 36, y: currentY },
    thickness: 1,
    color: primaryColor,
  });

  currentY -= 26;
  page.drawText('Cargo Pretendido:', { x: 36, y: currentY, size: 9.5, font: fontBold, color: slateDark });
  const roleField = form.createTextField('jobPosition');
  roleField.setText('Desenvolvedor Full Stack');
  roleField.addToPage(page, {
    x: 36,
    y: currentY - 26,
    width: 250,
    height: 22,
    borderColor: borderLight,
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 1,
  });

  page.drawText('Modalidade de Trabalho:', { x: 300, y: currentY, size: 9.5, font: fontBold, color: slateDark });
  const contractDropdown = form.createDropdown('workMode');
  contractDropdown.addOptions(['Remoto (Home Office)', 'Híbrido', 'Presencial']);
  contractDropdown.select('Remoto (Home Office)');
  contractDropdown.addToPage(page, {
    x: 300,
    y: currentY - 26,
    width: width - 300 - 36,
    height: 22,
    borderColor: borderLight,
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 1,
  });

  // Checkboxes
  currentY -= 54;
  page.drawText('Opções e Notificações:', { x: 36, y: currentY, size: 9.5, font: fontBold, color: slateDark });

  currentY -= 24;
  const check1 = form.createCheckBox('notifyEmail');
  check1.check();
  check1.addToPage(page, { x: 36, y: currentY, width: 14, height: 14, borderColor: borderLight, borderWidth: 1 });
  page.drawText('Desejo receber atualizações e avisos do processo por e-mail', {
    x: 58,
    y: currentY + 3,
    size: 9,
    font: fontRegular,
    color: slateDark,
  });

  currentY -= 22;
  const check2 = form.createCheckBox('agreeTerms');
  check2.check();
  check2.addToPage(page, { x: 36, y: currentY, width: 14, height: 14, borderColor: borderLight, borderWidth: 1 });
  page.drawText('Declaro sob as penas da lei que todas as informações acima são verdadeiras', {
    x: 58,
    y: currentY + 3,
    size: 9,
    font: fontRegular,
    color: slateDark,
  });

  // Section 3: Observações
  currentY -= 32;
  page.drawText('Observações Adicionais:', { x: 36, y: currentY, size: 9.5, font: fontBold, color: slateDark });
  const notesField = form.createTextField('additionalNotes');
  notesField.enableMultiline();
  notesField.setText('Disponibilidade para início imediato e participação em reuniões nos horários comerciais.');
  notesField.addToPage(page, {
    x: 36,
    y: currentY - 50,
    width: width - 72,
    height: 44,
    borderColor: borderLight,
    backgroundColor: rgb(1, 1, 1),
    borderWidth: 1,
  });

  // Section 4: Área para Assinatura e Data (Área Estática para Teste das Ferramentas Visuais)
  currentY -= 82;
  page.drawRectangle({
    x: 36,
    y: currentY - 110,
    width: width - 72,
    height: 120,
    color: rgb(0.98, 0.99, 1.0),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });

  page.drawText('3. ÁREA DE VALIDAÇÃO E ASSINATURA', {
    x: 52,
    y: currentY - 20,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText('(Use a ferramenta de Assinatura "✍️" e Data "📅" para assinar nesta caixa)', {
    x: 52,
    y: currentY - 34,
    size: 8.5,
    font: fontRegular,
    color: slateMuted,
  });

  // Data Line
  page.drawLine({
    start: { x: 52, y: currentY - 80 },
    end: { x: 200, y: currentY - 80 },
    thickness: 1,
    color: rgb(0.7, 0.75, 0.85),
  });
  page.drawText('Data de Preenchimento', {
    x: 74,
    y: currentY - 94,
    size: 8.5,
    font: fontRegular,
    color: slateMuted,
  });

  // Signature Line
  page.drawLine({
    start: { x: 260, y: currentY - 80 },
    end: { x: width - 52, y: currentY - 80 },
    thickness: 1,
    color: rgb(0.7, 0.75, 0.85),
  });
  page.drawText('Assinatura do Responsável / Candidato', {
    x: 320,
    y: currentY - 94,
    size: 8.5,
    font: fontRegular,
    color: slateMuted,
  });

  // Page 2: Exemplo de documento de múltiplos passos
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('TERMO DE CIÊNCIA E POLÍTICA DE PRIVACIDADE', {
    x: 36,
    y: height - 60,
    size: 15,
    font: fontBold,
    color: primaryColor,
  });

  page2.drawText('Página 2 - Documento Complementar', {
    x: 36,
    y: height - 80,
    size: 9.5,
    font: fontRegular,
    color: slateMuted,
  });

  page2.drawLine({
    start: { x: 36, y: height - 90 },
    end: { x: width - 36, y: height - 90 },
    thickness: 1,
    color: borderLight,
  });

  const termsText = [
    '1. O signatário autoriza expressamente o tratamento dos dados pessoais coletados neste formulário;',
    '2. Os dados serão utilizados exclusivamente para os propósitos de contratação, cadastramento e conformidade legal;',
    '3. O presente documento possui validade jurídica em conformidade com as diretrizes da LGPD (Lei Geral de Proteção de Dados);',
    '4. Quaisquer alterações ou anotações complementares podem ser realizadas utilizando as ferramentas de texto deste editor.',
  ];

  let p2Y = height - 130;
  for (const line of termsText) {
    page2.drawText(line, {
      x: 36,
      y: p2Y,
      size: 9.5,
      font: fontRegular,
      color: slateDark,
      lineHeight: 14,
    });
    p2Y -= 32;
  }

  // Checkboxes on Page 2
  p2Y -= 20;
  const agreeCheck2 = form.createCheckBox('agreePrivacyTerms');
  agreeCheck2.check();
  agreeCheck2.addToPage(page2, { x: 36, y: p2Y, width: 14, height: 14, borderColor: borderLight, borderWidth: 1 });
  page2.drawText('Li e concordo com todos os termos da política de privacidade acima descrita.', {
    x: 58,
    y: p2Y + 3,
    size: 9.5,
    font: fontBold,
    color: slateDark,
  });

  // Signature line on page 2
  p2Y -= 70;
  page2.drawLine({
    start: { x: 150, y: p2Y },
    end: { x: width - 150, y: p2Y },
    thickness: 1,
    color: rgb(0.7, 0.75, 0.85),
  });
  page2.drawText('Rubrica / Assinatura do Titular', {
    x: 230,
    y: p2Y - 16,
    size: 9,
    font: fontRegular,
    color: slateMuted,
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
