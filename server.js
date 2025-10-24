// const { exec } = require("child_process");

// const { socket } = require("./config");
// const { dispenseMultiLane, toInt16 } = require("./dispenseService");
// const { connectAll } = require("./opcuaClient");

// // On successful connection
// socket.on("connect", () => {
//   console.log("✅ Connected to Socket.IO server:", socket.id);
//   connectAll().catch((err) =>
//     console.error("🔴 OPC UA connectAll() failed:", err)
//   );
// });

// // Listen for your custom event
// socket.on("dispenseProducts", async (data, ack) => {
//   const { dispenser, laneData } = data;
//   console.log("dispenser, laneData: ", laneData);
//   if (!dispenser || !laneData) {
//     console.error("Missing params");
//     return ack({ success: false, error: "Missing params" });
//   }
//   //console.log("Received status update:");
//   //console.log(JSON.stringify(data, null, 2));
//   //dispenseMultiLane(dispenser, laneData);
//   try {
//     const result = await dispenseMultiLane(dispenser, laneData);
//     console.log("result: ", result);

//     return ack({ success: true, result });
//   } catch (err) {
//     console.log("result from error : ", err);
//     return ack({ success: false, error: err.message });
//   }
// });

// socket.on("restart-server", (payload) => {
//   //const { key } = payload || {};

//   // Optional: simple auth to protect access
//   // if (key !== process.env.ADMIN_KEY) {
//   //   return socket.emit("restart-response", {
//   //     success: false,
//   //     message: "Unauthorized",
//   //   });
//   // }

//   console.log("🌀 Restart command received via socket");

//   exec("pm2 restart canvan-server", (err, stdout, stderr) => {
//     if (err) {
//       console.error("Restart failed:", stderr);
//       return socket.emit("restart-response", {
//         success: false,
//         message: stderr,
//       });
//     }

//     socket.emit("restart-response", {
//       success: true,
//       message: stdout,
//     });
//   });
// });

// // Optional: Reconnect handling
// let retryCount = 0;

// socket.io.on("reconnect_attempt", () => {
//   retryCount++;
//   console.log(`🔄 Reconnect attempt ${retryCount}`);
// });

// socket.io.on("reconnect", (attemptNumber) => {
//   console.log(`✅ Reconnected after ${attemptNumber} attempts`);
//   retryCount = 0;
// });

// socket.on("disconnect", (reason) => {
//   console.log("❌ Disconnected from Socket.IO server:", reason);
// });

// socket.on("connect_error", (err) => {
//   console.error("⚠️ Connection error:", err.message);
// });

const { socket } = require("./config");
const { dispenseMultiLane, toInt16 } = require("./dispenseService");
const { connectAll } = require("./opcuaClient");
const { exec } = require("child_process");

// On successful connection
socket.on("connect", () => {
  console.log("https://app.tappedproductions.au");
  console.log("✅ Connected to Socket.IO server:", socket.id);
  connectAll().catch((err) =>
    console.error(" OPC UA connectAll() failed:", err)
  );
});

// Listen for your custom event
socket.on("dispenseProducts", async (data, ack) => {
  const { dispenser, laneData } = data;
  console.log("dispenser, laneData: ", laneData);
  if (!dispenser || !laneData) {
    console.error("Missing params");
    return ack({ success: false, error: "Missing params" });
  }
  //console.log("Received status update:");
  //console.log(JSON.stringify(data, null, 2));
  //dispenseMultiLane(dispenser, laneData);
  try {
    const result = await dispenseMultiLane(dispenser, laneData);
    console.log("result: ", result);

    return ack({ success: true, result });
  } catch (err) {
    console.log("result from error : ", err);
    return ack({ success: false, error: err.message });
  }
});

socket.on("restart-server", () => {
  //const { key } = payload || {};

  // Optional: simple auth to protect access
  // if (key !== process.env.ADMIN_KEY) {
  //   return socket.emit("restart-response", {
  //     success: false,
  //     message: "Unauthorized",
  //   });
  // }

  console.log(" Restart command received via socket");

  exec("pm2 restart canvan-server", (err, stdout, stderr) => {
    if (err) {
      console.error("Restart failed:", stderr);
      return socket.emit("restart-response", {
        success: false,
        message: stderr,
      });
    }

    socket.emit("restart-response", {
      success: true,
      message: stdout,
    });
  });
});

// Optional: Reconnect handling
let retryCount = 0;

socket.io.on("reconnect_attempt", () => {
  retryCount++;
  console.log(` Reconnect attempt ${retryCount}`);
});

socket.io.on("reconnect", (attemptNumber) => {
  console.log(`✅ Reconnected after ${attemptNumber} attempts`);
  retryCount = 0;
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected from Socket.IO server:", reason);
});

socket.on("connect_error", (err) => {
  console.error("⚠️ Connection error:", err.message);
});
