///////////////////////////////////////////////////////////////////
// Better Errors and Refactoring
///////////////////////////////////////////////////////////////////

/*

Vamos a crear una nueva y mejor Clase para manejo de errores y Refactoring y empezando 
con la clase, voy a crear un archivo en el folder Utils, llamada appError.js

Y quiero que todos los objetos de ArppError hereden del built-in error y para eso hago 
extends
Como de costumbre cuando hago un extends llamo a super() para llamar al parent 
constructor, y con argumento message, porque message es el unico parametro que el 
built-in error acepta

Todos los errores que creare usando esta clase seran Operational Errors, por ejemplo 
un usuario creando un tour y que le falten required fields y para eso creare una 
propiedad 
	isOperational

ya que si es true solo le mandaremos mensajes al client si es true
Como ultimo paso necesito capturar el stack trace y que es eso? nos muestra en donde 
paso el error
	console.log(err.stack);

Y lo pruebo en POSTMAN 
	127.0.0.1:8000/api/v1/toursss

Pero este console.log lo pongo por ejemplo en app.js
app.use( (err, req, res, next) => { 
	console.log(err.stack);

	err.statusCode = err.statusCode || 500;
	err.status = err.status || ‘errorcin’;

	res.status(err.statusCode).json({
		status: err.status,
		message: err.message		
	});
} );

*/


class AppError extends Error {
	constructor (message, statusCode) {
		super(message);
		this.statusCode = statusCode;
		// this.status puede ser fail o error, si el statusCode es 400 sera fail y si es 500 sera error asi que puedo checar si el statusCode empieza con 4, usando un metodo llamado startsWith que puedo usar en Strings, asi que convierto el statusCode a String hago el chequeo si es 4 con el que empieza 
		this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

		this.isOperational = true;

		Error.captureStackTrace(this, this.constructor);
	}
}

module.exports = AppError