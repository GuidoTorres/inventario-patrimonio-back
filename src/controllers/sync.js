const { Sequelize, Op } = require("sequelize");
const { getDatabaseConnection } = require("./../../config/config");
const ping = require("ping");
const initModels = require("../../app/models/init_models");

let remoteDBConnection = null;
let lastSuccessfulConnection = 0;
const CONNECTION_RETRY_INTERVAL = 30000;

function getLocalDatabaseConnection() {
  return new Sequelize("inventario_patrimonio", "root", "root", {
    host: "localhost",
    dialect: "mysql",
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

async function verifyDatabaseConnections() {
  let localDB = null;
  let remoteDB = null;
  
  try {
    console.log("Verifying local database connection...");
    localDB = getLocalDatabaseConnection();
    await localDB.authenticate();
    initModels(localDB);
    
    const [[localInfo]] = await localDB.query('SELECT @@hostname as hostname, DATABASE() as database_name, CONNECTION_ID() as connection_id');
    console.log("Local database info:", {
      hostname: localInfo.hostname,
      database: localInfo.database_name,
      connectionId: localInfo.connection_id,
      host: "localhost"
    });
  } catch (error) {
    console.error("Local database connection failed:", error);
    throw new Error("Cannot proceed without local database connection");
  }

  try {
    console.log("\nVerifying remote database connection...");
    remoteDB = await getRemoteDatabaseConnection();
    if (!remoteDB) {
      throw new Error("Could not establish remote connection");
    }
    
    const [[remoteInfo]] = await remoteDB.query('SELECT @@hostname as hostname, DATABASE() as database_name, CONNECTION_ID() as connection_id');
    console.log("Remote database info:", {
      hostname: remoteInfo.hostname,
      database: remoteInfo.database_name,
      connectionId: remoteInfo.connection_id,
      host: "10.30.1.43"
    });

    return { localDB, remoteDB };
  } catch (error) {
    console.error("Remote database connection failed:", error);
    throw new Error("Cannot proceed without remote database connection");
  }
}

async function syncMissingRecords(localDB, remoteDB, missingRecords, localToRemote) {
  let totalSynced = 0;
  
  for (const sbn of missingRecords) {
    try {
      if (localToRemote) {
        // Syncing from local to remote
        const localRecord = await localDB.models.bienes.findOne({
          where: { sbn }
        });

        if (localRecord) {
          const recordData = {
            ...localRecord.dataValues,
            lastSync: new Date()
          };
          delete recordData.id;

          await remoteDB.models.bienes.create(recordData, { silent: true });
          
          await localDB.models.bienes.update(
            { lastSync: new Date() },
            { where: { sbn }, silent: true }
          );
          
          totalSynced++;
          console.log(`Created record in remote: ${sbn}`);
        }
      } else {
        // Syncing from remote to local
        const remoteRecord = await remoteDB.models.bienes.findOne({
          where: { sbn }
        });

        if (remoteRecord) {
          const recordData = {
            ...remoteRecord.dataValues,
            lastSync: new Date()
          };
          delete recordData.id;

          await localDB.models.bienes.create(recordData, { silent: true });
          
          await remoteDB.models.bienes.update(
            { lastSync: new Date() },
            { where: { sbn }, silent: true }
          );
          
          totalSynced++;
          console.log(`Created record in local: ${sbn}`);
        }
      }
    } catch (error) {
      console.error(`Error syncing record ${sbn}:`, error);
    }
  }
  
  console.log(`Completed missing records sync. Total records synced: ${totalSynced}`);
}

async function syncLocalToRemote(localDB, remoteDB) {
  console.log("Starting Local to Remote sync");
  const batchSize = 100;
  let offset = 0;
  let totalSynced = 0;

  while (true) {
    const bienesLocales = await localDB.models.bienes.findAll({
      where: {
        [Op.or]: [
          { lastSync: null },
          { updatedAt: { [Op.gt]: Sequelize.col('lastSync') } }
        ]
      },
      limit: batchSize,
      offset: offset
    });

    if (bienesLocales.length === 0) break;

    for (const bien of bienesLocales) {
      try {
        const recordData = {
          ...bien.dataValues,
          lastSync: new Date()
        };
        delete recordData.id;

        const remoteRecord = await remoteDB.models.bienes.findOne({
          where: { sbn: bien.sbn }
        });

        if (remoteRecord) {
          if (!remoteRecord.updatedAt || bien.updatedAt > remoteRecord.updatedAt) {
            await remoteDB.models.bienes.update(recordData, {
              where: { sbn: bien.sbn },
              silent: true
            });
            totalSynced++;
            console.log(`Updated record in remote: ${bien.sbn}`);
          }
        } else {
          await remoteDB.models.bienes.create(recordData, { silent: true });
          totalSynced++;
          console.log(`Created record in remote: ${bien.sbn}`);
        }

        await localDB.models.bienes.update(
          { lastSync: new Date() },
          { where: { sbn: bien.sbn }, silent: true }
        );
      } catch (error) {
        console.error(`Error syncing record ${bien.sbn}:`, error);
      }
    }

    offset += batchSize;
  }

  console.log(`Completed local to remote sync. Total records synced: ${totalSynced}`);
}

async function syncRemoteToLocal(localDB, remoteDB) {
  console.log("Starting Remote to Local sync");
  const batchSize = 100;
  let offset = 0;
  let totalSynced = 0;

  // Get all remote records that either:
  // 1. Haven't been synced (lastSync is null)
  // 2. Have been updated since last sync
  while (true) {
      const bienesRemotos = await remoteDB.models.bienes.findAll({
      limit: batchSize,
      offset: offset,
      order: [['updatedAt', 'DESC']]
    });

    if (bienesRemotos.length === 0) break;

    for (const bien of bienesRemotos) {
      try {
        const recordData = {
          ...bien.dataValues,
          lastSync: new Date()
        };
        delete recordData.id;

        const localRecord = await localDB.models.bienes.findOne({
          where: { sbn: bien.sbn }
        });

        if (localRecord) {
          // Record exists locally - check if needs update
          if (!localRecord.updatedAt || bien.updatedAt > localRecord.updatedAt) {
            await localDB.models.bienes.update(recordData, {
              where: { sbn: bien.sbn },
              silent: true
            });
            console.log(`Updated record in local: ${bien.sbn}`);
            totalSynced++;
          } else {
            console.log(`Skipping ${bien.sbn} - local version is newer`);
          }
        } else {
          // Record doesn't exist locally - create it
          await localDB.models.bienes.create(recordData, { silent: true });
          console.log(`Created new record in local: ${bien.sbn}`);
          totalSynced++;
        }

        // Update lastSync timestamp in remote
        await remoteDB.models.bienes.update(
          { lastSync: new Date() },
          { 
            where: { sbn: bien.sbn },
            silent: true
          }
        );
      } catch (error) {
        console.error(`Error processing record ${bien.sbn}:`, error);
        console.error('Record data:', {
          sbn: bien.sbn,
          updatedAt: bien.updatedAt,
          lastSync: bien.lastSync
        });
      }
    }

    offset += batchSize;
    console.log(`Processed ${offset} records...`);
  }

  console.log(`Completed remote to local sync. Total records synced: ${totalSynced}`);
}

async function getRemoteDatabaseConnection() {
  const serverHost = "10.30.1.43";
  const now = Date.now();

  if (remoteDBConnection) {
    try {
      await remoteDBConnection.authenticate();
      return remoteDBConnection;
    } catch {
      try {
        await remoteDBConnection.close();
      } catch {}
      remoteDBConnection = null;
    }
  }

  try {
    console.log("Checking server availability...");
    const isServerUp = await ping.promise.probe(serverHost, {
      timeout: 2,
      extra: ["-c", "1"]
    });

    if (!isServerUp.alive) {
      console.log("Remote server is not accessible");
      return null;
    }

    console.log("Creating new remote connection...");
    remoteDBConnection = new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: serverHost,
      dialect: "mysql",
      logging: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

    await remoteDBConnection.authenticate();
    initModels(remoteDBConnection);
    console.log("Remote connection established successfully");
    
    return remoteDBConnection;
  } catch (error) {
    console.error("Failed to establish remote connection:", error);
    remoteDBConnection = null;
    return null;
  }
}

async function syncDatabases() {
  try {
    console.log('====================================');
    console.log("Starting synchronization process");
    console.log('====================================');

    const { localDB, remoteDB } = await verifyDatabaseConnections();

    // Check initial counts
    const [[{ count: localCount }]] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [[{ count: remoteCount }]] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');

    console.log(`\nInitial record counts:`);
    console.log(`Local database: ${localCount} records`);
    console.log(`Remote database: ${remoteCount} records`);

    // Find missing records in both directions
    const missingInRemoteQuery = `
      SELECT l.sbn FROM bienes l WHERE NOT EXISTS (
        SELECT 1 FROM bienes r WHERE r.sbn = l.sbn
      )`;

    const missingInLocalQuery = `
      SELECT r.sbn FROM bienes r WHERE NOT EXISTS (
        SELECT 1 FROM bienes l WHERE l.sbn = r.sbn
      )`;

    const missingInRemote = await localDB.query(missingInRemoteQuery, {
      type: Sequelize.QueryTypes.SELECT
    });

    const missingInLocal = await remoteDB.query(missingInLocalQuery, {
      type: Sequelize.QueryTypes.SELECT
    });

    // Handle missing records first
    if (missingInRemote.length > 0) {
      console.log(`Found ${missingInRemote.length} records missing in remote`);
      await syncMissingRecords(localDB, remoteDB, missingInRemote.map(r => r.sbn), true);
    }

    if (missingInLocal.length > 0) {
      console.log(`Found ${missingInLocal.length} records missing in local`);
      await syncMissingRecords(localDB, remoteDB, missingInLocal.map(r => r.sbn), false);
    }

    // Then handle updates
    console.log('\nSyncing local changes to remote...');
    await syncLocalToRemote(localDB, remoteDB);

    console.log('\nSyncing remote changes to local...');
    await syncRemoteToLocal(localDB, remoteDB);

    // Final verification
    const [[{ count: finalLocalCount }]] = await localDB.query('SELECT COUNT(*) as count FROM bienes');
    const [[{ count: finalRemoteCount }]] = await remoteDB.query('SELECT COUNT(*) as count FROM bienes');
    
    console.log('\nFinal record counts:');
    console.log(`Local database: ${finalLocalCount} records`);
    console.log(`Remote database: ${finalRemoteCount} records`);

    if (finalLocalCount === finalRemoteCount) {
      console.log('✓ Databases are synchronized');
    } else {
      console.log('! Database counts still don\'t match');
      
      const differences = await remoteDB.query(`
        SELECT 'missing_in_local' as type, r.sbn 
        FROM bienes r 
        WHERE NOT EXISTS (SELECT 1 FROM bienes l WHERE l.sbn = r.sbn)
        UNION ALL
        SELECT 'missing_in_remote' as type, l.sbn
        FROM bienes l 
        WHERE NOT EXISTS (SELECT 1 FROM bienes r WHERE r.sbn = l.sbn)
      `, {
        type: Sequelize.QueryTypes.SELECT
      });

      if (differences.length > 0) {
        console.log('Found differences:', differences);
      }
    }
  } catch (error) {
    console.error("Synchronization error:", error);
  } finally {
    if (remoteDBConnection) {
      await remoteDBConnection.close();
      remoteDBConnection = null;
    }
  }
}

module.exports = { syncDatabases };