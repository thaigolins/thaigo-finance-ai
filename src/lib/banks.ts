export type BankDef = {
  name: string;
  code: string;
  color: string;
  logo: string | null;
};

export const BANKS: BankDef[] = [
  { name: "Nubank", code: "260", color: "#820AD1", logo: "https://cdn.worldvectorlogo.com/logos/nubank.svg" },
  { name: "Itaú", code: "341", color: "#FF6600", logo: "https://cdn.worldvectorlogo.com/logos/itau-1.svg" },
  { name: "Bradesco", code: "237", color: "#CC092F", logo: "https://cdn.worldvectorlogo.com/logos/bradesco.svg" },
  { name: "Banco do Brasil", code: "001", color: "#FFCC00", logo: "https://cdn.worldvectorlogo.com/logos/banco-do-brasil.svg" },
  { name: "Caixa Econômica", code: "104", color: "#005CA9", logo: "https://cdn.worldvectorlogo.com/logos/caixa-economica-federal.svg" },
  { name: "Santander", code: "033", color: "#EC0000", logo: "https://cdn.worldvectorlogo.com/logos/santander.svg" },
  { name: "Inter", code: "077", color: "#FF6B00", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Banco_inter_logo.svg/1200px-Banco_inter_logo.svg.png" },
  { name: "C6 Bank", code: "336", color: "#242424", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/C6_Bank_logo.svg/1200px-C6_Bank_logo.svg.png" },
  { name: "BTG Pactual", code: "208", color: "#C9A84C", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/BTG_Pactual_logo.svg/1200px-BTG_Pactual_logo.svg.png" },
  { name: "XP", code: "102", color: "#000000", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/XP_Investimentos_logo.svg/1200px-XP_Investimentos_logo.svg.png" },
  { name: "Sicoob", code: "756", color: "#007A3D", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Sicoob_logo.svg/1200px-Sicoob_logo.svg.png" },
  { name: "Sicredi", code: "748", color: "#5FA110", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Sicredi_logo.svg/1200px-Sicredi_logo.svg.png" },
  { name: "Safra", code: "422", color: "#1A1B4B", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Banco_Safra_logo.svg/1200px-Banco_Safra_logo.svg.png" },
  { name: "Mercado Pago", code: "323", color: "#009EE3", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/MercadoPago_logo.svg/1200px-MercadoPago_logo.svg.png" },
  { name: "PicPay", code: "380", color: "#21C25E", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/PicPay_logo.svg/1200px-PicPay_logo.svg.png" },
  { name: "Neon", code: "536", color: "#00D4FF", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Neon_bank_logo.svg/1200px-Neon_bank_logo.svg.png" },
  { name: "Banco Original", code: "212", color: "#00A859", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Banco_Original_logo.svg/1200px-Banco_Original_logo.svg.png" },
  { name: "Pagseguro", code: "290", color: "#00B140", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/PagSeguro_logo.svg/1200px-PagSeguro_logo.svg.png" },
  { name: "Outro", code: "000", color: "#6B7280", logo: null },
];

export function findBank(name: string | null | undefined): BankDef | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().trim();
  return BANKS.find((b) => b.name.toLowerCase() === n)
    ?? BANKS.find((b) => n.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(n));
}
