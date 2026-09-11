import {
  Building2, CreditCard, Landmark, Coins, Wallet, Smartphone, Nfc, WalletCards, type LucideIcon,
} from 'lucide-react';

export function walletIcon(type: string): LucideIcon {
  switch (type) {
    case 'bank': return Landmark;
    case 'debit_card': case 'credit_card': return CreditCard;
    case 'crypto': return Coins;
    case 'cash': return Wallet;
    case 'physical': return WalletCards;
    case 'ewallet': return Smartphone;
    case 'prepaid_card': return Nfc;
    default: return Building2;
  }
}

export function walletColor(type: string): string {
  switch (type) {
    case 'bank': return '#3b82f6';
    case 'debit_card': return '#10b981';
    case 'credit_card': return '#f59e0b';
    case 'crypto': return '#8b5cf6';
    case 'cash': return '#ec4899';
    case 'physical': return '#f97316';
    case 'ewallet': return '#06b6d4';
    case 'prepaid_card': return '#22d3ee';
    default: return '#71717a';
  }
}
