const db = require('../config/database');

class EventModel {
    // Obtener todos los eventos
    static async getAll(filters = {}) {
        let sql = `
            SELECT 
                e.*,
                c.company_name as client_name,
                c.email as client_email,
                c.phone as client_phone
            FROM events e
            LEFT JOIN clients c ON e.client_id = c.id
            WHERE 1=1
        `;
        const params = [];

        // Aplicar filtros opcionales
        if (filters.client_id) {
            sql += ' AND e.client_id = ?';
            params.push(filters.client_id);
        }

        if (filters.status) {
            sql += ' AND e.status = ?';
            params.push(filters.status);
        }

        if (filters.from_date) {
            sql += ' AND e.event_date >= ?';
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            sql += ' AND e.event_date <= ?';
            params.push(filters.to_date);
        }

        sql += ' ORDER BY e.event_date DESC, e.start_time DESC';
        
        return await db.allAsync(sql, params);
    }

    // Obtener evento por ID
    static async getById(id) {
        const sql = `
            SELECT 
                e.*,
                c.company_name as client_name,
                c.email as client_email,
                c.phone as client_phone,
                c.contact_name as client_contact
            FROM events e
            LEFT JOIN clients c ON e.client_id = c.id
            WHERE e.id = ?
        `;
        return await db.getAsync(sql, [id]);
    }

    // Crear nuevo evento
    static async create(eventData) {
        const { 
            client_id, 
            event_name, 
            event_date, 
            start_time, 
            end_time, 
            location, 
            max_guests, 
            status,
            notes 
        } = eventData;

        const sql = `
            INSERT INTO events (
                client_id, event_name, event_date, start_time, 
                end_time, location, max_guests, status, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.runAsync(sql, [
            client_id, 
            event_name, 
            event_date, 
            start_time, 
            end_time, 
            location, 
            max_guests, 
            status || 'scheduled',
            notes
        ]);
        
        return result.id;
    }

    // Actualizar evento
    static async update(id, eventData) {
        const { 
            event_name, 
            event_date, 
            start_time, 
            end_time, 
            location, 
            max_guests, 
            status,
            notes 
        } = eventData;

        const sql = `
            UPDATE events 
            SET event_name = ?, event_date = ?, start_time = ?, 
                end_time = ?, location = ?, max_guests = ?, 
                status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const result = await db.runAsync(sql, [
            event_name, 
            event_date, 
            start_time, 
            end_time, 
            location, 
            max_guests, 
            status,
            notes,
            id
        ]);
        
        return result.changes > 0;
    }

    // Eliminar evento
    static async delete(id) {
        const sql = 'DELETE FROM events WHERE id = ?';
        const result = await db.runAsync(sql, [id]);
        return result.changes > 0;
    }

    // Obtener eventos de un cliente específico
    static async getByClientId(clientId) {
        const sql = `
            SELECT * FROM events 
            WHERE client_id = ? 
            ORDER BY event_date DESC, start_time DESC
        `;
        return await db.allAsync(sql, [clientId]);
    }

    // Obtener eventos activos (los que están ocurriendo ahora)
    static async getActiveEvents() {
        const sql = `
            SELECT 
                e.*,
                c.company_name as client_name
            FROM events e
            LEFT JOIN clients c ON e.client_id = c.id
            WHERE e.status = 'active'
            OR (e.status = 'scheduled' 
                AND date(e.event_date) = date('now', 'localtime')
                AND time(e.start_time) <= time('now', 'localtime')
                AND time(e.end_time) >= time('now', 'localtime'))
        `;
        return await db.allAsync(sql);
    }

    // Actualizar estado del evento
    static async updateStatus(id, status) {
        const sql = `
            UPDATE events 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.runAsync(sql, [status, id]);
        return result.changes > 0;
    }

    // Obtener estadísticas de eventos por cliente
    static async getStatsByClient(clientId) {
        const sql = `
            SELECT 
                COUNT(*) as total_events,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_events,
                SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_events,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_events
            FROM events
            WHERE client_id = ?
        `;
        return await db.getAsync(sql, [clientId]);
    }
}

module.exports = EventModel;