const express = require('express');
const router = express.Router();
const robotService = require('../services/robotService');

// GET /api/robot/status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        data: robotService.getStatus()
    });
});

// POST /api/robot/connect
router.post('/connect', (req, res) => {
    robotService.connect();
    res.json({
        success: true,
        message: 'Intentando conectar con el robot...'
    });
});

// POST /api/robot/disconnect
router.post('/disconnect', (req, res) => {
    robotService.disconnect();
    res.json({
        success: true,
        message: 'Robot desconectado'
    });
});

// POST /api/robot/command
router.post('/command', (req, res) => {
    const { commands } = req.body;
    
    if (!commands || !Array.isArray(commands)) {
        return res.status(400).json({
            success: false,
            error: 'commands debe ser un array'
        });
    }
    
    const sent = robotService.sendCommand(commands);
    
    res.json({
        success: sent,
        message: sent ? 'Comando enviado' : 'Robot no conectado'
    });
});

// POST /api/robot/emergency-stop
router.post('/emergency-stop', (req, res) => {
    robotService.emergencyStop();
    res.json({
        success: true,
        message: 'Parada de emergencia ejecutada'
    });
});

// GET /api/robot/queue
router.get('/queue', (req, res) => {
    res.json({
        success: true,
        data: {
            currentOrder: robotService.currentOrder,
            queueLength: robotService.queue.length,
            queue: robotService.queue
        }
    });
});

// DELETE /api/robot/queue
router.delete('/queue', (req, res) => {
    robotService.clearQueue();
    res.json({
        success: true,
        message: 'Cola limpiada'
    });
});

module.exports = router;