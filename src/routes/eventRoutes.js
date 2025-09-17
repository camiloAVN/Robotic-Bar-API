const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');

// Rutas básicas CRUD
router.get('/', eventController.getAllEvents);
router.get('/active', eventController.getActiveEvents); // Debe ir antes de /:id
router.get('/:id', eventController.getEventById);
router.post('/', eventController.createEvent);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

// Rutas especiales
router.get('/client/:clientId', eventController.getEventsByClient);
router.patch('/:id/status', eventController.updateEventStatus);

module.exports = router;