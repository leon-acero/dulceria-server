const mongoose = require('mongoose');
const {format} = require ('date-fns');
const {ObjectId} = require('mongoose').Types;
const Sale = require ('../models/saleModel');
const Product = require('../models/productModel');
const User = require('../models/userModel');
const Client = require('../models/clientModel');
const catchAsync = require('../Utils/catchAsync');
const factory = require ('./handlerFactory');
const AppError = require('../Utils/appError');


exports.deleteSale = factory.deleteOne(Sale);
exports.updateSale = factory.updateOne(Sale);
exports.getSale = factory.getOne(Sale);
exports.getAllSales = factory.getAll(Sale);


// PREGUNTA: ESTO QUEDA EN DUDA!!
exports.setProductClientIds = (req, res, next) => {
  // Allow nested Routes
	if (!req.body.product) {
		req.body.product = req.params.productId;
	}

	// Obtengo req.user.id del authController.protect
	if (!req.body.client) {
    req.body.product = req.params.clientId;

		// req.body.client = req.user.id;
	}

    next();
}


function roll (min, max, floatFlag) {
	const r = Math.random () *  (max - min) +  min;
	return floatFlag  ? r  : Math.floor (r)
}


exports.createBulkSale = catchAsync ( async (req, res, next) => {
	
	const allProducts = await Product.find();
	const allClients = await Client.find();
	const user = await User.findById("5c8a1d5b0190b214360dc057");
	console.log("user", user);

	const { fechaInicio, fechaFin } = req.params;

	console.log ("fecha", new Date(Date.now()));

	const dateFechaInicio = new Date(fechaInicio);
	const dateFechaFin = new Date(fechaFin);

	console.log("dateFechaInicio", dateFechaInicio);
	console.log("dateFechaFin", dateFechaFin);


	const allOrdersPerDay = [];
	const arrayFechas = [];
	
	for (let i = dateFechaInicio; dateFechaInicio <= dateFechaFin; i.setDate(i.getDate() + 1)) {

		// console.log("fecha_i", i);
		const newFecha = new Date (i);
		arrayFechas.push(newFecha);
	}

	// 1. ver si se aplica el descuento
	// 2. usar el Promise.all
	// 3, probar con un dia, dos dias, 5 dias, 10 dias, 30 dias, 2 meses, 6 meses, 12 meses

	const allPedidosDelRangoDeFechas = Promise.all (arrayFechas.map( currentFecha => {

		const allBasketsPerDay = allClients.map( currentClient => {
	
			let theBasket = 
			{
				createdAt: new Date(Date.now()),
				client: "",
				businessName: "",
				businessImageCover: "",
				estatusPedido: 2,
				user: "",
				userName: "",
				esMayorista: "",
				seAplicaDescuento: false,
				productOrdered: []
			};

			const descuento = roll(1, 6);

			// console.log("descuento", descuento);
			let bDescuento = false;

			if (descuento >= 1 && descuento <= 3)
				bDescuento = false;
			else if(descuento > 3 && descuento <= 6)
				bDescuento = true;
					
			// console.log("bDescuento", bDescuento);
			
			const productsOrdered = allProducts.map(currentProduct => {

				const quantity = roll(1, 5);
				// console.log("quantity", quantity);

				const priceDeVenta = currentClient.esMayorista ? currentProduct.priceMayoreo	: currentProduct.priceMenudeo;
				
				// Este 10/100 significa que es el 10% lo dejo hardcodeado porque este
				// metodo solo es para generar datos de prueba, este metodo NO se usa
				// en production
				return {
					product: currentProduct._id,
					productName: currentProduct.productName,
					imageCover: currentProduct.imageCover,
					quantity: quantity,
					costo: currentProduct.costo,
					priceDeVenta: priceDeVenta,
					descuento: bDescuento ?
						( priceDeVenta * quantity) * (10/100) : 0,
					sku: currentProduct.sku
				}
			})

			// la canasta de un cliente
			theBasket = 
			{
				// createdAt: dateFechaInicio,
				// createdAt: dateFechaInicio,
				createdAt: currentFecha,
				client: currentClient._id,
				businessName: currentClient.businessName,
				businessImageCover: currentClient.imageCover,
				estatusPedido: 2,
				// user: ObjectId("5c8a1d5b0190b214360dc057"),
				user: user._id,
				// userName: "Jonas Schmedtmann",
				userName: user.name,
				esMayorista: currentClient.esMayorista,
				seAplicaDescuento: bDescuento,
				productOrdered: productsOrdered
			};

			// console.log("theBasket", theBasket)
			// const sale = await Sale.create(theBasket);
			// await Sale.create(theBasket);
			return Sale.create(theBasket);
		})

		// todas las canastas de un solo dia
		return allOrdersPerDay.push(allBasketsPerDay);
	}))

	console.log("allPedidosDelRangoDeFechas", allPedidosDelRangoDeFechas);
	const lists = await allPedidosDelRangoDeFechas;
	console.log("lists", lists)
	// console.log("allBasketsPerDay", allBasketsPerDay);
	// const lists = await allBasketsPerDay;
	// console.log("lists", lists)

	res.status(201).json({
		status: 'success',
	});		
});



