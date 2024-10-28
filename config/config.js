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
    logging: false,
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
    const response = await ping.promise.probe(ipAddress, {
      timeout: 2,
      extra: ['-c', '1']
    });
    return response.alive;
  } catch (error) {
    return false;
  }
}

async function createConnection(config) {
  const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
      host: config.host,
      dialect: config.dialect,
      logging: false,
      pool: config.pool
    }
  );

  await sequelize.authenticate();
  initModels(sequelize);
  return sequelize;
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
    logConnectionStatus(`Checking server connection to ${serverIP}`);
    const online = await checkServerConnection(serverIP);

    console.log('isOnline');
    console.log(online);
    console.log('====================================');
    
    if (online) {
      logConnectionStatus('Server is online, attempting remote connection');
      await switchConnection(true);
    } else {
      logConnectionStatus('Server is offline, temporarily using local connection');
      await switchConnection(false);
    }
  } catch (error) {
    logConnectionStatus(`Error during initialization: ${error.message}`);
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