const OrderModel = require('../models/orderModel');
const EventModel = require('../models/eventModel');
const UserModel = require('../models/userModel');
const CocktailModel = require('../models/cocktailModel');
const robotService = require('../services/robotService');


class OrderController {
    // GET /api/orders
    async getAllOrders(req, res) {
        try {
            const filters = {
                event_id: req.query.event_id,
                user_id: req.query.user_id,
                status: req.query.status,
                from_date: req.query.from_date,
                to_date: req.query.to_date
            };

            const orders = await OrderModel.getAll(filters);
            
            res.json({
                success: true,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Error obteniendo órdenes:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener órdenes'
            });
        }
    }

    // GET /api/orders/:id
    async getOrderById(req, res) {
        try {
            const { id } = req.params;
            const order = await OrderModel.getById(id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Orden no encontrada'
                });
            }

            res.json({
                success: true,
                data: order
            });
        } catch (error) {
            console.error('Error obteniendo orden:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener orden'
            });
        }
    }

    // POST /api/orders
    async createOrder(req, res) {
        try {
            const { event_id, user_id, cocktail_id } = req.body;

            // Validaciones básicas
            if (!event_id || !cocktail_id) {
                return res.status(400).json({
                    success: false,
                    error: 'event_id y cocktail_id son requeridos'
                });
            }

            // Verificar que el evento existe y está activo
            const event = await EventModel.getById(event_id);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            if (event.status !== 'active' && event.status !== 'scheduled') {
                return res.status(400).json({
                    success: false,
                    error: `No se pueden crear órdenes para un evento ${event.status}`
                });
            }

            // Si se especifica usuario, verificar que existe y pertenece al evento
            if (user_id) {
                const user = await UserModel.getById(user_id);
                if (!user) {
                    return res.status(404).json({
                        success: false,
                        error: 'Usuario no encontrado'
                    });
                }

                if (user.event_id !== event_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'El usuario no pertenece a este evento'
                    });
                }

                // Verificar que no exceda su límite
                if (user.drinks_consumed >= user.max_drinks) {
                    return res.status(400).json({
                        success: false,
                        error: 'El usuario ha alcanzado su límite de bebidas'
                    });
                }
            }

            // Verificar que el cóctel existe
            const cocktail = await CocktailModel.getById(cocktail_id);
            if (!cocktail) {
                return res.status(404).json({
                    success: false,
                    error: 'Cóctel no encontrado'
                });
            }

            // Verificar disponibilidad de ingredientes
            const availability = await CocktailModel.checkAvailability(cocktail_id, event_id);
            if (!availability.can_prepare) {
                return res.status(400).json({
                    success: false,
                    error: 'Ingredientes insuficientes',
                    missing: availability.missing_ingredients
                });
            }

            // Crear orden
            const orderId = await OrderModel.create(req.body);
            const newOrder = await OrderModel.getById(orderId);

            res.status(201).json({
                success: true,
                message: 'Orden creada exitosamente',
                data: newOrder
            });
        } catch (error) {
            console.error('Error creando orden:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error al crear orden'
            });
        }
    }

    // PATCH /api/orders/:id/status
    async updateOrderStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            // Validar estado
            const validStatuses = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`
                });
            }

            // Verificar que la orden existe
            const order = await OrderModel.getById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Orden no encontrada'
                });
            }

            // Actualizar estado
            const updated = await OrderModel.updateStatus(id, status);
            
            if (updated) {
                const updatedOrder = await OrderModel.getById(id);
                res.json({
                    success: true,
                    message: `Estado actualizado a: ${status}`,
                    data: updatedOrder
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el estado'
                });
            }
        } catch (error) {
            console.error('Error actualizando estado:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar estado'
            });
        }
    }

    // POST /api/orders/:id/process
    async processOrder(req, res) {
        try {
            const { id } = req.params;

            // Obtener la orden antes de procesarla
            const order = await OrderModel.getById(id);
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Orden no encontrada'
                });
            }

            // Procesar orden (consumir inventario)
            await OrderModel.processOrder(id);
            
            // Obtener comandos del robot
            const commands = JSON.parse(order.robot_commands);
            
            // Enviar al robot
            const robotResult = robotService.prepareCocktail(id, commands);
            
            const processedOrder = await OrderModel.getById(id);
            
            res.json({
                success: true,
                message: 'Orden procesada, inventario actualizado',
                robot: robotResult,
                data: processedOrder
            });
        } catch (error) {
            console.error('Error procesando orden:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Error al procesar orden'
            });
        }
    }


    // POST /api/orders/:id/cancel
    async cancelOrder(req, res) {
        try {
            const { id } = req.params;

            await OrderModel.cancel(id);
            
            res.json({
                success: true,
                message: 'Orden cancelada exitosamente'
            });
        } catch (error) {
            console.error('Error cancelando orden:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Error al cancelar orden'
            });
        }
    }

    // GET /api/orders/event/:eventId
    async getOrdersByEvent(req, res) {
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

            const orders = await OrderModel.getByEventId(eventId);
            const stats = await OrderModel.getStats(eventId);

            res.json({
                success: true,
                event: event.event_name,
                stats,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Error obteniendo órdenes del evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener órdenes'
            });
        }
    }

    // GET /api/orders/user/:userId
    async getOrdersByUser(req, res) {
        try {
            const { userId } = req.params;
            
            // Verificar que el usuario existe
            const user = await UserModel.getById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            const orders = await OrderModel.getByUserId(userId);

            res.json({
                success: true,
                user: user.name,
                drinks_consumed: user.drinks_consumed,
                max_drinks: user.max_drinks,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Error obteniendo órdenes del usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener órdenes'
            });
        }
    }

    // GET /api/orders/event/:eventId/queue
    async getEventQueue(req, res) {
        try {
            const { eventId } = req.params;
            
            const queue = await OrderModel.getActiveQueue(eventId);
            
            res.json({
                success: true,
                count: queue.length,
                data: queue
            });
        } catch (error) {
            console.error('Error obteniendo cola:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener cola'
            });
        }
    }

    // GET /api/orders/event/:eventId/next
    async getNextOrder(req, res) {
        try {
            const { eventId } = req.params;
            
            const nextOrder = await OrderModel.getNextInQueue(eventId);
            
            if (!nextOrder) {
                return res.json({
                    success: true,
                    message: 'No hay órdenes pendientes',
                    data: null
                });
            }

            res.json({
                success: true,
                data: nextOrder
            });
        } catch (error) {
            console.error('Error obteniendo siguiente orden:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener siguiente orden'
            });
        }
    }

    // GET /api/orders/stats
    async getOrderStats(req, res) {
        try {
            const { event_id } = req.query;
            
            const stats = await OrderModel.getStats(event_id);
            const topCocktails = await OrderModel.getTopCocktails(event_id, 5);
            const preparationTimes = await OrderModel.getPreparationTimes(event_id);
            
            res.json({
                success: true,
                data: {
                    general: stats,
                    top_cocktails: topCocktails,
                    preparation_times: preparationTimes
                }
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener estadísticas'
            });
        }
    }

    // POST /api/orders/:id/complete
    async completeOrder(req, res) {
        try {
            const { id } = req.params;

            // Marcar como ready y luego delivered
            await OrderModel.updateStatus(id, 'ready');
            await OrderModel.updateStatus(id, 'delivered');
            
            const completedOrder = await OrderModel.getById(id);
            
            res.json({
                success: true,
                message: 'Orden completada',
                data: completedOrder
            });
        } catch (error) {
            console.error('Error completando orden:', error);
            res.status(500).json({
                success: false,
                error: 'Error al completar orden'
            });
        }
    }
}

module.exports = new OrderController();