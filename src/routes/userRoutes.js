const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Rutas básicas CRUD
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', userController.createUser);
router.post('/bulk', userController.bulkCreateUsers); // Debe ir antes de otras rutas POST con parámetros
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

// Rutas especiales
router.get('/event/:eventId', userController.getUsersByEvent);
router.get('/access/:code', userController.getUserByAccessCode);
router.post('/:id/checkin', userController.checkInUser);
router.post('/:id/drink', userController.addDrink);

module.exports = router;