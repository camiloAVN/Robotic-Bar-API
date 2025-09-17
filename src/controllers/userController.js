const UserModel = require('../models/userModel');
const EventModel = require('../models/eventModel');

class UserController {
    // GET /api/users
    async getAllUsers(req, res) {
        try {
            const filters = {
                event_id: req.query.event_id,
                checked_in: req.query.checked_in === 'true',
                is_vip: req.query.is_vip === 'true'
            };

            const users = await UserModel.getAll(filters);
            
            res.json({
                success: true,
                count: users.length,
                data: users
            });
        } catch (error) {
            console.error('Error obteniendo usuarios:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener usuarios'
            });
        }
    }

    // GET /api/users/:id
    async getUserById(req, res) {
        try {
            const { id } = req.params;
            const user = await UserModel.getById(id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            console.error('Error obteniendo usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener usuario'
            });
        }
    }

    // POST /api/users
    async createUser(req, res) {
        try {
            const { event_id, name, email, age } = req.body;

            // Validaciones básicas
            if (!event_id || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'event_id y name son requeridos'
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

            // Verificar que el evento no esté completado o cancelado
            if (event.status === 'completed' || event.status === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    error: `No se pueden agregar usuarios a un evento ${event.status}`
                });
            }

            // Verificar si el email ya existe en el evento
            if (email) {
                const emailExists = await UserModel.emailExistsInEvent(event_id, email);
                if (emailExists) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ya existe un usuario con ese email en este evento'
                    });
                }
            }

            // Verificar edad mínima si se proporciona
            if (age && age < 18) {
                req.body.max_drinks = 0; // Menores no pueden beber
            }

            // Crear usuario
            const userId = await UserModel.create(req.body);
            const newUser = await UserModel.getById(userId);

            res.status(201).json({
                success: true,
                message: 'Usuario creado exitosamente',
                data: newUser,
                access_code: newUser.access_code
            });
        } catch (error) {
            console.error('Error creando usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear usuario'
            });
        }
    }

    // PUT /api/users/:id
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el usuario existe
            const user = await UserModel.getById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            // Si se actualiza la edad a menor de 18, ajustar max_drinks
            if (req.body.age && req.body.age < 18) {
                req.body.max_drinks = 0;
            }

            // Actualizar usuario
            const updated = await UserModel.update(id, req.body);
            
            if (updated) {
                const updatedUser = await UserModel.getById(id);
                res.json({
                    success: true,
                    message: 'Usuario actualizado exitosamente',
                    data: updatedUser
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el usuario'
                });
            }
        } catch (error) {
            console.error('Error actualizando usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar usuario'
            });
        }
    }

    // DELETE /api/users/:id
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el usuario existe
            const user = await UserModel.getById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            // No permitir eliminar usuarios que ya hicieron check-in
            if (user.checked_in) {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar un usuario que ya hizo check-in'
                });
            }

            // Eliminar usuario
            const deleted = await UserModel.delete(id);
            
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Usuario eliminado exitosamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo eliminar el usuario'
                });
            }
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar usuario'
            });
        }
    }

    // GET /api/users/event/:eventId
    async getUsersByEvent(req, res) {
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

            const users = await UserModel.getByEventId(eventId);
            const stats = await UserModel.getEventStats(eventId);

            res.json({
                success: true,
                event: event.event_name,
                stats,
                count: users.length,
                data: users
            });
        } catch (error) {
            console.error('Error obteniendo usuarios del evento:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener usuarios del evento'
            });
        }
    }

    // GET /api/users/access/:code
    async getUserByAccessCode(req, res) {
        try {
            const { code } = req.params;
            
            const user = await UserModel.getByAccessCode(code);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Código de acceso inválido'
                });
            }

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            console.error('Error buscando por código de acceso:', error);
            res.status(500).json({
                success: false,
                error: 'Error al buscar usuario'
            });
        }
    }

    // POST /api/users/:id/checkin
    async checkInUser(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el usuario existe
            const user = await UserModel.getById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            // Verificar que el evento está activo
            if (user.event_status !== 'active' && user.event_status !== 'scheduled') {
                return res.status(400).json({
                    success: false,
                    error: 'El evento no está activo'
                });
            }

            // Verificar si ya hizo check-in
            if (user.checked_in) {
                return res.status(400).json({
                    success: false,
                    error: 'El usuario ya hizo check-in'
                });
            }

            // Hacer check-in
            const checkedIn = await UserModel.checkIn(id);
            
            if (checkedIn) {
                const updatedUser = await UserModel.getById(id);
                res.json({
                    success: true,
                    message: 'Check-in exitoso',
                    data: updatedUser
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo hacer check-in'
                });
            }
        } catch (error) {
            console.error('Error en check-in:', error);
            res.status(500).json({
                success: false,
                error: 'Error al hacer check-in'
            });
        }
    }

    // POST /api/users/:id/drink
    async addDrink(req, res) {
        try {
            const { id } = req.params;
            const { quantity = 1 } = req.body;
            
            // Verificar que el usuario existe
            const user = await UserModel.getById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Usuario no encontrado'
                });
            }

            // Verificar que el usuario hizo check-in
            if (!user.checked_in) {
                return res.status(400).json({
                    success: false,
                    error: 'El usuario debe hacer check-in primero'
                });
            }

            // Verificar edad
            if (user.age && user.age < 18) {
                return res.status(403).json({
                    success: false,
                    error: 'Usuario menor de edad no puede consumir bebidas alcohólicas'
                });
            }

            // Actualizar consumo
            await UserModel.updateDrinksConsumed(id, quantity);
            const updatedUser = await UserModel.getById(id);
            
            res.json({
                success: true,
                message: 'Bebida registrada',
                data: {
                    drinks_consumed: updatedUser.drinks_consumed,
                    max_drinks: updatedUser.max_drinks,
                    remaining: updatedUser.max_drinks - updatedUser.drinks_consumed
                }
            });
        } catch (error) {
            console.error('Error agregando bebida:', error);
            
            if (error.message === 'Límite de bebidas excedido') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            
            res.status(500).json({
                success: false,
                error: 'Error al registrar bebida'
            });
        }
    }

    // POST /api/users/bulk
    async bulkCreateUsers(req, res) {
        try {
            const { event_id, users } = req.body;

            // Validaciones
            if (!event_id || !users || !Array.isArray(users)) {
                return res.status(400).json({
                    success: false,
                    error: 'event_id y users (array) son requeridos'
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

            // Importar usuarios
            const results = await UserModel.bulkCreate(event_id, users);
            
            const successful = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            res.status(201).json({
                success: true,
                message: `${successful.length} usuarios creados, ${failed.length} fallidos`,
                data: {
                    successful,
                    failed
                }
            });
        } catch (error) {
            console.error('Error en creación masiva:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear usuarios'
            });
        }
    }
}

module.exports = new UserController();