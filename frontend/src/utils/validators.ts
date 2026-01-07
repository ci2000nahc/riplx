/**
 * Validate XRPL address format
 */
export const isValidXRPLAddress = (address: string): boolean => {
  // XRPL addresses start with 'r' and are 25-34 characters
  // Uses standard Base58 alphabet (no 0, O, I, l)
  return /^r[1-9A-HJ-NP-Za-km-z]{24,33}$/.test(address);
};

/**
 * Validate amount format (decimal number)
 */
export const isValidAmount = (amount: string): boolean => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};

/**
 * Format drops (smallest XRP unit) to XRP
 */
export const dropsToXRP = (drops: string): string => {
  const xrp = parseInt(drops) / 1_000_000;
  return xrp.toFixed(6);
};

/**
 * Format XRP to drops
 */
export const xrpToDrops = (xrp: string): string => {
  return (parseFloat(xrp) * 1_000_000).toFixed(0);
};
