const net = require('net');

const ROBOT_IP = '192.168.5.1';
const ROBOT_PORT = 6601;
let robotSocket = null;
let isConnected = false;

// Conectar al robot
function connectToRobot() {
    console.log(`Intentando conectar con robot en ${ROBOT_IP}:${ROBOT_PORT}...`);
    
    robotSocket = new net.Socket();
    
    robotSocket.connect(ROBOT_PORT, ROBOT_IP, () => {
        console.log('✅ CONECTADO AL ROBOT');
        isConnected = true;
        
        // Enviar mensaje de prueba
        const testMessage = JSON.stringify({
            type: 'test',
            message: 'Hola robot, servidor conectado',
            timestamp: new Date().toISOString()
        });
        
        robotSocket.write("hola mundo" + '\n');
        console.log('Mensaje enviado:', testMessage);
    });
    
    robotSocket.on('data', (data) => {
        console.log('Respuesta del robot:', data.toString());
    });
    
    robotSocket.on('error', (err) => {
        console.error('Error:', err.message);
        isConnected = false;
    });
    
    robotSocket.on('close', () => {
        console.log('Conexión cerrada');
        isConnected = false;
        setTimeout(connectToRobot, 5000); // Reintentar en 5 segundos
    });
}

module.exports = connectToRobot;