///////////////////////////////////////////////////////////////////
// Esta es la 3era Version para crear e Insertar pedidos y actualizar el Inventario
// aqui junto en una sola function .createSale y .updateSaleAndInventory
// lo que es usar req.body.id que viene siendo el id del Pedido el cual solo
// existe si es un pedido a actualizar, si no existe es que sera un Pedido Nuevo
///////////////////////////////////////////////////////////////////
exports.createOrUpdateSaleAndInventory = catchAsync (async (req, res, next) => {

	// console.log("req.body.id", req.body.id);
	// console.log("req.body", req.body);
	// Manejo de Error en Transaccion, me sirve para hacer Rollback
	// si hago throw Error, hara un Rollback
	let huboErrorEnTransaccion = false;

	let numeroDeErrorTransaccion = 0;
	let mensajeErrorTransaccion = "";

	// Inicio la sesion que uso para la Transaccion
	const session = await mongoose.startSession();
	
	// Opciones para la Transaccion
	const transactionOptions = {
		readPreference: 'primary',
		readConcern:  { level: 'local' },
		writeConcern: { w: 'majority' }
	};

	let actualizarInventario = true;
	
	if (req.body.clientId) {
		req.body.client = req.body.clientId;
		req.body.clientId = undefined;
	}

	// convierto quantity de string a number haciendo *=1
	// y lo necesito para hacer los cálculos
	if (req.body.productOrdered) {

		req.body.productOrdered.forEach(current => {
			if (current.quantity) { 
				current.quantity *= 1;
			}
		})
	}

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado
	// si el Pedido es Por Entregar osea 1 NO actualizo el Inventario
	if (req.body.estatusPedido === 1) {
		actualizarInventario = false;
	}


	///////////////////////////////////////////////////////////////////
	// Empiezo la Transaccion porque hay dos colecciones involucradas:
	// Sales y Products, una es para levantar el pedido, la otra es
	// para actualzar el Inventario
	try {
		
		const transactionResults = await session.withTransaction(async () => {

			///////////////////////////////////////////////////////////////////
			// Empiezo guardando el Pedido en la Collection Sales

			// pongo req.body entre corchetes, para poder pasarle options
			// como segundo parametro, osea la session
			
			/////////////////////////////////////////////////////
			// ESTO ES LO DIFERENTE ENTRE ACTUALIZAR PEDIDO Y CREAR PEDIDO

			let allSale;

			// Si no existe req.body.id es que crearé un Pedido Nuevo
			// de lo contrario es que lo actualizare
			// NOTA: req.body.id es donde viene el Id de un Pedido YA Existente
			// Esto lo puedes checar en el codigo del client en:
			// client/src/pages/updateOrder/UpdateOrder.jsx
			// si cargo un Pedido existente le asigno un valor a theBasket.id
			// si creo un Pedido Nuevo theBasket.id NO existe, no es declarado ni asignado
			if (!req.body.id) {
				allSale = await Sale.create([req.body], {session});
			}
			else {
				// actualizo el Pedido
				allSale = await Sale.findByIdAndUpdate(
					req.body.id, 
					req.body, 
					{ 
						new: true, 
						runValidators: true,
						session
					}
				);				
			}
			/////////////////////////////////////////////////////

			// console.log("allSale", allSale);

			if (!allSale) {
				if (!req.body.id) {
					// Error al crear el Documento, osea el Pedido
					numeroDeErrorTransaccion = 880;
					mensajeErrorTransaccion = "Error al Insertar el Pedido";
				}
				else {
					// Error al Actualizar, el Documento osea el Pedido no fue encontrado
					// Probablemente fue borrado, ya no existe
					numeroDeErrorTransaccion = 885;
					mensajeErrorTransaccion = "Error al Actualizar, el Pedido no fue encontrado. Probablemente fue borrado antes de grabarlo."
				}
				huboErrorEnTransaccion = true;
			}
		
			// console.log("allSale", allSale);
			if (huboErrorEnTransaccion){
				console.log("Hubo error al crear el Pedido, hare Roll Back");
				// throw new Error ('Abortando Transaccion por Error en el Pedido');
				throw new Error (mensajeErrorTransaccion);
			}
		
			// Termino de crear el pedido
			///////////////////////////////////////////////////////////////////


			///////////////////////////////////////////////////////////////////
			// Solo actualizo el inventario si el estatusPedido es "entregado"
			if (actualizarInventario) {

				///////////////////////////////////////////////////////////////////
				// Empiezo la actualizacion de Inventario en la Collection Products
	
				// Preparo la informacion para descontar al InventarioActual
				// es decir el productId y la cantidad Ordenada
				const inventarioActualizar = req.body.productOrdered.map (current => 
					(
						{ id: current.product, inventarioActual: current.quantity }
					)
				)
			
				// console.log(inventarioActualizar)			
				
				// Aqui actualizo el inventarioActual de la Collection Products
				// const allInventarioOrder = 
				await Promise.all (inventarioActualizar.map( async (current) => {
			
					// const updatedInventario = await Product.findByIdAndUpdate(
					// Pongo current.quantity NEGATIVO porque la cantidad ordenada
					// de producto se la descontaré al inventarioActual de la Collection
					// Products
					// usando el operador $inc de MongoDB lo que hace es que
					// la cantidad que exista en la Collection se le resta
					// a lo que el cliente ordenó en el pedido
	
					const updatedInventario = await Product.findByIdAndUpdate(
								current.id, 
								{ 
									$inc: 
										{ 
											inventarioActual: -current.inventarioActual 
										} 
								}, 
								{ 
									new: true, 
									runValidators: true,
									session: session
								}
					);
				
					// si no existe updatedInventario es que es null
					// corto la Transaccion regreso Error
					if (!updatedInventario) {
						// Error al crear el Documento, osea el Pedido
						numeroDeErrorTransaccion = 900;
						mensajeErrorTransaccion = "Error al Actualizar el Inventario. Se cancela el Pedido. Vuelva a intentarlo.";
						huboErrorEnTransaccion = true;
					}
					return updatedInventario;
					// console.log("updatedInventario",updatedInventario);
				}));
	
				// console.log("allInventarioOrder", allInventarioOrder)
	
				// Termino de actualizar el Inventario
				///////////////////////////////////////////////////////////////////
			}


			if (huboErrorEnTransaccion){
				console.log("Hubo error al actualizar inventario, hare Roll Back");
				// throw new Error ('Abortando Transaccion por Error al actualizar Inventario');
				throw new Error (mensajeErrorTransaccion);
			}
			else {
				console.log("Transaccion Exitosa");

				res.status(201).json({
					status: 'success',
					data: {
						sale: allSale
					}
				});
			}		
		}, transactionOptions );

		// console.log("transactionResults", transactionResults)

		///////////////////////////////////////////////////////////////////
		// La Transaccion ha terminado
		
		if (transactionResults) {
			console.log("El pedido y la actualizacion de Inventario fueron realizados con éxito");
		} 
		else {
			console.log("El pedido y la actualizacion de Inventario fueron intencionalmente abortados.");
			huboErrorEnTransaccion = true;
			numeroDeErrorTransaccion = 910;
			throw new Error ('Abortando Transaccion');
		}
	}
	catch (error) {
		console.log("La Transacción de Pedido e Inventario fue abortado por un error inesperado.")
		console.log("ERROR", error);
		huboErrorEnTransaccion = true;
	}
	finally {
		// Finalizo la Session de Transaccion
		await session.endSession();
		console.log("End Transaction Session");
	}

	if (huboErrorEnTransaccion) {
		return next(new AppError (mensajeErrorTransaccion, numeroDeErrorTransaccion));
	}
});



///////////////////////////////////////////////////////////////////
// createSale esta es la 2da version de createSale aqui lo que cambie
// fue que el Model, osea saleModel es Embedded es decir
// los productos ordenados estan como un Array de Objects
// dentro del Pedido de tal manera que NO tengo que hacer un .map
// ni un Promise.All como hice en la primera version en la que
// cada Document era un producto del Pedido, por lo que ahora
// queda mas conciso es un Document de Pedido y dentro un Array
// de Productos Ordenados
// Aun asi la primera version me sirvio para aprender mas sobre
// Two-Phase Commit y Promise.All
// Al final dejo la primer version como referencia, le cambie el nombre a
// exports.createSalePrimerVersion
// En ambas versiones uso Two-Phase Commit en las que uso session
// esto es porque hago dos cosas: inserto en la Collection de Sales
// y actualizo el inventario modificado en la Collection de Products
// por lo que ambas tienen que ser exitosas y para eso es el Two-Phase Commit
// y la session
// Sin embargo esta 2da version NO toma en cuenta cuando se hace una
// actualizacion en la Collection Sale, ya que solo se usa para insertar
// Documents y actualizar el Inventario
// 
// Es por esto que cree otra function llamada updateSaleAndInventory
// esta se encarga de Actualizar la collection de Sales y actualizar
// el inventario si es que se requiere, es decir, recuerda que
// tengo el field estatusPedido, el cual puede ser 1 por Entregar 
// y 2 Entregado, donde si es Por Entregar NO se modifica el inventario
// y si es Entregado SI se modifica

