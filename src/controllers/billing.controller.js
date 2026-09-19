const mongoose = require('mongoose');
const Billing = require('../models/Billing');
const Payment = require('../models/Payment');
const Refund = require('../models/Refund');
const Pet = require('../models/Pet');
const Owner = require('../models/Owner');
const { calculateBilling, generateInvoiceNumber, generatePaymentNumber, derivePaymentStatus } = require('../services/billing.service');
const { stockOutInternal } = require('../services/inventory.service');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/billing
const getBillings = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, paymentStatus, billingStatus, paymentMethod, itemType,
      owner, pet, appointment, date, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const query = {};
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (billingStatus) query.billingStatus = billingStatus;
    if (owner) query.owner = owner;
    if (pet) query.pet = pet;
    if (appointment) query.appointment = appointment;
    if (itemType) query['items.itemType'] = itemType;
    if (date) {
      const d = new Date(date);
      query.createdAt = { $gte: new Date(d.setHours(0, 0, 0, 0)), $lte: new Date(d.setHours(23, 59, 59, 999)) };
    } else if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    let bills = await Billing.find(query)
      .populate('owner', 'firstName lastName mobileNumber')
      .populate('pet', 'name')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });

    if (paymentMethod) {
      const paidBillingIds = await Payment.find({ paymentMethod }).distinct('billing');
      bills = bills.filter((b) => paidBillingIds.some((id) => id.equals(b._id)));
    }

    if (search) {
      const s = search.toLowerCase();
      bills = bills.filter((b) =>
        b.invoiceNumber?.toLowerCase().includes(s) ||
        `${b.owner?.firstName} ${b.owner?.lastName}`.toLowerCase().includes(s) ||
        b.owner?.mobileNumber?.includes(search) ||
        b.pet?.name?.toLowerCase().includes(s)
      );
    }

    const total = bills.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = bills.slice(skip, skip + Number(limit));

    res.json({ success: true, data: { billings: paginated, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/billing/summary
const getSummary = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const finalizedQuery = { billingStatus: 'issued' };

    const [todaySales, monthSales, unpaidBills, partialBills, todayPayments, monthPayments] = await Promise.all([
      Billing.aggregate([{ $match: { ...finalizedQuery, issuedAt: { $gte: startOfDay, $lte: endOfDay } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Billing.aggregate([{ $match: { ...finalizedQuery, issuedAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Billing.countDocuments({ ...finalizedQuery, paymentStatus: 'unpaid' }),
      Billing.countDocuments({ ...finalizedQuery, paymentStatus: 'partially_paid' }),
      Payment.aggregate([{ $match: { status: 'completed', paymentDate: { $gte: startOfDay, $lte: endOfDay } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $match: { status: 'completed', paymentDate: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    const outstandingAgg = await Billing.aggregate([{ $match: { ...finalizedQuery, balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: '$balance' } } }]);

    res.json({
      success: true,
      data: {
        todaySales: todaySales[0]?.total || 0,
        todayCollections: todayPayments[0]?.total || 0,
        outstandingBalance: outstandingAgg[0]?.total || 0,
        unpaidBills, partialBills,
        monthlySales: monthSales[0]?.total || 0,
        monthlyCollections: monthPayments[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/billing/today
const getToday = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const bills = await Billing.find({ billingStatus: 'issued', issuedAt: { $gte: start, $lte: end } }).populate('owner', 'firstName lastName').populate('pet', 'name');
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/billing/unpaid
const getUnpaid = async (req, res) => {
  try {
    const bills = await Billing.find({ billingStatus: 'issued', paymentStatus: 'unpaid' }).populate('owner', 'firstName lastName mobileNumber').populate('pet', 'name').sort({ issuedAt: 1 });
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/billing/partial
const getPartial = async (req, res) => {
  try {
    const bills = await Billing.find({ billingStatus: 'issued', paymentStatus: 'partially_paid' }).populate('owner', 'firstName lastName mobileNumber').populate('pet', 'name').sort({ issuedAt: 1 });
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/billing/recent
const getRecent = async (req, res) => {
  try {
    const bills = await Billing.find({ billingStatus: 'issued' }).populate('owner', 'firstName lastName').populate('pet', 'name').sort({ issuedAt: -1 }).limit(20);
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/billing/:id
const getBillingById = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id)
      .populate('owner').populate('pet').populate('appointment')
      .populate('items.inventoryItem', 'name').populate('items.veterinarian', 'name');
    if (!billing) return res.status(404).json({ success: false, message: 'Billing record not found', errors: [] });

    const payments = await Payment.find({ billing: billing._id }).populate('receivedBy', 'name').sort({ paymentDate: -1 });

    res.json({ success: true, data: { billing, payments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/billing — create draft
const createBilling = async (req, res) => {
  try {
    const { owner, pet, appointment, items = [], discountType, discountValue, discountReason, taxRate, notes, dueDate } = req.body;
    const errors = [];

    if (!owner || !isValidId(owner)) errors.push({ field: 'owner', message: 'Valid owner is required' });
    if (pet && !isValidId(pet)) errors.push({ field: 'pet', message: 'Invalid pet ID' });

    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const ownerDoc = await Owner.findById(owner);
    if (!ownerDoc) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'owner', message: 'Owner not found' }] });

    if (pet) {
      const petDoc = await Pet.findById(pet);
      if (!petDoc) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'pet', message: 'Pet not found' }] });
      if (petDoc.owner.toString() !== owner.toString()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'pet', message: 'Pet does not belong to the selected owner' }] });
      }
    }

    for (const item of items) {
      if (!item.quantity || item.quantity <= 0) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'items', message: 'Item quantity must be greater than zero' }] });
      if (item.unitPrice < 0) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'items', message: 'Unit price cannot be negative' }] });
    }

    const calc = calculateBilling(items, { discountType, discountValue, taxRate });

    const billing = await Billing.create({
      owner, pet, appointment, items: calc.items,
      subtotal: calc.subtotal, discountType, discountValue, discountAmount: calc.discountAmount, discountReason,
      taxRate, taxAmount: calc.taxAmount, totalAmount: calc.totalAmount,
      amountPaid: 0, balance: calc.totalAmount,
      paymentStatus: 'unpaid', billingStatus: 'draft',
      notes, dueDate, createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: { billing } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PUT /api/billing/:id — only drafts editable
const updateBilling = async (req, res) => {
  try {
    const existing = await Billing.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Billing record not found', errors: [] });
    if (existing.billingStatus !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft bills can be edited', errors: [] });
    }

    const { items = existing.items, discountType = existing.discountType, discountValue = existing.discountValue, taxRate = existing.taxRate } = req.body;
    const calc = calculateBilling(items, { discountType, discountValue, taxRate });

    const updated = await Billing.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        items: calc.items, subtotal: calc.subtotal, discountAmount: calc.discountAmount,
        taxAmount: calc.taxAmount, totalAmount: calc.totalAmount, balance: calc.totalAmount - existing.amountPaid,
        updatedBy: req.user._id,
      },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: { billing: updated } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/billing/:id/finalize
const finalizeBilling = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const billing = await Billing.findById(req.params.id).session(session);
    if (!billing) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Billing record not found', errors: [] }); }
    if (billing.billingStatus !== 'draft') { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Only draft bills can be finalized', errors: [] }); }
    if (billing.items.length === 0) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Cannot finalize a bill with no items', errors: [] }); }

    // Verify inventory availability before deducting anything
    for (const item of billing.items) {
      if (item.inventoryItem) {
        const InventoryItem = require('../models/InventoryItem');
        const invDoc = await InventoryItem.findById(item.inventoryItem).session(session);
        if (!invDoc) { await session.abortTransaction(); return res.status(400).json({ success: false, message: `Inventory item for "${item.name}" not found`, errors: [] }); }
        if (invDoc.quantityRemaining < item.quantity) {
          await session.abortTransaction();
          return res.status(409).json({ success: false, message: `Insufficient inventory for "${item.name}" (only ${invDoc.quantityRemaining} remaining)`, errors: [] });
        }
      }
    }

    // Deduct inventory for linked items
    for (const item of billing.items) {
      if (item.inventoryItem) {
        await stockOutInternal({
          inventoryItemId: item.inventoryItem, quantity: item.quantity, transactionType: 'sale',
          referenceType: 'billing', referenceId: billing._id, reason: `Sold via invoice`, performedBy: req.user._id,
        });
      }
    }

    const invoiceNumber = await generateInvoiceNumber();
    billing.invoiceNumber = invoiceNumber;
    billing.billingStatus = 'issued';
    billing.issuedAt = new Date();
    billing.finalizedAt = new Date();
    billing.finalizedBy = req.user._id;
    await billing.save({ session });

    await session.commitTransaction();
    res.json({ success: true, data: { billing } });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message, errors: [] });
  } finally {
    session.endSession();
  }
};

// POST /api/billing/:id/payments
const addPayment = async (req, res) => {
  try {
    const { amount, paymentMethod, referenceNumber, notes } = req.body;
    const billing = await Billing.findById(req.params.id);
    if (!billing) return res.status(404).json({ success: false, message: 'Billing record not found', errors: [] });

    if (billing.billingStatus === 'voided') return res.status(400).json({ success: false, message: 'Cannot pay a voided invoice', errors: [] });
    if (billing.billingStatus !== 'issued') return res.status(400).json({ success: false, message: 'Only issued invoices can receive payments', errors: [] });

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'amount', message: 'Payment amount must be greater than zero' }] });
    if (!paymentMethod) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'paymentMethod', message: 'Payment method is required' }] });
    if (paymentMethod !== 'cash' && !referenceNumber) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'referenceNumber', message: 'Reference number is required for digital payments' }] });
    }

    if (amount > billing.balance) {
      return res.status(400).json({ success: false, message: `Payment exceeds outstanding balance of ${billing.balance}`, errors: [] });
    }

    const paymentNumber = await generatePaymentNumber();
    const payment = await Payment.create({
      billing: billing._id, paymentNumber, amount, paymentMethod, referenceNumber, notes,
      receivedBy: req.user._id, status: 'completed',
    });

    billing.amountPaid += amount;
    billing.balance = billing.totalAmount - billing.amountPaid;
    billing.paymentStatus = derivePaymentStatus(billing.totalAmount, billing.amountPaid);
    await billing.save();

    res.status(201).json({ success: true, data: { billing, payment } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/billing/:id/payments
const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ billing: req.params.id }).populate('receivedBy', 'name').sort({ paymentDate: -1 });
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/billing/:id/void
const voidBilling = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const { reason, returnInventory = false } = req.body;
    if (!reason) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Void reason is required', errors: [] }); }

    const billing = await Billing.findById(req.params.id).session(session);
    if (!billing) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Billing record not found', errors: [] }); }
    if (billing.billingStatus === 'voided') { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Bill is already voided', errors: [] }); }

    if (returnInventory && billing.billingStatus === 'issued') {
      const InventoryItem = require('../models/InventoryItem');
      const { createTransaction } = require('../services/inventory.service');
      for (const item of billing.items) {
        if (item.inventoryItem) {
          const invDoc = await InventoryItem.findById(item.inventoryItem).session(session);
          if (invDoc) {
            const previousQuantity = invDoc.quantityRemaining;
            invDoc.quantityRemaining += item.quantity;
            await invDoc.save({ session });
            await createTransaction({
              inventoryItem: invDoc._id, transactionType: 'returned', quantity: item.quantity,
              previousQuantity, newQuantity: invDoc.quantityRemaining,
              referenceType: 'billing', referenceId: billing._id, reason: `Voided invoice ${billing.invoiceNumber}`, performedBy: req.user._id,
            });
          }
        }
      }
    }

    billing.billingStatus = 'voided';
    billing.voidReason = reason;
    billing.voidedAt = new Date();
    billing.voidedBy = req.user._id;
    await billing.save({ session });

    await session.commitTransaction();
    res.json({ success: true, data: { billing } });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: error.message, errors: [] });
  } finally {
    session.endSession();
  }
};

