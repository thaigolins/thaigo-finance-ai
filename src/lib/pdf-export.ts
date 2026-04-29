import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatBRL } from "./format";

export type PdfKind = "simples" | "private";

export type PdfTable = {
  title?: string;
  columns: string[];
  rows: (string | number)[][];
  // Optional totals row appended in bold
  totals?: (string | number)[];
};

export type PdfSection = {
  heading: string;
  paragraphs?: string[];
  table?: PdfTable;
  kpis?: { label: string; value: string }[];
};

export type PdfPayload = {
  module: string; // ex: "Extratos", "Dívidas"
  title: string; // ex: "Relatório de Extratos"
  period: string; // ex: "Abril/2026"
  filters?: string[]; // ex: ["Conta: Itaú", "Categoria: Alimentação"]
  summary?: { label: string; value: string }[];
  sections: PdfSection[];
  insights?: string[]; // IA — só usado em Private
  recommendations?: string[]; // IA — só usado em Private
  consolidatedPatrimony?: { label: string; value: string }[]; // Private
};

// Brand colors
const BRAND = {
  emerald: [104, 159, 122] as [number, number, number], // primary
  charcoal: [22, 28, 26] as [number, number, number],
  ink: [38, 45, 42] as [number, number, number],
  muted: [110, 118, 114] as [number, number, number],
  line: [220, 225, 222] as [number, number, number],
  softBg: [242, 246, 243] as [number, number, number],
};

const FOOTER_TEXT = "Thaigo Finance AI — Relatório Financeiro Pessoal";

function nowStr() {
  return new Date().toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" });
}

function addFooter(doc: jsPDF, kind: PdfKind) {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.3);
    doc.line(40, h - 36, w - 40, h - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(FOOTER_TEXT, 40, h - 22);
    doc.text(`Página ${i} de ${pageCount}`, w - 40, h - 22, { align: "right" });
    if (kind === "private") {
      doc.setTextColor(...BRAND.emerald);
      doc.setFontSize(7);
      doc.text("PRIVATE · CONFIDENCIAL", w / 2, h - 22, { align: "center" });
    }
  }
}

function drawTable(doc: jsPDF, startY: number, table: PdfTable, kind: PdfKind): number {
  const head = [table.columns];
  const body = table.rows.map((r) => r.map((c) => String(c)));
  if (table.totals) body.push(table.totals.map((c) => String(c)));

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 6,
      textColor: BRAND.ink,
      lineColor: BRAND.line,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: kind === "private" ? BRAND.charcoal : BRAND.softBg,
      textColor: kind === "private" ? [255, 255, 255] : BRAND.ink,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [250, 251, 250] },
    didParseCell: (data) => {
      if (table.totals && data.row.index === body.length - 1 && data.section === "body") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = kind === "private" ? [235, 240, 236] : BRAND.softBg;
      }
    },
    margin: { left: 40, right: 40 },
  });

  // @ts-expect-error - autotable adds lastAutoTable
  return doc.lastAutoTable.finalY + 14;
}

function drawHeading(doc: jsPDF, text: string, y: number, kind: PdfKind): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(kind === "private" ? 13 : 12);
  doc.setTextColor(...BRAND.charcoal);
  doc.text(text, 40, y);
  doc.setDrawColor(...BRAND.emerald);
  doc.setLineWidth(1.2);
  doc.line(40, y + 4, 40 + 28, y + 4);
  return y + 18;
}

function drawParagraph(doc: jsPDF, text: string, y: number, w: number): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.ink);
  const lines = doc.splitTextToSize(text, w);
  doc.text(lines, 40, y);
  return y + lines.length * 13 + 4;
}

function drawKpis(doc: jsPDF, items: { label: string; value: string }[], y: number, w: number): number {
  const cols = Math.min(items.length, 3);
  const gap = 10;
  const cardW = (w - gap * (cols - 1)) / cols;
  let row = 0;
  items.forEach((it, idx) => {
    const col = idx % cols;
    if (idx > 0 && col === 0) row++;
    const x = 40 + col * (cardW + gap);
    const yy = y + row * 56;
    doc.setFillColor(...BRAND.softBg);
    doc.setDrawColor(...BRAND.line);
    doc.roundedRect(x, yy, cardW, 46, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(it.label.toUpperCase(), x + 10, yy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BRAND.charcoal);
    doc.text(it.value, x + 10, yy + 32);
  });
  return y + (row + 1) * 56 + 6;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 60) {
    doc.addPage();
    return 60;
  }
  return y;
}

