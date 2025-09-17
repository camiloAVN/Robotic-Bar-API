const net = require('net');
const EventEmitter = require('events');

class RobotService extends EventEmitter {
    constructor() {
        super();
        this.socket = null;
        this.isConnected = false;
        this.currentOrder = null;
        this.queue = [];
        this.reconnectInterval = 5000; // 5 segundos
        this.robotConfig = {
            ip: process.env.ROBOT_IP || '192.168.5.100',
            port: process.env.ROBOT_PORT || 8080
        };
    }

    // Inicializar conexión con el robot
    connect() {
        console.log(`🤖 Conectando con robot en ${this.robotConfig.ip}:${this.robotConfig.port}...`);
        
        this.socket = new net.Socket();
        
        // Configurar timeout
        this.socket.setTimeout(30000); // 30 segundos timeout

        // Conectar
        this.socket.connect(this.robotConfig.port, this.robotConfig.ip, () => {
            console.log('✅ Conectado al robot');
            this.isConnected = true;
            this.emit('connected');
            
            // Enviar ping inicial
            this.sendCommand(['PING']);
        });

        // Manejar datos recibidos del robot
        this.socket.on('data', (data) => {
            this.handleRobotResponse(data);
        });

        // Manejar desconexión
        this.socket.on('close', () => {
            console.log('❌ Desconectado del robot');
            this.isConnected = false;
            this.emit('disconnected');
            
            // Reintentar conexión
            setTimeout(() => {
                if (!this.isConnected) {
                    this.connect();
                }
            }, this.reconnectInterval);
        });

        // Manejar errores
        this.socket.on('error', (err) => {
            console.error('❌ Error de conexión:', err.message);
            this.emit('error', err);
        });

        // Manejar timeout
        this.socket.on('timeout', () => {
            console.log('⏱️ Timeout de conexión');
            this.socket.end();
        });
    }

    // Enviar comando al robot
    sendCommand(commands) {
        if (!this.isConnected || !this.socket) {
            console.log('⚠️ Robot no conectado, agregando a cola...');
            this.queue.push(commands);
            return false;
        }

        try {
            // Convertir array a string separado por comas
            // Formato: "P1,50,P6,120\n"
            const commandString = commands.join(',') + '\n';
            
            console.log('📤 Enviando al robot:', commandString.trim());
            this.socket.write(commandString);
            
            this.emit('command_sent', {
                commands,
                timestamp: new Date()
            });
            
            return true;
        } catch (error) {
            console.error('Error enviando comando:', error);
            this.emit('error', error);
            return false;
        }
    }

    // Manejar respuesta del robot
    handleRobotResponse(data) {
        const response = data.toString().trim();
        console.log('📥 Respuesta del robot:', response);
        
        this.emit('response', response);

        // Interpretar respuestas comunes
        switch(response) {
            case 'OK':
                console.log('✅ Comando recibido por el robot');
                break;
                
            case 'PREPARANDO':
                console.log('🍹 Robot preparando cóctel...');
                if (this.currentOrder) {
                    this.emit('order_preparing', this.currentOrder);
                }
                break;
                
            case 'TERMINADO':
                console.log('✅ Cóctel completado');
                if (this.currentOrder) {
                    this.emit('order_completed', this.currentOrder);
                    this.currentOrder = null;
                    this.processNextInQueue();
                }
                break;
                
            case 'ERROR':
                console.error('❌ Error en el robot');
                if (this.currentOrder) {
                    this.emit('order_error', this.currentOrder);
                    this.currentOrder = null;
                }
                break;
                
            case 'PONG':
                console.log('🏓 Pong recibido');
                break;
                
            default:
                // Manejar respuestas con datos
                if (response.startsWith('ERROR:')) {
                    const errorMsg = response.substring(6);
                    console.error('❌ Error del robot:', errorMsg);
                    this.emit('robot_error', errorMsg);
                }
                break;
        }
    }

    // Preparar cóctel
    prepareCocktail(orderId, commands) {
        console.log(`🍹 Preparando orden #${orderId}`);
        
        if (this.currentOrder) {
            console.log('⏳ Robot ocupado, agregando a cola...');
            this.queue.push({ orderId, commands });
            return { queued: true, position: this.queue.length };
        }

        this.currentOrder = orderId;
        const sent = this.sendCommand(commands);
        
        if (!sent) {
            this.currentOrder = null;
            return { success: false, error: 'Robot no conectado' };
        }

        return { success: true, processing: true };
    }

    // Procesar siguiente en cola
    processNextInQueue() {
        if (this.queue.length === 0) {
            console.log('✅ Cola vacía');
            return;
        }

        const next = this.queue.shift();
        console.log(`📋 Procesando siguiente en cola: Orden #${next.orderId}`);
        
        this.prepareCocktail(next.orderId, next.commands);
    }

    // Obtener estado
    getStatus() {
        return {
            connected: this.isConnected,
            currentOrder: this.currentOrder,
            queueLength: this.queue.length,
            robotIp: this.robotConfig.ip,
            robotPort: this.robotConfig.port
        };
    }

    // Limpiar cola
    clearQueue() {
        this.queue = [];
        this.currentOrder = null;
        console.log('🗑️ Cola limpiada');
    }

    // Desconectar
    disconnect() {
        if (this.socket) {
            this.socket.end();
            this.socket.destroy();
            this.socket = null;
        }
        this.isConnected = false;
    }

    // Enviar comando de emergencia
    emergencyStop() {
        console.log('🛑 PARADA DE EMERGENCIA');
        this.sendCommand(['STOP']);
        this.clearQueue();
    }
}

// Crear instancia única (Singleton)
const robotService = new RobotService();

module.exports = robotService;