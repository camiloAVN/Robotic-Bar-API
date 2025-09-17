const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Rutas básicas
router.get('/', orderController.getAllOrders);
router.get('/stats', orderController.getOrderStats);
router.get('/:id', orderController.getOrderById);
router.post('/', orderController.createOrder);

// Acciones sobre órdenes
router.patch('/:id/status', orderController.updateOrderStatus);
router.post('/:id/process', orderController.processOrder);
router.post('/:id/cancel', orderController.cancelOrder);
router.post('/:id/complete', orderController.completeOrder);

// Rutas por relación
router.get('/event/:eventId', orderController.getOrdersByEvent);
router.get('/event/:eventId/queue', orderController.getEventQueue);
router.get('/event/:eventId/next', orderController.getNextOrder);
router.get('/user/:userId', orderController.getOrdersByUser);

module.exports = router;