function renderCover(doc: jsPDF, payload: PdfPayload) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  // Background panel
  doc.setFillColor(...BRAND.charcoal);
  doc.rect(0, 0, w, h, "F");
  // Accent bar
  doc.setFillColor(...BRAND.emerald);
  doc.rect(40, 80, 60, 4, "F");
  // Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.emerald);
  doc.text("THAIGO FINANCE AI", 40, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 210, 205);
  doc.text("Private Wealth Management", 40, 124);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(payload.title, w - 80);
  doc.text(titleLines, 40, h / 2 - 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(200, 210, 205);
  doc.text(payload.module.toUpperCase(), 40, h / 2 + 8);

  doc.setFontSize(11);
  doc.setTextColor(180, 190, 185);
  doc.text(`Período: ${payload.period}`, 40, h / 2 + 30);
  doc.text(`Emitido em: ${nowStr()}`, 40, h / 2 + 46);

  // Footer of cover
  doc.setDrawColor(...BRAND.emerald);
  doc.setLineWidth(0.5);
  doc.line(40, h - 80, w - 40, h - 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 185);
  doc.text("Documento confidencial — uso exclusivo do cliente.", 40, h - 60);
  doc.text(FOOTER_TEXT, w - 40, h - 60, { align: "right" });
}

function renderTOC(doc: jsPDF, payload: PdfPayload) {
  doc.addPage();
  let y = 80;
  y = drawHeading(doc, "Índice", y, "private");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND.ink);
  const items: string[] = [];
  items.push("1. Resumo Executivo");
  let idx = 2;
  if (payload.summary?.length) {
    items.push(`${idx}. Indicadores Consolidados`);
    idx++;
  }
  payload.sections.forEach((s) => {
    items.push(`${idx}. ${s.heading}`);
    idx++;
  });
  if (payload.insights?.length) {
    items.push(`${idx}. Insights da IA Financeira`);
    idx++;
  }
  if (payload.recommendations?.length) {
    items.push(`${idx}. Recomendações`);
    idx++;
  }
  if (payload.consolidatedPatrimony?.length) {
    items.push(`${idx}. Patrimônio Consolidado`);
  }
  items.forEach((it) => {
    doc.text(it, 40, y);
    y += 18;
  });
}

function renderSimpleHeader(doc: jsPDF, payload: PdfPayload): number {
  const w = doc.internal.pageSize.getWidth();
  // Title bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...BRAND.charcoal);
  doc.text(payload.title, 40, 60);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  doc.text(`Módulo: ${payload.module}`, 40, 76);
  doc.text(`Período: ${payload.period}`, 40, 90);
  doc.text(`Emitido em: ${nowStr()}`, w - 40, 76, { align: "right" });

  if (payload.filters?.length) {
    doc.text(`Filtros: ${payload.filters.join(" · ")}`, 40, 104);
  }

  doc.setDrawColor(...BRAND.emerald);
  doc.setLineWidth(1);
  doc.line(40, 114, w - 40, 114);
  return 132;
}

function renderPrivateHeader(doc: jsPDF, payload: PdfPayload, y: number): number {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  doc.text(`${payload.module.toUpperCase()} · ${payload.period}`, 40, 40);
  doc.text("PRIVATE", w - 40, 40, { align: "right" });
  doc.setDrawColor(...BRAND.line);
  doc.setLineWidth(0.3);
  doc.line(40, 48, w - 40, 48);
  return Math.max(y, 70);
}