// POST /api/billing/:id/refund
const refundBilling = async (req, res) => {
  try {
    const { amount, reason, refundMethod, referenceNumber, notes, paymentId } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'amount', message: 'Refund amount must be greater than zero' }] });
    if (!reason) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'reason', message: 'Refund reason is required' }] });

    const billing = await Billing.findById(req.params.id);
    if (!billing) return res.status(404).json({ success: false, message: 'Billing record not found', errors: [] });
    if (amount > billing.amountPaid) return res.status(400).json({ success: false, message: 'Refund amount exceeds amount paid', errors: [] });

    const refund = await Refund.create({
      billing: billing._id, payment: paymentId, amount, reason, refundMethod, referenceNumber, notes,
      processedBy: req.user._id,
    });

    billing.amountPaid -= amount;
    billing.balance = billing.totalAmount - billing.amountPaid;
    billing.paymentStatus = billing.amountPaid <= 0 ? 'refunded' : derivePaymentStatus(billing.totalAmount, billing.amountPaid);
    await billing.save();

    res.status(201).json({ success: true, data: { billing, refund } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getOwnerBilling = async (req, res) => {
  try {
    const bills = await Billing.find({ owner: req.params.ownerId }).populate('pet', 'name').sort({ createdAt: -1 });
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getPetBilling = async (req, res) => {
  try {
    const bills = await Billing.find({ pet: req.params.petId }).sort({ createdAt: -1 });
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

const getAppointmentBilling = async (req, res) => {
  try {
    const bills = await Billing.find({ appointment: req.params.appointmentId });
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

module.exports = {
  getBillings, getSummary, getToday, getUnpaid, getPartial, getRecent, getBillingById,
  createBilling, updateBilling, finalizeBilling, addPayment, getPayments, voidBilling, refundBilling,
  getOwnerBilling, getPetBilling, getAppointmentBilling,
};