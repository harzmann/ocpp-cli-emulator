// Script to simulate a ChargePoint S001 connecting to localhost:9000 and running a 5-minute charging session
import { VCP } from "./src/vcp";
import { setTimeout } from "node:timers/promises";

async function simulateCharging() {
  // Create VCP instance for ChargePoint S001
  const { OcppVersion } = await import("./src/ocppVersion");
  
  // Import the appropriate OCPP messages based on version
  const { bootNotificationOcppMessage } = await import("./src/v16/messages/bootNotification");
  const { statusNotificationOcppMessage } = await import("./src/v16/messages/statusNotification");
  const { startTransactionOcppMessage } = await import("./src/v16/messages/startTransaction");
  const { stopTransactionOcppMessage } = await import("./src/v16/messages/stopTransaction");
  const { heartbeatOcppMessage } = await import("./src/v16/messages/heartbeat");
  const { meterValuesOcppMessage } = await import("./src/v16/messages/meterValues");
  
  const vcp = new VCP({
    ocppVersion: OcppVersion.OCPP_1_6, // or OcppVersion.OCPP_1_6 for OCPP 1.6
    endpoint: "ws://localhost:9000",
    chargePointId: "S001",
  });

  await vcp.connect();
  console.log("✅ Connected as ChargePoint S001");

  // Send BootNotification
  vcp.send(
    bootNotificationOcppMessage.request({
      chargePointVendor: "Solidstudio",
      chargePointModel: "VirtualCP-S001", // Max 20 chars
      chargePointSerialNumber: "S001-001",
      firmwareVersion: "1.0.0",
    })
  );
  console.log("📡 Sent BootNotification");

  // Initial status: Available
  vcp.send(
    statusNotificationOcppMessage.request({
      connectorId: 1,
      errorCode: "NoError",
      status: "Available",
      timestamp: new Date().toISOString(),
    })
  );
  console.log("🟢 Status: Available");

  // Start heartbeat interval (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    vcp.send(heartbeatOcppMessage.request({}));
    console.log("💓 Heartbeat sent");
  }, 30000);

  // Wait a bit before starting transaction
  await setTimeout(2000);

  // Simulate transaction start
  const transactionId = 1; // OCPP 1.6 uses numeric transaction IDs
  const idTag = "test-idtag";
  const connectorId = 1;
  const evseId = 1;

  // Status: Preparing (EV plugged in)
  vcp.send(
    statusNotificationOcppMessage.request({
      connectorId,
      errorCode: "NoError",
      status: "Preparing",
      timestamp: new Date().toISOString(),
    })
  );
  console.log("🔌 Status: Preparing (EV plugged in)");

  // Start Transaction
  vcp.send(
    startTransactionOcppMessage.request({
      connectorId: connectorId,
      idTag: idTag,
      meterStart: 0,
      timestamp: new Date().toISOString(),
    })
  );

  // Start transaction with automatic meter values
  vcp.transactionManager.startTransaction(vcp, {
    transactionId,
    idTag,
    connectorId,
    evseId,
    meterValuesCallback: async (transactionState) => {
      // Send periodic meter values via MeterValues
      vcp.send(
        meterValuesOcppMessage.request({
          connectorId: connectorId,
          transactionId: transactionId,
          meterValue: [
            {
              timestamp: new Date().toISOString(),
              sampledValue: [
                {
                  value: (transactionState.meterValue / 1000).toString(),
                  measurand: "Energy.Active.Import.Register",
                  unit: "kWh",
                },
                {
                  value: (Math.random() * 2 + 10).toFixed(1),
                  measurand: "Power.Active.Import",
                  unit: "kW",
                },
              ],
            },
          ],
        })
      );
      console.log(
        `⚡ MeterValue: ${transactionState.meterValue} Wh, Power: ${(Math.random() * 2 + 10).toFixed(1)} kW at ${new Date().toISOString()}`
      );
    },
  });

  console.log("🔋 Charging started - Transaction running for 5 minutes");
  
  // Simulate charging for 5 minutes
  await setTimeout(5 * 60 * 1000);

  // Send Transaction Ended event
  const finalMeterValue = vcp.transactionManager.getMeterValue(transactionId);
  vcp.send(
    stopTransactionOcppMessage.request({
      transactionId: transactionId,
      meterStop: Math.floor(finalMeterValue),
      timestamp: new Date().toISOString(),
    })
  );

  // Stop the transaction
  vcp.transactionManager.stopTransaction(transactionId);
  console.log("⏹️ Charging stopped");

  // Status: Available (EV unplugged)
  vcp.send(
    statusNotificationOcppMessage.request({
      connectorId,
      errorCode: "NoError",
      status: "Available",
      timestamp: new Date().toISOString(),
    })
  );
  console.log("🟢 Status: Available (EV unplugged)");
  console.log(`📊 Total energy consumed: ${(finalMeterValue / 1000).toFixed(2)} kWh`);

  // Clean up heartbeat interval
  clearInterval(heartbeatInterval);
  console.log("🏁 Simulation completed");
}

simulateCharging().catch(console.error);
