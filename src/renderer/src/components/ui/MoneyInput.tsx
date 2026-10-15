import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { isMoneyInputValid } from "@/lib/money";

interface MoneyInputProps extends ComponentProps<typeof Input> {
  onValueChange: (value: string) => void;
}

export function MoneyInput({ value, onValueChange, ...props }: MoneyInputProps) {
  return (
    <Input
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (isMoneyInputValid(next)) {
          onValueChange(next);
        }
      }}
      {...props}
    />
  );
}