// Aun asi tanto createSale como updateSaleAndInventory son codigos
// casi idénticos por lo que conviene crear una 3era version donde
// junte tanto createSale y updateSaleAndInventory
///////////////////////////////////////////////////////////////////
exports.createSale = catchAsync (async (req, res, next) => {

	// console.log("req.body", req.body);
	// Manejo de Error en Transaccion, me sirve para hacer Rollback
	// si hago throw Error, hara un Rollback
	let huboErrorEnTransaccion = false;

	// Inicio la sesion que uso para la Transaccion
  	const session = await mongoose.startSession();
	
	// Opciones para la Transaccion
	const transactionOptions = {
		readPreference: 'primary',
		readConcern: { level: 'local' },
		writeConcern: { w: 'majority' }
  	};

	let actualizarInventario = true;


	if (req.body.clientId) {
		req.body.client = req.body.clientId;
		req.body.clientId = undefined;
	}

	if (req.body.productOrdered) {
		req.body.productOrdered.forEach(current => {
			if (current.quantity) { 
				current.quantity *= 1;
			}
		})
	}

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado
	// si el Pedido es Por Entregar osea 1 NO actualizo el Inventario
	if (req.body.estatusPedido === 1) {
		actualizarInventario = false;
	}


	// ///////////////////////////////////////////////////////////////////
	// // Empiezo la Transaccion porque hay dos colecciones involucradas:
	// // Sales y Products, una es para levantar el pedido, la otra es
	// // para actualzar el Inventario
	try {
		
		const transactionResults = await session.withTransaction(async () => {

			///////////////////////////////////////////////////////////////////
			// Empiezo guardando el Pedido en la Collection Sales

			// pongo req.body entre corchetes, para poder pasarle options
			// como segundo parametro, osea la session
			
			/////////////////////////////////////////////////////
			// ESTO ES LO DIFERENTE ENTRE ACTUALIZAR PEDIDO Y CREAR PEDIDO
			const allSale = await Sale.create([req.body], {session});
			/////////////////////////////////////////////////////

			console.log("allSale", allSale);

			if (!allSale) {
				huboErrorEnTransaccion = true;
			}
		
			// console.log("allSale", allSale);
			if (huboErrorEnTransaccion){
				console.log("Hubo error al crear el Pedido, hare Roll Back");
        		throw new Error ('Abortando Transaccion por Error en el Pedido');
			}
		
			// Termino de crear el pedido
			///////////////////////////////////////////////////////////////////


			///////////////////////////////////////////////////////////////////
			// Solo actualizo el inventario si el estatusPedido es "entregado"
			if (actualizarInventario) {

				///////////////////////////////////////////////////////////////////
				// Empiezo la actualizacion de Inventario en la Collection Products
	
				// Preparo la informacion para descontar al InventarioActual
				// es decir el productId y la cantidad Ordenada
				const inventarioActualizar = req.body.productOrdered.map (current => 
					({ id: current.product, inventarioActual: current.quantity}))
			
				// console.log(inventarioActualizar)
			
				
				// Aqui actualizo el inventarioActual de la Collection Products
				// const allInventarioOrder = 
				await Promise.all (inventarioActualizar.map( async (current) => {
			
					// const updatedInventario = await Product.findByIdAndUpdate(
					// Pongo current.quantity NEGATIVO porque la cantidad ordenada
					// de producto se la descontaré al inventarioActual de la Collection
					// Products
					// usando el operador $inc de MongoDB lo que hace es que
					// la cantidad que exista en la Collection se le resta
					// a lo que el cliente ordenó en el pedido
	
					const updatedInventario = await Product.findByIdAndUpdate(
								current.id, 
								{ $inc: { inventarioActual: -current.inventarioActual } }, 
								{ 
									new: true, 
									runValidators: true,
									session: session
								}
					);
				
					// si no existe updatedInventario es que es null
					// corto la Transaccion regreso Error
					if (!updatedInventario) {
						huboErrorEnTransaccion = true;
					}
					return updatedInventario;
					// console.log("updatedInventario",updatedInventario);
				}));
	
				// console.log("allInventarioOrder", allInventarioOrder)
	
				// Termino de actualizar el Inventario
				///////////////////////////////////////////////////////////////////
			}


			if (huboErrorEnTransaccion){
				console.log("Hubo error al actualizar inventario, hare Roll Back");
        		throw new Error ('Abortando Transaccion por Error al actualizar Inventario');
			}
			else {
				console.log("Transaccion Exitosa")
				res.status(201).json({
					status: 'success',
					data: {
						sale: allSale
					}
				});
			}		
		}, transactionOptions );

		// console.log("transactionResults", transactionResults)

		///////////////////////////////////////////////////////////////////
		// La Transaccion ha terminado
		
		if (transactionResults) {
			console.log("El pedido y la actualizacion de Inventario fueron realizados con éxito");
		} 
		else {
			console.log("El pedido y la actualizacion de Inventario fueron intencionalmente abortados.");
			huboErrorEnTransaccion = true;
			throw new Error ('Abortando Transaccion');
		}
	}
	catch (error) {
		console.log("La Transacción de Pedido e Inventario fue abortado por un error inesperado.")
		console.log("ERROR", error);
		huboErrorEnTransaccion = true;
	}
	finally {
		// Finalizo la Session de Transaccion
		await session.endSession();
		console.log("End Transaction Session");
	}

	if (huboErrorEnTransaccion) {
		return next(new AppError ('Hubo un error en la Transaccion se hizo Rollback', 999));
	}
	
});



const regresaMes = (mes) => {
  
  switch (mes) {
    case 1: 
      return "Ene"
    case 2: 
      return "Feb"
    case 3: 
      return "Mar"
    case 4: 
      return "Abr"
    case 5: 
      return "May"
    case 6: 
      return "Jun"
    case 7: 
      return "Jul"
    case 8: 
      return "Ago"
    case 9: 
      return "Sep"
    case 10: 
      return "Oct"
    case 11: 
      return "Nov"
    case 12: 
      return "Dic"
    default:
      return ""
  }
}


///////////////////////////////////////////////////////////////////
// returnUnwindObject es una helper function reusable, se usa para los 
// reportes de MongoDB me sirve mucho cuando hice el Refactoring de la BD, ya que 
// ahora pongo los productos del Pedido  Embedded en el mismo Pedido, y 
// con $unwind es como me permite hacer los calculos de
// multiplicar y sumar
///////////////////////////////////////////////////////////////////
const returnUnwindObject = () => ({
		$unwind : {
				"path" : "$productOrdered"
		}
	})


///////////////////////////////////////////////////////////////////
// returnProjectWithClientObject es una helper function,  se usa para los 
// reportes de MongoDB  me sirve mucho para filtrar solo os fields que voy a 
// ocupar en la consulta, asi no necesito cargar en memoria todos los fields 
// de la Collection si no es necesario, por eso el :1 que
// significa cargar, si es 0 significa no cargar
///////////////////////////////////////////////////////////////////
const returnProjectWithClientObject = () => ({
		$project: {
				createdAt: 1,
				client: 1,
				"productOrdered.priceDeVenta" : 1,
				"productOrdered.quantity" : 1,
				"productOrdered.descuento" : 1,
				estatusPedido: 1			
		}
	})

	
///////////////////////////////////////////////////////////////////
// returnProjectObject es igual que returnProjectWithClientObject con 
// la diferencia que aqui muestro un field menos osea client
///////////////////////////////////////////////////////////////////
const returnProjectObject = () => ({
		$project: {
				createdAt: 1,
				"productOrdered.priceDeVenta" : 1,
				"productOrdered.quantity" : 1,
				"productOrdered.descuento" : 1,
				estatusPedido: 1			
		}
	})


///////////////////////////////////////////////////////////////////
// returnGroupObject es una helper function,  se usa para los reportes de MongoDB
// me sirve mucho para agrupar los calculos que hago de multiplicar y sumar, es aqui
// donde se hacen los cálculos de los reportes
// El calculo es por cada producto: Precio de Venta * la cantidad ordenada 
// en el pedido luego se suma esa informacion por todos los productos ordenados
// Tambien se hace la suma de los descuentos hechos si es que aplican 
///////////////////////////////////////////////////////////////////
const returnGroupObject = () => ({
		$group: {
		_id: {
						anio: { $year: "$createdAt" },
						mes: { $month: "$createdAt" },
					},
					ventas: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },		
					descuentos: { $sum: "$productOrdered.descuento" }	
		}
	})


///////////////////////////////////////////////////////////////////
// returnAddFieldsObject  es una helper function,  se usa para los reportes de MongoDB
// me sirve mucho ya que hice los primeros calculos en returnGroupObject, ahora hago
// el calculo final de Ventas realizadas - Descuentos
///////////////////////////////////////////////////////////////////
const returnAddFieldsObject = () => ({
		$addFields: {
			subtotal: { $subtract: [ "$ventas", "$descuentos" ] }
		}
	})


///////////////////////////////////////////////////////////////////
// returnProjectFinalObject  es una helper function,  se usa para los reportes 
// de MongoDB
// Vuelvo a hacer un nuevo project para solo mostrar la informacion que 
// se mostrara al Client
///////////////////////////////////////////////////////////////////
const returnProjectFinalObject = () => ({
		$project: {
			_id: 0, "Fecha": "$_id", subtotal: 1
		}
	})


