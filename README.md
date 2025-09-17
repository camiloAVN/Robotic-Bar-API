# Robotic Bar API

![Database Schema](img/tabla.png)

A Node.js Express server with WebSocket support and SQLite database for managing a robotic bar system.

## 🚀 Features

- RESTful API with Express.js
- Real-time communication with WebSockets
- SQLite database for local data storage
- CORS enabled for cross-origin requests
- Environment-based configuration

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (version 14 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/)

## 🛠 Installation

Follow these steps to get the development server running:

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd robotic-bar-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration:

```env
PORT=3001
DB_PATH=./database.sqlite
# Add other environment variables as needed
```

### 4. Start the Server

```bash
node server.js
```
The server will start running on `http://localhost:3001`


### 5. Data base schema (optional)

To view the tables, copy the code from Tables.dbml and use it from dbdiagram.io.


## 📦 Dependencies

This project uses the following main dependencies:

```json
{
  "cors": "^2.8.5",
  "dotenv": "^17.2.2", 
  "express": "^5.1.0",
  "sqlite3": "^5.1.7"
}
```

- **cors**: Enable Cross-Origin Resource Sharing
- **dotenv**: Load environment variables from .env file
- **express**: Fast, unopinionated web framework for Node.js
- **sqlite3**: SQLite3 bindings for Node.js

## 🗄️ Database

This application uses SQLite as the local database solution. The database file will be automatically created when you first run the server.

### Database Features:
- Lightweight and serverless
- Perfect for development and small applications
- No additional setup required
- Data persists locally in a `.sqlite` file

## 🔗 API Testing

### Postman Collection

Import the provided Postman collection to test all available endpoints:

1. Open Postman
2. Click on "Import"
3. Navigate to the `postman/` folder in the project directory
4. Select `Robotic-Bar.postman_collection.json`
5. Click "Import"

The collection includes all configured endpoints for easy API testing and development.

## 🌐 WebSocket Support

This server includes WebSocket functionality for real-time communication. Connect to the WebSocket server at:

```
ws://localhost:3001
```

## 📁 Project Structure

```
robotic-bar-api/
├── server.js              # Main server file
├── .env.example           # Environment variables template
├── .env                   # Your environment configuration
├── package.json           # Project dependencies and scripts
├── postman/               # Postman collection folder
│   └── Robotic-Bar.postman_collection.json
├── img/                   # Images and documentation assets
│   └── tabla.png          # Database schema diagram
├── src
│   └──config
│   └──controllers
│   └──middlewares
│   └──models
│   └──routes
│   └──services
└── README.md             # This file
```

## 🚦 Usage

1. **Start the server**: `node server.js`
2. **Test endpoints**: Import the Postman collection and test the API
3. **WebSocket connection**: Connect your client to `ws://localhost:3001`
4. **Database**: SQLite database will be automatically created and managed

## 🔧 Development

### Running in Development Mode

For development, you might want to use a process manager like `nodemon`:

```bash
# Install nodemon globally (optional)
npm install -g nodemon

# Run with nodemon for auto-restart
nodemon server.js
```

### Environment Variables

Make sure to configure your `.env` file with the appropriate values for your environment:

- `PORT`: Server port (default: 3001)
- `DB_PATH`: SQLite database file path
- Add other variables as needed for your specific implementation

## 📝 Notes

- The server runs on `localhost:3001` by default
- SQLite database file will be created automatically
- CORS is enabled for cross-origin requests
- WebSocket support is included for real-time features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test your changes
5. Submit a pull request


---

**Happy coding! 🤖🍹**