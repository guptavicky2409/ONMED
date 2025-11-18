module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      socket.broadcast.to(roomId).emit("user-connected", socket.id);
    });

    socket.on("offer", (data) => {
      socket.broadcast.to(data.roomId).emit("offer", data.offer);
    });

    socket.on("answer", (data) => {
      socket.broadcast.to(data.roomId).emit("answer", data.answer);
    });

    socket.on("ice-candidate", (data) => {
      socket.broadcast.to(data.roomId).emit("ice-candidate", data.candidate);
    });
  });
};
module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("offer", (data) => {
      socket.broadcast.emit("offer", data);
    });

    socket.on("answer", (data) => {
      socket.broadcast.emit("answer", data);
    });

    socket.on("candidate", (data) => {
      socket.broadcast.emit("candidate", data);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};

