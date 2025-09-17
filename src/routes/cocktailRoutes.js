const express = require('express');
const router = express.Router();
const cocktailController = require('../controllers/cocktailController');

// Rutas básicas CRUD
router.get('/', cocktailController.getAllCocktails);
router.get('/popular', cocktailController.getPopularCocktails);
router.post('/default', cocktailController.createDefaultCocktails);
router.get('/:id', cocktailController.getCocktailById);
router.post('/', cocktailController.createCocktail);
router.put('/:id', cocktailController.updateCocktail);
router.delete('/:id', cocktailController.deleteCocktail);

// Rutas de ingredientes
router.post('/:id/ingredients', cocktailController.addIngredientToCocktail);
router.delete('/:id/ingredients/:ingredientId', cocktailController.removeIngredientFromCocktail);
router.get('/ingredient/:ingredientId', cocktailController.getCocktailsByIngredient);

// Rutas especiales
router.get('/:id/robot-commands', cocktailController.getRobotCommands);
router.post('/:id/check-availability', cocktailController.checkAvailability);
router.post('/:id/clone', cocktailController.cloneCocktail);

module.exports = router;