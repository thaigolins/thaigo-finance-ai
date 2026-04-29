export const accounts = [
  { id: "1", bank: "Nubank", type: "Conta Corrente", balance: 12450.32, color: "#8a05be" },
  { id: "2", bank: "Itaú", type: "Conta Corrente", balance: 28900.0, color: "#ec7000" },
  { id: "3", bank: "BTG Pactual", type: "Investimentos", balance: 154200.5, color: "#001E50" },
  { id: "4", bank: "Inter", type: "Poupança", balance: 8200.15, color: "#ff7a00" },
];

export const cards = [
  { id: "1", name: "Nubank Ultravioleta", brand: "Mastercard Black", limit: 25000, used: 8430.22, dueDay: 10, closingDay: 3, variant: "graphite" as const },
  { id: "2", name: "Itaú Personnalité Black", brand: "Visa Infinite", limit: 40000, used: 15200.5, dueDay: 15, closingDay: 8, variant: "obsidian" as const },
  { id: "3", name: "BTG Black", brand: "Mastercard Black", limit: 60000, used: 4220.0, dueDay: 20, closingDay: 13, variant: "emerald" as const },
];

export const transactions = [
  { id: "1", date: "2026-04-28", description: "iFood — Almoço", category: "Alimentação", amount: -68.9, account: "Nubank Ultravioleta" },
  { id: "2", date: "2026-04-28", description: "Salário Abril", category: "Receita", amount: 18500.0, account: "Itaú" },
  { id: "3", date: "2026-04-27", description: "Uber", category: "Transporte", amount: -32.5, account: "Nubank" },
  { id: "4", date: "2026-04-27", description: "Spotify Family", category: "Assinaturas", amount: -34.9, account: "Itaú" },
  { id: "5", date: "2026-04-26", description: "Aporte CDB BTG", category: "Investimentos", amount: -5000.0, account: "BTG Pactual" },
  { id: "6", date: "2026-04-26", description: "Amazon — Livros", category: "Lazer", amount: -187.4, account: "Itaú Black" },
  { id: "7", date: "2026-04-25", description: "Restaurante Fasano", category: "Alimentação", amount: -420.0, account: "Itaú Black" },
  { id: "8", date: "2026-04-24", description: "Aluguel Apto", category: "Moradia", amount: -4200.0, account: "Itaú" },
  { id: "9", date: "2026-04-23", description: "Dividendos ITSA4", category: "Receita", amount: 312.45, account: "BTG Pactual" },
  { id: "10", date: "2026-04-22", description: "Academia Smart Fit", category: "Saúde", amount: -119.9, account: "Nubank" },
];

export const recurring = [
  { id: "1", name: "Aluguel", amount: 4200, dueDay: 5, category: "Moradia", status: "active" },
  { id: "2", name: "Internet Vivo Fibra", amount: 199.9, dueDay: 8, category: "Casa", status: "active" },
  { id: "3", name: "Energia Enel", amount: 380, dueDay: 12, category: "Casa", status: "active" },
  { id: "4", name: "Plano Saúde Bradesco", amount: 1280, dueDay: 15, category: "Saúde", status: "active" },
  { id: "5", name: "Spotify Family", amount: 34.9, dueDay: 20, category: "Assinaturas", status: "active" },
  { id: "6", name: "Netflix Premium", amount: 55.9, dueDay: 22, category: "Assinaturas", status: "active" },
  { id: "7", name: "Academia", amount: 119.9, dueDay: 25, category: "Saúde", status: "active" },
];

export const goals = [
  { id: "1", name: "Reserva de Emergência", target: 80000, current: 62400, deadline: "Dez/2026", icon: "shield" },
  { id: "2", name: "Viagem Japão", target: 35000, current: 18200, deadline: "Out/2026", icon: "plane" },
  { id: "3", name: "Entrada Apartamento", target: 250000, current: 95000, deadline: "Jun/2027", icon: "home" },
  { id: "4", name: "Carro Novo", target: 180000, current: 42000, deadline: "Mar/2027", icon: "car" },
];

export const investments = [
  { id: "1", name: "Tesouro IPCA+ 2035", type: "Renda Fixa", amount: 45000, return: 12.4, allocation: 29 },
  { id: "2", name: "CDB BTG 110% CDI", type: "Renda Fixa", amount: 38000, return: 11.8, allocation: 25 },
  { id: "3", name: "ITSA4", type: "Ações", amount: 22500, return: 18.2, allocation: 15 },
  { id: "4", name: "BOVA11", type: "ETF", amount: 18700, return: 9.5, allocation: 12 },
  { id: "5", name: "FIIs (HGLG11, KNRI11)", type: "FIIs", amount: 21000, return: 14.1, allocation: 14 },
  { id: "6", name: "Bitcoin", type: "Cripto", amount: 9000, return: 32.5, allocation: 5 },
];

export const monthlyData = [
  { month: "Nov", income: 18500, expense: 11200, invested: 4500 },
  { month: "Dez", income: 22000, expense: 14800, invested: 5200 },
  { month: "Jan", income: 18500, expense: 10900, invested: 5000 },
  { month: "Fev", income: 18500, expense: 12100, invested: 4800 },
  { month: "Mar", income: 19200, expense: 11500, invested: 5500 },
  { month: "Abr", income: 18812, expense: 10620, invested: 5000 },
];

