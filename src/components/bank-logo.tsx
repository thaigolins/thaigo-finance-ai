import { useState } from "react";

type Props = {
  name: string;
  logo?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
};

export function BankLogo({ name, logo, color, size = 40, className }: Props) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "?").slice(0, 2).toUpperCase();
  const safeColor = color || "#6B7280";

  if (logo && !imgError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-xl bg-white flex items-center justify-center border border-border/20 overflow-hidden p-1 ${className ?? ""}`}
      >
        <img
          src={logo}
          alt={name}
          style={{ width: size - 8, height: size - 8, objectFit: "contain" }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: safeColor + "20",
        border: `2px solid ${safeColor}40`,
      }}
      className={`rounded-xl flex items-center justify-center ${className ?? ""}`}
    >
      <span style={{ color: safeColor, fontSize: size * 0.3 }} className="font-bold">
        {initial}
      </span>
    </div>
  );
}
