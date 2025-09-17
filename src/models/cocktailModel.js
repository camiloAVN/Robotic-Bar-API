const db = require('../config/database');

class CocktailModel {
    // Obtener todos los cócteles
    static async getAll(filters = {}) {
        let sql = `
            SELECT 
                c.*,
                COUNT(DISTINCT ci.ingredient_id) as ingredient_count,
                SUM(ci.quantity) as total_ml_calculated
            FROM cocktails c
            LEFT JOIN cocktail_ingredients ci ON c.id = ci.cocktail_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.category) {
            sql += ' AND c.category = ?';
            params.push(filters.category);
        }

        if (filters.is_active !== undefined) {
            sql += ' AND c.is_active = ?';
            params.push(filters.is_active ? 1 : 0);
        }

        if (filters.is_alcoholic !== undefined) {
            sql += ' AND c.is_alcoholic = ?';
            params.push(filters.is_alcoholic ? 1 : 0);
        }

        sql += ' GROUP BY c.id ORDER BY c.cocktail_name';
        
        return await db.allAsync(sql, params);
    }

    // Obtener cóctel por ID con sus ingredientes
    static async getById(id) {
        const cocktailSql = 'SELECT * FROM cocktails WHERE id = ?';
        const cocktail = await db.getAsync(cocktailSql, [id]);
        
        if (!cocktail) return null;

        const ingredientsSql = `
            SELECT 
                ci.*,
                i.ingredient_name,
                i.category as ingredient_category,
                i.position,
                i.color,
                i.alcohol_content,
                i.cost_per_unit
            FROM cocktail_ingredients ci
            LEFT JOIN ingredients i ON ci.ingredient_id = i.id
            WHERE ci.cocktail_id = ?
            ORDER BY ci.sequence, ci.id
        `;
        
        const ingredients = await db.allAsync(ingredientsSql, [id]);
        
        cocktail.ingredients = ingredients;
        cocktail.total_cost = ingredients.reduce((sum, ing) => sum + (ing.quantity * ing.cost_per_unit), 0);
        
        return cocktail;
    }

    // Crear nuevo cóctel
    static async create(cocktailData) {
        const { 
            cocktail_name, 
            category, 
            description,
            base_price,
            image_url,
            is_alcoholic
        } = cocktailData;

        const sql = `
            INSERT INTO cocktails (
                cocktail_name, category, description, 
                base_price, image_url, is_alcoholic
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.runAsync(sql, [
            cocktail_name, 
            category || 'custom',
            description,
            base_price || 0,
            image_url,
            is_alcoholic !== undefined ? (is_alcoholic ? 1 : 0) : 1
        ]);
        
        return result.id;
    }

    // Actualizar cóctel
    static async update(id, cocktailData) {
        const { 
            cocktail_name, 
            category, 
            description,
            base_price,
            image_url,
            is_active,
            is_alcoholic
        } = cocktailData;

        const sql = `
            UPDATE cocktails 
            SET cocktail_name = ?, category = ?, description = ?,
                base_price = ?, image_url = ?, is_active = ?, 
                is_alcoholic = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const result = await db.runAsync(sql, [
            cocktail_name, 
            category,
            description,
            base_price,
            image_url,
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
            is_alcoholic !== undefined ? (is_alcoholic ? 1 : 0) : 1,
            id
        ]);
        
        return result.changes > 0;
    }

    // Eliminar cóctel
    static async delete(id) {
        const sql = 'DELETE FROM cocktails WHERE id = ?';
        const result = await db.runAsync(sql, [id]);
        return result.changes > 0;
    }

    // Agregar ingrediente a cóctel
    static async addIngredient(cocktailId, ingredientData) {
        const { 
            ingredient_id, 
            quantity, 
            unit,
            sequence,
            is_optional,
            notes
        } = ingredientData;

        const sql = `
            INSERT INTO cocktail_ingredients (
                cocktail_id, ingredient_id, quantity, unit, 
                sequence, is_optional, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const result = await db.runAsync(sql, [
            cocktailId,
            ingredient_id,
            quantity,
            unit || 'ml',
            sequence || 1,
            is_optional ? 1 : 0,
            notes
        ]);
        
        // Actualizar total_ml del cóctel
        await this.updateTotalMl(cocktailId);
        
        return result.id;
    }

    // Actualizar ingrediente de cóctel
    static async updateIngredient(cocktailIngredientId, ingredientData) {
        const { 
            quantity, 
            unit,
            sequence,
            is_optional,
            notes
        } = ingredientData;

        const sql = `
            UPDATE cocktail_ingredients 
            SET quantity = ?, unit = ?, sequence = ?, 
                is_optional = ?, notes = ?
            WHERE id = ?
        `;
        
        const result = await db.runAsync(sql, [
            quantity,
            unit,
            sequence,
            is_optional ? 1 : 0,
            notes,
            cocktailIngredientId
        ]);
        
        return result.changes > 0;
    }

    // Eliminar ingrediente de cóctel
    static async removeIngredient(cocktailId, ingredientId) {
        const sql = 'DELETE FROM cocktail_ingredients WHERE cocktail_id = ? AND ingredient_id = ?';
        const result = await db.runAsync(sql, [cocktailId, ingredientId]);
        
        // Actualizar total_ml del cóctel
        await this.updateTotalMl(cocktailId);
        
        return result.changes > 0;
    }

    // Actualizar total_ml del cóctel
    static async updateTotalMl(cocktailId) {
        const sql = `
            UPDATE cocktails 
            SET total_ml = (
                SELECT COALESCE(SUM(quantity), 0) 
                FROM cocktail_ingredients 
                WHERE cocktail_id = ? AND unit = 'ml'
            ),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await db.runAsync(sql, [cocktailId, cocktailId]);
    }

    // Obtener receta como comandos para el robot
    static async getRobotCommands(cocktailId) {
        const sql = `
            SELECT 
                ci.quantity,
                ci.sequence,
                i.position,
                i.ingredient_name
            FROM cocktail_ingredients ci
            LEFT JOIN ingredients i ON ci.ingredient_id = i.id
            WHERE ci.cocktail_id = ? 
            AND i.position IS NOT NULL
            AND i.is_available = 1
            ORDER BY ci.sequence, ci.id
        `;
        
        const ingredients = await db.allAsync(sql, [cocktailId]);
        
        // Convertir a formato de comandos para el robot
        const commands = [];
        for (const ing of ingredients) {
            if (ing.position) {
                // Formato: [posición, cantidad]
                commands.push(ing.position);
                commands.push(String(ing.quantity));
            }
        }
        
        return {
            cocktail_id: cocktailId,
            commands: commands,
            ingredients_detail: ingredients
        };
    }

    // Verificar disponibilidad de ingredientes para un cóctel
    static async checkAvailability(cocktailId, eventId) {
        const sql = `
            SELECT 
                ci.*,
                i.ingredient_name,
                i.position,
                inv.current_quantity as available_quantity,
                CASE 
                    WHEN inv.current_quantity IS NULL THEN 'No en inventario'
                    WHEN inv.current_quantity < ci.quantity THEN 'Insuficiente'
                    ELSE 'Disponible'
                END as status
            FROM cocktail_ingredients ci
            LEFT JOIN ingredients i ON ci.ingredient_id = i.id
            LEFT JOIN inventory inv ON (
                inv.ingredient_id = ci.ingredient_id 
                AND inv.event_id = ?
            )
            WHERE ci.cocktail_id = ? AND ci.is_optional = 0
        `;
        
        const availability = await db.allAsync(sql, [eventId, cocktailId]);
        
        const canPrepare = availability.every(item => item.status === 'Disponible');
        const missing = availability.filter(item => item.status !== 'Disponible');
        
        return {
            can_prepare: canPrepare,
            ingredients: availability,
            missing_ingredients: missing
        };
    }

    // Buscar cócteles por ingrediente
    static async getByIngredient(ingredientId) {
        const sql = `
            SELECT 
                c.*,
                ci.quantity,
                ci.unit
            FROM cocktails c
            JOIN cocktail_ingredients ci ON c.id = ci.cocktail_id
            WHERE ci.ingredient_id = ? AND c.is_active = 1
            ORDER BY c.cocktail_name
        `;
        return await db.allAsync(sql, [ingredientId]);
    }

    // Obtener cócteles populares (más pedidos)
    static async getPopular(limit = 10) {
        const sql = `
            SELECT 
                c.*,
                COUNT(o.id) as order_count
            FROM cocktails c
            LEFT JOIN orders o ON c.id = o.cocktail_id
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY order_count DESC
            LIMIT ?
        `;
        return await db.allAsync(sql, [limit]);
    }

    // Clonar un cóctel
    static async clone(cocktailId, newName) {
        // Obtener cóctel original
        const original = await this.getById(cocktailId);
        if (!original) throw new Error('Cóctel no encontrado');

        // Crear nuevo cóctel
        const newCocktail = {
            cocktail_name: newName,
            category: original.category,
            description: original.description + ' (Copia)',
            base_price: original.base_price,
            is_alcoholic: original.is_alcoholic
        };

        const newId = await this.create(newCocktail);

        // Copiar ingredientes
        for (const ing of original.ingredients) {
            await this.addIngredient(newId, {
                ingredient_id: ing.ingredient_id,
                quantity: ing.quantity,
                unit: ing.unit,
                sequence: ing.sequence,
                is_optional: ing.is_optional,
                notes: ing.notes
            });
        }

        return newId;
    }

    // Verificar si el nombre ya existe
    static async nameExists(name, excludeId = null) {
        let sql = 'SELECT id FROM cocktails WHERE LOWER(cocktail_name) = LOWER(?)';
        const params = [name];
        
        if (excludeId) {
            sql += ' AND id != ?';
            params.push(excludeId);
        }
        
        const result = await db.getAsync(sql, params);
        return !!result;
    }

    // Crear cócteles por defecto
    static async createDefaultCocktails() {
        const defaultCocktails = [
            {
                name: 'Margarita',
                category: 'classic',
                description: 'Clásico cóctel mexicano con tequila',
                price: 12,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Tequila', quantity: 60 },
                    { name: 'Triple Sec', quantity: 30 },
                    { name: 'Jugo de Limón', quantity: 30 }
                ]
            },
            {
                name: 'Mojito',
                category: 'classic',
                description: 'Refrescante cóctel cubano con ron y menta',
                price: 10,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Ron Blanco', quantity: 60 },
                    { name: 'Jugo de Limón', quantity: 30 },
                    { name: 'Sprite', quantity: 60 }
                ]
            },
            {
                name: 'Piña Colada',
                category: 'classic',
                description: 'Tropical mezcla de ron y piña',
                price: 11,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Ron Blanco', quantity: 60 },
                    { name: 'Jugo de Piña', quantity: 120 }
                ]
            },
            {
                name: 'Cuba Libre',
                category: 'classic',
                description: 'Ron con coca cola y limón',
                price: 8,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Ron Blanco', quantity: 60 },
                    { name: 'Coca Cola', quantity: 120 },
                    { name: 'Jugo de Limón', quantity: 10 }
                ]
            },
            {
                name: 'Vodka Naranja',
                category: 'classic',
                description: 'Simple y refrescante',
                price: 8,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Vodka', quantity: 60 },
                    { name: 'Jugo de Naranja', quantity: 120 }
                ]
            },
            {
                name: 'Gin Tonic',
                category: 'classic',
                description: 'Clásico británico',
                price: 10,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Gin', quantity: 60 },
                    { name: 'Agua Tónica', quantity: 120 }
                ]
            },
            {
                name: 'Tequila Sunrise',
                category: 'classic',
                description: 'Colorido cóctel con gradiente de colores',
                price: 9,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Tequila', quantity: 60 },
                    { name: 'Jugo de Naranja', quantity: 120 },
                    { name: 'Granadina', quantity: 15 }
                ]
            },
            {
                name: 'Blue Lagoon',
                category: 'signature',
                description: 'Vibrante cóctel azul',
                price: 11,
                is_alcoholic: true,
                ingredients: [
                    { name: 'Vodka', quantity: 50 },
                    { name: 'Blue Curaçao', quantity: 30 },
                    { name: 'Sprite', quantity: 100 }
                ]
            },
            {
                name: 'Virgin Mojito',
                category: 'mocktail',
                description: 'Mojito sin alcohol',
                price: 6,
                is_alcoholic: false,
                ingredients: [
                    { name: 'Jugo de Limón', quantity: 30 },
                    { name: 'Sprite', quantity: 150 }
                ]
            },
            {
                name: 'Sunset Paradise',
                category: 'mocktail',
                description: 'Mezcla tropical sin alcohol',
                price: 6,
                is_alcoholic: false,
                ingredients: [
                    { name: 'Jugo de Naranja', quantity: 80 },
                    { name: 'Jugo de Piña', quantity: 80 },
                    { name: 'Granadina', quantity: 20 }
                ]
            }
        ];

        const results = [];
        
        for (const cocktail of defaultCocktails) {
            try {
                // Verificar si ya existe
                const exists = await this.nameExists(cocktail.name);
                if (!exists) {
                    // Crear cóctel
                    const cocktailId = await this.create({
                        cocktail_name: cocktail.name,
                        category: cocktail.category,
                        description: cocktail.description,
                        base_price: cocktail.price,
                        is_alcoholic: cocktail.is_alcoholic
                    });

                    // Agregar ingredientes
                    let addedIngredients = 0;
                    for (let i = 0; i < cocktail.ingredients.length; i++) {
                        const ing = cocktail.ingredients[i];
                        
                        // Buscar el ID del ingrediente por nombre
                        const ingredient = await db.getAsync(
                            'SELECT id FROM ingredients WHERE ingredient_name = ?',
                            [ing.name]
                        );
                        
                        if (ingredient) {
                            await this.addIngredient(cocktailId, {
                                ingredient_id: ingredient.id,
                                quantity: ing.quantity,
                                sequence: i + 1
                            });
                            addedIngredients++;
                        } else {
                            console.log(`⚠️ Ingrediente no encontrado: ${ing.name}`);
                        }
                    }
                    
                    results.push({ 
                        success: true, 
                        name: cocktail.name, 
                        id: cocktailId,
                        ingredients_added: addedIngredients 
                    });
                } else {
                    results.push({ success: false, name: cocktail.name, error: 'Ya existe' });
                }
            } catch (error) {
                results.push({ success: false, name: cocktail.name, error: error.message });
            }
        }
        
        return results;
    }
}

module.exports = CocktailModel;
