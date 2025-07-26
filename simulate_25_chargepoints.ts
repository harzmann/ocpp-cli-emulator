// Script to simulate 25 ChargePoints (S001-S025) connecting to localhost:9000 with parallel charging sessions
import { VCP } from "./src/vcp";
import { setTimeout } from "node:timers/promises";

interface ChargePointConfig {
  id: string;
  chargePointId: string;
  startDelay: number; // minutes
  chargingDuration: number; // minutes
  connectorId: number;
}

async function createChargePoint(config: ChargePointConfig): Promise<VCP> {
  const { OcppVersion } = await import("./src/ocppVersion");
  
  const vcp = new VCP({
    ocppVersion: OcppVersion.OCPP_1_6,
    endpoint: "ws://localhost:9000",
    chargePointId: config.chargePointId,
  });

  return vcp;
}

async function simulateChargePoint(config: ChargePointConfig): Promise<void> {
  try {
    console.log(`[${config.chargePointId}] 🏗️  Initializing ChargePoint...`);
    
    // Import OCPP messages
    const { bootNotificationOcppMessage } = await import("./src/v16/messages/bootNotification");
    const { statusNotificationOcppMessage } = await import("./src/v16/messages/statusNotification");
    const { startTransactionOcppMessage } = await import("./src/v16/messages/startTransaction");
    const { stopTransactionOcppMessage } = await import("./src/v16/messages/stopTransaction");
    
    const vcp = await createChargePoint(config);
    
    // Connect
    await vcp.connect();
    console.log(`[${config.chargePointId}] ✅ Connected successfully`);

    // Send BootNotification
    vcp.send(
      bootNotificationOcppMessage.request({
        chargePointVendor: "eh-systemhaus",
        chargePointModel: `VCP-${config.chargePointId}`,
        chargePointSerialNumber: `${config.chargePointId}-001`,
        firmwareVersion: "1.0.0",
      })
    );
    console.log(`[${config.chargePointId}] 📡 Sent BootNotification`);

    // Initial status: Available
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: config.connectorId,
        errorCode: "NoError",
        status: "Available",
        timestamp: new Date().toISOString(),
      })
    );
    console.log(`[${config.chargePointId}] 🟢 Status: Available`);

    // Wait for start delay
    console.log(`[${config.chargePointId}] ⏳ Waiting ${config.startDelay} minutes before starting charging...`);
    await setTimeout(config.startDelay * 60 * 1000);

    // Start charging session
    console.log(`[${config.chargePointId}] 🚗 ═══════════════════════════════════════════`);
    console.log(`[${config.chargePointId}] 🔋 STARTING CHARGING SESSION`);
    console.log(`[${config.chargePointId}] 🚗 ═══════════════════════════════════════════`);
    console.log(`[${config.chargePointId}] ⏱️  Duration: ${config.chargingDuration} minutes`);
    console.log(`[${config.chargePointId}] 🔌 Connector: ${config.connectorId}`);
    console.log(`[${config.chargePointId}] 🚗 ═══════════════════════════════════════════`);

    const idTag = `tag-${config.chargePointId}`;

    // Status: Preparing (EV plugged in)
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: config.connectorId,
        errorCode: "NoError",
        status: "Preparing",
        timestamp: new Date().toISOString(),
      })
    );
    console.log(`[${config.chargePointId}] 🔌 Status: Preparing (EV plugged in)`);

    // Start Transaction
    vcp.send(
      startTransactionOcppMessage.request({
        connectorId: config.connectorId,
        idTag: idTag,
        meterStart: 0,
        timestamp: new Date().toISOString(),
      })
    );

    // Wait a moment for transaction to start, then send Charging status
    await setTimeout(1000);
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: config.connectorId,
        errorCode: "NoError", 
        status: "Charging",
        timestamp: new Date().toISOString(),
      })
    );
    console.log(`[${config.chargePointId}] 🔋 Status: Charging - Session Active!`);
    console.log(`[${config.chargePointId}] 📊 MeterValues will be sent every 15 seconds with:`);
    console.log(`[${config.chargePointId}]    • Energy.Active.Import.Register (kWh)`);
    console.log(`[${config.chargePointId}]    • Power.Active.Import (kW)`);
    console.log(`[${config.chargePointId}]    • Voltage (V)`);
    console.log(`[${config.chargePointId}]    • Current.Import (A)`);
    console.log(`[${config.chargePointId}]    • Temperature (Celsius)`);

    // Simulate charging for the specified duration
    await setTimeout(config.chargingDuration * 60 * 1000);

    // Stop charging session
    const activeTransactions = Array.from(vcp.transactionManager.transactions.keys());
    
    if (activeTransactions.length > 0) {
      const transactionId = activeTransactions[0];
      
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
      
      console.log(`[${config.chargePointId}] 🛑 ═══════════════════════════════════════════`);
      console.log(`[${config.chargePointId}] ⏹️  CHARGING SESSION COMPLETED`);
      console.log(`[${config.chargePointId}] 🛑 ═══════════════════════════════════════════`);
      console.log(`[${config.chargePointId}] 📊 Total energy: ${(finalMeterValue / 1000).toFixed(2)} kWh`);
      console.log(`[${config.chargePointId}] ⏱️  Duration: ${config.chargingDuration} minutes`);
      console.log(`[${config.chargePointId}] 📈 TransactionID: ${transactionId}`);
      console.log(`[${config.chargePointId}] 🛑 ═══════════════════════════════════════════`);
    } else {
      console.log(`[${config.chargePointId}] ⚠️ No active transactions found to stop`);
    }

    // Status: Available (EV unplugged)
    vcp.send(
      statusNotificationOcppMessage.request({
        connectorId: config.connectorId,
        errorCode: "NoError",
        status: "Available",
        timestamp: new Date().toISOString(),
      })
    );
    console.log(`[${config.chargePointId}] 🟢 Status: Available (EV unplugged)`);

    // Wait a moment for the last messages to be sent
    await setTimeout(2000);
    
    console.log(`[${config.chargePointId}] 🔌 Closing WebSocket connection...`);
    
    // Close WebSocket connection cleanly (this will also stop the automatic heartbeat)
    vcp.close();
    
    console.log(`[${config.chargePointId}] ✅ ChargePoint simulation completed successfully`);
    
  } catch (error) {
    console.error(`[${config.chargePointId}] ❌ Error:`, error);
  }
}

