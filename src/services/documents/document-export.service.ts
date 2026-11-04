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
import zlib from 'zlib';
import { ValidationError } from '@/lib/errors';
import { FullProfessionalProfile } from '@/modules/professional-profile/profile.types';
import { GeneratedResumeContent } from '@/services/gemini/gemini.schemas';

/**
 * Gera um arquivo DOCX de coluna única 100% compatível com sistemas ATS e padronizado com fonte Inter
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
          font: 'Inter',
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
          color: '306D64',
          font: 'Inter',
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
            color: '04332D',
            font: 'Inter',
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
            color: '306D64',
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
            color: '04332D',
            font: 'Inter',
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
            font: 'Inter',
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
              font: 'Inter',
            }),
            new TextRun({
              text: `   (${exp.period})`,
              size: 20,
              color: '4B5563',
              font: 'Inter',
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
                font: 'Inter',
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
                font: 'Inter',
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
              font: 'Inter',
            }),
            new TextRun({
              text: `  (${edu.period} • ${edu.status})`,
              size: 20,
              color: '4B5563',
              font: 'Inter',
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
                font: 'Inter',
              }),
              new TextRun({
                text: group.items.join(', '),
                size: 20,
                font: 'Inter',
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
      color: [0.016, 0.2, 0.176], // #04332D
      spacingAfter: 2,
    });
    page.drawLine({
      start: { x: marginX, y: cursorY + 2 },
      end: { x: pageWidth - marginX, y: cursorY + 2 },
      thickness: 0.75,
      color: rgb(0.188, 0.427, 0.392), // #306D64
    });
    cursorY -= 8;
  };

  // Header
  drawTextBlock(resume.header.fullName, {
    size: 18,
    bold: true,
    color: [0.016, 0.024, 0.024], // #040606
    spacingAfter: 2,
  });
  drawTextBlock(resume.header.targetRole, {
    size: 12,
    bold: true,
    color: [0.188, 0.427, 0.392], // #306D64
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

function decodePdfLiteralString(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, ' ')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8))
    );
}

function decodePdfHexString(hexRaw: string): string {
  const cleanHex = hexRaw.replace(/\s+/g, '');
  if (!cleanHex) return '';
  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const pair = cleanHex.slice(i, i + 2).padEnd(2, '0');
    const code = parseInt(pair, 16);
    if (!Number.isNaN(code)) bytes.push(code);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  return Buffer.from(bytes).toString('latin1');
}

function extractTextTokensFromPdfContentStream(content: string): string[] {
  const lines: string[] = [];

  // Match TJ arrays: [(...) -10 (...) <hex>] TJ
  const tjArrayRegex = /\[((?:[^[\]]|\([^)]*\)|<[0-9A-Fa-f\s]*>)*)\]\s*TJ/g;
  let match: RegExpExecArray | null;
  while ((match = tjArrayRegex.exec(content)) !== null) {
    const inner = match[1];
    const tokenRegex = /\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]+)>/g;
    let tokenMatch: RegExpExecArray | null;
    let lineAcc = '';
    while ((tokenMatch = tokenRegex.exec(inner)) !== null) {
      if (tokenMatch[1] !== undefined) {
        lineAcc += decodePdfLiteralString(tokenMatch[1]);
      } else if (tokenMatch[2] !== undefined) {
        lineAcc += decodePdfHexString(tokenMatch[2]);
      }
    }
    if (lineAcc.trim()) lines.push(lineAcc.trim());
  }

  // Match single string Tj: (...) Tj or <...> Tj
  const singleTjRegex = /(?:\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]+)>)\s*(?:Tj|'|")/g;
  while ((match = singleTjRegex.exec(content)) !== null) {
    if (match[1] !== undefined) {
      const dec = decodePdfLiteralString(match[1]).trim();
      if (dec) lines.push(dec);
    } else if (match[2] !== undefined) {
      const dec = decodePdfHexString(match[2]).trim();
      if (dec) lines.push(dec);
    }
  }

  return lines;
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
  const rawLatin1 = buffer.toString('latin1');
  const extractedChunks: string[] = [];

  // Iterate over all stream ... endstream blocks
  let searchPos = 0;
  while (searchPos < rawLatin1.length) {
    const streamIdx = rawLatin1.indexOf('stream', searchPos);
    if (streamIdx === -1) break;
    const endStreamIdx = rawLatin1.indexOf('endstream', streamIdx + 6);
    if (endStreamIdx === -1) break;

    let dataStart = streamIdx + 6;
    if (rawLatin1[dataStart] === '\r' && rawLatin1[dataStart + 1] === '\n') {
      dataStart += 2;
    } else if (rawLatin1[dataStart] === '\n' || rawLatin1[dataStart] === '\r') {
      dataStart += 1;
    }

    let dataEnd = endStreamIdx;
    if (
      dataEnd - 2 >= dataStart &&
      rawLatin1[dataEnd - 2] === '\r' &&
      rawLatin1[dataEnd - 1] === '\n'
    ) {
      dataEnd -= 2;
    } else if (
      dataEnd - 1 >= dataStart &&
      (rawLatin1[dataEnd - 1] === '\n' || rawLatin1[dataEnd - 1] === '\r')
    ) {
      dataEnd -= 1;
    }

    const slice = buffer.subarray(dataStart, dataEnd);
    let decodedStream = '';
    try {
      decodedStream = zlib.inflateSync(slice).toString('latin1');
    } catch {
      try {
        decodedStream = zlib.inflateRawSync(slice).toString('latin1');
      } catch {
        decodedStream = slice.toString('latin1');
      }
    }

    if (decodedStream.includes('Tj') || decodedStream.includes('TJ')) {
      const tokens = extractTextTokensFromPdfContentStream(decodedStream);
      if (tokens.length > 0) {
        extractedChunks.push(tokens.join('\n'));
      }
    }

    searchPos = endStreamIdx + 9;
  }

  if (extractedChunks.length > 0) {
    return extractedChunks.join('\n').trim();
  }

  // Fallback for uncompressed PDFs or plain text inside PDF structure
  const fallbackTokens = extractTextTokensFromPdfContentStream(rawLatin1);
  if (fallbackTokens.length > 0) {
    return fallbackTokens.join('\n').trim();
  }

  return buffer
    .toString('utf-8')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\r\n]/gu, ' ')
    .trim();
}

/**
 * Extrai texto de arquivo DOCX ou PDF com validação segura de extensão e tamanho
 */
