const { Sequelize } = require("sequelize");
const initModels = require("../app/models/init_models");
const ping = require("ping");
const cron = require("node-cron");

let db;
let isUsingRemoteDB = false;
let isCheckingConnection = false;
let lastCheckTime = 0;
const CHECK_INTERVAL = 10000;

const dbConfigs = {
  remote: {
    database: "inventario_patrimonio",
    username: "usuario",
    password: "root",
    host: "10.30.1.43",
    dialect: "mysql",
    logging: true,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  local: {
    database: "inventario_patrimonio",
    username: "root",
    password: "root",
    host: "localhost",
    dialect: "mysql",
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};

function logConnectionStatus(message) {
  const timestamp = new Date().toISOString();
  const connectionType = isUsingRemoteDB ? 'REMOTE' : 'LOCAL';
  console.log(`[${timestamp}] [DB:${connectionType}] ${message}`);
}

async function checkServerConnection(ipAddress) {
  try {
    console.log(`Attempting to ping ${ipAddress}...`);
    const response = await ping.promise.probe(ipAddress, {
      timeout: 2,
      extra: ['-c', '1']
    });
    console.log('Ping response:', {
      alive: response.alive,
      output: response.output,
      time: response.time
    });
    return response.alive;
  } catch (error) {
    console.error('Ping error:', error);
    return false;
  }
}

async function createConnection(config) {
  console.log('Attempting database connection with config:', {
    host: config.host,
    user: config.username,
    database: config.database,
    port: 3306  // MySQL default port
  });

  try {
    const sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        dialect: config.dialect,
        logging: true,  // Activar logging para ver queries
        pool: config.pool,
        dialectOptions: {
          connectTimeout: 30000,  // 30 segundos
          // Opciones específicas para Windows
          supportBigNumbers: true,
          bigNumberStrings: true
        }
      }
    );

    console.log('Testing connection...');
    await sequelize.authenticate();
    console.log('Connection successful');
    
    initModels(sequelize);
    return sequelize;
  } catch (error) {
    console.error('Connection error details:', {
      name: error.name,
      message: error.message,
      code: error.original?.code,
      errno: error.original?.errno,
      sqlState: error.original?.sqlState,
      sqlMessage: error.original?.sqlMessage
    });
    throw error;
  }
}

async function switchConnection(useRemote) {
  // Always try remote first if server is available
  if (useRemote && !isUsingRemoteDB) {
    logConnectionStatus('Attempting to switch to remote database');
  } else if (useRemote === isUsingRemoteDB && db) {
    return; // Only return if we're already on remote
  }

  const config = useRemote ? dbConfigs.remote : dbConfigs.local;
  logConnectionStatus(`Attempting to connect to ${config.host}`);

  try {
    const newConnection = await createConnection(config);
    
    if (db) {
      logConnectionStatus('Closing existing connection');
      await db.close().catch(() => {});
    }

    db = newConnection;
    isUsingRemoteDB = useRemote;
    logConnectionStatus(`Successfully connected to ${config.host}`);
    
    // If we're on local, schedule immediate check for remote availability
    if (!useRemote) {
      setTimeout(checkAndSwitchToRemote, 5000);
    }
  } catch (error) {
    logConnectionStatus(`Failed to connect to ${config.host}: ${error.message}`);
    if (useRemote) {
      logConnectionStatus('Falling back to local database');
      await switchConnection(false);
    }
  }
}

async function checkAndSwitchToRemote() {
  const serverIP = "10.30.1.43";
  const online = await checkServerConnection(serverIP);
  
  if (online && !isUsingRemoteDB) {
    logConnectionStatus('Server is available - switching to remote database');
    await switchConnection(true);
  }
}


async function initializeDatabase() {
  if (isCheckingConnection) {
    logConnectionStatus('Connection check already in progress');
    return;
  }

  try {
    isCheckingConnection = true;
    const serverIP = "10.30.1.43";
    
    // Test network connectivity
    console.log('\nTesting network connectivity:');
    const online = await checkServerConnection(serverIP);
    console.log(`Network connectivity test result: ${online}`);

    // Test MySQL port
    console.log('\nTesting MySQL port (3306):');
    try {
      const netTest = require('net');
      const testSocket = new netTest.Socket();
      
      const portTestResult = await new Promise((resolve) => {
        testSocket.setTimeout(2000);  // 2 second timeout
        
        testSocket.on('connect', () => {
          testSocket.destroy();
          resolve(true);
        });
        
        testSocket.on('timeout', () => {
          testSocket.destroy();
          resolve(false);
        });
        
        testSocket.on('error', (err) => {
          console.log('Port test error:', err.message);
          resolve(false);
        });

        testSocket.connect(3306, serverIP);
      });

      console.log(`MySQL port test result: ${portTestResult}`);
    } catch (error) {
      console.error('Port test failed:', error.message);
    }

    if (online) {
      logConnectionStatus('Server is online, attempting remote connection');
      await switchConnection(true);
    } else {
      logConnectionStatus('Server is offline, temporarily using local connection');
      await switchConnection(false);
    }
  } catch (error) {
    logConnectionStatus(`Error during initialization: ${error.message}`);
    console.error('Full error:', error);
    if (isUsingRemoteDB || !db) {
      await switchConnection(false);
    }
  } finally {
    isCheckingConnection = false;
    lastCheckTime = Date.now();
  }
}

function getDatabaseConnection() {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return db;
}

function getCurrentConnectionInfo() {
  if (!db) {
    return {
      status: 'Not Connected',
      type: 'None',
      host: 'None'
    };
  }
  
  return {
    status: 'Connected',
    type: isUsingRemoteDB ? 'Remote' : 'Local',
    host: isUsingRemoteDB ? dbConfigs.remote.host : dbConfigs.local.host
  };
}

// More frequent checks (every 5 seconds) to ensure we switch to remote as soon as possible
cron.schedule("*/5 * * * * *", async () => {
  if (isCheckingConnection || (Date.now() - lastCheckTime) < CHECK_INTERVAL) {
    return;
  }

  try {
    if (db) {
      await db.authenticate();
      logConnectionStatus('Connection health check successful');
      
      // If we're on local, check if remote is available
      if (!isUsingRemoteDB) {
        await checkAndSwitchToRemote();
      }
    } else {
      await initializeDatabase();
    }
  } catch (error) {
    logConnectionStatus('Connection health check failed, reinitializing');
    await initializeDatabase();
  }
});

async function alterTable(query) {
  const sequelize = getDatabaseConnection();
  try {
    const [columns] = await sequelize.query(
      "SHOW COLUMNS FROM siga LIKE 'nombre_sede'",
      { type: Sequelize.QueryTypes.RAW }
    );
    
    if (!columns.length) {
      logConnectionStatus('Adding nombre_sede column to siga table');
      await sequelize.query(
        'ALTER TABLE siga ADD COLUMN nombre_sede VARCHAR(255) NULL',
        { type: Sequelize.QueryTypes.RAW }
      );
      logConnectionStatus('Column nombre_sede added successfully');
    }
    logConnectionStatus('Table altered successfully');
  } catch (error) {
    logConnectionStatus(`Error altering table: ${error.message}`);
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  getDatabaseConnection,
  checkServerConnection,
  alterTable,
  getCurrentConnectionInfo
};