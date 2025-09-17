const EventModel = require('../models/eventModel');
const ClientModel = require('../models/clientModel');

class EventController {
    // GET /api/events
    async getAllEvents(req, res) {
        try {
            // Obtener filtros de query params
            const filters = {
                client_id: req.query.client_id,
                status: req.query.status,
                from_date: req.query.from_date,
                to_date: req.query.to_date
            };

            const events = await EventModel.getAll(filters);
            
            res.json({
                success: true,
                count: events.length,
                data: events
            });
        } catch (error) {
            console.error('Error obteniendo eventos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener eventos'
            });
        }
    }

    // GET /api/events/:id
    async getEventById(req, res) {
        try {
            const { id } = req.params;
            const event = await EventModel.getById(id);
            
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            res.json({
                success: true,
                data: event
            });
        } catch (error) {
            console.error('Error obteniendo evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener evento'
            });
        }
    }

    // POST /api/events
    async createEvent(req, res) {
        try {
            const { client_id, event_name, event_date } = req.body;

            // Validaciones básicas
            if (!client_id || !event_name || !event_date) {
                return res.status(400).json({
                    success: false,
                    error: 'client_id, event_name y event_date son requeridos'
                });
            }

            // Verificar que el cliente existe
            const client = await ClientModel.getById(client_id);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Cliente no encontrado'
                });
            }

            // Validar que la fecha del evento no sea en el pasado
            const eventDate = new Date(event_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (eventDate < today && req.body.status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    error: 'La fecha del evento no puede ser en el pasado'
                });
            }

            // Crear evento
            const eventId = await EventModel.create(req.body);
            const newEvent = await EventModel.getById(eventId);

            res.status(201).json({
                success: true,
                message: 'Evento creado exitosamente',
                data: newEvent
            });
        } catch (error) {
            console.error('Error creando evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear evento'
            });
        }
    }

    // PUT /api/events/:id
    async updateEvent(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el evento existe
            const event = await EventModel.getById(id);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            // Actualizar evento
            const updated = await EventModel.update(id, req.body);
            
            if (updated) {
                const updatedEvent = await EventModel.getById(id);
                res.json({
                    success: true,
                    message: 'Evento actualizado exitosamente',
                    data: updatedEvent
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el evento'
                });
            }
        } catch (error) {
            console.error('Error actualizando evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar evento'
            });
        }
    }

    // DELETE /api/events/:id
    async deleteEvent(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el evento existe
            const event = await EventModel.getById(id);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            // No permitir eliminar eventos activos
            if (event.status === 'active') {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar un evento activo'
                });
            }

            // Eliminar evento
            const deleted = await EventModel.delete(id);
            
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Evento eliminado exitosamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo eliminar el evento'
                });
            }
        } catch (error) {
            console.error('Error eliminando evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar evento'
            });
        }
    }

    // GET /api/events/client/:clientId
    async getEventsByClient(req, res) {
        try {
            const { clientId } = req.params;
            
            // Verificar que el cliente existe
            const client = await ClientModel.getById(clientId);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Cliente no encontrado'
                });
            }

            const events = await EventModel.getByClientId(clientId);
            const stats = await EventModel.getStatsByClient(clientId);

            res.json({
                success: true,
                client: client.company_name,
                stats,
                count: events.length,
                data: events
            });
        } catch (error) {
            console.error('Error obteniendo eventos del cliente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener eventos del cliente'
            });
        }
    }

    // GET /api/events/active
    async getActiveEvents(req, res) {
        try {
            const events = await EventModel.getActiveEvents();
            
            res.json({
                success: true,
                count: events.length,
                data: events
            });
        } catch (error) {
            console.error('Error obteniendo eventos activos:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener eventos activos'
            });
        }
    }

    // PATCH /api/events/:id/status
    async updateEventStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            // Validar estado
            const validStatuses = ['scheduled', 'active', 'completed', 'cancelled'];
            if (!status || !validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`
                });
            }

            // Verificar que el evento existe
            const event = await EventModel.getById(id);
            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Evento no encontrado'
                });
            }

            // Actualizar estado
            const updated = await EventModel.updateStatus(id, status);
            
            if (updated) {
                const updatedEvent = await EventModel.getById(id);
                res.json({
                    success: true,
                    message: `Estado del evento actualizado a: ${status}`,
                    data: updatedEvent
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el estado'
                });
            }
        } catch (error) {
            console.error('Error actualizando estado del evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar estado del evento'
            });
        }
    }
}

module.exports = new EventController();