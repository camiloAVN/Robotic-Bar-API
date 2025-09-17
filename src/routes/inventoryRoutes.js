const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// Rutas básicas CRUD
router.get('/', inventoryController.getAllInventory);
router.post('/check-availability', inventoryController.checkAvailability);
router.get('/:id', inventoryController.getInventoryById);
router.post('/', inventoryController.createInventory);
router.put('/:id', inventoryController.updateInventory);
router.delete('/:id', inventoryController.deleteInventory);

// Rutas especiales
router.get('/event/:eventId', inventoryController.getInventoryByEvent);
router.get('/event/:eventId/low-stock', inventoryController.getLowStock);
router.post('/event/:eventId/initialize', inventoryController.initializeEventInventory);
router.post('/:id/consume', inventoryController.consumeFromInventory);
router.post('/:id/restock', inventoryController.restockInventory);

module.exports = router;