///////////////////////////////////////////////////////////////////
// returnSortObject es una helper function,  se usa para los reportes de MongoDB
// por ultimo ordeno la informacion Ascendentemene
///////////////////////////////////////////////////////////////////
const returnSortObject = () => ({
		$sort: {
				"Fecha": 1
		}
	})


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /monthly-sales/:year
// getMonthlySales
// 
// Cargo las Ventas de la Dulceria: Todos los meses de un año, para eso le mando
// el param :year
// Ademas esta ordenado de Enero a Diciembre
// i.e. /monthly-sales/2022 
// Me regresa
// 2022 Ventas: 
// 						Enero: 		$30,000
// 						Febrero: 	$35,000
// 						Marzo: 		$40,000
// 						etc, etc, etc
// 						Diciembre: $80,000
///////////////////////////////////////////////////////////////////
exports.getMonthlySales = catchAsync(async (req, res, next) => {

	const year = req.params.year * 1;

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

	const ventasPorMesMongoDB = await Sale.aggregate([
		returnUnwindObject (),
		returnProjectObject (),
		{
			$match: {
				createdAt: { "$gte": new Date(`${year}-01-01`),
										 "$lt": new Date(`${year+1}-01-01`) 
									 }, 
				estatusPedido: { "$eq": 2 }				
			}
		},
		returnGroupObject (),
		returnAddFieldsObject (),
		returnProjectFinalObject (),
		returnSortObject ()
	]);


	let totalAnual = 0;

	const ventasPorMes = ventasPorMesMongoDB.map(current=> {
							
		totalAnual += current.subtotal;

		return {
			name: `${regresaMes(current.Fecha.mes)}`,
			SubTotal: current.subtotal
		}
	})

	res.status(200)
	.json( {
		status: 'success',
		totalAnual,
		data: {
			ventasPorMes
		}
	});
});


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /weekly-sales/:year/:month
// getWeeklySales
// 
// Cargo las Ventas de la Dulceria: Todas las semanas de un mes y de un año, 
// para eso le mando
// los params :year :month
// Ademas esta ordenado de la primera semana a la última semana del Mes
// i.e. /weekly-sales/2022 
// Me regresa
// 2022-Oct Ventas: 
// 						Semana 36: $1,000
// 						Semana 37: $3,000
// 						Semana 38: $2,000
// 						Semana 39: $2,500
///////////////////////////////////////////////////////////////////
exports.getWeeklySales = catchAsync(async (req, res, next) => {

	const year = req.params.year * 1;
	const month = req.params.month * 1;
	let yearEnd = year;
	let monthEnd = month;

	// SI es Diciembre cambio de mes y de año
	if (monthEnd === 12) {
		monthEnd = 0;
		yearEnd += 1;
	}

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

	const ventasPorSemana = await Sale.aggregate([

		returnUnwindObject (),
		returnProjectObject (),
		{
			$match: {
				createdAt: { "$gte": new Date(`${year}-${month}-01`),
										 "$lt": new Date(`${yearEnd}-${monthEnd+1}-01`) 
									 },   
				estatusPedido: { "$eq": 2 }					
			}
		},
		{
			$group: {
				_id: {
								anio: 	{ $year: "$createdAt" },
								mes: 		{ $month: "$createdAt" },
								semana: { $week: "$createdAt" },
							},
							ventas: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },	
							descuentos: { $sum: "$productOrdered.descuento" }		
			}
		},
		returnAddFieldsObject (),
		{
			$project: {
				_id: 0, "Fecha": "$_id.semana", subtotal: 1
			}
		},
		returnSortObject ()
	]);

	res.status(200)
	.json( {
		status: 'success',
		data: {
			ventasPorSemana
		}
	});
});



///////////////////////////////////////////////////////////////////
// Obtengo el número de día del Domingo, esto me sirve para saber
// el primer dia de la semana, osea el Domingo
// y asi formar la semana i.e. 10-Ene (Domingo) al 16-Ene (Sabado)
const getSundayFromWeekNum = (weekNum, year) => {
	// const sunday = new Date(year, 0, (1 + (weekNum - 1) * 7));

	// console.log("weekNum", weekNum);
	// console.log("year", year);
	// console.log("((weekNum) * 7)", (weekNum * 7));

	const sunday = new Date(year, 0, (weekNum * 7));
	while (sunday.getDay() !== 0) {
		sunday.setDate(sunday.getDate() - 1);
	}
	return format(sunday, 'dd-MMM');
}



///////////////////////////////////////////////////////////////////
// Obtengo el número de día del Sábado, esto me sirve para saber
// el primer dia de la semana, osea el Sabado
// y asi formar la semana i.e. 10-Ene (Domingo) al 16-Ene (Sabado)
const getSaturdayFromWeekNum = (weekNum, year) => {
	// console.log("weekNum", weekNum);
	// console.log("year", year);
	// console.log("(1 + (weekNum) * 7)", (weekNum * 7));

	// const saturday = new Date(year, 0, (1 + (weekNum - 1) * 7));
	const saturday = new Date(year, 0, (weekNum * 7));

	// console.log("saturday", saturday);

	while (saturday.getDay() !== 6) {
		saturday.setDate(saturday.getDate() + 1);
	}
	return format(saturday, 'dd-MMM')
}

///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /weekly-range-sales/:start/:end
// getWeeklyRangeSales

