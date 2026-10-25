import React from 'react';
import { formatMinorUnits } from '@recoverflow/core';

interface MoneyProps {
  amountMinor: bigint | number | string;
  currency?: string;
  className?: string;
  showSign?: boolean;
}

export const Money: React.FC<MoneyProps> = ({
  amountMinor,
  currency = 'INR',
  className = '',
  showSign = false,
}) => {
  const minor = typeof amountMinor === 'string' ? BigInt(amountMinor) : (typeof amountMinor === 'number' ? BigInt(amountMinor) : amountMinor);
  const isNegative = minor < 0n;
  const absMinor = isNegative ? -minor : minor;
  const formatted = formatMinorUnits(absMinor, currency);
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;

  let sign = '';
  if (showSign && minor > 0n) sign = '+';
  else if (isNegative) sign = '-';

  return (
    <span className={`font-mono font-medium tracking-tight tabular-nums ${className}`}>
      {sign}{symbol}{formatted}
    </span>
  );
};
