const fetch = require("node-fetch");
const { getDatabaseConnection, alterTable, checkServerConnection } = require("../../config/config");
const { QueryTypes } = require("sequelize");

const SigaDB = async () => {
  const BATCH_SIZE = 1000; // Process records in batches
  const API_URL = "http://10.30.1.42:8084/api/v1/bienes";
  let processedCount = 0;
  let errorCount = 0;
  const online = await checkServerConnection("10.30.1.43");

  if (online) {
    try {
      const { models } = await getDatabaseConnection();

      await alterTable(
        "ALTER TABLE siga ADD COLUMN IF NOT EXISTS nombre_sede VARCHAR(255) NULL"
      );
      // Fetch API data with timeout and retry
      const fetchWithRetry = async (url, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

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
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
          }
        }
      };

      // Get external data
      console.log("Fetching external data...");
      const externalData = await fetchWithRetry(API_URL);

      if (!externalData?.data?.length) {
        console.log("No data received from external API");
        return;
      }

      // Get existing sequences efficiently
      console.log("Checking existing records...");
      const existingSequences = new Set(
        (
          await models.siga.findAll({
            attributes: ["secuencia"],
            raw: true,
          })
        ).map((item) => item.secuencia)
      );

      // Filter and prepare new records
      const newRecords = externalData.data
        .filter((item) => !existingSequences.has(item.SECUENCIA))
        .map((item) => ({
          ...item,
          created_at: new Date(),
          updated_at: new Date(),
        }));

      if (!newRecords.length) {
        console.log("No new records to sync");
        return;
      }

      console.log(`Found ${newRecords.length} new records to sync`);

      // Process in batches with transaction
      for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
        const batch = newRecords.slice(i, i + BATCH_SIZE);
        const transaction = await (await getDatabaseConnection()).transaction();

        try {
          await models.siga.bulkCreate(batch, {
            transaction,
            validate: true,
            hooks: true,
          });

          await transaction.commit();
          processedCount += batch.length;

          console.log(
            `Processed ${processedCount}/${newRecords.length} records`
          );
        } catch (error) {
          await transaction.rollback();
          errorCount++;
          console.error(
            `Error processing batch ${i / BATCH_SIZE + 1}:`,
            error.message
          );

          // Log failed records for later review
          await logFailedRecords(batch, error);
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
      throw error; // Re-throw to be handled by caller
    } finally {
      // Report sync results
      const endTime = new Date();
      console.log(`
                Sync completed:
                - Total processed: ${processedCount}
                - Successful: ${processedCount - errorCount}
                - Failed batches: ${errorCount}
                - Timestamp: ${endTime.toISOString()}
            `);
    }
  }
};

// Helper function to log failed records
const logFailedRecords = async (records, error) => {
  try {
    const logEntry = {
      timestamp: new Date(),
      error: error.message,
      records: records,
    };

    // You could save this to a file or database
    console.error("Failed records:", JSON.stringify(logEntry, null, 2));
  } catch (logError) {
    console.error("Error logging failed records:", logError);
  }
};

module.exports = {
  SigaDB,
};
