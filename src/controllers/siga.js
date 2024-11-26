const fetch = require("node-fetch");
const { Sequelize, QueryTypes } = require("sequelize");

const SigaDB = async () => {
  const BATCH_SIZE = 1000;
  const API_URL = "http://10.30.1.42:8084/api/v1/bienes";
  let processedCountServer = 0;
  let processedCountLocal = 0;
  let errorCount = 0;

  // Mapeo exacto de campos API a BD
  const fieldMapping = {
    'SECUENCIA': 'SECUENCIA',
    'CODIGO_ACTIVO': 'CODIGO_ACTIVO',
    'DESCRIPCION': 'DESCRIPCION',
    'ESTADO': 'ESTADO',
    'ESTADO_CONSERV': 'ESTADO_CONSERV',
    'EMPLEADO_FINAL': 'EMPLEADO_FINAL',
    'SEDE': 'SEDE',
    'nombre_sede': 'nombre_sede',
    'CENTRO_COSTO': 'CENTRO_COSTO',
    'NOMBRE_DEPEND': 'NOMBRE_DEPEND',
    'TIPO_UBICAC': 'TIPO_UBICAC',
    'COD_UBICAC': 'COD_UBICAC',
    'UBICAC_FISICA': 'UBICAC_FISICA',
    'docum_ident': 'docum_ident',
    'RESPONSABLE': 'RESPONSABLE',
    'USUARIO_FINAL': 'USUARIO_FINAL',
    'NRO_SERIE': 'NRO_SERIE',
    'MARCA': 'MARCA',
    'MODELO': 'MODELO',
    'MEDIDAS': 'MEDIDAS',
    'CARACTERISTICAS': 'CARACTERISTICAS',
    'OBSERVACIONES': 'OBSERVACIONES'
  };

  try {
    // Inicializar conexiones
    const serverDB = new Sequelize("inventario_patrimonio", "usuario", "root", {
      host: "10.30.1.43",
      dialect: "mysql",
      logging: false
    });

    const localDB = new Sequelize("inventario_patrimonio5", "root", "root", {
      host: "localhost",
      dialect: "mysql",
      logging: false
    });

    // Verificar conexiones
    await Promise.all([
      serverDB.authenticate(),
      localDB.authenticate()
    ]);
    console.log("Conexiones establecidas correctamente");

    // Función para obtener datos del API con retry
    const fetchWithRetry = async (url, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return await response.json();
        } catch (error) {
          if (i === retries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    };

    // Obtener datos del API
    console.log("Obteniendo datos del API...");
    const externalData = await fetchWithRetry(API_URL);

    if (!externalData?.data?.length) {
      console.log("No se recibieron datos del API");
      return;
    }

    // Preparar registros manteniendo los nombres exactos de los campos
    const prepareRecord = (apiData) => {
      const record = {};
      for (const [apiField, dbField] of Object.entries(fieldMapping)) {
        record[dbField] = apiData[apiField];
      }
      return record;
    };

    // Preparar registros para cada base de datos
    const newRecords = externalData.data.map(item => prepareRecord(item));

    // Generar la consulta SQL dinámicamente
    const generateUpsertQuery = (records) => {
      if (records.length === 0) return null;

      const columns = Object.keys(records[0]);
      const updateClauses = columns
        .filter(col => col !== 'SECUENCIA') // SECUENCIA es la clave primaria
        .map(col => `${col}=VALUES(${col})`)
        .join(',');

      return `
        INSERT INTO siga 
        (${columns.join(',')}) 
        VALUES :values 
        ON DUPLICATE KEY UPDATE 
        ${updateClauses}
      `;
    };

    // Función para procesar lotes en una base de datos
    const processBatch = async (db, records, isServer) => {
      if (records.length === 0) return;

      const query = generateUpsertQuery(records);
      if (!query) return;

      const transaction = await db.transaction();
      try {
        await db.query(query, {
          replacements: { 
            values: records.map(record => Object.values(record))
          },
          type: QueryTypes.INSERT,
          transaction
        });

        await transaction.commit();
        if (isServer) {
          processedCountServer += records.length;
        } else {
          processedCountLocal += records.length;
        }
        
        // console.log(`Procesados ${records.length} registros en ${isServer ? 'servidor' : 'local'}`);
      } catch (error) {
        await transaction.rollback();
        errorCount++;
        // console.error(`Error procesando lote en ${isServer ? 'servidor' : 'local'}:`, error.message);
        // Log del primer registro que causó el error para debugging
        // console.error('Ejemplo de registro con error:', records[0]);
        await logFailedRecords(records, error, isServer);
      }
    };

    // Procesar en ambas bases de datos
    // console.log(`Procesando ${newRecords.length} registros...`);
    for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
      const batch = newRecords.slice(i, i + BATCH_SIZE);
      
      try {
        await Promise.all([
          processBatch(serverDB, batch, true),
          processBatch(localDB, batch, false)
        ]);
      } catch (error) {
        console.error("Error en el procesamiento del lote:", error.message);
      }
    }

    // console.log(`
    //   Sincronización completada:
    //   - Registros procesados en servidor: ${processedCountServer}
    //   - Registros procesados en local: ${processedCountLocal}
    //   - Errores: ${errorCount}
    //   - Timestamp: ${new Date().toISOString()}
    // `);

  } catch (error) {
    console.error("Error de sincronización:", error);
    throw error;
  }
};

// Función para registrar errores
const logFailedRecords = async (records, error, isServer) => {
  const logEntry = {
    timestamp: new Date(),
    database: isServer ? 'servidor' : 'local',
    error: error.message,
    records: records
  };
  // console.error("Registros fallidos:", JSON.stringify(logEntry, null, 2));
};

module.exports = {
  SigaDB
};