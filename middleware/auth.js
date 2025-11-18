module.exports = function (req, res, next) {
  if (!req.session.admin) {
    return res.status(401).send("NOT_LOGGED_IN");
  }
  next();
};