async function main() {
  console.log("🚗 ═══════════════════════════════════════════════════════════");
  console.log("🏭 STARTING 25 CHARGEPOINT SIMULATION");
  console.log("🚗 ═══════════════════════════════════════════════════════════");
  console.log("🔌 Endpoint: ws://localhost:9000");
  console.log("📊 ChargePoints: S001 - S025");
  console.log("⏱️  Start delays: 1-60 minutes (random)");
  console.log("🔋 Charging durations: 15-60 minutes (random)");
  console.log("📡 OCPP Version: 1.6");
  console.log("📊 MeterValues: Energy, Power, Voltage, Current, Temperature");
  console.log("🚗 ═══════════════════════════════════════════════════════════\n");

  // Generate configurations for 25 charge points
  const chargePointConfigs: ChargePointConfig[] = [];
  
  for (let i = 1; i <= 25; i++) {
    const chargePointId = `S${i.toString().padStart(3, '0')}`; // S001, S002, ..., S025
    const startDelay = Math.random() * (60 - 1) + 1; // 1-60 minutes
    const chargingDuration = Math.random() * (60 - 15) + 15; // 15-60 minutes
    
    chargePointConfigs.push({
      id: `cp-${i}`,
      chargePointId,
      startDelay: Math.round(startDelay * 10) / 10, // Round to 1 decimal
      chargingDuration: Math.round(chargingDuration * 10) / 10, // Round to 1 decimal
      connectorId: 1,
    });
  }
  
  // Sort by start delay for better overview
  chargePointConfigs.sort((a, b) => a.startDelay - b.startDelay);
  
  console.log("📋 CHARGEPOINT SCHEDULE (sorted by start time):");
  console.log("═══════════════════════════════════════════════");
  chargePointConfigs.forEach((config, index) => {
    const startTime = new Date(Date.now() + config.startDelay * 60 * 1000);
    const endTime = new Date(startTime.getTime() + config.chargingDuration * 60 * 1000);
    console.log(`${(index + 1).toString().padStart(2, ' ')}. [${config.chargePointId}] Start: ${startTime.toLocaleTimeString()} | Duration: ${config.chargingDuration}min | End: ${endTime.toLocaleTimeString()}`);
  });
  
  console.log("\n🚀 Starting all ChargePoint simulations in parallel...\n");

  // Start all charge point simulations in parallel
  const promises = chargePointConfigs.map(config => simulateChargePoint(config));
  
  // Wait for all simulations to complete
  try {
    const results = await Promise.allSettled(promises);
    
    // Count successful and failed simulations
    const successful = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.filter(result => result.status === 'rejected').length;
    
    console.log("\n🏁 ═══════════════════════════════════════════════════════════");
    console.log("🎉 ALL CHARGEPOINT SIMULATIONS COMPLETED");
    console.log("🏁 ═══════════════════════════════════════════════════════════");
    console.log(`✅ Successful: ${successful}/25`);
    console.log(`❌ Failed: ${failed}/25`);
    
    if (failed > 0) {
      console.log("\n❌ Failed simulations:");
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.log(`   [${chargePointConfigs[index].chargePointId}] ${result.reason}`);
        }
      });
    }
    
    console.log("🏁 ═══════════════════════════════════════════════════════════");
  } catch (error) {
    console.error("❌ Error in main simulation:", error);
  }
}

// Start the simulation
main().catch(console.error);
