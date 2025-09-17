const db = require('../config/database');
const CocktailModel = require('./cocktailModel');
const InventoryModel = require('./inventoryModel');
const UserModel = require('./userModel');

class OrderModel {
    // Obtener todas las órdenes
    static async getAll(filters = {}) {
        let sql = `
            SELECT 
                o.*,
                e.event_name,
                u.name as user_name,
                u.table_number,
                c.cocktail_name,
                c.category as cocktail_category,
                c.is_alcoholic
            FROM orders o
            LEFT JOIN events e ON o.event_id = e.id
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN cocktails c ON o.cocktail_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.event_id) {
            sql += ' AND o.event_id = ?';
            params.push(filters.event_id);
        }

        if (filters.user_id) {
            sql += ' AND o.user_id = ?';
            params.push(filters.user_id);
        }

        if (filters.status) {
            sql += ' AND o.status = ?';
            params.push(filters.status);
        }

        if (filters.from_date) {
            sql += ' AND DATE(o.created_at) >= DATE(?)';
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            sql += ' AND DATE(o.created_at) <= DATE(?)';
            params.push(filters.to_date);
        }

        sql += ' ORDER BY o.created_at DESC';
        
        return await db.allAsync(sql, params);
    }

    // Obtener orden por ID
    static async getById(id) {
        const sql = `
            SELECT 
                o.*,
                e.event_name,
                e.status as event_status,
                u.name as user_name,
                u.table_number,
                u.access_code,
                c.cocktail_name,
                c.category as cocktail_category,
                c.base_price
            FROM orders o
            LEFT JOIN events e ON o.event_id = e.id
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN cocktails c ON o.cocktail_id = c.id
            WHERE o.id = ?
        `;
        
        const order = await db.getAsync(sql, [id]);
        
        if (order) {
            // Obtener ingredientes consumidos
            const consumptionSql = `
                SELECT 
                    oc.*,
                    i.ingredient_name,
                    i.position
                FROM order_consumption oc
                LEFT JOIN ingredients i ON oc.ingredient_id = i.id
                WHERE oc.order_id = ?
            `;
            order.consumption = await db.allAsync(consumptionSql, [id]);
        }
        
        return order;
    }

    // Crear nueva orden
    static async create(orderData) {
        const { 
            event_id, 
            user_id, 
            cocktail_id,
            notes
        } = orderData;

        // Obtener información del cóctel
        const cocktail = await CocktailModel.getById(cocktail_id);
        if (!cocktail) {
            throw new Error('Cóctel no encontrado');
        }

        // Obtener comandos para el robot
        const robotCommands = await CocktailModel.getRobotCommands(cocktail_id);

        // Calcular posición en la cola
        const queueResult = await db.getAsync(
            'SELECT MAX(queue_position) as max_queue FROM orders WHERE event_id = ? AND status IN ("pending", "preparing")',
            [event_id]
        );
        const queuePosition = (queueResult.max_queue || 0) + 1;

        const sql = `
            INSERT INTO orders (
                event_id, user_id, cocktail_id, status, 
                queue_position, robot_commands, total_ml, price, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.runAsync(sql, [
            event_id, 
            user_id, 
            cocktail_id,
            'pending',
            queuePosition,
            JSON.stringify(robotCommands.commands),
            cocktail.total_ml,
            cocktail.base_price,
            notes
        ]);
        
        return result.id;
    }

    // Actualizar estado de orden
    static async updateStatus(id, status) {
        let sql;
        let params;

        if (status === 'preparing') {
            sql = `
                UPDATE orders 
                SET status = ?, preparation_start = CURRENT_TIMESTAMP, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            params = [status, id];
        } else if (status === 'ready' || status === 'delivered') {
            sql = `
                UPDATE orders 
                SET status = ?, preparation_end = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            params = [status, id];
        } else {
            sql = `
                UPDATE orders 
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            params = [status, id];
        }
        
        const result = await db.runAsync(sql, params);
        return result.changes > 0;
    }

    // Procesar orden (consumir inventario y registrar)
    static async processOrder(orderId) {
        const order = await this.getById(orderId);
        if (!order) {
            throw new Error('Orden no encontrada');
        }

        if (order.status !== 'pending') {
            throw new Error(`La orden ya está en estado: ${order.status}`);
        }

        // Obtener ingredientes del cóctel
        const cocktail = await CocktailModel.getById(order.cocktail_id);
        
        // Verificar disponibilidad
        const availability = await CocktailModel.checkAvailability(order.cocktail_id, order.event_id);
        if (!availability.can_prepare) {
            throw new Error('Ingredientes insuficientes para preparar el cóctel');
        }

        // Actualizar estado a "preparing"
        await this.updateStatus(orderId, 'preparing');

        // Consumir del inventario y registrar consumo
        for (const ingredient of cocktail.ingredients) {
            try {
                // Consumir del inventario
                await InventoryModel.consume(order.event_id, ingredient.ingredient_id, ingredient.quantity);
                
                // Registrar consumo en la orden
                await db.runAsync(
                    'INSERT INTO order_consumption (order_id, ingredient_id, quantity_used) VALUES (?, ?, ?)',
                    [orderId, ingredient.ingredient_id, ingredient.quantity]
                );
            } catch (error) {
                // Si falla, revertir el estado
                await this.updateStatus(orderId, 'cancelled');
                throw error;
            }
        }

        // Si el usuario tiene límite de bebidas, actualizar su consumo
        if (order.user_id) {
            await UserModel.updateDrinksConsumed(order.user_id, 1);
        }

        return true;
    }

    // Cancelar orden
    static async cancel(id) {
        const order = await this.getById(id);
        if (!order) {
            throw new Error('Orden no encontrada');
        }

        if (order.status === 'delivered' || order.status === 'cancelled') {
            throw new Error(`No se puede cancelar una orden ${order.status}`);
        }

        // Si ya se había empezado a preparar, devolver inventario
        if (order.status === 'preparing' && order.consumption.length > 0) {
            for (const item of order.consumption) {
                // Buscar el inventario correspondiente
                const inv = await db.getAsync(
                    'SELECT id FROM inventory WHERE event_id = ? AND ingredient_id = ?',
                    [order.event_id, item.ingredient_id]
                );
                
                if (inv) {
                    // Devolver al inventario
                    await InventoryModel.restock(inv.id, item.quantity_used);
                }
            }
            
            // Limpiar consumo
            await db.runAsync('DELETE FROM order_consumption WHERE order_id = ?', [id]);
        }

        return await this.updateStatus(id, 'cancelled');
    }

    // Obtener órdenes por evento
    static async getByEventId(eventId) {
        const sql = `
            SELECT 
                o.*,
                u.name as user_name,
                u.table_number,
                c.cocktail_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN cocktails c ON o.cocktail_id = c.id
            WHERE o.event_id = ?
            ORDER BY o.created_at DESC
        `;
        return await db.allAsync(sql, [eventId]);
    }

    // Obtener órdenes por usuario
    static async getByUserId(userId) {
        const sql = `
            SELECT 
                o.*,
                c.cocktail_name,
                c.is_alcoholic
            FROM orders o
            LEFT JOIN cocktails c ON o.cocktail_id = c.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
        `;
        return await db.allAsync(sql, [userId]);
    }

    // Obtener cola de órdenes activas
    static async getActiveQueue(eventId) {
        const sql = `
            SELECT 
                o.*,
                u.name as user_name,
                u.table_number,
                c.cocktail_name,
                c.total_ml,
                CASE 
                    WHEN o.status = 'preparing' THEN 
                        ROUND((julianday('now') - julianday(o.preparation_start)) * 24 * 60, 1)
                    ELSE NULL
                END as minutes_preparing
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN cocktails c ON o.cocktail_id = c.id
            WHERE o.event_id = ? 
            AND o.status IN ('pending', 'preparing')
            ORDER BY o.queue_position, o.created_at
        `;
        return await db.allAsync(sql, [eventId]);
    }

    // Obtener siguiente orden en la cola
    static async getNextInQueue(eventId) {
        const sql = `
            SELECT 
                o.*,
                u.name as user_name,
                u.table_number,
                c.cocktail_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN cocktails c ON o.cocktail_id = c.id
            WHERE o.event_id = ? 
            AND o.status = 'pending'
            ORDER BY o.queue_position, o.created_at
            LIMIT 1
        `;
        return await db.getAsync(sql, [eventId]);
    }

    // Obtener estadísticas de órdenes
    static async getStats(eventId = null) {
        let sql = `
            SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing_orders,
                SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_orders,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                SUM(CASE WHEN status = 'delivered' THEN price ELSE 0 END) as total_revenue,
                AVG(CASE 
                    WHEN status = 'delivered' AND preparation_start IS NOT NULL AND preparation_end IS NOT NULL
                    THEN (julianday(preparation_end) - julianday(preparation_start)) * 24 * 60
                    ELSE NULL
                END) as avg_preparation_time_minutes
            FROM orders
        `;
        
        const params = [];
        if (eventId) {
            sql += ' WHERE event_id = ?';
            params.push(eventId);
        }
        
        return await db.getAsync(sql, params);
    }

    // Obtener cócteles más pedidos
    static async getTopCocktails(eventId = null, limit = 10) {
        let sql = `
            SELECT 
                c.id,
                c.cocktail_name,
                c.category,
                COUNT(o.id) as order_count,
                SUM(o.price) as total_revenue
            FROM orders o
            JOIN cocktails c ON o.cocktail_id = c.id
            WHERE o.status = 'delivered'
        `;
        
        const params = [];
        if (eventId) {
            sql += ' AND o.event_id = ?';
            params.push(eventId);
        }
        
        sql += ' GROUP BY c.id ORDER BY order_count DESC LIMIT ?';
        params.push(limit);
        
        return await db.allAsync(sql, params);
    }

    // Obtener tiempo promedio de preparación por cóctel
    static async getPreparationTimes(eventId = null) {
        let sql = `
            SELECT 
                c.cocktail_name,
                COUNT(o.id) as total_prepared,
                AVG((julianday(o.preparation_end) - julianday(o.preparation_start)) * 24 * 60) as avg_minutes,
                MIN((julianday(o.preparation_end) - julianday(o.preparation_start)) * 24 * 60) as min_minutes,
                MAX((julianday(o.preparation_end) - julianday(o.preparation_start)) * 24 * 60) as max_minutes
            FROM orders o
            JOIN cocktails c ON o.cocktail_id = c.id
            WHERE o.status = 'delivered' 
            AND o.preparation_start IS NOT NULL 
            AND o.preparation_end IS NOT NULL
        `;
        
        const params = [];
        if (eventId) {
            sql += ' AND o.event_id = ?';
            params.push(eventId);
        }
        
        sql += ' GROUP BY c.id ORDER BY total_prepared DESC';
        
        return await db.allAsync(sql, params);
    }
}

module.exports = OrderModel;
