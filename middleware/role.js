module.exports = function (roles) {
  return function (req, res, next) {
    // In future if using roles
    next();
  };
};
