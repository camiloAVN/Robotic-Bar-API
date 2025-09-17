const db = require('../config/database');
const crypto = require('crypto');

class UserModel {
    // Generar código de acceso único
    static generateAccessCode() {
        return crypto.randomBytes(3).toString('hex').toUpperCase();
    }

    // Obtener todos los usuarios
    static async getAll(filters = {}) {
        let sql = `
            SELECT 
                u.*,
                e.event_name,
                e.event_date,
                c.company_name as client_name
            FROM users u
            LEFT JOIN events e ON u.event_id = e.id
            LEFT JOIN clients c ON e.client_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.event_id) {
            sql += ' AND u.event_id = ?';
            params.push(filters.event_id);
        }

        if (filters.checked_in !== undefined) {
            sql += ' AND u.checked_in = ?';
            params.push(filters.checked_in ? 1 : 0);
        }

        if (filters.is_vip !== undefined) {
            sql += ' AND u.is_vip = ?';
            params.push(filters.is_vip ? 1 : 0);
        }

        sql += ' ORDER BY u.created_at DESC';
        
        return await db.allAsync(sql, params);
    }

    // Obtener usuario por ID
    static async getById(id) {
        const sql = `
            SELECT 
                u.*,
                e.event_name,
                e.event_date,
                e.status as event_status,
                c.company_name as client_name
            FROM users u
            LEFT JOIN events e ON u.event_id = e.id
            LEFT JOIN clients c ON e.client_id = c.id
            WHERE u.id = ?
        `;
        return await db.getAsync(sql, [id]);
    }

    // Crear nuevo usuario
    static async create(userData) {
        const { 
            event_id, 
            name, 
            email, 
            phone, 
            age, 
            max_drinks,
            is_vip,
            table_number
        } = userData;

        // Generar código de acceso único
        let access_code;
        let codeExists = true;
        
        // Intentar generar un código único (máximo 5 intentos)
        for (let i = 0; i < 5 && codeExists; i++) {
            access_code = this.generateAccessCode();
            const existing = await db.getAsync(
                'SELECT id FROM users WHERE access_code = ?', 
                [access_code]
            );
            codeExists = !!existing;
        }

        const sql = `
            INSERT INTO users (
                event_id, name, email, phone, age, 
                max_drinks, is_vip, table_number, access_code
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.runAsync(sql, [
            event_id, 
            name, 
            email, 
            phone, 
            age,
            max_drinks || 10,
            is_vip ? 1 : 0,
            table_number,
            access_code
        ]);
        
        return result.id;
    }

    // Actualizar usuario
    static async update(id, userData) {
        const { 
            name, 
            email, 
            phone, 
            age, 
            max_drinks,
            is_vip,
            table_number
        } = userData;

        const sql = `
            UPDATE users 
            SET name = ?, email = ?, phone = ?, age = ?, 
                max_drinks = ?, is_vip = ?, table_number = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const result = await db.runAsync(sql, [
            name, 
            email, 
            phone, 
            age,
            max_drinks,
            is_vip ? 1 : 0,
            table_number,
            id
        ]);
        
        return result.changes > 0;
    }

    // Eliminar usuario
    static async delete(id) {
        const sql = 'DELETE FROM users WHERE id = ?';
        const result = await db.runAsync(sql, [id]);
        return result.changes > 0;
    }

    // Obtener usuarios por evento
    static async getByEventId(eventId) {
        const sql = `
            SELECT * FROM users 
            WHERE event_id = ? 
            ORDER BY name ASC
        `;
        return await db.allAsync(sql, [eventId]);
    }

    // Buscar usuario por código de acceso
    static async getByAccessCode(accessCode) {
        const sql = `
            SELECT 
                u.*,
                e.event_name,
                e.event_date,
                e.status as event_status
            FROM users u
            LEFT JOIN events e ON u.event_id = e.id
            WHERE u.access_code = ?
        `;
        return await db.getAsync(sql, [accessCode.toUpperCase()]);
    }

    // Check-in de usuario
    static async checkIn(id) {
        const sql = `
            UPDATE users 
            SET checked_in = 1, 
                check_in_time = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND checked_in = 0
        `;
        const result = await db.runAsync(sql, [id]);
        return result.changes > 0;
    }

    // Actualizar consumo de bebidas
    static async updateDrinksConsumed(id, increment = 1) {
        // Primero verificar el límite
        const user = await this.getById(id);
        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        if (user.drinks_consumed + increment > user.max_drinks) {
            throw new Error('Límite de bebidas excedido');
        }

        const sql = `
            UPDATE users 
            SET drinks_consumed = drinks_consumed + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.runAsync(sql, [increment, id]);
        return result.changes > 0;
    }

    // Verificar si el email ya existe en el evento
    static async emailExistsInEvent(eventId, email) {
        const sql = 'SELECT id FROM users WHERE event_id = ? AND email = ?';
        const result = await db.getAsync(sql, [eventId, email]);
        return !!result;
    }

    // Obtener estadísticas del evento
    static async getEventStats(eventId) {
        const sql = `
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN checked_in = 1 THEN 1 ELSE 0 END) as checked_in_users,
                SUM(CASE WHEN is_vip = 1 THEN 1 ELSE 0 END) as vip_users,
                SUM(drinks_consumed) as total_drinks_consumed,
                AVG(drinks_consumed) as avg_drinks_per_user,
                SUM(CASE WHEN age < 18 THEN 1 ELSE 0 END) as minors
            FROM users
            WHERE event_id = ?
        `;
        return await db.getAsync(sql, [eventId]);
    }

    // Importación masiva de usuarios
    static async bulkCreate(eventId, usersData) {
        const sql = `
            INSERT INTO users (
                event_id, name, email, phone, age, 
                max_drinks, is_vip, table_number, access_code
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const results = [];
        for (const userData of usersData) {
            try {
                // Generar código único para cada usuario
                let access_code = this.generateAccessCode();
                
                const result = await db.runAsync(sql, [
                    eventId,
                    userData.name,
                    userData.email,
                    userData.phone,
                    userData.age,
                    userData.max_drinks || 10,
                    userData.is_vip ? 1 : 0,
                    userData.table_number,
                    access_code
                ]);

                results.push({
                    success: true,
                    id: result.id,
                    name: userData.name,
                    access_code
                });
            } catch (error) {
                results.push({
                    success: false,
                    name: userData.name,
                    error: error.message
                });
            }
        }

        return results;
    }
}

module.exports = UserModel;