const BANK_INITIALS: Record<string, string> = {
  "nubank": "NU",
  "itaú": "IT",
  "itau": "IT",
  "bradesco": "BR",
  "banco do brasil": "BB",
  "caixa econômica": "CE",
  "caixa": "CX",
  "santander": "SA",
  "inter": "IN",
  "c6 bank": "C6",
  "btg pactual": "BT",
  "btg": "BT",
  "xp": "XP",
  "sicoob": "SC",
  "sicredi": "SR",
  "safra": "SF",
  "mercado pago": "MP",
  "picpay": "PP",
  "neon": "NE",
  "banco original": "OR",
  "pagseguro": "PS",
};

function getInitials(name: string): string {
  const key = name.toLowerCase().trim();
  if (BANK_INITIALS[key]) return BANK_INITIALS[key];
  const words = name.trim().split(" ");
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function BankLogo({
  name,
  color,
  size = 40,
  className,
}: {
  name: string;
  logo?: string | null;
  color: string;
  size?: number;
  className?: string;
}) {
  const initials = getInitials(name);
  const fontSize = size <= 32 ? size * 0.35 : size * 0.3;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        backgroundColor: color + "25",
        border: `2px solid ${color}60`,
        borderRadius: size * 0.25,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: color,
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        {initials}
      </span>
    </div>
  );
}