export function generatePdf(payload: PdfPayload, kind: PdfKind) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const contentW = w - 80;

  if (kind === "private") {
    renderCover(doc, payload);
    renderTOC(doc, payload);
    doc.addPage();
    let y = renderPrivateHeader(doc, payload, 60);

    // Resumo executivo
    y = drawHeading(doc, "1. Resumo Executivo", y, "private");
    const exec =
      `Este relatório consolida a posição do módulo ${payload.module.toLowerCase()} referente a ${payload.period}. ` +
      (payload.filters?.length ? `Filtros aplicados: ${payload.filters.join(", ")}. ` : "") +
      `Os dados apresentados refletem o estado das contas, transações e indicadores na data de emissão. ` +
      `Recomenda-se a leitura integral do documento, com atenção especial às seções de insights e recomendações.`;
    y = drawParagraph(doc, exec, y, contentW);
    y += 6;

    // Indicators
    if (payload.summary?.length) {
      y = ensureSpace(doc, y, 80);
      y = drawHeading(doc, "Indicadores Consolidados", y, "private");
      y = drawKpis(doc, payload.summary, y, contentW);
    }

    // Sections
    payload.sections.forEach((s, i) => {
      y = ensureSpace(doc, y, 60);
      y = drawHeading(doc, `${i + 2}. ${s.heading}`, y, "private");
      if (s.kpis?.length) {
        y = drawKpis(doc, s.kpis, y, contentW);
      }
      s.paragraphs?.forEach((p) => {
        y = ensureSpace(doc, y, 40);
        y = drawParagraph(doc, p, y, contentW);
      });
      if (s.table) {
        y = ensureSpace(doc, y, 80);
        y = drawTable(doc, y, s.table, "private");
      }
    });

    // Insights
    if (payload.insights?.length) {
      y = ensureSpace(doc, y, 60);
      y = drawHeading(doc, "Insights da IA Financeira", y, "private");
      payload.insights.forEach((it) => {
        y = ensureSpace(doc, y, 40);
        y = drawParagraph(doc, `• ${it}`, y, contentW);
      });
    }

    // Recommendations
    if (payload.recommendations?.length) {
      y = ensureSpace(doc, y, 60);
      y = drawHeading(doc, "Recomendações", y, "private");
      payload.recommendations.forEach((it) => {
        y = ensureSpace(doc, y, 40);
        y = drawParagraph(doc, `→ ${it}`, y, contentW);
      });
    }

    // Patrimony
    if (payload.consolidatedPatrimony?.length) {
      y = ensureSpace(doc, y, 80);
      y = drawHeading(doc, "Patrimônio Consolidado", y, "private");
      y = drawKpis(doc, payload.consolidatedPatrimony, y, contentW);
    }
  } else {
    // SIMPLES
    let y = renderSimpleHeader(doc, payload);

    if (payload.summary?.length) {
      y = drawKpis(doc, payload.summary, y, contentW);
    }

    payload.sections.forEach((s) => {
      y = ensureSpace(doc, y, 60);
      y = drawHeading(doc, s.heading, y, "simples");
      s.paragraphs?.forEach((p) => {
        y = ensureSpace(doc, y, 40);
        y = drawParagraph(doc, p, y, contentW);
      });
      if (s.table) {
        y = ensureSpace(doc, y, 80);
        y = drawTable(doc, y, s.table, "simples");
      }
    });
  }

  addFooter(doc, kind);
  const fname = `${payload.module.toLowerCase().replace(/\s+/g, "-")}-${kind}-${Date.now()}.pdf`;
  doc.save(fname);
}

// ============ Module-specific payload builders ============

import {
  accounts,
  cards,
  transactions,
  recurring,
  goals,
  investments,
  upcomingBills,
  invoices,
  debts,
  fgtsAccounts,
  monthlyData,
  categoryData,
} from "./mock-data";

const sumTotalAccounts = () => accounts.reduce((a, b) => a + b.balance, 0);
const sumDebts = () => debts.reduce((a, b) => a + b.balance, 0);
const sumInvestments = () => investments.reduce((a, b) => a + b.amount, 0);

