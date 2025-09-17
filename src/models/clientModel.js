const db = require('../config/database');

class ClientModel {
    // Obtener todos los clientes
    static async getAll() {
        const sql = 'SELECT * FROM clients ORDER BY created_at DESC';
        return await db.allAsync(sql);
    }

    // Obtener cliente por ID
    static async getById(id) {
        const sql = 'SELECT * FROM clients WHERE id = ?';
        return await db.getAsync(sql, [id]);
    }

    // Crear nuevo cliente
    static async create(clientData) {
        const { company_name, contact_name, email, phone, address } = clientData;
        const sql = `
            INSERT INTO clients (company_name, contact_name, email, phone, address)
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await db.runAsync(sql, [company_name, contact_name, email, phone, address]);
        return result.id;
    }

    // Actualizar cliente
    static async update(id, clientData) {
        const { company_name, contact_name, email, phone, address } = clientData;
        const sql = `
            UPDATE clients 
            SET company_name = ?, contact_name = ?, email = ?, phone = ?, address = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.runAsync(sql, [company_name, contact_name, email, phone, address, id]);
        return result.changes > 0;
    }

    // Eliminar cliente
    static async delete(id) {
        const sql = 'DELETE FROM clients WHERE id = ?';
        const result = await db.runAsync(sql, [id]);
        return result.changes > 0;
    }

    // Buscar cliente por email
    static async findByEmail(email) {
        const sql = 'SELECT * FROM clients WHERE email = ?';
        return await db.getAsync(sql, [email]);
    }
}

module.exports = ClientModel;