// Cargo las Ventas de la Dulceria: 
// Se manda un rango de fechas: fecha de inicio (start) y fecha fin (end)
// de las ventas que se quieren buscar 
// Se recomienda mandar semanas completas
// para eso le mando
// los params :start :end
// Ademas esta ordenado por semana
// i.e. /weekly-range-sales/2022-09-25/2022-10-08
// osea son dos semanas completas 
// Me regresa
// 2022-09-25 a 2022-10-08 Ventas: 
// 						Semana 36: $1,000
// 						Semana 37: $3,000
// 
// Otro ejemplo:
// /weekly-range-sales/2022-12-25/2023-01-12
// En este caso hay dos años diferentes y debo checar el zero based
// o uno based de cada año
///////////////////////////////////////////////////////////////////
exports.getWeeklyRangeSales = catchAsync(async (req, res, next) => {

	const {start} = req.params;
	const {end} = req.params;

	// console.log("start", start)
	// console.log("end", end)

	const newStart = new Date(start);

	// Debido a un problema con MongoDB, necesito agregarle un dia
	// mas al end, endDate, porque MongoDB NO me toma en cuenta el ultimo
	// dia seleccionado por el usuario, se lo tengo que agregar a mano
	// como la variable end es un string, tengo que convertirlo a Fecha
	// y luego agregarle un dia
	const newEnd = new Date(end);
	// Para MongoDB NECESITO agregar un dia extra, es cosa de MongoDB para calcular con fechas
	const endPlusOneDay = new Date (newEnd.getTime() + (1 * 86400000))

	// Para JavaScript a diferencia de MongoDB NO necesito agregar un dia, lo dejo tal cual
	// const endDayForNodeJS = new Date (newEnd.getTime())
	
	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

	const ventasPorSemanaMongoDB = await Sale.aggregate([

		returnUnwindObject (),
		returnProjectObject (),
		{
			$match: {
				createdAt: { "$gte": new Date(`${newStart}`),
										 "$lt":  new Date(`${endPlusOneDay}`) 
									 },   
				estatusPedido: { "$eq": 2 }				
			}
		},
		{
			$group: {
				_id: {
								anio: 	{ $year: "$createdAt" },
								semana: { $week: "$createdAt" },
							},
							ventas: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },		
							descuentos: { $sum: "$productOrdered.descuento" }	
			}
		},
		returnAddFieldsObject (),
		{
			$project: {
				_id: 0, "Semana": "$_id.semana", subtotal: 1, "Anio": "$_id.anio"
			}
		},
		{
			$sort: {
				"Anio": 1, "Semana": 1
			}
		}
	]);

	// console.log("ventasPorSemanaMongoDB", ventasPorSemanaMongoDB);

	// Comentarize bastante codigo porque hacia malabares con las fechas sobre todo porque usaba
	// la fecha de MongoDB y ahi hay que aumentar un dia, y eso lo replique aqui en NodeJS
	// y veo que fue demasiado, al parecer no era necesario, asi comentarice mucho codigo de
	// este metodo y de getSundayFromWeekNum y getSaturdayFromWeekNum

	// Necesito obtener que dia es el 1 de Enero del año que me interesa
	// osea necesito saber si es domingo, lunes, martes, etc.
	// porque? Porque voy a usar en la consulta de MongoDB una function
	// que se llama $week, pero hay un problema, $week puede ser
	// zero based o one based
	// La documentacion de MongoDB dice:
	// Si el dia primero del año cae en Domingo entonces es one based
	// De lo contrario es zero based

	// const primerDiaDelAnioStart = new Date(newStart.getUTCFullYear(), 0, 1);
	// const primerDiaDelAnioEnd   = new Date(endDayForNodeJS.getUTCFullYear(), 0, 1);


	// si getDay() es cero quiere que decir que el primer dia del año es
	// Domingo por lo que $week de MongoDB es one based
	// pero si no es cero quiere decir que es zero based
	// por lo que si es zero based le sumare 1
	// console.log("primerDiaDelAnioStart", primerDiaDelAnioStart);
	// console.log("getDay",primerDiaDelAnioStart.getDay())
	
	// console.log("primerDiaDelAnioEnd", primerDiaDelAnioEnd);
	// console.log("getDay-End",primerDiaDelAnioEnd.getDay())

	// let sumaUnoStart = false;
	// let sumaUnoEnd = false;


	// este if dice su el dia primero del año NO es cero entonces
	// es zero based y necesito sumar un 1 a la Semana que regresa
	// la API
	// if (primerDiaDelAnioStart.getDay() !== 0) {
	// 	sumaUnoStart = true;
	// }

	// if (primerDiaDelAnioEnd.getDay() !== 0) {
	// 	sumaUnoEnd = true;
	// }

	let totalAcumulado = 0;
	const ventasPorSemana = ventasPorSemanaMongoDB.map(current=> {
		
		// console.log("current", current);
		totalAcumulado += current.subtotal;

		// const firstDay = getSundayFromWeekNum(sumaUnoStart ? current.Semana + 1 : current.Semana, current.Anio);
		const firstDay = getSundayFromWeekNum(current.Semana, current.Anio);

		// console.log("sumaUnoEnd", sumaUnoEnd);
		// console.log("current.Semana", current.Semana);
		// const lastDay = getSaturdayFromWeekNum(sumaUnoEnd ? current.Semana + 1 : current.Semana, current.Anio);
		const lastDay = getSaturdayFromWeekNum(current.Semana, current.Anio);

		// console.log("firstDay", firstDay)
		// console.log("lastDay", lastDay)

		return {
			name: `${firstDay} - ${lastDay}`,
			SubTotal: current.subtotal
		}
	})

	// console.log("ventasPorSemana", ventasPorSemana);

	res.status(200)
	.json( {
		status: 'success',
		totalAcumulado,
		data: {
			ventasPorSemana
		}
	});
});


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /one-month-sales/:year/:month
// getOneMonthSales
// 
// Cargo las Ventas de la Dulceria: La venta de un Mes en un año, para eso le mando
// los param :year y :month
// i.e. /one-month-sales/2022/10
// Me regresa
// 2022-Octubre Ventas: $30,000
///////////////////////////////////////////////////////////////////
exports.getOneMonthSales = catchAsync(async (req, res, next) => {

		const year = req.params.year * 1;
		const month = req.params.month * 1;
		let yearEnd = year;
		let monthEnd = month;
	
		// SI es Diciembre cambio de mes y de año
		if (monthEnd === 12) {
			monthEnd = 0;
			yearEnd += 1;
		}

		// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

    const ventaTotalPorMes = await Sale.aggregate([

			returnUnwindObject (),
			returnProjectObject (),
			{
				$match: {
					createdAt: { "$gte": new Date(`${year}-${month}-01`),
											 "$lt": new Date(`${yearEnd}-${monthEnd+1}-01`) 
										 },    
					estatusPedido: { "$eq": 2 }				
				}
			},
			returnGroupObject (),
			returnAddFieldsObject (),
			returnProjectFinalObject ()
    ]);
  
  
    res.status(200)
    .json( {
      status: 'success',
      data: {
        ventaTotalPorMes
      }
    });
  });


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /whole-year-sales/:year
// getWholeYearSales
// 
// Cargo las Ventas de la Dulceria de un solo año, para eso le mando
// el param :year
// i.e. /whole-year-sales/2022 
// Me regresa
// 2022 Ventas: $300,000
///////////////////////////////////////////////////////////////////
exports.getWholeYearSales = catchAsync(async (req, res, next) => {

    const year = req.params.year * 1;
  
		// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

    const ventaTotalPorAnio = await Sale.aggregate([
			returnUnwindObject (),
			returnProjectObject (),
			{
				$match: {
					createdAt: { "$gte": new Date(`${year}-01-01`),
											 "$lt": new Date(`${year+1}-01-01`) 
										 },    
					estatusPedido: { "$eq": 2 }				
				}
			},
			{
				$group: {
					_id: {
									anio: { $year: "$createdAt" },
								},
								ventas: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },	
								descuentos: { $sum: "$productOrdered.descuento" }		
				}
			},
			returnAddFieldsObject (),
			returnProjectFinalObject ()
    ]);
  
  
    res.status(200).json( {
      status: 'success',
      data: {
        ventaTotalPorAnio
      }
    });
});


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /whole-business-sales-by-year
// getWholeBusinessSalesByYear
// 
// Cargo las Ventas en toda la Historia de la Dulceria agrupada y ordenada por Año
// i.e. 2022 Ventas: $300,000
// 2021 Ventas: $250,000
// 2020 Ventas: $225,000
///////////////////////////////////////////////////////////////////
exports.getWholeBusinessSalesByYear = catchAsync(async (req, res, next) => {

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

    const ventaTotalPorAnioMongoDB = await Sale.aggregate([

			returnUnwindObject (),
			returnProjectObject (),
			{
				$match : {
							estatusPedido : { "$eq": 2	}
				}
			},
			{
				$group: {
					_id: {
									anio: { $year: "$createdAt" },
								},
								ventas: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },	
								descuentos: { $sum: "$productOrdered.descuento" }			
				}
			},
			returnAddFieldsObject (),
			returnProjectFinalObject (),
			returnSortObject ()
    ]);
  
	let totalEmpresa = 0;

	const ventaTotalPorAnio = ventaTotalPorAnioMongoDB.map(current=> {
							
		totalEmpresa += current.subtotal;

		return {
			name: current.Fecha.anio,
			Total: current.subtotal
		}
	})
		
		
    res.status(200).json( {
      status: 'success',
			totalEmpresa,
      data: {
        ventaTotalPorAnio
      }
    });
});


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js =>  /whole-year-sales-by-businessId/:year
// getWholeYearSalesByBusinessId
// 
// Cargo las Ventas que la Dulceria le ha hecho a uno de sus Clientes: 
// Es lo que la Dulceria le ha vendido en un Año, para eso le mando 
// el param :year
// 
// i.e. /whole-year-sales-by-businessId/2022 
// Me regresa
// 2022 Ventas que se le hicieron a El Abarrotero: $300,000
///////////////////////////////////////////////////////////////////
exports.getWholeYearSalesByBusinessId = catchAsync(async (req, res, next) => {

    const year = req.params.year * 1;
	const {client} = req.body;

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

    const ventaTotalPorAnioDeUnNegocio = await Sale.aggregate([

			returnUnwindObject (),
			{
				$project: {
						createdAt: 1,
						client: 1,
						businessName: 1,
						priceDeVenta: 1,
						quantity: 1,
						descuento: 1,
						estatusPedido: 1						
				}
			},
			{
				$match: {
					createdAt: { "$gte": new Date(`${year}-01-01`),
											 "$lt": new Date(`${year+1}-01-01`) 
										 },
					client: { "$eq": ObjectId(`${client}`) },   
					estatusPedido: { "$eq": 2 }  				
				}
			},
			{
				$group: {
					_id: "$businessName",
								ventas: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },
								descuentos: { $sum: "$productOrdered.descuento" }			
				}
			},
			returnAddFieldsObject (),
			{
				$project: {
					_id: 0, "Negocio": "$_id", subtotal: 1
				}
			}
    ]);
  
  
    res.status(200).json( {
      status: 'success',
      data: {
        ventaTotalPorAnioDeUnNegocio
      }
    });
});


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /monthly-sales-by-businessId/:year
// getMonthlySalesByBusinessId
// 
// Cargo las Ventas que la Dulceria le ha hecho a uno de sus Clientes: 
// Es lo que la Dulceria le ha vendido en Todos los meses de un año, 
// para eso le mando 
// el param :year
// Ademas esta ordenado de Enero a Diciembre
// i.e. /monthly-sales-by-businessId/2022 
// Me regresa
// 2022 Ventas que se le hicieron a El Abarrotero: 
// 						Enero: 		$8,000
// 						Febrero: 	$10,000
// 						Marzo: 		$38,000
// 						etc, etc, etc
// 						Diciembre: $20,000
///////////////////////////////////////////////////////////////////
exports.getMonthlySalesByBusinessId = catchAsync(async (req, res, next) => {

	const year = req.params.year * 1;
	const {client} = req.body;

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado

	const ventasPorMes = await Sale.aggregate([

		returnUnwindObject (),
		returnProjectWithClientObject (),
		{
			$match: {
				createdAt: { "$gte": new Date(`${year}-01-01`),
											"$lt": new Date(`${year+1}-01-01`) 
										},
				client: { "$eq": ObjectId(`${client}`) },    
				estatusPedido: { "$eq": 2 }		
			}
		},
		returnGroupObject (),
		returnAddFieldsObject (),
		returnProjectFinalObject (),
		returnSortObject ()
	]);


	res.status(200).json( {
		status: 'success',
		data: {
			ventasPorMes
		}
	});
});


