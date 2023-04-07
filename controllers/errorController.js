// Utils
const AppError = require('../Utils/appError');


///////////////////////////////////////////////////////////////////////////
// FUNCIONES LOCALES
const handleCastErrorDB = error => {
	// si regresamos a ver el error Object vemos que tiene dos propiedades una 
  // es path que es el nombre del field que esta en el formato equivocado, 
  // y value es el valor incorrecto que se capturó

	const message = `Inválido ${error.path}: ${error.value}`;

	// 400 es Bad Request
	return new AppError (message, 400);
}



const handleDuplicateFieldsDB = error => {


	// const invalidValue = error.errmsg.match(/(["'])(\\?.)*?\1/)[0];
	let invalidValue = "";

  if (error.errmsg.match(/(["'])(\\?.)*?\1/) !== null) {
    // Obtiene el dato que hay entre comillas
	  invalidValue = error.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  }
  else {
    // Obtiene el dato que hay entre curly braces
    // incluye los curly braces
    invalidValue = error.errmsg.match(/{(.*?)}/)[0];
    // Sin incluir los curly braces
    //  invalidValue = error.errmsg.match(/[^{}]+(?=})/g)[0];
  }
  

	const message = `El dato capturado ya existe: ${invalidValue}. Por favor usa un valor único.`;

  // 400 es Bad Request
  return new AppError(message, 400);
}



const handleJWTError = () => new AppError('Token inválido. Vuelve a iniciar sesión', 401);


const handleJWTExpiredError = () => new AppError('El token ha expirado. Vuelve a iniciar sesión!', 401);


const handleMongooseServerSelectionError = () => new AppError('Error al conectarse. Primero revisa tu conexión a Internet: Tu Wi-Fi o si tienes saldo, o una conexión lenta pueden ser los problemas, si estas en un lugar con mala recepción de red. O bien problemas con el servidor y/o la Base de Datos.', 400);


const handleValidationErrorDB = error => {
	
  // como error.errors es un Object y NO un array USO Object.values
  // para iterar los valores de un Object
  const errorMessages = Object.values(error.errors).map(current => current.message);
  const message = `El dato capturado es inválido ${errorMessages.join(' ')}`;

	return new AppError (message, 400);
}



const sendErrorDev = (err, req, res) => {
  // A) API
  // originalUrl es el URL completo pero sin el Host, se ve igual que el route
	if (req.originalUrl.startsWith('/api')) {
		res.status(err.statusCode).json({
  			status: err.status,
  			error: err,
  			message: err.message,
  			stack: err.stack	
  		});
	}
	else {
		// B) RENDERED WEBSITE
		// ‘error’ sera un template que tengo disponible en 
    // /dev-data/templates/errorTemplate.pug
    console.error('💥 ERROR!', err);

    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack	
    });
	}
}



const sendErrorProd = (err, req, res) => {
  
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted error: send message to the client
    if (err.isOperational) {

      res.status(err.statusCode).json({
      status: err.status,
      message: err.message		
      });
    }
    // Programming or other unknown error: don’t leak error detail
    else {
      // 1. Log to the console
      console.error('💥 ERROR!', err);


      // 2. Send generic message
      res.status(500).json ({
        status: 'error',
        message: 'Something went very wrong 1'
      });
    }
  }
  else {
    // B) RENDERED WEBSITE
    // Operational, trusted error: send message to the client
    if (err.isOperational) {

      // res.status(err.statusCode).render('error.pug', {
      //   title: 'Something went wrong!', 
      //   msg: err.message
      // });
      console.error('💥 ERRORRR!', err);


      res.status(500).json ({
        status: 'error',
        message: 'Something went very wrong 2',
        theError: err
      });
    }
    // Programming or other unknown error: don’t leak error detail
    else {
      // 1. Log to the console
      console.error('💥 ERROR!', err);


      // 2. Send generic message
      // res.status(err.statusCode).render('error.pug', {
      //   title: 'Something went wrong!', 
      //   msg: 'Please try again later'
      // });
      res.status(500).json ({
        status: 'error',
        message: 'Something went very wrong 3',
        theError: err
      });
    }
  }
}
///////////////////////////////////////////////////////////////////////////


module.exports = (err, req, res, next) => { 


	err.statusCode = err.statusCode || 500;
	// de igual forma defino el status
	err.status = err.status || 'errorcin';


	// y como se crea err.message?
	if (process.env.NODE_ENV === 'development') {
		sendErrorDev (err, req, res);
	}
	else if (process.env.NODE_ENV === 'production') {
		// necesito crear una HardCopy de err porque la voy a usar para crear el 
    // nuevo error que mandare ya con isOperational = true y de nuevo uso Destructuring
		let error = Object.assign(err);

    // if (error.MongooseServerSelectionError)

		// este es el manejo de errores para lo que manda Mongoose y que hasta ahora 
    // no manejo
		//le paso como argumento el err que Mongoose Creo
		if (error.constructor.name === 'CastError')
			error = handleCastErrorDB (error);

		if(error.code === 11000)
			error = handleDuplicateFieldsDB (error);

		if(error.constructor.name === 'ValidationError')
			error = handleValidationErrorDB (error);

    if(error.constructor.name === 'JsonWebTokenError')
			error = handleJWTError ();

    if(error.constructor.name === 'TokenExpiredError')
      error = handleJWTExpiredError ();
    
    if(error.constructor.name === 'MongooseServerSelectionError')
      error = handleMongooseServerSelectionError ();

		sendErrorProd (error, req, res);
	}
}
