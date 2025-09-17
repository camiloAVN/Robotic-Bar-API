const db = require('../config/database');

class InventoryModel {
    // Obtener todo el inventario
    static async getAll(filters = {}) {
        let sql = `
            SELECT 
                inv.*,
                e.event_name,
                e.event_date,
                e.status as event_status,
                i.ingredient_name,
                i.category,
                i.position,
                i.cost_per_unit,
                i.min_stock,
                (inv.initial_quantity - inv.current_quantity) as consumed_quantity,
                ROUND(((inv.initial_quantity - inv.current_quantity) / NULLIF(inv.initial_quantity, 0)) * 100, 2) as consumption_percentage
            FROM inventory inv
            LEFT JOIN events e ON inv.event_id = e.id
            LEFT JOIN ingredients i ON inv.ingredient_id = i.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.event_id) {
            sql += ' AND inv.event_id = ?';
            params.push(filters.event_id);
        }

        if (filters.ingredient_id) {
            sql += ' AND inv.ingredient_id = ?';
            params.push(filters.ingredient_id);
        }

        if (filters.low_stock) {
            sql += ' AND inv.current_quantity < i.min_stock';
        }

        sql += ' ORDER BY e.event_date DESC, i.ingredient_name';
        
        return await db.allAsync(sql, params);
    }

    // Obtener inventario por ID
    static async getById(id) {
        const sql = `
            SELECT 
                inv.*,
                e.event_name,
                e.event_date,
                e.status as event_status,
                i.ingredient_name,
                i.category,
                i.position,
                i.cost_per_unit
            FROM inventory inv
            LEFT JOIN events e ON inv.event_id = e.id
            LEFT JOIN ingredients i ON inv.ingredient_id = i.id
            WHERE inv.id = ?
        `;
        return await db.getAsync(sql, [id]);
    }

    // Crear inventario para un evento
    static async create(inventoryData) {
        const { 
            event_id, 
            ingredient_id, 
            initial_quantity, 
            bottle_size,
            bottles_count,
            unit
        } = inventoryData;

        const sql = `
            INSERT INTO inventory (
                event_id, ingredient_id, initial_quantity, current_quantity,
                bottle_size, bottles_count, unit
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const totalQuantity = initial_quantity || (bottle_size * bottles_count);
        
        const result = await db.runAsync(sql, [
            event_id, 
            ingredient_id, 
            totalQuantity,
            totalQuantity, // current_quantity empieza igual a initial
            bottle_size || 750,
            bottles_count || 1,
            unit || 'ml'
        ]);
        
        return result.id;
    }

    // Actualizar inventario
    static async update(id, inventoryData) {
        const { 
            initial_quantity, 
            current_quantity,
            bottle_size,
            bottles_count
        } = inventoryData;

        const sql = `
            UPDATE inventory 
            SET initial_quantity = ?, current_quantity = ?,
                bottle_size = ?, bottles_count = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const result = await db.runAsync(sql, [
            initial_quantity,
            current_quantity,
            bottle_size,
            bottles_count,
            id
        ]);
        
        return result.changes > 0;
    }

    // Eliminar inventario
    static async delete(id) {
        const sql = 'DELETE FROM inventory WHERE id = ?';
        const result = await db.runAsync(sql, [id]);
        return result.changes > 0;
    }

    // Obtener inventario de un evento
    static async getByEventId(eventId) {
        const sql = `
            SELECT 
                inv.*,
                i.ingredient_name,
                i.category,
                i.position,
                i.cost_per_unit,
                i.color,
                (inv.initial_quantity - inv.current_quantity) as consumed_quantity,
                ROUND(((inv.initial_quantity - inv.current_quantity) / NULLIF(inv.initial_quantity, 0)) * 100, 2) as consumption_percentage
            FROM inventory inv
            LEFT JOIN ingredients i ON inv.ingredient_id = i.id
            WHERE inv.event_id = ?
            ORDER BY i.position, i.ingredient_name
        `;
        return await db.allAsync(sql, [eventId]);
    }

    // Consumir ingrediente (actualizar cantidad)
    static async consume(eventId, ingredientId, quantity) {
        // Primero verificar que hay suficiente inventario
        const current = await db.getAsync(
            'SELECT current_quantity FROM inventory WHERE event_id = ? AND ingredient_id = ?',
            [eventId, ingredientId]
        );

        if (!current) {
            throw new Error('No hay inventario para este ingrediente en este evento');
        }

        if (current.current_quantity < quantity) {
            throw new Error(`Inventario insuficiente. Disponible: ${current.current_quantity}`);
        }

        const sql = `
            UPDATE inventory 
            SET current_quantity = current_quantity - ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE event_id = ? AND ingredient_id = ?
        `;
        
        const result = await db.runAsync(sql, [quantity, eventId, ingredientId]);
        return result.changes > 0;
    }

    // Reabastecer ingrediente
    static async restock(id, additionalQuantity) {
        const sql = `
            UPDATE inventory 
            SET current_quantity = current_quantity + ?,
                initial_quantity = initial_quantity + ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const result = await db.runAsync(sql, [additionalQuantity, additionalQuantity, id]);
        return result.changes > 0;
    }

    // Verificar disponibilidad de ingredientes para un evento
    static async checkAvailability(eventId, ingredientId, requiredQuantity) {
        const sql = `
            SELECT current_quantity 
            FROM inventory 
            WHERE event_id = ? AND ingredient_id = ?
        `;
        
        const result = await db.getAsync(sql, [eventId, ingredientId]);
        
        if (!result) {
            return { available: false, message: 'Ingrediente no disponible en el inventario' };
        }
        
        if (result.current_quantity < requiredQuantity) {
            return { 
                available: false, 
                message: `Cantidad insuficiente. Disponible: ${result.current_quantity}`,
                current_quantity: result.current_quantity
            };
        }
        
        return { 
            available: true, 
            current_quantity: result.current_quantity,
            remaining_after: result.current_quantity - requiredQuantity
        };
    }

    // Obtener ingredientes con bajo stock
    static async getLowStock(eventId) {
        const sql = `
            SELECT 
                inv.*,
                i.ingredient_name,
                i.category,
                i.position,
                i.min_stock,
                (inv.current_quantity / NULLIF(i.min_stock, 0) * 100) as stock_percentage
            FROM inventory inv
            LEFT JOIN ingredients i ON inv.ingredient_id = i.id
            WHERE inv.event_id = ? 
            AND inv.current_quantity < i.min_stock
            ORDER BY stock_percentage ASC
        `;
        return await db.allAsync(sql, [eventId]);
    }

    // Inicializar inventario para un evento (copiar de un template o evento anterior)
    static async initializeFromTemplate(eventId, templateEventId = null) {
        try {
            let sql;
            let params;

            if (templateEventId) {
                // Copiar de un evento anterior
                sql = `
                    INSERT INTO inventory (event_id, ingredient_id, initial_quantity, current_quantity, bottle_size, bottles_count, unit)
                    SELECT ?, ingredient_id, initial_quantity, initial_quantity, bottle_size, bottles_count, unit
                    FROM inventory
                    WHERE event_id = ?
                `;
                params = [eventId, templateEventId];
            } else {
                // Crear inventario básico con todos los ingredientes disponibles
                sql = `
                    INSERT INTO inventory (event_id, ingredient_id, initial_quantity, current_quantity, bottle_size, bottles_count, unit)
                    SELECT ?, id, 1000, 1000, 750, 2, COALESCE(unit, 'ml')
                    FROM ingredients
                    WHERE is_available = 1
                `;
                params = [eventId];
            }

            const result = await db.runAsync(sql, params);
            return result.changes;
        } catch (error) {
            console.error('Error inicializando inventario:', error);
            throw error;
        }
    }

    // Obtener estadísticas de consumo del evento
    static async getConsumptionStats(eventId) {
        const sql = `
            SELECT 
                COUNT(*) as total_ingredients,
                SUM(initial_quantity - current_quantity) as total_consumed,
                SUM((initial_quantity - current_quantity) * i.cost_per_unit) as total_cost,
                AVG((initial_quantity - current_quantity) / NULLIF(initial_quantity, 0) * 100) as avg_consumption_percentage,
                SUM(CASE WHEN current_quantity < i.min_stock THEN 1 ELSE 0 END) as low_stock_count
            FROM inventory inv
            LEFT JOIN ingredients i ON inv.ingredient_id = i.id
            WHERE inv.event_id = ?
        `;
        return await db.getAsync(sql, [eventId]);
    }

    // Obtener resumen de inventario por categoría
    static async getInventoryByCategory(eventId) {
        const sql = `
            SELECT 
                i.category,
                COUNT(*) as ingredient_count,
                SUM(inv.initial_quantity) as total_initial,
                SUM(inv.current_quantity) as total_current,
                SUM(inv.initial_quantity - inv.current_quantity) as total_consumed,
                ROUND(AVG((inv.initial_quantity - inv.current_quantity) / NULLIF(inv.initial_quantity, 0) * 100), 2) as avg_consumption_percentage
            FROM inventory inv
            LEFT JOIN ingredients i ON inv.ingredient_id = i.id
            WHERE inv.event_id = ?
            GROUP BY i.category
            ORDER BY i.category
        `;
        return await db.allAsync(sql, [eventId]);
    }

    // Verificar si existe inventario para un evento/ingrediente
    static async exists(eventId, ingredientId) {
        const sql = 'SELECT id FROM inventory WHERE event_id = ? AND ingredient_id = ?';
        const result = await db.getAsync(sql, [eventId, ingredientId]);
        return !!result;
    }
}

module.exports = InventoryModel;