///////////////////////////////////////////////////////////////////
// Viene de saleRoutes.js => /one-month-sales-by-businessId/:year/:month
// getOneMonthSalesByBusinessId
// 
// Cargo las Ventas que la Dulceria le ha hecho a uno de sus Clientes: 
// La venta de un solo Mes en un año, para eso le mando
// los param :year y :month
// i.e. /one-month-sales-by-businessId/2022/10
// Me regresa
// 2022-Octubre Ventas que se le hicieron a El Abarrotero: $30,000
///////////////////////////////////////////////////////////////////
exports.getOneMonthSalesByBusinessId = catchAsync(async (req, res, next) => {

    const year = req.params.year * 1;
	const month = req.params.month * 1;
	let yearEnd = year;
	let monthEnd = month;

	// SI es Diciembre cambio de mes y de año
	if (monthEnd === 12) {
		monthEnd = 0;
		yearEnd += 1;
	}

	const {client} = req.body;

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado
  
    const ventaTotalPorMes = await Sale.aggregate([
			
			returnUnwindObject (),
			returnProjectWithClientObject (),
			{
				$match: {
					createdAt: { "$gte": new Date(`${year}-${month}-01`),
											 "$lt": new Date(`${yearEnd}-${monthEnd+1}-01`) 
										 },
					client: { "$eq": ObjectId(`${client}`) },    
					estatusPedido: { "$eq": 2 }						
				}
			},
			returnGroupObject (),
			returnAddFieldsObject (),
			returnProjectFinalObject ()
    ]);
  
  
    res.status(200).json( {
      status: 'success',
      data: {
        ventaTotalPorMes
      }
    });
});


///////////////////////////////////////////////////////////////////
// Viene de saleToutes.js  => list-of-years-sales
// getListOfYearsSales
// 
// Cargo la lista de años en que ha habido Ventas
// Lo usara para poner los años en un select para que el usuario
// seleccione el año que quiere hacer consulta
// i.e. 2022, 2021, 2020
///////////////////////////////////////////////////////////////////
exports.getListOfYearsSales = catchAsync(async (req, res, next) => {

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado
		
	const listOfYearsSalesMongoDB = await Sale.aggregate([

			{
				$project : {
						createdAt : 1,
						estatusPedido: 1,
						_id : 0
				}
		},
		{
			$match : {
					estatusPedido : { "$eq" : 2 }
			}
		},
		{
			$group: {
				_id: {
					anio: { $year: "$createdAt" }
				}	 
			}
		},
		{
			$project: {
				"Fecha": "$_id", _id: 0 					
			}
		},
		{
			$sort: {
				"Fecha": -1
				
			}
		}
    ]);

	// Para que uso bandera?
	// Para que guarde en setYear el primer año que me sale en listOfYearsSales
	// el cual es el año que se pondra en el select, como ya viene ordenado
	// desde MongoDB ese año que guardo el mas actual, osea el año en curso
	// Deberia haber una mejor manera de hacerlo en vez usar bandera
	let bandera = false;
	let currentYear = 0;
	const listOfYearsSales = listOfYearsSalesMongoDB.map(current =>  {

		// console.log("current.Fecha.anio", current.Fecha.anio);

		if (!bandera) {
			currentYear = current.Fecha.anio;
			bandera = true;
		}
		return current.Fecha;
	})

	res.status(200).json( {
      status: 'success',
			currentYear,
      data: {
        listOfYearsSales
      }
    });
});


///////////////////////////////////////////////////////////////////
// Esta function me regresa de la BD los ultimos 5 pedidos o menos
// que tenga un Cliente con estatusPedido: 1 Por Entregar 
// asi el usuario puede escoger uno de estos pedidos para
// actualizarlo (quitar, poner productos, modificar la cantidad,
// aplicar descuento o no) o borrarlo
///////////////////////////////////////////////////////////////////
exports.getUltimosCincoPedidosPorEntregar = catchAsync(async (req, res, next) => {

	const { clientId } = req.params;

	// estatusPedido: 1 es por Entregar y 2 es Entregado
  
	const ultimosCincoPedidosPorEntregar = await Sale.aggregate([

		{
			$project: {
					client: 1,
					estatusPedido: 1,
					createdAt: 1
					
			}
		},
		{
			$match: {
								client: { "$eq": ObjectId(`${clientId}`) },               
                estatusPedido: { "$eq": 1 }					
			}
		},
		{
			$group: {
				_id: {
								Fecha: "$createdAt"
				}				
			}
		},
		{
			$sort: {
					"_id.Fecha": -1
					
			}
		},
		{
			$limit: 5
		}
	]);


	res.status(200)
	.json( {
		status: 'success',
		data: {
			ultimosCincoPedidosPorEntregar
		}
	});
});


