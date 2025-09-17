const InventoryModel = require('../models/inventoryModel');
const EventModel = require('../models/eventModel');
const IngredientModel = require('../models/ingredientModel');

class InventoryController {
    // GET /api/inventory
    async getAllInventory(req, res) {
        try {
            const filters = {
                event_id: req.query.event_id,
                ingredient_id: req.query.ingredient_id,
                low_stock: req.query.low_stock === 'true'
            };

            const inventory = await InventoryModel.getAll(filters);
            
            res.json({
                success: true,
                count: inventory.length,
                data: inventory
            });
        } catch (error) {
            console.error('Error obteniendo inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener inventario'
            });
        }
    }

    // GET /api/inventory/:id
    async getInventoryById(req, res) {
        try {
            const { id } = req.params;
            const inventory = await InventoryModel.getById(id);
            
            if (!inventory) {
                return res.status(404).json({
                    success: false,
                    error: 'Inventario no encontrado'
                });
            }

            res.json({
                success: true,
                data: inventory
            });
        } catch (error) {
            console.error('Error obteniendo inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener inventario'
            });
        }
    }

    // POST /api/inventory
    async createInventory(req, res) {
        try {
            const { event_id, ingredient_id, initial_quantity, bottles_count } = req.body;

            // Validaciones básicas
            if (!event_id || !ingredient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'event_id e ingredient_id son requeridos'
                });
            }

            // Verificar que el evento existe
            const event = await EventModel.getById(event_id);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
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

            // Verificar que no exista ya
            const exists = await InventoryModel.exists(event_id, ingredient_id);
            if (exists) {
                return res.status(400).json({
                    success: false,
                    error: 'Ya existe inventario para este ingrediente en este evento'
                });
            }

            // Validar cantidad
            if (!initial_quantity && !bottles_count) {
                return res.status(400).json({
                    success: false,
                    error: 'Debe especificar initial_quantity o bottles_count'
                });
            }

            // Crear inventario
            const inventoryId = await InventoryModel.create(req.body);
            const newInventory = await InventoryModel.getById(inventoryId);

            res.status(201).json({
                success: true,
                message: 'Inventario creado exitosamente',
                data: newInventory
            });
        } catch (error) {
            console.error('Error creando inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear inventario'
            });
        }
    }

    // PUT /api/inventory/:id
    async updateInventory(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el inventario existe
            const inventory = await InventoryModel.getById(id);
            if (!inventory) {
                return res.status(404).json({
                    success: false,
                    error: 'Inventario no encontrado'
                });
            }

            // Actualizar inventario
            const updated = await InventoryModel.update(id, req.body);
            
            if (updated) {
                const updatedInventory = await InventoryModel.getById(id);
                res.json({
                    success: true,
                    message: 'Inventario actualizado exitosamente',
                    data: updatedInventory
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el inventario'
                });
            }
        } catch (error) {
            console.error('Error actualizando inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar inventario'
            });
        }
    }

    // DELETE /api/inventory/:id
    async deleteInventory(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el inventario existe
            const inventory = await InventoryModel.getById(id);
            if (!inventory) {
                return res.status(404).json({
                    success: false,
                    error: 'Inventario no encontrado'
                });
            }

            // No permitir eliminar inventario de eventos activos
            if (inventory.event_status === 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar inventario de un evento activo'
                });
            }

            // Eliminar inventario
            const deleted = await InventoryModel.delete(id);
            
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Inventario eliminado exitosamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo eliminar el inventario'
                });
            }
        } catch (error) {
            console.error('Error eliminando inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar inventario'
            });
        }
    }

    // GET /api/inventory/event/:eventId
    async getInventoryByEvent(req, res) {
        try {
            const { eventId } = req.params;
            
            // Verificar que el evento existe
            const event = await EventModel.getById(eventId);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            const inventory = await InventoryModel.getByEventId(eventId);
            const stats = await InventoryModel.getConsumptionStats(eventId);
            const byCategory = await InventoryModel.getInventoryByCategory(eventId);

            res.json({
                success: true,
                event: event.event_name,
                stats,
                byCategory,
                count: inventory.length,
                data: inventory
            });
        } catch (error) {
            console.error('Error obteniendo inventario del evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener inventario del evento'
            });
        }
    }

    // POST /api/inventory/:id/consume
    async consumeFromInventory(req, res) {
        try {
            const { id } = req.params;
            const { quantity } = req.body;

            if (!quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Cantidad debe ser mayor a 0'
                });
            }

            // Obtener inventario
            const inventory = await InventoryModel.getById(id);
            if (!inventory) {
                return res.status(404).json({
                    success: false,
                    error: 'Inventario no encontrado'
                });
            }

            // Consumir
            await InventoryModel.consume(inventory.event_id, inventory.ingredient_id, quantity);
            
            const updatedInventory = await InventoryModel.getById(id);
            
            res.json({
                success: true,
                message: `Consumidos ${quantity} ${inventory.unit} de ${inventory.ingredient_name}`,
                data: {
                    consumed: quantity,
                    remaining: updatedInventory.current_quantity
                }
            });
        } catch (error) {
            console.error('Error consumiendo inventario:', error);
            
            if (error.message.includes('insuficiente')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Error al consumir inventario'
            });
        }
    }

    // POST /api/inventory/:id/restock
    async restockInventory(req, res) {
        try {
            const { id } = req.params;
            const { quantity } = req.body;

            if (!quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Cantidad debe ser mayor a 0'
                });
            }

            // Verificar que el inventario existe
            const inventory = await InventoryModel.getById(id);
            if (!inventory) {
                return res.status(404).json({
                    success: false,
                    error: 'Inventario no encontrado'
                });
            }

            // Reabastecer
            const restocked = await InventoryModel.restock(id, quantity);
            
            if (restocked) {
                const updatedInventory = await InventoryModel.getById(id);
                res.json({
                    success: true,
                    message: `Reabastecidos ${quantity} ${inventory.unit} de ${inventory.ingredient_name}`,
                    data: {
                        added: quantity,
                        new_total: updatedInventory.current_quantity
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo reabastecer'
                });
            }
        } catch (error) {
            console.error('Error reabasteciendo inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al reabastecer inventario'
            });
        }
    }

    // GET /api/inventory/event/:eventId/low-stock
    async getLowStock(req, res) {
        try {
            const { eventId } = req.params;
            
            // Verificar que el evento existe
            const event = await EventModel.getById(eventId);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            const lowStock = await InventoryModel.getLowStock(eventId);
            
            res.json({
                success: true,
                event: event.event_name,
                count: lowStock.length,
                data: lowStock
            });
        } catch (error) {
            console.error('Error obteniendo stock bajo:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener stock bajo'
            });
        }
    }

    // POST /api/inventory/event/:eventId/initialize
    async initializeEventInventory(req, res) {
        try {
            const { eventId } = req.params;
            const { template_event_id } = req.body;
            
            // Verificar que el evento existe
            const event = await EventModel.getById(eventId);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            // Verificar que no tenga inventario ya
            const existing = await InventoryModel.getByEventId(eventId);
            if (existing.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El evento ya tiene inventario inicializado'
                });
            }

            // Inicializar inventario
            const itemsCreated = await InventoryModel.initializeFromTemplate(eventId, template_event_id);
            
            res.status(201).json({
                success: true,
                message: `Inventario inicializado con ${itemsCreated} ingredientes`,
                items_created: itemsCreated
            });
        } catch (error) {
            console.error('Error inicializando inventario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al inicializar inventario'
            });
        }
    }

    // POST /api/inventory/check-availability
    async checkAvailability(req, res) {
        try {
            const { event_id, ingredient_id, quantity } = req.body;

            if (!event_id || !ingredient_id || !quantity) {
                return res.status(400).json({
                    success: false,
                    error: 'event_id, ingredient_id y quantity son requeridos'
                });
            }

            const availability = await InventoryModel.checkAvailability(event_id, ingredient_id, quantity);
            
            res.json({
                success: true,
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
}

module.exports = new InventoryController();