export const categoryData = [
  { name: "Moradia", value: 4580, color: "oklch(0.68 0.11 158)" },
  { name: "Alimentação", value: 1820, color: "oklch(0.65 0.08 210)" },
  { name: "Transporte", value: 680, color: "oklch(0.72 0.10 240)" },
  { name: "Lazer", value: 920, color: "oklch(0.76 0.10 85)" },
  { name: "Saúde", value: 1399, color: "oklch(0.62 0.14 25)" },
  { name: "Assinaturas", value: 220, color: "oklch(0.55 0.04 200)" },
];

export const upcomingBills = [
  { id: "1", name: "Fatura Nubank Ultravioleta", amount: 8430.22, dueDate: "10/Mai", status: "pending" },
  { id: "2", name: "Fatura Itaú Personnalité", amount: 15200.5, dueDate: "15/Mai", status: "pending" },
  { id: "3", name: "Aluguel Apto", amount: 4200, dueDate: "05/Mai", status: "pending" },
  { id: "4", name: "Plano Saúde", amount: 1280, dueDate: "15/Mai", status: "pending" },
  { id: "5", name: "Energia Enel", amount: 380, dueDate: "12/Mai", status: "pending" },
];

export const invoices = [
  { id: "1", card: "Nubank Ultravioleta", month: "Abril/2026", amount: 8430.22, status: "open", dueDate: "10/05/2026", items: 24 },
  { id: "2", card: "Itaú Personnalité Black", month: "Abril/2026", amount: 15200.5, status: "open", dueDate: "15/05/2026", items: 41 },
  { id: "3", card: "BTG Black", month: "Abril/2026", amount: 4220.0, status: "open", dueDate: "20/05/2026", items: 12 },
  { id: "4", card: "Nubank Ultravioleta", month: "Março/2026", amount: 7120.8, status: "paid", dueDate: "10/04/2026", items: 22 },
  { id: "5", card: "Itaú Personnalité Black", month: "Março/2026", amount: 13900.0, status: "paid", dueDate: "15/04/2026", items: 38 },
];

export const debts = [
  { id: "1", institution: "Itaú", type: "Financiamento Imóvel", originalAmount: 420000, balance: 312400, rate: 9.8, cet: 10.6, installments: 360, paid: 72, remaining: 288, monthly: 3850.4, dueDay: 10, status: "em dia", collateral: "Imóvel Apto 142" },
  { id: "2", institution: "BTG Pactual", type: "Empréstimo Pessoal", originalAmount: 60000, balance: 38200, rate: 2.1, cet: 28.4, installments: 36, paid: 14, remaining: 22, monthly: 2180.5, dueDay: 15, status: "em dia", collateral: null },
  { id: "3", institution: "Santander", type: "Veículo", originalAmount: 95000, balance: 41800, rate: 1.65, cet: 22.1, installments: 48, paid: 28, remaining: 20, monthly: 2620.9, dueDay: 8, status: "em dia", collateral: "Veículo HRV 2023" },
  { id: "4", institution: "Nubank", type: "Cartão Rotativo", originalAmount: 12000, balance: 9450.3, rate: 14.5, cet: 410.2, installments: 12, paid: 2, remaining: 10, monthly: 1180.6, dueDay: 10, status: "atrasado", collateral: null },
  { id: "5", institution: "Caixa", type: "Consignado", originalAmount: 40000, balance: 18900, rate: 1.45, cet: 19.8, installments: 60, paid: 32, remaining: 28, monthly: 980.0, dueDay: 5, status: "em dia", collateral: null },
  { id: "6", institution: "Bradesco", type: "Renegociação", originalAmount: 28000, balance: 14200, rate: 2.8, cet: 38.6, installments: 24, paid: 12, remaining: 12, monthly: 1380.0, dueDay: 20, status: "renegociado", collateral: null },
];

export const fgtsAccounts = [
  { id: "1", employer: "Tech Holding S.A.", cnpj: "12.345.678/0001-90", status: "ativa", balance: 48230.5, lastUpdate: "2026-04-15", monthlyDeposit: 1480.0, withdrawals: 0, jam: 312.4 },
  { id: "2", employer: "Consultoria Prima Ltda.", cnpj: "98.765.432/0001-10", status: "inativa", balance: 18920.8, lastUpdate: "2025-11-20", monthlyDeposit: 0, withdrawals: 4200, jam: 142.8 },
  { id: "3", employer: "Banco Beta S.A.", cnpj: "55.444.333/0001-22", status: "inativa", balance: 9420.15, lastUpdate: "2024-08-10", monthlyDeposit: 0, withdrawals: 0, jam: 84.2 },
];

export const fgtsHistory = [
  { month: "Nov", balance: 68200 },
  { month: "Dez", balance: 70100 },
  { month: "Jan", balance: 71800 },
  { month: "Fev", balance: 73400 },
  { month: "Mar", balance: 75100 },
  { month: "Abr", balance: 76571 },
];
