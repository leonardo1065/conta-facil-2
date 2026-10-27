import { Input } from "@/components/ui/input";
import { formatValorBR, parseValorBR } from "@/lib/money";

/** Campo de valor que aceita vírgula como decimal e formata 0,00 ao sair. */
export function MoneyInput({
  id,
  value,
  onChange,
  onKeyDown,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      placeholder="0,00"
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        const numero = parseValorBR(value);
        if (Number.isFinite(numero)) onChange(formatValorBR(numero));
      }}
    />
  );
}
