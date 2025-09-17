require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rutas
const clientRoutes = require('./src/routes/clientRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const userRoutes = require('./src/routes/userRoutes');
const ingredientRoutes = require('./src/routes/ingredientRoutes');
const inventoryRoutes = require('./src/routes/inventoryRoutes');
const cocktailRoutes = require('./src/routes/cocktailRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const robotService = require('./src/services/robotService');
const robotRoutes = require('./src/routes/robotRoutes');


// Crear aplicación Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/clients', clientRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/cocktails', cocktailRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/robot', robotRoutes);


// Ruta de prueba
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Manejo de errores para rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;


app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
    
    // Conectar con el robot
    robotService.connect();
    
    // Escuchar eventos del robot
    robotService.on('connected', () => {
        console.log('🤖 Evento: Robot conectado');
    });
    
    robotService.on('disconnected', () => {
        console.log('🤖 Evento: Robot desconectado');
    });
    
    robotService.on('order_completed', (orderId) => {
        console.log(`🤖 Evento: Orden #${orderId} completada`);
        // Aquí podrías actualizar la BD automáticamente
        const OrderModel = require('./src/models/orderModel');
        OrderModel.updateStatus(orderId, 'ready');
    });
    
    robotService.on('order_error', (orderId) => {
        console.log(`🤖 Evento: Error en orden #${orderId}`);
        // Aquí podrías manejar el error
    });
});
