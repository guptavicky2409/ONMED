module.exports = (io) => {
  // Track room states and users
  const rooms = new Map(); // roomId -> { users: Set, callInitiated: boolean }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);

      // Initialize room if not exists
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Set(), callInitiated: false, userOrder: [], callStarted: false });
      }

      const room = rooms.get(roomId);
      room.users.add(socket.id);
      room.userOrder.push({ id: socket.id, joinedAt: Date.now() });

      console.log(`User ${socket.id} joined room ${roomId}. Total users: ${room.users.size}`);

      // If there are 2 users and call is initiated, notify both to start WebRTC
      if (room.users.size === 2 && room.callInitiated && !room.callStarted) {
        console.log(`Both users in room ${roomId}, starting WebRTC handshake`);

        // Determine which user should be the offerer (the one who joined first)
        const offerer = room.userOrder[0]?.id;
        const answerer = room.userOrder[1]?.id;

        console.log(`Room ${roomId}: Offerer=${offerer}, Answerer=${answerer}`);

        // Notify users of their roles
        io.to(offerer).emit("call-ready", { role: "offerer" });
        io.to(answerer).emit("call-ready", { role: "answerer" });

        room.callStarted = true; // Mark call as started to prevent duplicate initiation
      }
    });

    socket.on("initiate-call", (roomId) => {
      console.log(`Call initiated in room: ${roomId} by ${socket.id}`);
      const room = rooms.get(roomId);
      if (room && !room.callStarted) {
        room.callInitiated = true;
        console.log(`Room ${roomId} status: users=${room.users.size}, callInitiated=${room.callInitiated}, callStarted=${room.callStarted}`);

        // If both users are present and call not already started, notify them with roles
        if (room.users.size === 2 && !room.callStarted) {
          console.log(`Both users present, starting WebRTC for room ${roomId}`);
          const offerer = room.userOrder[0]?.id;
          const answerer = room.userOrder[1]?.id;
          console.log(`Room ${roomId}: Offerer=${offerer}, Answerer=${answerer}`);
          io.to(offerer).emit("call-ready", { role: "offerer" });
          io.to(answerer).emit("call-ready", { role: "answerer" });
          room.callStarted = true; // Mark call as started
        } else {
          console.log(`Not enough users or call already started. Room size: ${room.users.size}`);
          // Notify the single user that call is initiated (usually the caller)
          socket.emit("call-initiated");
        }
      }
    });

    socket.on("offer", (data) => {
      console.log("Relaying offer to room:", data.roomId);
      socket.broadcast.to(data.roomId).emit("offer", data.offer);
    });

    socket.on("answer", (data) => {
      console.log("Relaying answer to room:", data.roomId);
      socket.broadcast.to(data.roomId).emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {
      console.log("Relaying ICE candidate to room:", data.roomId);
      socket.broadcast.to(data.roomId).emit("ice-candidate", data.candidate);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      // Remove user from rooms
      for (const [roomId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          console.log(`User ${socket.id} removed from room ${roomId}. Remaining users: ${room.users.size}`);

          // If room is empty, clean it up
          if (room.users.size === 0) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} cleaned up`);
          }
        }
      }
    });
  });
};
