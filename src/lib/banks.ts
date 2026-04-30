export type BankDef = {
  name: string;
  code: string;
  color: string;
  logo: string | null;
};

export const BANKS: BankDef[] = [
  { name: "Nubank", code: "260", color: "#820AD1", logo: "https://logo.clearbit.com/nubank.com.br" },
  { name: "Itaú", code: "341", color: "#FF6600", logo: "https://logo.clearbit.com/itau.com.br" },
  { name: "Bradesco", code: "237", color: "#CC092F", logo: "https://logo.clearbit.com/bradesco.com.br" },
  { name: "Banco do Brasil", code: "001", color: "#FFCC00", logo: "https://logo.clearbit.com/bb.com.br" },
  { name: "Caixa Econômica", code: "104", color: "#005CA9", logo: "https://logo.clearbit.com/caixa.gov.br" },
  { name: "Santander", code: "033", color: "#EC0000", logo: "https://logo.clearbit.com/santander.com.br" },
  { name: "Inter", code: "077", color: "#FF6B00", logo: "https://logo.clearbit.com/inter.co" },
  { name: "C6 Bank", code: "336", color: "#242424", logo: "https://logo.clearbit.com/c6bank.com.br" },
  { name: "BTG Pactual", code: "208", color: "#1A1A2E", logo: "https://logo.clearbit.com/btgpactual.com" },
  { name: "XP", code: "102", color: "#000000", logo: "https://logo.clearbit.com/xp.com.br" },
  { name: "Sicoob", code: "756", color: "#007A3D", logo: "https://logo.clearbit.com/sicoob.com.br" },
  { name: "Sicredi", code: "748", color: "#5FA110", logo: "https://logo.clearbit.com/sicredi.com.br" },
  { name: "Safra", code: "422", color: "#1A1B4B", logo: "https://logo.clearbit.com/safra.com.br" },
  { name: "Mercado Pago", code: "323", color: "#009EE3", logo: "https://logo.clearbit.com/mercadopago.com.br" },
  { name: "PicPay", code: "380", color: "#21C25E", logo: "https://logo.clearbit.com/picpay.com" },
  { name: "Neon", code: "536", color: "#00D4FF", logo: "https://logo.clearbit.com/neon.com.br" },
  { name: "Banco Original", code: "212", color: "#00A859", logo: "https://logo.clearbit.com/original.com.br" },
  { name: "Pagseguro", code: "290", color: "#00B140", logo: "https://logo.clearbit.com/pagseguro.com.br" },
  { name: "Outro", code: "000", color: "#6B7280", logo: null },
];

export function findBank(name: string | null | undefined): BankDef | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().trim();
  return BANKS.find((b) => b.name.toLowerCase() === n)
    ?? BANKS.find((b) => n.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(n));
}
