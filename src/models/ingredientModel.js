const db = require('../config/database');

class IngredientModel {
    // Obtener todos los ingredientes
    static async getAll(filters = {}) {
        let sql = `
            SELECT 
                i.*,
                COALESCE(
                    (SELECT SUM(current_quantity) 
                     FROM inventory 
                     WHERE ingredient_id = i.id 
                     AND event_id IN (SELECT id FROM events WHERE status = 'active')),
                    0
                ) as current_stock
            FROM ingredients i
            WHERE 1=1
        `;
        const params = [];

        if (filters.category) {
            sql += ' AND i.category = ?';
            params.push(filters.category);
        }

        if (filters.is_available !== undefined) {
            sql += ' AND i.is_available = ?';
            params.push(filters.is_available ? 1 : 0);
        }

        if (filters.has_position !== undefined) {
            if (filters.has_position) {
                sql += ' AND i.position IS NOT NULL';
            } else {
                sql += ' AND i.position IS NULL';
            }
        }

        sql += ' ORDER BY i.position, i.ingredient_name';
        
        return await db.allAsync(sql, params);
    }

    // Obtener ingrediente por ID
    static async getById(id) {
        const sql = `
            SELECT 
                i.*,
                COALESCE(
                    (SELECT SUM(current_quantity) 
                     FROM inventory 
                     WHERE ingredient_id = i.id 
                     AND event_id IN (SELECT id FROM events WHERE status = 'active')),
                    0
                ) as current_stock
            FROM ingredients i
            WHERE i.id = ?
        `;
        return await db.getAsync(sql, [id]);
    }

    // Obtener ingrediente por posición
    static async getByPosition(position) {
        const sql = 'SELECT * FROM ingredients WHERE position = ?';
        return await db.getAsync(sql, [position.toUpperCase()]);
    }

    // Crear nuevo ingrediente
    static async create(ingredientData) {
        const { 
            ingredient_name, 
            category, 
            brand,
            position,
            alcohol_content,
            unit,
            cost_per_unit,
            density,
            color,
            min_stock,
            notes
        } = ingredientData;

        // Formatear posición a mayúsculas si existe
        const formattedPosition = position ? position.toUpperCase() : null;

        const sql = `
            INSERT INTO ingredients (
                ingredient_name, category, brand, position, alcohol_content,
                unit, cost_per_unit, density, color, min_stock, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.runAsync(sql, [
            ingredient_name, 
            category, 
            brand,
            formattedPosition,
            alcohol_content || 0,
            unit || 'ml',
            cost_per_unit || 0,
            density || 1.0,
            color,
            min_stock || 100,
            notes
        ]);
        
        return result.id;
    }

    // Actualizar ingrediente
    static async update(id, ingredientData) {
        const { 
            ingredient_name, 
            category, 
            brand,
            position,
            alcohol_content,
            unit,
            cost_per_unit,
            density,
            color,
            is_available,
            min_stock,
            notes
        } = ingredientData;

        // Formatear posición a mayúsculas si existe
        const formattedPosition = position ? position.toUpperCase() : null;

        const sql = `
            UPDATE ingredients 
            SET ingredient_name = ?, category = ?, brand = ?, position = ?,
                alcohol_content = ?, unit = ?, cost_per_unit = ?, density = ?,
                color = ?, is_available = ?, min_stock = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const result = await db.runAsync(sql, [
            ingredient_name, 
            category, 
            brand,
            formattedPosition,
            alcohol_content,
            unit,
            cost_per_unit,
            density,
            color,
            is_available !== undefined ? (is_available ? 1 : 0) : 1,
            min_stock,
            notes,
            id
        ]);
        
        return result.changes > 0;
    }

    // Eliminar ingrediente
    static async delete(id) {
        // Verificar si el ingrediente está siendo usado en algún cóctel
        const usageCheck = await db.getAsync(
            'SELECT COUNT(*) as count FROM cocktail_ingredients WHERE ingredient_id = ?',
            [id]
        );

        if (usageCheck.count > 0) {
            throw new Error('No se puede eliminar un ingrediente que está siendo usado en cócteles');
        }

        const sql = 'DELETE FROM ingredients WHERE id = ?';
        const result = await db.runAsync(sql, [id]);
        return result.changes > 0;
    }

    // Obtener ingredientes por categoría
    static async getByCategory(category) {
        const sql = `
            SELECT * FROM ingredients 
            WHERE category = ? AND is_available = 1
            ORDER BY ingredient_name
        `;
        return await db.allAsync(sql, [category]);
    }

    // Obtener posiciones disponibles para el robot
    static async getAvailablePositions() {
        // Generar lista de posiciones posibles (P1 a P20)
        const allPositions = [];
        for (let i = 1; i <= 20; i++) {
            allPositions.push(`P${i}`);
        }

        // Obtener posiciones ocupadas
        const sql = 'SELECT position FROM ingredients WHERE position IS NOT NULL';
        const occupiedRows = await db.allAsync(sql);
        const occupiedPositions = occupiedRows.map(row => row.position);

        // Filtrar posiciones disponibles
        const availablePositions = allPositions.filter(
            pos => !occupiedPositions.includes(pos)
        );

        return availablePositions;
    }

