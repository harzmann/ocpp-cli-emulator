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
      chargePointVendor: "eh-systemhaus",
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

  // Start Transaction - Backend will provide the TransactionID in response
  vcp.send(
    startTransactionOcppMessage.request({
      connectorId: connectorId,
      idTag: idTag,
      meterStart: 0,
      timestamp: new Date().toISOString(),
    })
  );

  // Wait a moment for transaction to start, then send Charging status
  await setTimeout(1000);
  vcp.send(
    statusNotificationOcppMessage.request({
      connectorId,
      errorCode: "NoError", 
      status: "Charging",
      timestamp: new Date().toISOString(),
    })
  );
  console.log("🔋 Status: Charging");

  console.log("\n� ═══════════════════════════════════════════");
  console.log("�🔋 CHARGING SESSION STARTED");
  console.log("🚗 ═══════════════════════════════════════════");
  console.log("⏱️  Duration: 5 minutes");
  console.log("📡 TransactionID will be provided by backend");
  console.log("📊 MeterValues sent every 15 seconds with:");
  console.log("   • Energy.Active.Import.Register (kWh)");
  console.log("   • Power.Active.Import (kW)");
  console.log("   • Voltage (V)");
  console.log("   • Current.Import (A)");
  console.log("   • Temperature (Celsius)");
  console.log("🚗 ═══════════════════════════════════════════\n");
  
  // Simulate charging for 5 minutes
  await setTimeout(5 * 60 * 1000);

  // Note: In a real implementation, you would need to track the transactionId from the StartTransaction response
  // For this simulation, we'll stop all active transactions
  const activeTransactions = Array.from(vcp.transactionManager.transactions.keys());
  
  if (activeTransactions.length > 0) {
    const transactionId = activeTransactions[0]; // Get the first active transaction
    
    // Send StopTransaction
    const finalMeterValue = vcp.transactionManager.getMeterValue(transactionId);
    vcp.send(
      stopTransactionOcppMessage.request({
        transactionId: typeof transactionId === 'number' ? transactionId : parseInt(transactionId.toString()),
        meterStop: Math.floor(finalMeterValue),
        timestamp: new Date().toISOString(),
      })
    );

    // Stop the transaction
    vcp.transactionManager.stopTransaction(transactionId);
    console.log("\n🛑 ═══════════════════════════════════════════");
    console.log("⏹️  CHARGING SESSION COMPLETED");
    console.log("🛑 ═══════════════════════════════════════════");
    console.log(`📊 Total energy consumed: ${(finalMeterValue / 1000).toFixed(2)} kWh`);
    console.log(`⏱️  Session duration: 5 minutes`);
    console.log(`📈 Final TransactionID: ${transactionId}`);
    console.log("🛑 ═══════════════════════════════════════════\n");
  } else {
    console.log("⚠️ No active transactions found to stop");
  }

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

  // Clean up heartbeat interval
  clearInterval(heartbeatInterval);
  
  // Wait a moment for the last messages to be sent
  await setTimeout(2000);
  
  console.log("🔌 Closing WebSocket connection and exiting...");
  
  // Close WebSocket connection cleanly (this will also exit the program)
  vcp.close();
}

simulateCharging().catch(console.error);
