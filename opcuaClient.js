const { OPCUAClient, AttributeIds, DataType } = require("node-opcua");

// ─── 1. Define the two endpoints ───────────────────────────────────────────────
const endpoints = {
  ep1: process.env.OPCUA_ENDPOINT_1 || "opc.tcp://10.1.4.112:4840", // dispensers 1–6
  ep2: process.env.OPCUA_ENDPOINT_2 || "opc.tcp://10.1.4.113:4840", // dispensers 7–10
};

const clients = {};
const sessions = {};

// ─── 2. Heartbeat helpers ────────────────────────────────────────────────────
const heartbeatTimers = {};

/**
 * startHeartbeat(dispenser, nodeId, intervalMs):
 *    Pulses `nodeId` every `intervalMs` using the correct session.
 */
function startHeartbeat(dispenser, nodeId, intervalMs = 4000) {
  const key = `D${dispenser}-${nodeId}`;
  if (heartbeatTimers[key]) return; // already running

  const sendPulse = async () => {
    try {
      await pulse(dispenser, nodeId);
    } catch (err) {
      console.error(
        `💓 Heartbeat failed [D${dispenser}, ${nodeId}] →`,
        err.message
      );
    }
  };

  // Fire once immediately, then on interval:
  sendPulse();
  heartbeatTimers[key] = setInterval(sendPulse, intervalMs);
}

/**
 * stopHeartbeat(dispenser, nodeId):
 *    Stops a running heartbeat.
 */
function stopHeartbeat(dispenser, nodeId) {
  const key = `D${dispenser}-${nodeId}`;
  const tid = heartbeatTimers[key];
  if (tid) {
    clearInterval(tid);
    delete heartbeatTimers[key];
  }
}

/**
 * Helper: getEndpointKey(dispenser)
 *    Map dispenser IDs 1–6 → "ep1", 7–10 → "ep2"
 */
function getEndpointKey(dispenser) {
  return dispenser >= 1 && dispenser <= 6 ? "ep1" : "ep2";
}

// ─── 3. Core OPC UA connect + wrappers ─────────────────────────────────────────
async function connectAll() {
  for (const key of Object.keys(endpoints)) {
    const url = endpoints[key];
    const client = OPCUAClient.create({ endpoint_must_exist: false });
    await client.connect(url);
    const session = await client.createSession();
    clients[key] = client;
    sessions[key] = session;
    console.log(`🟢 Connected to OPC UA [${key}] @ ${url}`);
  }

  // ─── 4. Once both sessions exist, fire all 10 heartbeats ─────────────────────

  const heartbeatNodeFor = (dispenser) => {
    if (dispenser <= 6) {
      return `ns=4;i=${35 + (dispenser - 1) * 39}`;
    } else {
      return `ns=4;i=${35 + (dispenser - 7) * 39}`;
    }
  };

  for (let dispenser = 1; dispenser <= 10; dispenser++) {
    const nodeId = heartbeatNodeFor(dispenser);
    startHeartbeat(dispenser, nodeId, 4000);
    console.log(`→ Heartbeat started for Dispenser ${dispenser} @ ${nodeId}`);
  }
}

async function readNode(dispenser, nodeId) {
  const key = getEndpointKey(dispenser);
  const session = sessions[key];
  if (!session) {
    throw new Error(`No session for endpoint key="${key}"`);
  }
  return session.read({
    nodeId,
    attributeId: AttributeIds.Value,
  });
}

async function writeNode(
  dispenser,
  nodeId,
  value,
  dataType = DataType.Boolean
) {
  const key = getEndpointKey(dispenser);
  const session = sessions[key];
  if (!session) {
    throw new Error(`No session for endpoint key="${key}"`);
  }
  return session.write({
    nodeId,
    attributeId: AttributeIds.Value,
    value: { value: { dataType, value } },
  });
}

async function pulse(dispenser, nodeId, ms = 1500) {
  await writeNode(dispenser, nodeId, true);
  await new Promise((r) => setTimeout(r, ms));
  await writeNode(dispenser, nodeId, false);
}

module.exports = {
  readNode,
  writeNode,
  pulse,
  startHeartbeat,
  stopHeartbeat,
  AttributeIds,
  DataType,
  connectAll,
};
