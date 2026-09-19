const Billing = require('../models/Billing');

// Backend-authoritative calculation — never trust frontend totals
const calculateBilling = (items, { discountType = 'fixed', discountValue = 0, taxRate = 0 } = {}) => {
  const calculatedItems = items.map((item) => {
    const rawTotal = item.quantity * item.unitPrice;
    const itemDiscount = Math.min(item.discount || 0, rawTotal);
    const total = Math.max(0, rawTotal - itemDiscount);
    return { ...item, discount: itemDiscount, total };
  });

  const subtotal = calculatedItems.reduce((sum, i) => sum + i.total, 0);

  let discountAmount = 0;
  if (discountType === 'percentage') {
    discountAmount = subtotal * (Math.min(discountValue, 100) / 100);
  } else {
    discountAmount = Math.min(discountValue, subtotal);
  }

  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * (taxRate / 100);
  const totalAmount = Math.max(0, afterDiscount + taxAmount);

  return { items: calculatedItems, subtotal, discountAmount, taxAmount, totalAmount };
};

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await Billing.findOne({ invoiceNumber: { $regex: `^${prefix}` } }).sort({ invoiceNumber: -1 });
  let nextSeq = 1;
  if (last) {
    const lastSeq = parseInt(last.invoiceNumber.split('-')[2], 10);
    nextSeq = lastSeq + 1;
  }
  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
};

const generatePaymentNumber = async () => {
  const Payment = require('../models/Payment');
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;
  const last = await Payment.findOne({ paymentNumber: { $regex: `^${prefix}` } }).sort({ paymentNumber: -1 });
  let nextSeq = 1;
  if (last) {
    const lastSeq = parseInt(last.paymentNumber.split('-')[2], 10);
    nextSeq = lastSeq + 1;
  }
  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
};

const derivePaymentStatus = (totalAmount, amountPaid) => {
  if (amountPaid <= 0) return 'unpaid';
  if (amountPaid < totalAmount) return 'partially_paid';
  if (amountPaid === totalAmount) return 'paid';
  return 'overpaid';
};

module.exports = { calculateBilling, generateInvoiceNumber, generatePaymentNumber, derivePaymentStatus };