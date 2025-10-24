// services/dispenseService.js
const {
  writeNode,
  pulse,
  readNode,
  AttributeIds,
  session,
} = require("./opcuaClient");
const { DataType } = require("node-opcua");

function getCorrectNodeIds(dispenser) {
  let offset;

  if (dispenser <= 6) {
    offset = (dispenser - 1) * 39;
  } else {
    offset = (dispenser - 7) * 39;
  }

  return {
    qtyBase: 12 + offset, // Quantity[0] @ i=13 … Quantity[5] @ i=18
    dispCmd: 19 + offset, // Disp_Cmd
    dispAck: 20 + offset, // Disp_Ack
    dispCountBase: 21 + offset, // Disp_Count[0] @ i=22 … Disp_Count[5] @ i=27
    dispCmplt: 28 + offset, // Disp_Cmplt
    rstDisp: 29 + offset, // Rst_Disp
    rstAck: 30 + offset, // Rst_Ack
    stateOutOfStock: 8 + offset, // State[1]
    stateLowStock: 9 + offset, // State[2]
    opcuaCommsBad: 34 + offset, // OPCUA Comms Bad
    dispAckQtyBase: 36 + offset, // Disp_Ack_Qty[0]…[5]
    clrFault: 31 + offset,
  };
}

function toInt16(str) {
  // 1) parse the string into a (JS) Number
  let n = parseInt(str, 10);
  if (isNaN(n)) {
    throw new Error(`"${str}" is not a valid integer string`);
  }

  // 2) coerce into a signed 16‐bit range (–32,768 .. +32,767)
  //    This effectively does: n & 0xFFFF but keeps the sign.
  const int16 = (n << 16) >> 16;

  return int16;
}
// simple sleep
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// poll a Boolean node until it === target or timeout
async function waitForBit(dispenser, nodeId, target, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const dv = await readNode(dispenser, nodeId);
    //console.log("dv: ", dv);
    if (dv.value.value === target) return;
    await delay(200);
  }
  throw new Error(`Timeout waiting for ${nodeId} → ${target}`);
}

// poll an Int32 node until it matches `count`
async function waitForCount(dispenser, nodeId, count) {
  while (true) {
    const dv = await readNode(dispenser, nodeId);
    //  console.log("dv: ", dv);
    if (dv.value.value === count) return;
    await delay(50);
  }
}

async function dispenseMultiLane(dispenser, laneData) {
  const NodeIds = await getCorrectNodeIds(dispenser);
  // 1) comms health (once)
  const bad = await readNode(dispenser, `ns=4;i=${NodeIds.opcuaCommsBad}`);
  // if (bad) throw new Error(`OPC UA comms bad on dispenser ${dispenser}`);

  // 2) write quantity for each lane
  for (const { lane, qty } of laneData) {
    // assume NodeIds.qtyBase is the same for all lanes; laneData.lane indexes into it
    const qtyNode = `ns=4;i=${NodeIds.qtyBase + lane}`;

    console.log(
      `➤ [D${dispenser}, L${lane}] write Qty_to_Disp ->`,
      qtyNode,
      qty
    );
    await writeNode(dispenser, qtyNode, qty, DataType.Int16);
  }

  // 3) stock‐low warning (once)
  const low = (await readNode(dispenser, `ns=4;i=${NodeIds.stateLowStock}`))
    .value.value;
  if (low) console.warn(`⚠ Dispenser ${dispenser} is low on stock`);

  // 4) write the dispense command (once)
  console.log(`➤ [D${dispenser}] Writing Disp_Cmd…`);
  await writeNode(
    dispenser,
    `ns=4;i=${NodeIds.dispCmd}`,
    true,
    DataType.Boolean
  );

  // 5) wait for PLC to ack (once)
  await waitForBit(dispenser, `ns=4;i=${NodeIds.dispAck}`, true, 5000);
  console.log(`✔ [D${dispenser}] Disp_Ack received`);

  // 6) read how many the PLC will actually dispense for each lane
  //    (collect all ackQtys in an array of objects)
  const ackResults = await Promise.all(
    laneData.map(async ({ lane }) => {
      const ackQtyNode = `ns=4;i=${NodeIds.dispAckQtyBase + lane}`;
      const raw = await readNode(dispenser, ackQtyNode);
      const ackQty = raw.value.value;
      console.log(
        `→ [D${dispenser}, L${lane}] ${ackQtyNode} PLC will dispense:`,
        ackQty
      );
      return { lane, ackQty };
    })
  );

  // 7) wait until each lane’s count reaches its ackQty
  for (const { lane, ackQty } of ackResults) {
    await waitForCount(
      dispenser,
      `ns=4;i=${NodeIds.dispCountBase + lane}`,
      ackQty
    );
    console.log(`✔ [D${dispenser}, L${lane}] Disp_Count reached`, ackQty);
  }

  // 8) wait for the “complete” pulse (once)
  await waitForBit(dispenser, `ns=4;i=${NodeIds.dispCmplt}`, true, 10000);
  console.log(`✔ [D${dispenser}] Disp_Cmplt`);

  // 9) reset the dispenser (once)
  //console.log(`➤ [D${dispenser}] pulsing Rst_Disp…`);
  //await waitForBit(dispenser, `ns=4;i=${NodeIds.rstDisp}`, true, 5000);
  //await waitForBit(dispenser, `ns=4;i=${NodeIds.rstAck}`, true, 5000);
  //console.log(`✔ [D${dispenser}] Rst_Ack`);

  // build a result array per lane, pairing requested→dispensed
  return ackResults.map(({ lane, ackQty }) => ({
    dispenser,
    lane,
    requested: laneData.find((x) => x.lane === lane).qty,
    dispensed: ackQty,
  }));
}

module.exports = { dispenseMultiLane, toInt16 };
