// This file centralizes configuration for all backend functions.
module.exports = {
  DATA_NAMESPACE: 'marching-art',
};

const cors = require('cors')({
  origin: true, // Allow all origins
  credentials: true
});

// Export for use in functions
exports.corsMiddleware = cors;