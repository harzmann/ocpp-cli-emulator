import { z } from "zod";
import {
  type OcppCall,
  type OcppCallResult,
  OcppOutgoing,
} from "../../ocppMessage";
import type { VCP } from "../../vcp";
import { ConnectorIdSchema, IdTagInfoSchema, IdTokenSchema } from "./_common";
import { meterValuesOcppMessage } from "./meterValues";

const StartTransactionReqSchema = z.object({
  connectorId: ConnectorIdSchema,
  idTag: IdTokenSchema,
  meterStart: z.number().int(),
  reservationId: z.number().int().nullish(),
  timestamp: z.string().datetime(),
});
type StartTransactionReqType = typeof StartTransactionReqSchema;

const StartTransactionResSchema = z.object({
  idTagInfo: IdTagInfoSchema,
  transactionId: z.number().int(),
});
type StartTransactionResType = typeof StartTransactionResSchema;

class StartTransactionOcppMessage extends OcppOutgoing<
  StartTransactionReqType,
  StartTransactionResType
> {
  resHandler = async (
    vcp: VCP,
    call: OcppCall<z.infer<StartTransactionReqType>>,
    result: OcppCallResult<z.infer<StartTransactionResType>>,
  ): Promise<void> => {
    vcp.transactionManager.startTransaction(vcp, {
      transactionId: result.payload.transactionId,
      idTag: call.payload.idTag,
      connectorId: call.payload.connectorId,
      meterValuesCallback: async (transactionState) => {
        // Generate realistic charging values
        const powerKW = Math.random() * 2 + 10; // 10-12 kW
        const voltage = 400 + Math.random() * 10; // 400-410V
        const current = powerKW * 1000 / voltage; // Calculate current from power and voltage
        const temperature = 25 + Math.random() * 15; // 25-40°C
        
        vcp.send(
          meterValuesOcppMessage.request({
            connectorId: call.payload.connectorId,
            transactionId: result.payload.transactionId,
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
                    value: powerKW.toFixed(2),
                    measurand: "Power.Active.Import",
                    unit: "kW",
                  },
                  {
                    value: voltage.toFixed(1),
                    measurand: "Voltage",
                    unit: "V",
                  },
                  {
                    value: current.toFixed(2),
                    measurand: "Current.Import",
                    unit: "A",
                  },
                  {
                    value: temperature.toFixed(1),
                    measurand: "Temperature",
                    unit: "Celsius",
                  },
                ],
              },
            ],
          }),
        );
        
        // Enhanced debug output with ChargePoint ID
        const chargePointPrefix = `[${vcp.chargePointId}]`;
        console.log(`\n${chargePointPrefix} 📊 MeterValues Update:`);
        console.log(`${chargePointPrefix}    🔋 Energy: ${(transactionState.meterValue / 1000).toFixed(3)} kWh`);
        console.log(`${chargePointPrefix}    ⚡ Power: ${powerKW.toFixed(2)} kW`);
        console.log(`${chargePointPrefix}    🔌 Voltage: ${voltage.toFixed(1)} V`);
        console.log(`${chargePointPrefix}    ⚡ Current: ${current.toFixed(2)} A`);
        console.log(`${chargePointPrefix}    🌡️  Temperature: ${temperature.toFixed(1)} °C`);
        console.log(`${chargePointPrefix}    🕐 Time: ${new Date().toLocaleTimeString()}`);
        console.log(`${chargePointPrefix}    📈 TransactionID: ${result.payload.transactionId}`);
        console.log(`${chargePointPrefix}    ─────────────────────────────────────────`);
      },
    });
  };
}

export const startTransactionOcppMessage = new StartTransactionOcppMessage(
  "StartTransaction",
  StartTransactionReqSchema,
  StartTransactionResSchema,
);
