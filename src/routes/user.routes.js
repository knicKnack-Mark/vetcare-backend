const express = require('express');
const router = express.Router();
const { getUsers } = require('../controllers/user.controller');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);
router.get('/', getUsers);

module.exports = router;