const mongoose = require('mongoose');
const dotenv = require('dotenv');

///////////////////////////////////////////////////////////////////
// Catching Uncaught Exceptions
///////////////////////////////////////////////////////////////////
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💀 Shutting down…');
  console.log(err.name, err.message);
  console.log(err);
  // console.log(err);

  // hasta que cierro el server (que termine todos los requests que estan 
  // pendientes o que se esten ejecutando al momento) es cuando termino la App
  process.exit(1);
});


///////////////////////////////////////////////////////////////////
// Refactoring MVC
///////////////////////////////////////////////////////////////////

//esta linea que esta abajo debe estar ANTES de
// const app = require('./app');
// de lo contrario NO se loggea esta informacion
// GET /api/v1/tours?difficulty=easy&duration=5 200 2500.972 ms - 9390
dotenv.config({ path: './config.env'});

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose.connect(DB, { 
  useNewUrlParser: true,
  useCreateIndex: true,
  useFindAndModify: false,
  useUnifiedTopology: true
}).then( () => {
  // connection es un parametro que agregue aqui como connection => {}
  // pero lo quite
  // console.log(connection.connections);
  console.log('DB Connection succesful');
});


// este es app.js
const app = require('./app');

// 4. ENCIENDO EL SERVER
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Running on port ${port}...`);
});


///////////////////////////////////////////////////////////////////
//Errors Outside Express: Unhandled Rejections
///////////////////////////////////////////////////////////////////
// el primer argumento es el nombre del event, el 2do es una callback function
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💀 Shutting down…');
  console.log(err.name, err.message);
  console.log(err);
  // console.log(err);
  server.close( () =>{ 
    // hasta que cierro el server (que termine todos los requests que estan 
    // pendientes o que se esten ejecutando al momento) es cuando termino la App
    process.exit(1);
  });
});

  
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💀 Shutting down…');
  console.log(err.name, err.message);
  //  console.log(err);
  server.close( () =>{ 
    // hasta que cierro el server (que termine todos los requests que estan 
    // pendientes o que se esten ejecutando al momento) es cuando termino la App
    process.exit(1);
  });
});


//////////////////////////////////////////////////////////////////
// Lecture-225 Responding to a SIGTERM Signal
//////////////////////////////////////////////////////////////////
process.on('SIGTERM', () => {

	console.log ('👋 SIGTERM RECEIVED. Shutting down gracefully');
	// Cierro el server graciosamente pero tambien maneja os requests pendientes que es lo que
	// quiero en vez de una cierre abrupto
	server.close( () => {
		console.log('💀 Process Terminated! ');

		// en este caso no uso proces.exit porque el SIGTERM se encarga de cerrar la App
	});
});
