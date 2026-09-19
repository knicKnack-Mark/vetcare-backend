const express = require('express');
const router = express.Router();
const {
  getItems, getSummary, getLowStock, getOutOfStock, getExpiring, getExpired, getItemById,
  createItem, updateItem, patchItem, deactivateItem, stockIn, stockOut, adjustStock, getTransactions,
} = require('../controllers/inventory.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

router.use(authenticateUser);

router.get('/summary', getSummary);
router.get('/low-stock', getLowStock);
router.get('/out-of-stock', getOutOfStock);
router.get('/expiring', getExpiring);
router.get('/expired', getExpired);

router.get('/', getItems);
router.post('/', requireRole('ADMIN', 'RECEPTIONIST'), createItem);
router.get('/:id', getItemById);
router.put('/:id', requireRole('ADMIN', 'RECEPTIONIST'), updateItem);
router.patch('/:id', requireRole('ADMIN', 'RECEPTIONIST'), patchItem);
router.delete('/:id', requireRole('ADMIN'), deactivateItem);

router.post('/:id/stock-in', requireRole('ADMIN', 'RECEPTIONIST'), stockIn);
router.post('/:id/stock-out', requireRole('ADMIN', 'RECEPTIONIST', 'VETERINARIAN'), stockOut);
router.post('/:id/adjust', requireRole('ADMIN'), adjustStock);
router.get('/:id/transactions', getTransactions);

module.exports = router;