import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import mammoth from 'mammoth';
import { GeneratedResumeContent } from '@/services/gemini/gemini.schemas';

/**
 * Gera um arquivo DOCX de coluna única 100% compatível com sistemas ATS e padronizado com fonte Roboto
 */
export async function generateResumeDocxBuffer(
  resume: GeneratedResumeContent
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Header: Nome Completo
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: resume.header.fullName,
          bold: true,
          size: 32,
          font: 'Roboto',
        }),
      ],
    })
  );

  // Cargo alvo
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: resume.header.targetRole,
          bold: true,
          size: 24,
          color: '1D4ED8',
          font: 'Roboto',
        }),
      ],
    })
  );

  // Contatos em linha única limpa para leitura ATS
  const contactParts = [
    resume.header.location,
    resume.header.email,
    resume.header.phone,
    resume.header.linkedinUrl,
    resume.header.portfolioUrl,
  ].filter(Boolean);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            size: 20,
            color: '374151',
            font: 'Roboto',
          }),
        ],
      })
    );
  }

  const addSectionHeader = (title: string) => {
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        border: {
          bottom: {
            color: 'CBD5E1',
            space: 4,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: [
          new TextRun({
            text: title.toUpperCase(),
            bold: true,
            size: 22,
            color: '0F172A',
            font: 'Roboto',
          }),
        ],
      })
    );
  };

  // Resumo Profissional
  if (resume.professionalSummary) {
    addSectionHeader('Resumo Profissional');
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: resume.professionalSummary,
            size: 21,
            font: 'Roboto',
          }),
        ],
      })
    );
  }

  // Experiências Profissionais
  if (resume.experiences && resume.experiences.length > 0) {
    addSectionHeader('Experiência Profissional');
    for (const exp of resume.experiences) {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: `${exp.position} — ${exp.company}`,
              bold: true,
              size: 22,
              font: 'Roboto',
            }),
            new TextRun({
              text: `   (${exp.period})`,
              size: 20,
              color: '4B5563',
              font: 'Roboto',
            }),
          ],
        })
      );

      for (const bullet of exp.descriptionBullets) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: bullet,
                size: 20,
                font: 'Roboto',
              }),
            ],
          })
        );
      }

      if (exp.toolsUsed && exp.toolsUsed.length > 0) {
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `Ferramentas e tecnologias: ${exp.toolsUsed.join(', ')}`,
                italics: true,
                size: 19,
                color: '475569',
                font: 'Roboto',
              }),
            ],
          })
        );
      }
    }
  }

  // Formação Acadêmica
  if (resume.educations && resume.educations.length > 0) {
    addSectionHeader('Formação Acadêmica');
    for (const edu of resume.educations) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: `${edu.degree} em ${edu.course} — ${edu.institution}`,
              bold: true,
              size: 21,
              font: 'Roboto',
            }),
            new TextRun({
              text: `  (${edu.period} • ${edu.status})`,
              size: 20,
              color: '4B5563',
              font: 'Roboto',
            }),
          ],
        })
      );
    }
  }

  // Competências e Certificações
  const hasSkills =
    resume.skills.technical.length > 0 ||
    resume.skills.tools.length > 0 ||
    resume.skills.soft.length > 0 ||
    resume.skills.languages.length > 0 ||
    resume.skills.certifications.length > 0;

  if (hasSkills) {
    addSectionHeader('Competências, Idiomas e Certificações');

    const skillGroups: Array<{ label: string; items: string[] }> = [
      { label: 'Competências Técnicas', items: resume.skills.technical },
      { label: 'Ferramentas e Tecnologias', items: resume.skills.tools },
      { label: 'Competências Comportamentais', items: resume.skills.soft },
      { label: 'Idiomas', items: resume.skills.languages },
      { label: 'Certificações', items: resume.skills.certifications },
    ];

    for (const group of skillGroups) {
      if (group.items.length > 0) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `${group.label}: `,
                bold: true,
                size: 20,
                font: 'Roboto',
              }),
              new TextRun({
                text: group.items.join(', '),
                size: 20,
                font: 'Roboto',
              }),
            ],
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

function sanitizeWinAnsiText(input: string): string {
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  const clean = sanitizeWinAnsiText(text);
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxCharsPerLine) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/**
 * Gera um arquivo PDF de coluna única otimizado para leitura ATS
 */
