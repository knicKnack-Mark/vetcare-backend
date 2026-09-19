const express = require('express');
const router = express.Router();
const {
  getBillings, getSummary, getToday, getUnpaid, getPartial, getRecent, getBillingById,
  createBilling, updateBilling, finalizeBilling, addPayment, getPayments, voidBilling, refundBilling,
} = require('../controllers/billing.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/summary', getSummary);
router.get('/today', getToday);
router.get('/unpaid', getUnpaid);
router.get('/partial', getPartial);
router.get('/recent', getRecent);

router.get('/', getBillings);
router.post('/', requireRole('ADMIN', 'RECEPTIONIST'), createBilling);
router.get('/:id', getBillingById);
router.put('/:id', requireRole('ADMIN', 'RECEPTIONIST'), updateBilling);
router.patch('/:id', requireRole('ADMIN', 'RECEPTIONIST'), updateBilling);

router.post('/:id/finalize', requireRole('ADMIN', 'RECEPTIONIST'), finalizeBilling);
router.post('/:id/payments', requireRole('ADMIN', 'RECEPTIONIST'), addPayment);
router.get('/:id/payments', getPayments);
router.post('/:id/void', requireRole('ADMIN'), voidBilling);
router.post('/:id/refund', requireRole('ADMIN'), refundBilling);

module.exports = router;