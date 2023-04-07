module.exports = fn => {
	return (req, res, next) => {
		// estas dos lineas son identicas
		// fn(req, res, next).catch(err => next(err));	
		fn (req, res, next).catch(next);	

	};
};