export async function generateResumePdfBuffer(
  resume: GeneratedResumeContent
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginX = 48;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - 52;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < 50) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - 52;
    }
  };

  const drawTextBlock = (
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      maxChars?: number;
      spacingAfter?: number;
    } = {}
  ) => {
    const size = opts.size ?? 10;
    const font = opts.bold ? fontBold : fontRegular;
    const [r, g, b] = opts.color ?? [0.1, 0.12, 0.16];
    const maxChars = opts.maxChars ?? Math.floor((pageWidth - marginX * 2) / (size * 0.52));
    const lines = wrapTextLines(text, maxChars);

    for (const line of lines) {
      ensureSpace(size + 5);
      page.drawText(line, {
        x: marginX,
        y: cursorY,
        size,
        font,
        color: rgb(r, g, b),
      });
      cursorY -= size + 4;
    }
    cursorY -= opts.spacingAfter ?? 4;
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(28);
    cursorY -= 8;
    drawTextBlock(title.toUpperCase(), {
      size: 11,
      bold: true,
      color: [0.09, 0.25, 0.68],
      spacingAfter: 2,
    });
    page.drawLine({
      start: { x: marginX, y: cursorY + 2 },
      end: { x: pageWidth - marginX, y: cursorY + 2 },
      thickness: 0.75,
      color: rgb(0.8, 0.84, 0.9),
    });
    cursorY -= 8;
  };

  // Header
  drawTextBlock(resume.header.fullName, {
    size: 18,
    bold: true,
    spacingAfter: 2,
  });
  drawTextBlock(resume.header.targetRole, {
    size: 12,
    bold: true,
    color: [0.11, 0.31, 0.85],
    spacingAfter: 4,
  });

  const contacts = [
    resume.header.location,
    resume.header.email,
    resume.header.phone,
    resume.header.linkedinUrl,
    resume.header.portfolioUrl,
  ].filter(Boolean);
  if (contacts.length > 0) {
    drawTextBlock(contacts.join('  |  '), {
      size: 9,
      color: [0.3, 0.35, 0.42],
      spacingAfter: 8,
    });
  }

  // Resumo
  if (resume.professionalSummary) {
    drawSectionHeader('Resumo Profissional');
    drawTextBlock(resume.professionalSummary, { size: 10, spacingAfter: 6 });
  }

  // Experiências
  if (resume.experiences && resume.experiences.length > 0) {
    drawSectionHeader('Experiência Profissional');
    for (const exp of resume.experiences) {
      drawTextBlock(`${exp.position} - ${exp.company} (${exp.period})`, {
        size: 10.5,
        bold: true,
        spacingAfter: 2,
      });
      for (const bullet of exp.descriptionBullets) {
        drawTextBlock(`- ${bullet}`, { size: 9.5, spacingAfter: 2 });
      }
      if (exp.toolsUsed && exp.toolsUsed.length > 0) {
        drawTextBlock(`Ferramentas: ${exp.toolsUsed.join(', ')}`, {
          size: 9,
          color: [0.3, 0.35, 0.42],
          spacingAfter: 6,
        });
      }
    }
  }

  // Formação
  if (resume.educations && resume.educations.length > 0) {
    drawSectionHeader('Formação Acadêmica');
    for (const edu of resume.educations) {
      drawTextBlock(
        `${edu.degree} em ${edu.course} - ${edu.institution} (${edu.period} - ${edu.status})`,
        { size: 10, spacingAfter: 4 }
      );
    }
  }

  // Competências
  const skillSections = [
    { label: 'Competências Técnicas', items: resume.skills.technical },
    { label: 'Ferramentas', items: resume.skills.tools },
    { label: 'Competências Comportamentais', items: resume.skills.soft },
    { label: 'Idiomas', items: resume.skills.languages },
    { label: 'Certificações', items: resume.skills.certifications },
  ].filter((s) => s.items.length > 0);

  if (skillSections.length > 0) {
    drawSectionHeader('Competências e Qualificações');
    for (const sec of skillSections) {
      drawTextBlock(`${sec.label}: ${sec.items.join(', ')}`, {
        size: 9.5,
        spacingAfter: 3,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Extrai texto de arquivo DOCX ou TXT/PDF básico para importação assistida de perfil
 */
export async function extractTextFromUploadedDocument(
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
  return buffer.toString('utf-8').replace(/[^\p{L}\p{N}\p{P}\p{Z}\r\n]/gu, ' ').trim();
}