export function buildPayload(
  module: string,
  period: string,
  filters: string[] = [],
): PdfPayload {
  const base: Partial<PdfPayload> = { module, period, filters };

  switch (module) {
    case "Dashboard": {
      const income = monthlyData[monthlyData.length - 1].income;
      const expense = monthlyData[monthlyData.length - 1].expense;
      return {
        ...base,
        module,
        period,
        title: "Visão Geral Financeira",
        summary: [
          { label: "Patrimônio total", value: formatBRL(sumTotalAccounts() + sumInvestments()) },
          { label: "Entradas (mês)", value: formatBRL(income) },
          { label: "Saídas (mês)", value: formatBRL(expense) },
          { label: "Saldo do mês", value: formatBRL(income - expense) },
          { label: "Investimentos", value: formatBRL(sumInvestments()) },
          { label: "Dívidas", value: formatBRL(sumDebts()) },
        ],
        sections: [
          {
            heading: "Fluxo mensal",
            table: {
              columns: ["Mês", "Entradas", "Saídas", "Investido", "Saldo"],
              rows: monthlyData.map((m) => [
                m.month,
                formatBRL(m.income),
                formatBRL(m.expense),
                formatBRL(m.invested),
                formatBRL(m.income - m.expense),
              ]),
            },
          },
          {
            heading: "Despesas por categoria",
            table: {
              columns: ["Categoria", "Valor"],
              rows: categoryData.map((c) => [c.name, formatBRL(c.value)]),
              totals: ["TOTAL", formatBRL(categoryData.reduce((a, b) => a + b.value, 0))],
            },
          },
        ],
        insights: [
          "Despesas recuaram 7,6% versus março, com economia em lazer e alimentação.",
          "Índice de poupança em 43,5%, acima do benchmark recomendado de 30%.",
          "Concentração de despesa em Moradia (43%) — dentro do esperado para o perfil.",
        ],
        recommendations: [
          "Realocar excedente de reserva para Tesouro IPCA+ 2035.",
          "Antecipar parcelas do cartão rotativo (CET 410%) para zerar em 60 dias.",
          "Aumentar aporte mensal em FIIs em R$ 800 mantendo perfil moderado.",
        ],
        consolidatedPatrimony: [
          { label: "Contas correntes", value: formatBRL(accounts.filter((a) => a.type !== "Investimentos").reduce((s, a) => s + a.balance, 0)) },
          { label: "Investimentos", value: formatBRL(sumInvestments()) },
          { label: "FGTS", value: formatBRL(fgtsAccounts.reduce((s, a) => s + a.balance, 0)) },
          { label: "Dívidas (-)", value: `- ${formatBRL(sumDebts())}` },
          { label: "Patrimônio líquido", value: formatBRL(sumTotalAccounts() + sumInvestments() + fgtsAccounts.reduce((s, a) => s + a.balance, 0) - sumDebts()) },
        ],
      };
    }
    case "Financeiro":
      return {
        ...base,
        module,
        period,
        title: "Relatório Financeiro",
        summary: [
          { label: "Total em contas", value: formatBRL(sumTotalAccounts()) },
          { label: "Contas ativas", value: String(accounts.length) },
        ],
        sections: [
          {
            heading: "Contas bancárias",
            table: {
              columns: ["Banco", "Tipo", "Saldo"],
              rows: accounts.map((a) => [a.bank, a.type, formatBRL(a.balance)]),
              totals: ["TOTAL", "", formatBRL(sumTotalAccounts())],
            },
          },
        ],
        insights: ["BTG Pactual concentra 53% do total — diversificação adequada para wealth management."],
        recommendations: ["Manter reserva de emergência em conta de alta liquidez."],
      };
    case "Cartões":
      return {
        ...base,
        module,
        period,
        title: "Relatório de Cartões",
        summary: [
          { label: "Limite total", value: formatBRL(cards.reduce((a, c) => a + c.limit, 0)) },
          { label: "Utilizado", value: formatBRL(cards.reduce((a, c) => a + c.used, 0)) },
          { label: "Disponível", value: formatBRL(cards.reduce((a, c) => a + (c.limit - c.used), 0)) },
        ],
        sections: [
          {
            heading: "Cartões cadastrados",
            table: {
              columns: ["Cartão", "Bandeira", "Limite", "Usado", "Disponível", "Vencto."],
              rows: cards.map((c) => [
                c.name,
                c.brand,
                formatBRL(c.limit),
                formatBRL(c.used),
                formatBRL(c.limit - c.used),
                `Dia ${c.dueDay}`,
              ]),
            },
          },
        ],
        insights: ["Utilização média do limite em 22% — saudável."],
        recommendations: ["Manter utilização abaixo de 30% do limite agregado."],
      };
    case "Faturas":
      return {
        ...base,
        module,
        period,
        title: "Relatório de Faturas",
        summary: [
          { label: "Em aberto", value: formatBRL(invoices.filter((i) => i.status === "open").reduce((a, b) => a + b.amount, 0)) },
          { label: "Pagas", value: formatBRL(invoices.filter((i) => i.status === "paid").reduce((a, b) => a + b.amount, 0)) },
        ],
        sections: [
          {
            heading: "Faturas",
            table: {
              columns: ["Cartão", "Mês", "Vencimento", "Itens", "Valor", "Status"],
              rows: invoices.map((i) => [i.card, i.month, i.dueDate, i.items, formatBRL(i.amount), i.status === "open" ? "Em aberto" : "Paga"]),
            },
          },
        ],
        insights: ["Fatura Itaú Personnalité concentra 56% do total em aberto."],
        recommendations: ["Programar débito automático para evitar juros rotativos."],
      };
    case "Extratos":
      return {
        ...base,
        module,
        period,
        title: "Extrato Consolidado",
        summary: [
          { label: "Entradas", value: formatBRL(transactions.filter((t) => t.amount > 0).reduce((a, b) => a + b.amount, 0)) },
          { label: "Saídas", value: formatBRL(transactions.filter((t) => t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0)) },
          { label: "Lançamentos", value: String(transactions.length) },
        ],
        sections: [
          {
            heading: "Lançamentos",
            table: {
              columns: ["Data", "Descrição", "Categoria", "Conta", "Valor"],
              rows: transactions.map((t) => [
                new Date(t.date).toLocaleDateString("pt-BR"),
                t.description,
                t.category,
                t.account,
                formatBRL(t.amount),
              ]),
            },
          },
        ],
        insights: ["Maior despesa: Aluguel (R$ 4.200). Receita principal: Salário (R$ 18.500)."],
        recommendations: ["Categorizar lançamentos pendentes para análise mais precisa."],
      };
    case "Recorrentes":
      return {
        ...base,
        module,
        period,
        title: "Contas Recorrentes",
        summary: [
          { label: "Total mensal", value: formatBRL(recurring.reduce((a, b) => a + b.amount, 0)) },
          { label: "Itens ativos", value: String(recurring.filter((r) => r.status === "active").length) },
        ],
        sections: [
          {
            heading: "Assinaturas e contas fixas",
            table: {
              columns: ["Nome", "Categoria", "Vencimento", "Valor"],
              rows: recurring.map((r) => [r.name, r.category, `Dia ${r.dueDay}`, formatBRL(r.amount)]),
              totals: ["TOTAL", "", "", formatBRL(recurring.reduce((a, b) => a + b.amount, 0))],
            },
          },
          {
            heading: "Próximos vencimentos",
            table: {
              columns: ["Conta", "Vencimento", "Valor"],
              rows: upcomingBills.map((b) => [b.name, b.dueDate, formatBRL(b.amount)]),
            },
          },
        ],
        insights: ["Assinaturas representam 4% das contas fixas — margem para corte."],
        recommendations: ["Avaliar consolidação de planos de streaming."],
      };
    case "Empréstimos & Dívidas":
      return {
        ...base,
        module,
        period,
        title: "Empréstimos & Dívidas",
        summary: [
          { label: "Saldo devedor total", value: formatBRL(sumDebts()) },
          { label: "Parcela mensal", value: formatBRL(debts.reduce((a, b) => a + b.monthly, 0)) },
          { label: "Contratos ativos", value: String(debts.length) },
        ],
        sections: [
          {
            heading: "Contratos",
            table: {
              columns: ["Instituição", "Tipo", "Saldo", "Taxa a.a.", "CET", "Parcela", "Restantes"],
              rows: debts.map((d) => [
                d.institution,
                d.type,
                formatBRL(d.balance),
                `${d.rate}%`,
                `${d.cet}%`,
                formatBRL(d.monthly),
                d.remaining,
              ]),
              totals: ["TOTAL", "", formatBRL(sumDebts()), "", "", formatBRL(debts.reduce((a, b) => a + b.monthly, 0)), ""],
            },
          },
        ],
        insights: [
          "Cartão Rotativo Nubank apresenta CET de 410% — prioridade absoluta de quitação.",
          "Financiamento imóvel responde por 80% da dívida total, com taxa competitiva (9,8%).",
        ],
        recommendations: [
          "Quitar imediatamente o rotativo (R$ 9.450) usando reserva excedente.",
          "Avaliar portabilidade do empréstimo pessoal BTG (CET 28%).",
        ],
      };
    case "FGTS":
      return {
        ...base,
        module,
        period,
        title: "Relatório de FGTS",
        summary: [
          { label: "Saldo total", value: formatBRL(fgtsAccounts.reduce((a, b) => a + b.balance, 0)) },
          { label: "Contas", value: String(fgtsAccounts.length) },
          { label: "JAM (mês)", value: formatBRL(fgtsAccounts.reduce((a, b) => a + b.jam, 0)) },
        ],
        sections: [
          {
            heading: "Contas vinculadas",
            table: {
              columns: ["Empregador", "CNPJ", "Status", "Saldo", "Depósito mensal", "Última atualização"],
              rows: fgtsAccounts.map((f) => [
                f.employer,
                f.cnpj,
                f.status,
                formatBRL(f.balance),
                formatBRL(f.monthlyDeposit),
                new Date(f.lastUpdate).toLocaleDateString("pt-BR"),
              ]),
              totals: ["TOTAL", "", "", formatBRL(fgtsAccounts.reduce((a, b) => a + b.balance, 0)), "", ""],
            },
          },
        ],
        insights: ["Conta Banco Beta sem atualização há mais de 18 meses — verificar com a Caixa."],
        recommendations: ["Avaliar saque-aniversário se a estratégia for liquidez no curto prazo."],
      };
    case "Metas":
      return {
        ...base,
        module,
        period,
        title: "Metas Financeiras",
        summary: [
          { label: "Total objetivado", value: formatBRL(goals.reduce((a, b) => a + b.target, 0)) },
          { label: "Acumulado", value: formatBRL(goals.reduce((a, b) => a + b.current, 0)) },
        ],
        sections: [
          {
            heading: "Acompanhamento",
            table: {
              columns: ["Meta", "Objetivo", "Acumulado", "% Concluído", "Prazo"],
              rows: goals.map((g) => [
                g.name,
                formatBRL(g.target),
                formatBRL(g.current),
                `${Math.round((g.current / g.target) * 100)}%`,
                g.deadline,
              ]),
            },
          },
        ],
        insights: ["Reserva de emergência em 78% — projeção de conclusão antecipada."],
        recommendations: ["Redirecionar 20% do aporte para Entrada Apartamento (atual: 38%)."],
      };
    case "Investimentos":
      return {
        ...base,
        module,
        period,
        title: "Carteira de Investimentos",
        summary: [
          { label: "Patrimônio investido", value: formatBRL(sumInvestments()) },
          { label: "Retorno médio", value: `${(investments.reduce((a, b) => a + b.return, 0) / investments.length).toFixed(1)}%` },
          { label: "Ativos", value: String(investments.length) },
        ],
        sections: [
          {
            heading: "Alocação",
            table: {
              columns: ["Ativo", "Classe", "Valor", "Retorno", "Alocação"],
              rows: investments.map((i) => [i.name, i.type, formatBRL(i.amount), `${i.return}%`, `${i.allocation}%`]),
              totals: ["TOTAL", "", formatBRL(sumInvestments()), "", "100%"],
            },
          },
        ],
        insights: [
          "54% em renda fixa — perfil conservador-moderado adequado ao ciclo atual.",
          "Bitcoin gerou +32,5% no período, mas mantém peso baixo (5%) — risco controlado.",
        ],
        recommendations: [
          "Aumentar exposição em FIIs de logística aproveitando spread atual.",
          "Considerar 5% em renda fixa global (USD) para hedge cambial.",
        ],
      };
    case "Relatórios":
    default: {
      const income = monthlyData[monthlyData.length - 1].income;
      const expense = monthlyData[monthlyData.length - 1].expense;
      return {
        ...base,
        module: module || "Relatórios",
        period,
        title: "Relatório Financeiro Mensal",
        summary: [
          { label: "Receita", value: formatBRL(income) },
          { label: "Despesa", value: formatBRL(expense) },
          { label: "Saldo", value: formatBRL(income - expense) },
        ],
        sections: [
          {
            heading: "Entradas vs Saídas (6 meses)",
            table: {
              columns: ["Mês", "Entradas", "Saídas", "Saldo"],
              rows: monthlyData.map((m) => [m.month, formatBRL(m.income), formatBRL(m.expense), formatBRL(m.income - m.expense)]),
            },
          },
          {
            heading: "Categorias",
            table: {
              columns: ["Categoria", "Valor"],
              rows: categoryData.map((c) => [c.name, formatBRL(c.value)]),
            },
          },
        ],
        insights: ["Despesas em queda de 7,6% MoM. Poupança em 43,5% da receita."],
        recommendations: ["Manter ritmo atual de aportes; reavaliar assinaturas de baixo uso."],
      };
    }
  }
}
