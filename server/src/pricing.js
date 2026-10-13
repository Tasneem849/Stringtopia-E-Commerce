// Pure helpers for prices and phone numbers (no dependencies, so they are easy to test)

// Flat delivery fee (piasters) from the environment; pickup is always free. The server decides, never the client.
export const feeFor = (delivery) => (delivery.method === 'delivery' ? +process.env.DELIVERY_FEE || 0 : 0);

export const sumTotal = (lines) => lines.reduce((sum, l) => sum + l.price * l.qty, 0);

// Paymob wants +20 numbers: 01012345678 becomes +201012345678
export const toEgPhone = (phone) => {
  const d = phone.replace(/[\s()-]/g, '');
  return /^01\d{9}$/.test(d) ? `+2${d}` : /^20\d{10}$/.test(d) ? `+${d}` : d;
};
