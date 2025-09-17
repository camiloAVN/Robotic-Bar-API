const CocktailModel = require('../models/cocktailModel');
const IngredientModel = require('../models/ingredientModel');

class CocktailController {
    // GET /api/cocktails
    async getAllCocktails(req, res) {
        try {
            const filters = {
                category: req.query.category,
                //is_active: req.query.is_active === 'true', correguir is active es un numero pero debe ser booleano
               //is_alcoholic: req.query.is_alcoholic === 'true'
            };

            const cocktails = await CocktailModel.getAll(filters);
            
            res.json({
                success: true,
                count: cocktails.length,
                data: cocktails
            });
        } catch (error) {
            console.error('Error obteniendo cócteles:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener cócteles'
            });
        }
    }

    // GET /api/cocktails/:id
    async getCocktailById(req, res) {
        try {
            const { id } = req.params;
            const cocktail = await CocktailModel.getById(id);
            
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            res.json({
                success: true,
                data: cocktail
            });
        } catch (error) {
            console.error('Error obteniendo cóctel:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener cóctel'
            });
        }
    }

    // POST /api/cocktails
    async createCocktail(req, res) {
        try {
            const { cocktail_name, ingredients } = req.body;

            // Validaciones básicas
            if (!cocktail_name) {
                return res.status(400).json({
                    success: false,
                    error: 'cocktail_name es requerido'
                });
            }

            // Verificar que el nombre no exista
            const nameExists = await CocktailModel.nameExists(cocktail_name);
            if (nameExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Ya existe un cóctel con ese nombre'
                });
            }

            // Crear cóctel
            const cocktailId = await CocktailModel.create(req.body);

            // Si se proporcionaron ingredientes, agregarlos
            if (ingredients && Array.isArray(ingredients)) {
                for (let i = 0; i < ingredients.length; i++) {
                    const ing = ingredients[i];
                    await CocktailModel.addIngredient(cocktailId, {
                        ...ing,
                        sequence: ing.sequence || i + 1
                    });
                }
            }

            const newCocktail = await CocktailModel.getById(cocktailId);

            res.status(201).json({
                success: true,
                message: 'Cóctel creado exitosamente',
                data: newCocktail
            });
        } catch (error) {
            console.error('Error creando cóctel:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear cóctel'
            });
        }
    }

    // PUT /api/cocktails/:id
    async updateCocktail(req, res) {
        try {
            const { id } = req.params;
            const { cocktail_name } = req.body;
            
            // Verificar que el cóctel existe
            const cocktail = await CocktailModel.getById(id);
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            // Si se cambia el nombre, verificar que no exista
            if (cocktail_name && cocktail_name !== cocktail.cocktail_name) {
                const nameExists = await CocktailModel.nameExists(cocktail_name, id);
                if (nameExists) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ya existe un cóctel con ese nombre'
                    });
                }
            }

            // Actualizar cóctel
            const updated = await CocktailModel.update(id, req.body);
            
            if (updated) {
                const updatedCocktail = await CocktailModel.getById(id);
                res.json({
                    success: true,
                    message: 'Cóctel actualizado exitosamente',
                    data: updatedCocktail
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el cóctel'
                });
            }
        } catch (error) {
            console.error('Error actualizando cóctel:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar cóctel'
            });
        }
    }

    // DELETE /api/cocktails/:id
    async deleteCocktail(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el cóctel existe
            const cocktail = await CocktailModel.getById(id);
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            // Eliminar cóctel
            const deleted = await CocktailModel.delete(id);
            
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Cóctel eliminado exitosamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo eliminar el cóctel'
                });
            }
        } catch (error) {
            console.error('Error eliminando cóctel:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar cóctel'
            });
        }
    }

    // POST /api/cocktails/:id/ingredients
    async addIngredientToCocktail(req, res) {
        try {
            const { id } = req.params;
            const { ingredient_id, quantity } = req.body;

            // Validaciones
            if (!ingredient_id || !quantity) {
                return res.status(400).json({
                    success: false,
                    error: 'ingredient_id y quantity son requeridos'
                });
            }

            // Verificar que el cóctel existe
            const cocktail = await CocktailModel.getById(id);
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            // Verificar que el ingrediente existe
            const ingredient = await IngredientModel.getById(ingredient_id);
            if (!ingredient) {
                return res.status(404).json({
                    success: false,
                    error: 'Ingrediente no encontrado'
                });
            }

            // Agregar ingrediente
            await CocktailModel.addIngredient(id, req.body);
            
            const updatedCocktail = await CocktailModel.getById(id);
            
            res.json({
                success: true,
                message: `${ingredient.ingredient_name} agregado al cóctel`,
                data: updatedCocktail
            });
        } catch (error) {
            console.error('Error agregando ingrediente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al agregar ingrediente'
            });
        }
    }

    // DELETE /api/cocktails/:id/ingredients/:ingredientId
    async removeIngredientFromCocktail(req, res) {
        try {
            const { id, ingredientId } = req.params;

            // Verificar que el cóctel existe
            const cocktail = await CocktailModel.getById(id);
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            // Eliminar ingrediente
            const removed = await CocktailModel.removeIngredient(id, ingredientId);
            
            if (removed) {
                const updatedCocktail = await CocktailModel.getById(id);
                res.json({
                    success: true,
                    message: 'Ingrediente eliminado del cóctel',
                    data: updatedCocktail
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo eliminar el ingrediente'
                });
            }
        } catch (error) {
            console.error('Error eliminando ingrediente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar ingrediente'
            });
        }
    }

    // GET /api/cocktails/:id/robot-commands
    async getRobotCommands(req, res) {
        try {
            const { id } = req.params;

            // Verificar que el cóctel existe
            const cocktail = await CocktailModel.getById(id);
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            const commands = await CocktailModel.getRobotCommands(id);
            
            res.json({
                success: true,
                cocktail_name: cocktail.cocktail_name,
                data: commands
            });
        } catch (error) {
            console.error('Error obteniendo comandos del robot:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener comandos del robot'
            });
        }
    }

    // POST /api/cocktails/:id/check-availability
    async checkAvailability(req, res) {
        try {
            const { id } = req.params;
            const { event_id } = req.body;

            if (!event_id) {
                return res.status(400).json({
                    success: false,
                    error: 'event_id es requerido'
                });
            }

            // Verificar que el cóctel existe
            const cocktail = await CocktailModel.getById(id);
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            const availability = await CocktailModel.checkAvailability(id, event_id);
            
            res.json({
                success: true,
                cocktail_name: cocktail.cocktail_name,
                data: availability
            });
        } catch (error) {
            console.error('Error verificando disponibilidad:', error);
            res.status(500).json({
                success: false,
                error: 'Error al verificar disponibilidad'
            });
        }
    }

    // GET /api/cocktails/ingredient/:ingredientId
    async getCocktailsByIngredient(req, res) {
        try {
            const { ingredientId } = req.params;

            // Verificar que el ingrediente existe
            const ingredient = await IngredientModel.getById(ingredientId);
            if (!ingredient) {
                return res.status(404).json({
                    success: false,
                    error: 'Ingrediente no encontrado'
                });
            }

            const cocktails = await CocktailModel.getByIngredient(ingredientId);
            
            res.json({
                success: true,
                ingredient: ingredient.ingredient_name,
                count: cocktails.length,
                data: cocktails
            });
        } catch (error) {
            console.error('Error obteniendo cócteles por ingrediente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener cócteles'
            });
        }
    }

    // GET /api/cocktails/popular
    async getPopularCocktails(req, res) {
        try {
            const limit = req.query.limit || 10;
            const cocktails = await CocktailModel.getPopular(limit);
            
            res.json({
                success: true,
                count: cocktails.length,
                data: cocktails
            });
        } catch (error) {
            console.error('Error obteniendo cócteles populares:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener cócteles populares'
            });
        }
    }

    // POST /api/cocktails/:id/clone
    async cloneCocktail(req, res) {
        try {
            const { id } = req.params;
            const { new_name } = req.body;

            if (!new_name) {
                return res.status(400).json({
                    success: false,
                    error: 'new_name es requerido'
                });
            }

            // Verificar que el nombre no exista
            const nameExists = await CocktailModel.nameExists(new_name);
            if (nameExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Ya existe un cóctel con ese nombre'
                });
            }

            const newId = await CocktailModel.clone(id, new_name);
            const newCocktail = await CocktailModel.getById(newId);
            
            res.status(201).json({
                success: true,
                message: 'Cóctel clonado exitosamente',
                data: newCocktail
            });
        } catch (error) {
            console.error('Error clonando cóctel:', error);
            res.status(500).json({
                success: false,
                error: 'Error al clonar cóctel'
            });
        }
    }

    // POST /api/cocktails/default
    async createDefaultCocktails(req, res) {
        try {
            const results = await CocktailModel.createDefaultCocktails();
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            res.status(201).json({
                success: true,
                message: `${successful.length} cócteles creados, ${failed.length} omitidos`,
                data: {
                    successful,
                    failed
                }
            });
        } catch (error) {
            console.error('Error creando cócteles por defecto:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear cócteles por defecto'
            });
        }
    }
}

module.exports = new CocktailController();
