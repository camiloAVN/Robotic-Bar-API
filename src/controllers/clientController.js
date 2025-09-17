const ClientModel = require('../models/clientModel');

class ClientController {
    // GET /api/clients
    async getAllClients(req, res) {
        try {
            const clients = await ClientModel.getAll();
            res.json({
                success: true,
                count: clients.length,
                data: clients
            });
        } catch (error) {
            console.error('Error obteniendo clientes:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener clientes'
            });
        }
    }

    // GET /api/clients/:id
    async getClientById(req, res) {
        try {
            const { id } = req.params;
            const client = await ClientModel.getById(id);
            
            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Cliente no encontrado'
                });
            }

            res.json({
                success: true,
                data: client
            });
        } catch (error) {
            console.error('Error obteniendo cliente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al obtener cliente'
            });
        }
    }

    // POST /api/clients
    async createClient(req, res) {
        try {
            const { company_name, email } = req.body; // todo: añadir contact_name, phone, address 

            // Validaciones básicas
            if (!company_name || !email) {
                return res.status(400).json({
                    success: false,
                    error: 'company_name y email son requeridos'
                });
            }

            // Verificar si el email ya existe
            const existingClient = await ClientModel.findByEmail(email);
            if (existingClient) {
                return res.status(400).json({
                    success: false,
                    error: 'Ya existe un cliente con ese email'
                });
            }

            // Crear cliente
            const clientId = await ClientModel.create(req.body);
            const newClient = await ClientModel.getById(clientId);

            res.status(201).json({
                success: true,
                message: 'Cliente creado exitosamente',
                data: newClient
            });
        } catch (error) {
            console.error('Error creando cliente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al crear cliente'
            });
        }
    }

    // PUT /api/clients/:id
    async updateClient(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el cliente existe
            const client = await ClientModel.getById(id);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Cliente no encontrado'
                });
            }

            // Actualizar cliente
            const updated = await ClientModel.update(id, req.body);
            
            if (updated) {
                const updatedClient = await ClientModel.getById(id);
                res.json({
                    success: true,
                    message: 'Cliente actualizado exitosamente',
                    data: updatedClient
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo actualizar el cliente'
                });
            }
        } catch (error) {
            console.error('Error actualizando cliente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al actualizar cliente'
            });
        }
    }

    // DELETE /api/clients/:id
    async deleteClient(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar que el cliente existe
            const client = await ClientModel.getById(id);
            if (!client) {
                return res.status(404).json({
                    success: false,
                    error: 'Cliente no encontrado'
                });
            }

            // Eliminar cliente
            const deleted = await ClientModel.delete(id);
            
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Cliente eliminado exitosamente'
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: 'No se pudo eliminar el cliente'
                });
            }
        } catch (error) {
            console.error('Error eliminando cliente:', error);
            res.status(500).json({
                success: false,
                error: 'Error al eliminar cliente'
            });
        }
    }
}

module.exports = new ClientController();