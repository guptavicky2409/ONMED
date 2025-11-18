const express = require("express");
const router = express.Router();
const path = require("path");

router.get("/call/:roomId", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "videoCall.html"));
});

module.exports = router;
