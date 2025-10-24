const { io } = require("socket.io-client");
//const socket = io("http://localhost:8000", {
const socket = io("https://app.tappedproductions.au", {
  //const socket = io("https://canvan.onrender.com", {
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 1000,
  auth: {
    token:
      "foxiXQpKh6Bk4Actf5QYBipXyUnID6Fm360tcGUxrSu4vA5MCKqL7NQ0pAAn6ZDtBB1g5Xredk2ungael7whago5vNsvKqkb5mXnhCMiUr0YG2E1SPsDF56R2EdWK6vF",
  },
});

module.exports = { socket };