export async function extractTextFromUploadedDocument(
  fileName: string,
  buffer: Buffer
): Promise<string> {
  if (!buffer || buffer.byteLength === 0) {
    throw new ValidationError('O arquivo enviado está vazio.');
  }
  if (buffer.byteLength > 10 * 1024 * 1024) {
    throw new ValidationError(
      'O arquivo excede o limite máximo permitido de 10 MB.'
    );
  }

  const lower = fileName.trim().toLowerCase();
  if (!lower.endsWith('.pdf') && !lower.endsWith('.docx') && !lower.endsWith('.txt')) {
    throw new ValidationError(
      'Formato de arquivo não suportado. Envie seu currículo em PDF (.pdf) ou Word (.docx).'
    );
  }

  try {
    if (lower.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) {
        throw new ValidationError(
          'Não foi possível extrair texto deste arquivo DOCX. Verifique se o documento possui conteúdo textual.'
        );
      }
      return text;
    }

    if (lower.endsWith('.pdf')) {
      const text = extractTextFromPdfBuffer(buffer);
      if (!text || text.length < 15) {
        throw new ValidationError(
          'Não foi possível extrair texto legível deste PDF (ele pode ser apenas uma imagem escaneada). Tente enviar em Word (.docx) ou nos conte sua trajetória aqui no chat!'
        );
      }
      return text;
    }

    return buffer
      .toString('utf-8')
      .replace(/[^\p{L}\p{N}\p{P}\p{Z}\r\n]/gu, ' ')
      .trim();
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(
      'Falha ao ler o documento enviado. Verifique se o arquivo PDF ou DOCX não está corrompido ou protegido por senha.'
    );
  }
}

/**
 * Constrói a estrutura padronizada GeneratedResumeContent a partir do Currículo Mestre (FullProfessionalProfile)
 */
export function buildMasterResumeContentFromProfile(
  profile: FullProfessionalProfile
): GeneratedResumeContent {
  return {
    header: {
      fullName: profile.full_name || 'Profissional',
      targetRole:
        profile.target_roles ||
        profile.specialties ||
        'Posicionamento Profissional',
      location: profile.location || null,
      email: profile.contact_email || null,
      phone: profile.phone || null,
      linkedinUrl: profile.linkedin_url || null,
      portfolioUrl: profile.portfolio_url || null,
    },
    professionalSummary:
      profile.professional_summary ||
      `Profissional com atuação em ${profile.target_roles || 'sua área de especialidade'}${profile.experience_years ? ` (${profile.experience_years})` : ''}.`,
    experiences: profile.experiences.map((exp) => {
      const bullets = [
        exp.description,
        ...(exp.achievements ? [`Resultados e conquistas: ${exp.achievements}`] : []),
      ].filter(Boolean);
      return {
        company: exp.company,
        position: exp.position,
        period: `${exp.start_date} - ${exp.end_date || 'Atual'}`,
        descriptionBullets: bullets,
        toolsUsed: exp.tools
          ? exp.tools
              .split(/[,;]/)
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };
    }),
    educations: profile.educations.map((edu) => ({
      institution: edu.institution,
      course: edu.course,
      degree: edu.degree,
      period:
        [edu.start_date, edu.end_date].filter(Boolean).join(' - ') ||
        edu.status,
      status: edu.status,
    })),
    skills: {
      technical: profile.skills
        .filter((s) => s.category === 'TECHNICAL')
        .map((s) => (s.proficiency ? `${s.name} (${s.proficiency})` : s.name)),
      tools: profile.skills
        .filter((s) => s.category === 'TOOL')
        .map((s) => (s.proficiency ? `${s.name} (${s.proficiency})` : s.name)),
      soft: profile.skills
        .filter((s) => s.category === 'SOFT')
        .map((s) => (s.proficiency ? `${s.name} (${s.proficiency})` : s.name)),
      languages: profile.skills
        .filter((s) => s.category === 'LANGUAGE')
        .map((s) => (s.proficiency ? `${s.name} — ${s.proficiency}` : s.name)),
      certifications: profile.skills
        .filter((s) => s.category === 'CERTIFICATION')
        .map((s) => (s.proficiency ? `${s.name} (${s.proficiency})` : s.name)),
    },
    atsKeywordsApplied: profile.skills.slice(0, 12).map((s) => s.name),
    factualIntegrityNote:
      'Currículo Mestre consolidado exclusivamente com informações confirmadas pelo profissional.',
  };
}
