const IngredientModel = require('../models/ingredientModel');

class IngredientController {
    // GET /api/ingredients
    async getAllIngredients(req, res) {
        try {
            const filters = {
                category: req.query.category,
                is_available: req.query.is_available === 'true',
                has_position: req.query.has_position === 'true'
            };

            const ingredients = await IngredientModel.getAll(filters);
            
            res.json({
                success: true,
                count: ingredients.length,
                data: ingredients
            });
        } catch (error) {
            console.error('Error obteniendo ingredientes:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener ingredientes'
            });
        }
    }

    // GET /api/ingredients/:id
    async getIngredientById(req, res) {
        try {
            const { id } = req.params;
            const ingredient = await IngredientModel.getById(id);
            
            if (!ingredient) {
                return res.status(404).json({
                    success: false,
                    error: 'Ingrediente no encontrado'
                });
            }

            res.json({
                success: true,
                data: ingredient
            });
        } catch (error) {
            console.error('Error obteniendo ingrediente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener ingrediente'
            });
        }
    }

    // POST /api/ingredients
    async createIngredient(req, res) {
        try {
            const { ingredient_name, category, position } = req.body;

            // Validaciones básicas
            if (!ingredient_name || !category) {
                return res.status(400).json({
                    success: false,
                    error: 'ingredient_name y category son requeridos'
                });
            }

            // Validar categoría
            const validCategories = ['alcohol', 'juice', 'soda', 'syrup', 'garnish', 'other'];
            if (!validCategories.includes(category)) {
                return res.status(400).json({
                    success: false,
                    error: `Categoría inválida. Debe ser una de: ${validCategories.join(', ')}`
                });
            }

            // Verificar que el nombre no exista
            const nameExists = await IngredientModel.nameExists(ingredient_name);
            if (nameExists) {
                return res.status(400).json({
                    success: false,
                    error: 'Ya existe un ingrediente con ese nombre'
                });
            }

            // Verificar que la posición no esté ocupada
            if (position) {
                const positionExists = await IngredientModel.positionExists(position);
                if (positionExists) {
                    return res.status(400).json({
                        success: false,
                        error: 'La posición ya está ocupada por otro ingrediente'
                    });
                }
            }

            // Crear ingrediente
            const ingredientId = await IngredientModel.create(req.body);
            const newIngredient = await IngredientModel.getById(ingredientId);

            res.status(201).json({
                success: true,
                message: 'Ingrediente creado exitosamente',
                data: newIngredient
            });
        } catch (error) {
            console.error('Error creando ingrediente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear ingrediente'
            });
        }
    }

    // PUT /api/ingredients/:id
    async updateIngredient(req, res) {
        try {
            const { id } = req.params;
            const { ingredient_name, position } = req.body;
            
            // Verificar que el ingrediente existe
            const ingredient = await IngredientModel.getById(id);
            if (!ingredient) {
                return res.status(404).json({
                    success: false,
                    error: 'Ingrediente no encontrado'
                });
            }

            // Si se cambia el nombre, verificar que no exista
            if (ingredient_name && ingredient_name !== ingredient.ingredient_name) {
                const nameExists = await IngredientModel.nameExists(ingredient_name, id);
                if (nameExists) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ya existe un ingrediente con ese nombre'
                    });
                }
            }

            // Si se cambia la posición, verificar que no esté ocupada
            if (position && position !== ingredient.position) {
                const positionExists = await IngredientModel.positionExists(position, id);
                if (positionExists) {
                    return res.status(400).json({
                        success: false,
                        error: 'La posición ya está ocupada por otro ingrediente'
                    });
                }
            }

            // Actualizar ingrediente
            const updated = await IngredientModel.update(id, req.body);
            
            if (updated) {
                const updatedIngredient = await IngredientModel.getById(id);
                res.json({
                    success: true,
                    message: 'Ingrediente actualizado exitosamente',
                    data: updatedIngredient
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el ingrediente'
                });
            }
        } catch (error) {
            console.error('Error actualizando ingrediente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar ingrediente'
            });
        }
    }

    // DELETE /api/ingredients/:id
    async deleteIngredient(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el ingrediente existe
            const ingredient = await IngredientModel.getById(id);
            if (!ingredient) {
                return res.status(404).json({
                    success: false,
                    error: 'Ingrediente no encontrado'
                });
            }

            // Eliminar ingrediente
            const deleted = await IngredientModel.delete(id);
            
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Ingrediente eliminado exitosamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo eliminar el ingrediente'
                });
            }
        } catch (error) {
            console.error('Error eliminando ingrediente:', error);
            
            if (error.message.includes('usado en cócteles')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Error al eliminar ingrediente'
            });
        }
    }

    // GET /api/ingredients/category/:category
    async getIngredientsByCategory(req, res) {
        try {
            const { category } = req.params;
            
            // Validar categoría
            const validCategories = ['alcohol', 'juice', 'soda', 'syrup', 'garnish', 'other'];
            if (!validCategories.includes(category)) {
                return res.status(400).json({
                    success: false,
                    error: `Categoría inválida. Debe ser una de: ${validCategories.join(', ')}`
                });
            }

            const ingredients = await IngredientModel.getByCategory(category);
            
            res.json({
                success: true,
                category,
                count: ingredients.length,
                data: ingredients
            });
        } catch (error) {
            console.error('Error obteniendo ingredientes por categoría:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener ingredientes'
            });
        }
    }

    // GET /api/ingredients/positions/available
    async getAvailablePositions(req, res) {
        try {
            const positions = await IngredientModel.getAvailablePositions();
            
            res.json({
                success: true,
                count: positions.length,
                data: positions
            });
        } catch (error) {
            console.error('Error obteniendo posiciones disponibles:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener posiciones disponibles'
            });
        }
    }

    // GET /api/ingredients/positions/map
    async getPositionMap(req, res) {
        try {
            const map = await IngredientModel.getPositionMap();
            
            res.json({
                success: true,
                data: map
            });
        } catch (error) {
            console.error('Error obteniendo mapa de posiciones:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener mapa de posiciones'
            });
        }
    }

    // GET /api/ingredients/position/:position
    async getIngredientByPosition(req, res) {
        try {
            const { position } = req.params;
            const ingredient = await IngredientModel.getByPosition(position);
            
            if (!ingredient) {
                return res.status(404).json({
                    success: false,
                    error: 'No hay ingrediente en esa posición'
                });
            }

            res.json({
                success: true,
                data: ingredient
            });
        } catch (error) {
            console.error('Error obteniendo ingrediente por posición:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener ingrediente'
            });
        }
    }

    // PATCH /api/ingredients/:id/availability
    async updateAvailability(req, res) {
        try {
            const { id } = req.params;
            const { is_available } = req.body;

            if (is_available === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'is_available es requerido'
                });
            }

            // Verificar que el ingrediente existe
            const ingredient = await IngredientModel.getById(id);
            if (!ingredient) {
                return res.status(404).json({
                    success: false,
                    error: 'Ingrediente no encontrado'
                });
            }

            // Actualizar disponibilidad
            const updated = await IngredientModel.updateAvailability(id, is_available);
            
            if (updated) {
                res.json({
                    success: true,
                    message: `Ingrediente ${is_available ? 'habilitado' : 'deshabilitado'} exitosamente`
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar la disponibilidad'
                });
            }
        } catch (error) {
            console.error('Error actualizando disponibilidad:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar disponibilidad'
            });
        }
    }

    // GET /api/ingredients/stats
    async getStats(req, res) {
        try {
            const stats = await IngredientModel.getStats();
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener estadísticas'
            });
        }
    }

    // POST /api/ingredients/default
    async createDefaultIngredients(req, res) {
        try {
            const results = await IngredientModel.createDefaultIngredients();
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            res.status(201).json({
                success: true,
                message: `${successful.length} ingredientes creados, ${failed.length} omitidos`,
                data: {
                    successful,
                    failed
                }
            });
        } catch (error) {
            console.error('Error creando ingredientes por defecto:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear ingredientes por defecto'
            });
        }
    }
}

module.exports = new IngredientController();
