const errorHandler = (err, _req, res, _next) => {
 const status = err.status || 500;
 console.error(`[Express ${status}]`, err.message);
 res.status(status).json({
 error: status === 500 && process.env.NODE_ENV === 'production'
 ? 'Internal server error'
 : err.message || 'Unexpected error',
 });
};

module.exports = errorHandler;
