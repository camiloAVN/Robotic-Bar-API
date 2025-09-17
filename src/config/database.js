// importacion de librerias
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Crear carpeta database si no existe
const dbDir = path.join(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Crear conexión a SQLite
const dbPath = path.join(dbDir, 'bar_autonomo.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error conectando a SQLite:', err.message);
    } else {
        console.log('Conectado a SQLite');
        initDatabase();
    }
});

// Función para inicializar la base de datos
function initDatabase() {
    // funcion para que se ejecunten las consultas en orden
    db.serialize(() => {
        // Crear tabla de clientes
        db.run(`
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_name TEXT NOT NULL,
                contact_name TEXT,
                email TEXT UNIQUE,
                phone TEXT,
                address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla clients:', err.message);
            } else {
                console.log('Tabla clients verificada/creada');
            }
        });
        // Crear tabla de eventos con relacion a clientes - si se borran los clientes se borran sus proyectos
        db.run(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                event_name TEXT NOT NULL,
                event_date DATE,
                start_time DATETIME,
                end_time DATETIME,
                location TEXT,
                max_guests INTEGER,
                status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'active', 'completed', 'cancelled')),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla events:', err.message);
            } else {
                console.log('Tabla events verificada/creada');
            }
        });

        // Crear índice para mejorar búsquedas por cliente
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_events_client_id 
            ON events(client_id)
        `);

        // Crear índice para búsquedas por fecha
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_events_date 
            ON events(event_date)
        `);
        // crear tabla usuarios con relacion a eventos - si se borran los proyectos se borran sus usuarios
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                age INTEGER,
                max_drinks INTEGER DEFAULT 10,
                drinks_consumed INTEGER DEFAULT 0,
                is_vip BOOLEAN DEFAULT 0,
                table_number TEXT,
                access_code TEXT UNIQUE,
                checked_in BOOLEAN DEFAULT 0,
                check_in_time DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla users:', err.message);
            } else {
                console.log('Tabla users verificada/creada');
            }
        });

        // Crear índices para users
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_users_event_id 
            ON users(event_id)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_users_access_code 
            ON users(access_code)
        `);

        db.run(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_event_email 
            ON users(event_id, email)
        `);
        // crear tabla ingredientes 
         db.run(`
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ingredient_name TEXT NOT NULL UNIQUE,
                category TEXT CHECK(category IN ('alcohol', 'juice', 'soda', 'syrup', 'other')),
                brand TEXT,
                position TEXT UNIQUE,
                alcohol_content REAL DEFAULT 0,
                unit TEXT DEFAULT 'ml' CHECK(unit IN ('ml', 'oz', 'units')),
                cost_per_unit REAL DEFAULT 0,
                color TEXT,
                is_available BOOLEAN DEFAULT 1,
                min_stock REAL DEFAULT 100,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla ingredients:', err.message);
            } else {
                console.log('Tabla ingredients verificada/creada');
            }
        });

        // Crear índices para ingredients
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_ingredients_category 
            ON ingredients(category)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_ingredients_position 
            ON ingredients(position)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_ingredients_available 
            ON ingredients(is_available)
        `);
        // crear tabla inventario con relacion a eventos e ingredientes
        db.run(`
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                ingredient_id INTEGER NOT NULL,
                initial_quantity REAL DEFAULT 0,
                current_quantity REAL DEFAULT 0,
                bottle_size INTEGER DEFAULT 750,
                bottles_count INTEGER DEFAULT 1,
                unit TEXT DEFAULT 'ml',
                restock_alert_sent BOOLEAN DEFAULT 0,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
                UNIQUE(event_id, ingredient_id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla inventory:', err.message);
            } else {
                console.log('Tabla inventory verificada/creada');
            }
        });

        // Crear índices para inventory
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_inventory_event_id 
            ON inventory(event_id)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_inventory_ingredient_id 
            ON inventory(ingredient_id)
        `);
        // crear tabla cocteles 
        db.run(`
            CREATE TABLE IF NOT EXISTS cocktails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cocktail_name TEXT NOT NULL UNIQUE,
                category TEXT CHECK(category IN ('classic', 'signature', 'mocktail', 'shot', 'custom')),
                description TEXT,
                base_price REAL DEFAULT 0,
                image_url TEXT,
                is_active BOOLEAN DEFAULT 1,
                is_alcoholic BOOLEAN DEFAULT 1,
                total_ml REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla cocktails:', err.message);
            } else {
                console.log('Tabla cocktails verificada/creada');
            }
        });

        // Crear tabla de ingredientes por cóctel (recetas)
        db.run(`
            CREATE TABLE IF NOT EXISTS cocktail_ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cocktail_id INTEGER NOT NULL,
                ingredient_id INTEGER NOT NULL,
                quantity REAL NOT NULL,
                unit TEXT DEFAULT 'ml',
                sequence INTEGER DEFAULT 1,
                is_optional BOOLEAN DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cocktail_id) REFERENCES cocktails(id) ON DELETE CASCADE,
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
                UNIQUE(cocktail_id, ingredient_id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla cocktail_ingredients:', err.message);
            } else {
                console.log('Tabla cocktail_ingredients verificada/creada');
            }
        });

        // Crear índices
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_cocktails_category 
            ON cocktails(category)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_cocktails_active 
            ON cocktails(is_active)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_cocktail_ingredients_cocktail 
            ON cocktail_ingredients(cocktail_id)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_cocktail_ingredients_ingredient 
            ON cocktail_ingredients(ingredient_id)
        `);
        // crear tabla de ordenes con relacion a eventos, usuarios y cocteles 
        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                user_id INTEGER,
                cocktail_id INTEGER NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
                queue_position INTEGER,
                preparation_start DATETIME,
                preparation_end DATETIME,
                robot_commands TEXT,
                total_ml REAL,
                price REAL,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (cocktail_id) REFERENCES cocktails(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla orders:', err.message);
            } else {
                console.log('Tabla orders verificada/creada');
            }
        });

        // Crear tabla de consumo de ingredientes por orden
        db.run(`
            CREATE TABLE IF NOT EXISTS order_consumption (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                ingredient_id INTEGER NOT NULL,
                quantity_used REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
            )
        `, (err) => {
            if (err) {
                console.error('Error creando tabla order_consumption:', err.message);
            } else {
                console.log('Tabla order_consumption verificada/creada');
            }
        });

        // Crear índices para orders
        db.run(`
            CREATE INDEX IF NOT EXISTS idx_orders_event_id 
            ON orders(event_id)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_orders_user_id 
            ON orders(user_id)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_orders_status 
            ON orders(status)
        `);

        db.run(`
            CREATE INDEX IF NOT EXISTS idx_orders_created 
            ON orders(created_at)
        `);

    });
}

//funcion helper para ejecutar queries con promesas
// esta sirve para ejecutar consultas tipo INSERT, UPDATE o DELETE
db.runAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        this.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};
// ejecuta consultas que devuelven una sola fila
db.getAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        this.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};
// ejecuta consultas que devuelven múltiples filas
db.allAsync = function(sql, params = []) {
    return new Promise((resolve, reject) => {
        this.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

module.exports = db;