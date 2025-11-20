module.exports = (io) => {
  // Track room states and users
  const rooms = new Map(); // roomId -> { users: Map(socketId -> userId), roles: Map }

  io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      console.log(`📞 User ${socket.id} joining room ${roomId}`);
      
      socket.join(roomId);

      // Initialize room if not exists
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { 
          users: new Map(),
          offerer: null,
          answerer: null
        });
      }

      const room = rooms.get(roomId);
      room.users.set(socket.id, { joinedAt: Date.now() });

      console.log(`👥 Room ${roomId} now has ${room.users.size} user(s)`);

      // Assign roles based on join order
      if (room.users.size === 1) {
        room.offerer = socket.id;
        console.log(`🎯 ${socket.id} assigned as OFFERER`);
      } else if (room.users.size === 2) {
        room.answerer = socket.id;
        console.log(`🎯 ${socket.id} assigned as ANSWERER`);
        
        // Both users present - start WebRTC negotiation
        setTimeout(() => {
          console.log(`🚀 Starting WebRTC negotiation for room ${roomId}`);
          
          // Tell offerer to create offer
          io.to(room.offerer).emit("start-call", { role: "offerer" });
          
          // Tell answerer to wait for offer
          io.to(room.answerer).emit("start-call", { role: "answerer" });
        }, 500); // Small delay to ensure both clients are ready
      }

      // Notify others in room
      socket.to(roomId).emit("user-joined", { 
        socketId: socket.id,
        userCount: room.users.size 
      });
    });

    socket.on("offer", (data) => {
      console.log(`📤 Relaying offer from ${socket.id} to room ${data.roomId}`);
      socket.to(data.roomId).emit("offer", data.offer);
    });

    socket.on("answer", (data) => {
      console.log(`📤 Relaying answer from ${socket.id} to room ${data.roomId}`);
      socket.to(data.roomId).emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {
      console.log(`🧊 Relaying ICE candidate from ${socket.id} to room ${data.roomId}`);
      socket.to(data.roomId).emit("ice-candidate", data.candidate);
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);

      // Remove user from all rooms
      for (const [roomId, room] of rooms.entries()) {
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          console.log(`👋 Removed ${socket.id} from room ${roomId}. Remaining: ${room.users.size}`);

          // Notify others
          socket.to(roomId).emit("user-disconnected", {
            userId: socket.id,
            userCount: room.users.size
          });

          // Clean up empty rooms
          if (room.users.size === 0) {
            rooms.delete(roomId);
            console.log(`🧹 Cleaned up empty room ${roomId}`);
          }
        }
      }
    });
  });
};
