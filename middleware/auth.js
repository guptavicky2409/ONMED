module.exports = {
  // Admin authentication
  adminAuth: function (req, res, next) {
    if (!req.session.admin) {
      return res.status(401).json({ error: "Admin not logged in" });
    }
    next();
  },

  // Patient authentication
  patientAuth: function (req, res, next) {
    if (!req.session.patientId) {
      return res.status(401).json({ error: "Patient not logged in" });
    }
    next();
  },

  // Doctor authentication
  doctorAuth: function (req, res, next) {
    if (!req.session.doctorId) {
      return res.status(401).json({ error: "Doctor not logged in" });
    }
    next();
  }
};