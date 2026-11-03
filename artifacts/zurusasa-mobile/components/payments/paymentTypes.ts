export type PaymentScreenView =
  | 'hub'
  | 'payment_methods'
  | 'your_payments'
  | 'credits_coupons'
  | 'earnings';

export interface PaymentMethodItem {
  id: string;
  type: 'mpesa' | 'card';
  title: string;
  subtitle: string;
  isDefault?: boolean;
}

export interface CurrencyItem {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCIES_LIST: CurrencyItem[] = [
  { code: 'KES', name: 'Kenyan shilling', symbol: 'KSh' },
  { code: 'AUD', name: 'Australian dollar', symbol: '$' },
  { code: 'BRL', name: 'Brazilian real', symbol: 'R$' },
  { code: 'BGN', name: 'Bulgarian lev', symbol: 'лв.' },
  { code: 'CAD', name: 'Canadian dollar', symbol: '$' },
  { code: 'CLP', name: 'Chilean peso', symbol: '$' },
  { code: 'CNY', name: 'Chinese yuan', symbol: '¥' },
  { code: 'COP', name: 'Colombian peso', symbol: '$' },
  { code: 'CRC', name: 'Costa Rican colon', symbol: '₡' },
  { code: 'CZK', name: 'Czech koruna', symbol: 'Kč' },
  { code: 'DKK', name: 'Danish krone', symbol: 'kr' },
  { code: 'AED', name: 'Emirati dirham', symbol: 'د.إ' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British pound', symbol: '£' },
  { code: 'HKD', name: 'Hong Kong dollar', symbol: '$' },
  { code: 'HUF', name: 'Hungarian forint', symbol: 'Ft' },
  { code: 'INR', name: 'Indian rupee', symbol: '₹' },
  { code: 'IDR', name: 'Indonesian rupiah', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli new shekel', symbol: '₪' },
  { code: 'JPY', name: 'Japanese yen', symbol: '¥' },
  { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM' },
  { code: 'MXN', name: 'Mexican peso', symbol: '$' },
  { code: 'MAD', name: 'Moroccan dirham', symbol: 'د.م.' },
  { code: 'TWD', name: 'New Taiwan dollar', symbol: 'NT$' },
  { code: 'NZD', name: 'New Zealand dollar', symbol: '$' },
  { code: 'NOK', name: 'Norwegian krone', symbol: 'kr' },
  { code: 'PLN', name: 'Polish zloty', symbol: 'zł' },
  { code: 'QAR', name: 'Qatari riyal', symbol: 'ر.ق' },
  { code: 'RON', name: 'Romanian leu', symbol: 'lei' },
  { code: 'SAR', name: 'Saudi Arabian riyal', symbol: 'ر.س' },
  { code: 'SGD', name: 'Singapore dollar', symbol: '$' },
  { code: 'ZAR', name: 'South African rand', symbol: 'R' },
  { code: 'KRW', name: 'South Korean won', symbol: '₩' },
  { code: 'SEK', name: 'Swedish krona', symbol: 'kr' },
  { code: 'CHF', name: 'Swiss franc', symbol: 'CHF' },
  { code: 'TZS', name: 'Tanzanian shilling', symbol: 'TSh' },
  { code: 'THB', name: 'Thai baht', symbol: '฿' },
  { code: 'TRY', name: 'Turkish lira', symbol: '₺' },
  { code: 'UGX', name: 'Ugandan shilling', symbol: 'USh' },
  { code: 'USD', name: 'United States dollar', symbol: '$' },
];
