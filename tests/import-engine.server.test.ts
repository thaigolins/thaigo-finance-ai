import { describe, expect, it } from "vitest";
import { parseExtratoFromText } from "../src/server/import-engine.server";

describe("parseExtratoFromText", () => {
  it("extrai 8 lançamentos do OCR mobile brasileiro", () => {
    const ocrText = `Sex, 24 de abr - 2026
Pix Qr Estatico Pago
Ednaldo da Conceicao Moraes
-R$ 10,00
Pix Enviado
Thaigo Lins Paiva da Silva
-R$ 34.526,00
Qui, 23 de abr - 2026
Pix Qr Dinamico Pago
Rosinalda Pereira de Sa
-R$ 7,50
Pix Qr Estatico Pago
Ednaldo da Conceicao Moraes
-R$ 10,00
Pix Qr Estatico Pago
Danilo Mendes Mendonca
-R$ 130,00
Pix Enviado
Felipe Augusto Rocha Borges
-R$ 80,00
Proventos
R$ 5.289,65
Ordem de Crédito
R$ 1.394,28`;

    const txs = parseExtratoFromText(ocrText);

    expect(txs).toHaveLength(8);
    expect(txs).toEqual([
      expect.objectContaining({ occurred_at: "2026-04-24", kind: "expense", description: "Pix Qr Estatico Pago Ednaldo da Conceicao Moraes", amount: 10 }),
      expect.objectContaining({ occurred_at: "2026-04-24", kind: "expense", description: "Pix Enviado Thaigo Lins Paiva da Silva", amount: 34526 }),
      expect.objectContaining({ occurred_at: "2026-04-23", kind: "expense", description: "Pix Qr Dinamico Pago Rosinalda Pereira de Sa", amount: 7.5 }),
      expect.objectContaining({ occurred_at: "2026-04-23", kind: "expense", description: "Pix Qr Estatico Pago Ednaldo da Conceicao Moraes", amount: 10 }),
      expect.objectContaining({ occurred_at: "2026-04-23", kind: "expense", description: "Pix Qr Estatico Pago Danilo Mendes Mendonca", amount: 130 }),
      expect.objectContaining({ occurred_at: "2026-04-23", kind: "expense", description: "Pix Enviado Felipe Augusto Rocha Borges", amount: 80 }),
      expect.objectContaining({ occurred_at: "2026-04-23", kind: "income", description: "Proventos", amount: 5289.65 }),
      expect.objectContaining({ occurred_at: "2026-04-23", kind: "income", description: "Ordem de Crédito", amount: 1394.28 }),
    ]);
  });
});