///////////////////////////////////////////////////////////////////
// generaTicket me crea el Ticket que se manda al cliente por medio 
// de WhatsApp, Email o Impresora
///////////////////////////////////////////////////////////////////
exports.getTicketFromServer = catchAsync (async (req, res, next) => {

	const { orderId } = req.params;

	const ticketDeVenta = await Sale.aggregate([
		// Stage 1
		{
			$match: {
				 _id: { "$eq": ObjectId(`${orderId}`) }  					
			}
		},
		// Stage 2
		{
			$unwind: {
					path: "$productOrdered"
			}
		},
		// Stage 3
		{
			$project: {
					createdAt: 1,
					client: 1,
					businessName: 1,
					seAplicaDescuento: 1,
					_id: 1,
					"productOrdered.productName": 1,
					"productOrdered.sku": 1,
					"productOrdered.priceDeVenta": 1,
					"productOrdered.quantity": 1,
					"productOrdered.descuento": 1,
					// subTotal: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },
					// descuento: { $sum: "$productOrdered.descuento" },
					total: { $subtract: [ { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },  { $sum: "$productOrdered.descuento" } ] },					
			}
		},	
		// Stage 4
		{
			$group: {
					_id: {
									orderId: "$_id",
									cliente: "$client",
									negocio: "$businessName",
									seAplicaDescuento: "$seAplicaDescuento",
									sku: "$productOrdered.sku",
									productName: "$productOrdered.productName",
									quantity: "$productOrdered.quantity",
									priceDeVenta: "$productOrdered.priceDeVenta",
									total: "$total",
							 },
								ventaProducto: { $sum:{ $multiply: [ "$productOrdered.priceDeVenta", "$productOrdered.quantity" ] } },
								descuentoProducto: { $sum: "$productOrdered.descuento" },
								TotalProducto: {
									$sum: "$productOrdered.quantity"
								}
			},											
		},
		// Stage 5
		{
			$group: {
							_id:"$_id.orderId",

							clientInfo: {
								$first: {
									client: "$_id.cliente",
									businessName: "$_id.negocio",
									seAplicaDescuento: "$_id.seAplicaDescuento"
								}
							},						 
							productOrdered:
											{
													$push:
																{
																	sku:"$_id.sku",
																	productName: "$_id.productName",
																	quantity: "$_id.quantity",
																	priceDeVenta: "$_id.priceDeVenta",
																	subTotal:"$ventaProducto",
																	descuento:"$descuentoProducto",
																	total:"$_id.total"																		
																}
											},
							TotalVenta:{$sum:"$ventaProducto"},
							TotalDescuento:{$sum:"$descuentoProducto"},
							TotalProducto: {$sum: "$TotalProducto"},
			}
		},
		// Stage 6
		{
			$addFields: {
					 TotalPedido: { $subtract: [ "$TotalVenta", "$TotalDescuento" ] }
			}
		},
	]);

	// console.log ("ticketDeVenta", ticketDeVenta);
	res.status(200).json( {
		status: 'success',
		data: {
			ticketDeVenta
		}
	});
});



///////////////////////////////////////////////////////////////////
// Esta function me regesa de la BD un pedido en especifico
// le mando el clientId y la fecha en que se creo el pedido
// Esto me sirve para mostrarle al Client un pedido
// que quiera actualizar, ya sea modificar los productos, su cantidad
// su EstatusPedido o borrarlo
///////////////////////////////////////////////////////////////////
exports.getUpdateOrderClientFecha = catchAsync(async (req, res, next) => {

	const client = req.params.clientId;
	const createdAt = req.params.fecha;

	// const updateOrder = await Sale.findOne({client}, {createdAt});
	const updateOrder = await Sale.findOne( 
			{
				createdAt, 
				client
			}
	);

	console.log("updateOrder", updateOrder);

	if (!updateOrder) {
		return next (new AppError('No se encontró el pedido a actualizar', 401));
	}

	res.status(200).json( {
		status: 'success',
		data: {
			updateOrder
		}
	});

});


///////////////////////////////////////////////////////////////////
// Es por esto que cree otra function llamada updateSaleAndInventory
// esta se encarga de Actualizar la collection de Sales y actualizar
// el inventario si es que se requiere, es decir, recuerda que
// tengo el field estatusPedido, el cual puede ser 1 por Entregar 
// y 2 Entregado, donde si es Por Entregar NO se modifica el inventario
// y si es Entregado SI se modifica

// Aun asi tanto createSale como updateSaleAndInventory son codigos
// casi idénticos por lo que conviene crear una 3era version donde
// junte tanto createSale y updateSaleAndInventory
///////////////////////////////////////////////////////////////////
exports.updateSaleAndInventory = catchAsync (async (req, res, next) => {

	// console.log("req.body.id", req.body.id);
	// console.log("req.body", req.body);

	// Manejo de Error en Transaccion, me sirve para hacer Rollback
	// si hago throw Error, hara un Rollback
	let huboErrorEnTransaccion = false;

	// Inicio la sesion que uso para la Transaccion
  	const session = await mongoose.startSession();
	
	// Opciones para la Transaccion
	const transactionOptions = {
		readPreference: 'primary',
		readConcern: { level: 'local' },
		writeConcern: { w: 'majority' }
  	};

	let actualizarInventario = true;
	// console.log("Start Transaction session", session);
	
	
	if (req.body.clientId) {
		req.body.client = req.body.clientId;
		req.body.clientId = undefined;
	}

	if (req.body.productOrdered) {
		req.body.productOrdered.forEach(current => {
			if (current.quantity) { 
				current.quantity *= 1;
			}
		})
	}

	// estatusPedido, donde 1 es Por Entregar y 2 es Entregado
	// si el Pedido es Por Entregar osea 1 NO actualizo el Inventario
	if (req.body.estatusPedido === 1) {
		actualizarInventario = false;
	}


	// ///////////////////////////////////////////////////////////////////
	// // Empiezo la Transaccion porque hay dos colecciones involucradas:
	// // Sales y Products, una es para levantar el pedido, la otra es
	// // para actualzar el Inventario
	try {
		
		const transactionResults = await session.withTransaction(async () => {

			///////////////////////////////////////////////////////////////////
			// Empiezo guardando el Pedido en la Collection Sales


			// new: true, significa que me va a regresar el Document YA actualizado
			// console.log("req.params.id", req.params.id)
			// console.log("req.body", req.body)
			/////////////////////////////////////////////////////
			// ESTO ES LO DIFERENTE ENTRE ACTUALIZAR PEDIDO Y CREAR PEDIDO
			const allSale = await Sale.findByIdAndUpdate(
						req.body.id, 
						req.body, 
						{ 
							new: true, 
							runValidators: true,
							session
						}
			);
			/////////////////////////////////////////////////////
			console.log("allSale", allSale)

			// si no existe allSale es que es null
			// if (!allSale) {
			// 	return next(new AppError ('No Document found with that Id', 404));
			// }

			// pongo req.body entre corchetes, para poder pasarle options
			// como segundo parametro, osea la session
			// const allSale = await Sale.create([req.body], {session});
			// console.log("allSale", allSale);

			if (!allSale) {
				huboErrorEnTransaccion = true;
			}
		
			// console.log("allSale", allSale);
			if (huboErrorEnTransaccion){
				console.log("Hubo error al crear el Pedido, hare Roll Back");
        		throw new Error ('Abortando Transaccion por Error en el Pedido');
			}
		
			// Termino de crear el pedido
			///////////////////////////////////////////////////////////////////


			///////////////////////////////////////////////////////////////////
			// Solo actualizo el inventario si el estatusPedido es "entregado"
			if (actualizarInventario) {

				///////////////////////////////////////////////////////////////////
				// Empiezo la actualizacion de Inventario en la Collection Products
	
				// Preparo la informacion para descontar al InventarioActual
				// es decir el productId y la cantidad Ordenada
				const inventarioActualizar = req.body.productOrdered.map (current => 
							({ id: current.product, inventarioActual: current.quantity}))
			
				// console.log(inventarioActualizar)
			
				
				// Aqui actualizo el inventarioActual de la Collection Products
				// const allInventarioOrder = 
				await Promise.all (inventarioActualizar.map( async (current) => {
			
					// const updatedInventario = await Product.findByIdAndUpdate(
					// Pongo current.quantity NEGATIVO porque la cantidad ordenada
					// de producto se la descontaré al inventarioActual de la Collection
					// Products
					// usando el operador $inc de MongoDB lo que hace es que
					// la cantidad que exista en la Collection se le resta
					// a lo que el cliente ordenó en el pedido
	
					const updatedInventario = await Product.findByIdAndUpdate(
								current.id, 
								{ $inc: { inventarioActual: -current.inventarioActual } }, 
								{ 
									new: true, 
									runValidators: true,
									session: session
								}
					);
				
					// si no existe updatedInventario es que es null
					// corto la Transaccion regreso Error
					if (!updatedInventario) {
						huboErrorEnTransaccion = true;
					}
					return updatedInventario;
					// console.log("updatedInventario",updatedInventario);
				}));
	
				// console.log("allInventarioOrder", allInventarioOrder)
	
				// Termino de actualizar el Inventario
				///////////////////////////////////////////////////////////////////
			}


			if (huboErrorEnTransaccion){
				console.log("Hubo error al actualizar inventario, hare Roll Back");
        		throw new Error ('Abortando Transaccion por Error al actualizar Inventario');
			}
			else {
				console.log("Transaccion Exitosa")
				res.status(201).json({
					status: 'success',
					data: {
						sale: allSale
					}
				});
			}		
		}, transactionOptions );

		// console.log("transactionResults", transactionResults)

		///////////////////////////////////////////////////////////////////
		// La Transaccion ha terminado
		
		if (transactionResults) {
			console.log("El pedido y la actualizacion de Inventario fueron realizados con éxito");
		} 
		else {
			console.log("El pedido y la actualizacion de Inventario fueron intencionalmente abortados.");
			huboErrorEnTransaccion = true;
			throw new Error ('Abortando Transaccion');
		}
	}
	catch (error) {
		console.log("La Transacción de Pedido e Inventario fue abortado por un error inesperado.")
		console.log("ERROR", error);
		huboErrorEnTransaccion = true;
	}
	finally {
		// Finalizo la Session de Transaccion
		await session.endSession();
		console.log("End Transaction Session");
	}

	if (huboErrorEnTransaccion) {
		return next(new AppError ('Hubo un error en la Transaccion se hizo Rollback', 999));
	}
	
});


