export type FgtsEntry = {
  occurred_at: string;
  entry_type: "deposito" | "jam" | "saque" | "outro";
  amount: number;
  notes: string;
};

export function parseFgtsEntries(text: string): FgtsEntry[] {
  const entries: FgtsEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    const dateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(.*)/);
    if (!dateMatch) continue;

    const [, dd, mm, yyyy, rest] = dateMatch;
    const occurred_at = `${yyyy}-${mm}-${dd}`;

    const amounts = rest.match(/(-?\s*R?\$?\s*\d{1,3}(?:\.\d{3})*,\d{2})/g);
    if (!amounts || amounts.length === 0) continue;

    const valStr = amounts[0]
      .replace(/R\$\s*/g, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const amount = Math.abs(parseFloat(valStr));
    if (!isFinite(amount) || amount === 0) continue;

    const firstAmountIdx = rest.indexOf(amounts[0]);
    const desc = rest.slice(0, firstAmountIdx).trim().toUpperCase();

    if (!desc || desc.length < 3) continue;
    if (desc.includes("DATA") || desc.includes("LANÇAMENTO") || desc.includes("SALDO ANTERIOR")) continue;

    const descLower = desc.toLowerCase();
    let entry_type: FgtsEntry["entry_type"] = "outro";

    if (descLower.includes("115-deposito") || descLower.includes("deposito")) {
      entry_type = "deposito";
    } else if (
      descLower.includes("credito de jam") ||
      descLower.includes("ac cred dist") ||
      descLower.includes("ac aut jam") ||
      descLower.includes("ac reposicao") ||
      descLower.includes("regularizacao credito") ||
      descLower.includes("jam")
    ) {
      entry_type = "jam";
    } else if (descLower.includes("saque")) {
      entry_type = "saque";
    }

    entries.push({ occurred_at, entry_type, amount, notes: desc.slice(0, 200) });
  }

  console.log("[fgts-parser] parsed", entries.length, "entries");
  return entries;
}
