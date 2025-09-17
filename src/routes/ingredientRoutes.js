const express = require('express');
const router = express.Router();
const ingredientController = require('../controllers/ingredientController');

// Rutas básicas CRUD
router.get('/', ingredientController.getAllIngredients);
router.get('/stats', ingredientController.getStats); // Antes de /:id
router.get('/positions/available', ingredientController.getAvailablePositions);
router.get('/positions/map', ingredientController.getPositionMap);
router.post('/default', ingredientController.createDefaultIngredients);
router.get('/:id', ingredientController.getIngredientById);
router.post('/', ingredientController.createIngredient);
router.put('/:id', ingredientController.updateIngredient);
router.delete('/:id', ingredientController.deleteIngredient);

// Rutas especiales
router.get('/category/:category', ingredientController.getIngredientsByCategory);
router.get('/position/:position', ingredientController.getIngredientByPosition);
router.patch('/:id/availability', ingredientController.updateAvailability);

module.exports = router;