///////////////////////////////////////////////////////////////////
// Esta es la Primer version que hice para insertar Pedidos con sus Productos
// a la Collection de Sale, ademas de actualizar el Inventario en la Collection
// Products, aqui cada Document era un Producto del Pedido por lo que
// tenia mucha informacion repetida, era estable y funcionaba bien pero
// empece a tener problemas cuando tuve que hacer updates al pedido
// auna si me sirvio mucho de aprendizaje para el Two-Phase Commit y usar
// session, luego hice la segunda version llamada .createSale la cual aun la
// uso al 1 de Noviembre de 2022, y tengo tambien .updateSaleAndInventory
// que se encarga de actualizar la Collection de Sale y la de Products
// en caso de ser necesario, pero ambas functiones son ta parecidas que lo
// mejor es unirlas en una sola para evitar repetir còdigo
///////////////////////////////////////////////////////////////////
exports.createSalePrimerVersion = catchAsync (async (req, res, next) => {

	// Manejo de Error en Transaccion, me sirve para hacer Rollback
	// si hago throw Error, hara un Rollback
	let huboErrorEnTransaccion = false;

	// Inicio la sesion que uso para la Transaccion
  	const session = await mongoose.startSession();
	
	// Opciones para la Transaccion
	const transactionOptions = {
		readPreference: 'primary',
		readConcern: { level: 'local' },
		writeConcern: { w: 'majority' }
  	};

	let actualizarInventario = true;

	// console.log("Start Transaction session", session);
 

	// Hago un renombramiento de los fields de .id a .product
	// y de .clientId a client
	// ya que product y client son los fields que uso en el Schema
	// de saleModel.js
	// luego pongo undefined a current.id y a current.clientId
	// para que sean ignorados por el schema saleModel al grabar
	req.body.forEach(current => {
			if (current.id) {
					current.product = current.id;
					current.id = undefined;
			}
	
			if (current.clientId) {
					current.client = current.clientId;
					current.clientId = undefined;
			}
	
			if (current.quantity) { 
					current.quantity *= 1;
			}

			// if (current.estatusPedido === "porEntregar") {
				// estatusPedido, donde 1 es Por Entregar y 2 es Entregado
			if (current.estatusPedido === 1) {
				actualizarInventario = false;
			}
	})

	///////////////////////////////////////////////////////////////////
	// Empiezo la Transaccion porque hay dos colecciones involucradas:
	// Sales y Products, una es para levantar el pedido, la otra es
	// para actualzar el Inventario
	try {
		
		const transactionResults = await session.withTransaction(async () => {

			///////////////////////////////////////////////////////////////////
			// Empiezo guardando el Pedido en la Collection Sales

			// PREGUNTA: como saber si el pedido fue creado? esto para ver
			// si le doy Roll back desde este momento y ya no ir
			// a actualizar Inventario
			// En este ciclo .map voy agregando a la Collection Sale
			// cada uno de los productos ordenados en el Pedido
			const allSale = await Promise.all (req.body.map( async (itemPedido) => {
		
				// pongo itemPedido entre corchetes, para poder pasarle options
				// como segundo parametro, osea la session
				// console.log("itemPedido", itemPedido);
				const newSale = await Sale.create([itemPedido], {session});
				// console.log(newSale);

				// si no existe newSale es que es null
				// corto la Transaccion regreso Error
				if (!newSale) {
					huboErrorEnTransaccion = true;	
				}
				return newSale;
			}));
		
			// console.log("allSale", allSale);
			if (huboErrorEnTransaccion){
				console.log("Hubo error al crear el Pedido, hare Roll Back");
        		throw new Error ('Abortando Transaccion por Error en el Pedido');
			}
		
			// Termino de crear el pedido
			///////////////////////////////////////////////////////////////////


			///////////////////////////////////////////////////////////////////
			// Solo actualizo el inventario si el estatusPedido es "entregado"
			if (actualizarInventario) {

				///////////////////////////////////////////////////////////////////
				// Empiezo la actualizacion de Inventario en la Collection Products
	
				// Preparo la informacion para descontar al InventarioActual
				// es decir el productId y la cantidad Ordenada
				const inventarioActualizar = req.body.map (current => 
							({ id: current.product, inventarioActual: current.quantity}))
			
				// console.log(inventarioActualizar)
			
				
				// Aqui actualizo el inventarioActual de la Collection Products
				// const allInventarioOrder = 
				await Promise.all (inventarioActualizar.map( async (current) => {
			
					// const updatedInventario = await Product.findByIdAndUpdate(
					// Pongo current.quantity NEGATIVO porque la cantidad ordenada
					// de producto se la descontaré al inventarioActual de la Collection
					// Products
					// usando el operador $inc de MongoDB lo que hace es que
					// la cantidad que exista en la Collection se le resta
					// a lo que el cliente ordenó en el pedido
	
					const updatedInventario = await Product.findByIdAndUpdate(
								current.id, 
								{ $inc: { inventarioActual: -current.inventarioActual } }, 
								{ 
									new: true, 
									runValidators: true,
									session: session
								}
					);
				
					// si no existe updatedInventario es que es null
					// corto la Transaccion regreso Error
					if (!updatedInventario) {
						huboErrorEnTransaccion = true;
					}
					return updatedInventario;
					// console.log("updatedInventario",updatedInventario);
				}));
	
				// console.log("allInventarioOrder", allInventarioOrder)
	
				// Termino de actualizar el Inventario
				///////////////////////////////////////////////////////////////////
			}


			if (huboErrorEnTransaccion){
				console.log("Hubo error al actualizar inventario, hare Roll Back");
        		throw new Error ('Abortando Transaccion por Error al actualizar Inventario');
			}
			else {
				console.log("Transaccion Exitosa")
				res.status(201).json({
					status: 'success',
					data: {
						sale: allSale
					}
				});
			}		
		}, transactionOptions );

		// console.log("transactionResults", transactionResults)

		///////////////////////////////////////////////////////////////////
		// La Transaccion ha terminado
		
		if (transactionResults) {
			console.log("El pedido y la actualizacion de Inventario fueron realizados con éxito");
		} 
		else {
			console.log("El pedido y la actualizacion de Inventario fueron intencionalmente abortados.");
			huboErrorEnTransaccion = true;
			throw new Error ('Abortando Transaccion');
		}
	}
	catch (error) {
		console.log("La Transacción de Pedido e Inventario fue abortado por un error inesperado.")
		console.log("ERROR", error);
		huboErrorEnTransaccion = true;
	}
	finally {
		// Finalizo la Session de Transaccion
		await session.endSession();
		console.log("End Transaction Session");
	}

	if (huboErrorEnTransaccion) {
		return next(new AppError ('Hubo un error en la Transaccion se hizo Rollback', 999));
	}
});