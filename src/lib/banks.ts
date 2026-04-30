export type BankDef = {
  name: string;
  code: string;
  color: string;
  logo: string | null;
};

export const BANKS: BankDef[] = [
  { name: "Nubank", code: "260", color: "#820AD1", logo: null },
  { name: "Itaú", code: "341", color: "#FF6600", logo: null },
  { name: "Bradesco", code: "237", color: "#CC092F", logo: null },
  { name: "Banco do Brasil", code: "001", color: "#FFCC00", logo: null },
  { name: "Caixa Econômica", code: "104", color: "#005CA9", logo: null },
  { name: "Santander", code: "033", color: "#EC0000", logo: null },
  { name: "Inter", code: "077", color: "#FF6B00", logo: null },
  { name: "C6 Bank", code: "336", color: "#3D3D3D", logo: null },
  { name: "BTG Pactual", code: "208", color: "#C9A84C", logo: null },
  { name: "XP", code: "102", color: "#1A1A1A", logo: null },
  { name: "Sicoob", code: "756", color: "#007A3D", logo: null },
  { name: "Sicredi", code: "748", color: "#5FA110", logo: null },
  { name: "Safra", code: "422", color: "#1A1B4B", logo: null },
  { name: "Mercado Pago", code: "323", color: "#009EE3", logo: null },
  { name: "PicPay", code: "380", color: "#21C25E", logo: null },
  { name: "Neon", code: "536", color: "#00C4D4", logo: null },
  { name: "Banco Original", code: "212", color: "#00A859", logo: null },
  { name: "Pagseguro", code: "290", color: "#00B140", logo: null },
  { name: "Outro", code: "000", color: "#6B7280", logo: null },
];

export function findBank(name?: string | null): BankDef | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().trim();
  return (
    BANKS.find((b) => b.name.toLowerCase() === n) ??
    BANKS.find((b) => n.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(n))
  );
}