    // Actualizar disponibilidad del ingrediente
    static async updateAvailability(id, isAvailable) {
        const sql = `
            UPDATE ingredients 
            SET is_available = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        const result = await db.runAsync(sql, [isAvailable ? 1 : 0, id]);
        return result.changes > 0;
    }

    // Obtener mapa de posiciones para el robot
    static async getPositionMap() {
        const sql = `
            SELECT id, ingredient_name, position, unit
            FROM ingredients 
            WHERE position IS NOT NULL AND is_available = 1
            ORDER BY position
        `;
        const ingredients = await db.allAsync(sql);
        
        // Crear un objeto mapa para fácil acceso
        const map = {};
        ingredients.forEach(ing => {
            map[ing.position] = {
                id: ing.id,
                name: ing.ingredient_name,
                unit: ing.unit
            };
        });
        
        return map;
    }

    // Verificar si un nombre de ingrediente ya existe
    static async nameExists(name, excludeId = null) {
        let sql = 'SELECT id FROM ingredients WHERE LOWER(ingredient_name) = LOWER(?)';
        const params = [name];
        
        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }
        
        const result = await db.getAsync(sql, params);
        return !!result;
    }

    // Verificar si una posición ya está ocupada
    static async positionExists(position, excludeId = null) {
        if (!position) return false;
        
        let sql = 'SELECT id FROM ingredients WHERE position = ?';
        const params = [position.toUpperCase()];
        
        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }
        
        const result = await db.getAsync(sql, params);
        return !!result;
    }

    // Obtener estadísticas de ingredientes
    static async getStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_ingredients,
                SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) as available_ingredients,
                SUM(CASE WHEN position IS NOT NULL THEN 1 ELSE 0 END) as positioned_ingredients,
                COUNT(DISTINCT category) as categories,
                SUM(CASE WHEN category = 'alcohol' THEN 1 ELSE 0 END) as alcoholic_ingredients,
                SUM(CASE WHEN category = 'juice' THEN 1 ELSE 0 END) as juices,
                SUM(CASE WHEN category = 'soda' THEN 1 ELSE 0 END) as sodas
            FROM ingredients
        `;
        return await db.getAsync(sql);
    }

    // Crear ingredientes base para empezar
    static async createDefaultIngredients() {
        const defaultIngredients = [
            // Alcoholes
            { ingredient_name: 'Vodka', category: 'alcohol', position: 'P1', alcohol_content: 40, cost_per_unit: 0.5, color: '#FFFFFF' },
            { ingredient_name: 'Ron Blanco', category: 'alcohol', position: 'P2', alcohol_content: 40, cost_per_unit: 0.6, color: '#F5F5DC' },
            { ingredient_name: 'Tequila', category: 'alcohol', position: 'P3', alcohol_content: 40, cost_per_unit: 0.7, color: '#FFE4B5' },
            { ingredient_name: 'Gin', category: 'alcohol', position: 'P4', alcohol_content: 40, cost_per_unit: 0.6, color: '#F0F8FF' },
            { ingredient_name: 'Whisky', category: 'alcohol', position: 'P5', alcohol_content: 40, cost_per_unit: 0.8, color: '#8B4513' },
            
            // Jugos
            { ingredient_name: 'Jugo de Naranja', category: 'juice', position: 'P6', alcohol_content: 0, cost_per_unit: 0.2, color: '#FFA500' },
            { ingredient_name: 'Jugo de Limón', category: 'juice', position: 'P7', alcohol_content: 0, cost_per_unit: 0.2, color: '#FFFF00' },
            { ingredient_name: 'Jugo de Piña', category: 'juice', position: 'P8', alcohol_content: 0, cost_per_unit: 0.3, color: '#FFD700' },
            { ingredient_name: 'Jugo de Cranberry', category: 'juice', position: 'P9', alcohol_content: 0, cost_per_unit: 0.3, color: '#DC143C' },
            
            // Sodas
            { ingredient_name: 'Coca Cola', category: 'soda', position: 'P10', alcohol_content: 0, cost_per_unit: 0.1, color: '#3B2F2F' },
            { ingredient_name: 'Sprite', category: 'soda', position: 'P11', alcohol_content: 0, cost_per_unit: 0.1, color: '#F0FFFF' },
            { ingredient_name: 'Agua Tónica', category: 'soda', position: 'P12', alcohol_content: 0, cost_per_unit: 0.15, color: '#FFFFF0' },
            
            // Jarabes
            { ingredient_name: 'Granadina', category: 'syrup', position: 'P13', alcohol_content: 0, cost_per_unit: 0.3, color: '#DC143C' },
            { ingredient_name: 'Blue Curaçao', category: 'syrup', position: 'P14', alcohol_content: 15, cost_per_unit: 0.4, color: '#007FFF' },
            { ingredient_name: 'Triple Sec', category: 'syrup', position: 'P15', alcohol_content: 30, cost_per_unit: 0.4, color: '#FFE4E1' }
        ];

        const results = [];
        for (const ingredient of defaultIngredients) {
            try {
                // Verificar si ya existe
                const exists = await this.nameExists(ingredient.ingredient_name);
                if (!exists) {
                    const id = await this.create(ingredient);
                    results.push({ success: true, name: ingredient.ingredient_name, id });
                } else {
                    results.push({ success: false, name: ingredient.ingredient_name, error: 'Ya existe' });
                }
            } catch (error) {
                results.push({ success: false, name: ingredient.ingredient_name, error: error.message });
            }
        }
        
        return results;
    }
}

module.exports = IngredientModel;