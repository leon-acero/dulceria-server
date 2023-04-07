const express = require('express');
const saleController = require('../controllers/saleController');
const authController = require('../controllers/authController');

const router = express.Router( { mergeParams: true } );

///////////////////////////////////////////////////////////////////
// /list-of-years-sales
// 
// Cargo la lista de años en que ha habido Ventas
// Lo usara para poner los años en un select para que el usuario
// seleccione el año que quiere hacer consulta
// i.e. 2022, 2021, 2020
///////////////////////////////////////////////////////////////////

router
	.route('/list-of-years-sales')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getListOfYearsSales);


///////////////////////////////////////////////////////////////////
// /whole-business-sales-by-year
// 
// Cargo las Ventas en toda la Historia de la Dulceria agrupada y ordenada por Año
// i.e. 2022 Ventas: $300,000
// 2021 Ventas: $250,000
// 2020 Ventas: $225,000
///////////////////////////////////////////////////////////////////

router
.route('/whole-business-sales-by-year')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getWholeBusinessSalesByYear);


router
    .route('/:id')
    .put(
		authController.protect,
		authController.restrictTo('admin', 'vendedor'), 
		saleController.createOrUpdateSaleAndInventory)
    .delete(
			authController.protect,
            authController.restrictTo('admin', 'vendedor'), 
            saleController.deleteSale)
    .get(   
            saleController.getSale);


router
    .route('/')
    .get(saleController.getAllSales)
    .post(  authController.protect, 
            authController.restrictTo('admin', 'vendedor'),
            saleController.createOrUpdateSaleAndInventory);

	
///////////////////////////////////////////////////////////////////
// /whole-year-sales/:year
// 
// Cargo las Ventas de la Dulceria de un solo año, para eso le mando
// el param :year
// i.e. /whole-year-sales/2022 
// Me regresa
// 2022 Ventas: $300,000
///////////////////////////////////////////////////////////////////
router
	.route('/whole-year-sales/:year')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getWholeYearSales); 


///////////////////////////////////////////////////////////////////
// /monthly-sales/:year
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
router
	.route('/monthly-sales/:year')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getMonthlySales); 


///////////////////////////////////////////////////////////////////
// /weekly-sales/:year/:month
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
router
	.route('/weekly-sales/:year/:month')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getWeeklySales); 


///////////////////////////////////////////////////////////////////
// /weekly-range-sales/:start/:end
// 
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
///////////////////////////////////////////////////////////////////
router
	.route('/weekly-range-sales/:start/:end')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getWeeklyRangeSales); 					



///////////////////////////////////////////////////////////////////
// /one-month-sales/:year/:month
// 
// Cargo las Ventas de la Dulceria: La venta de un solo Mes en un año, para eso le mando
// los param :year y :month
// i.e. /one-month-sales/2022/10
// Me regresa
// 2022-Octubre Ventas: $30,000
///////////////////////////////////////////////////////////////////
router
	.route('/one-month-sales/:year/:month')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getOneMonthSales); 


///////////////////////////////////////////////////////////////////
// /whole-year-sales-by-businessId/:year
// 
// Cargo las Ventas que la Dulceria le ha hecho a uno de sus Clientes: 
// Es lo que la Dulceria le ha vendido en un Año, para eso le mando 
// el param :year
// 
// i.e. /whole-year-sales-by-businessId/2022 
// Me regresa
// 2022 Ventas que se le hicieron a El Abarrotero: $150,000
///////////////////////////////////////////////////////////////////
router
	.route('/whole-year-sales-by-businessId/:year')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getWholeYearSalesByBusinessId); 


///////////////////////////////////////////////////////////////////
// /monthly-sales-by-businessId/:year
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
router
	.route('/monthly-sales-by-businessId/:year')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getMonthlySalesByBusinessId); 		


///////////////////////////////////////////////////////////////////
// /one-month-sales-by-businessId/:year/:month
// 
// Cargo las Ventas que la Dulceria le ha hecho a uno de sus Clientes: 
// La venta de un solo Mes en un año, para eso le mando
// los param :year y :month
// i.e. /one-month-sales-by-businessId/2022/10
// Me regresa
// 2022-Octubre Ventas que se le hicieron a El Abarrotero: $30,000
///////////////////////////////////////////////////////////////////
router
	.route('/one-month-sales-by-businessId/:year/:month')
	.get(authController.protect, 
		authController.restrictTo ('admin'),
		saleController.getOneMonthSalesByBusinessId); 


///////////////////////////////////////////////////////////////////
// Esta function me regresa de la BD los ultimos 5 pedidos o menos
// que tenga un Cliente con estatusPedido: 1 Por Entregar 
// asi el usuario puede escoger uno de estos pedidos para
// actualizarlo (quitar, poner productos, modificar la cantidad,
// aplicar descuento o no) o borrarlo
///////////////////////////////////////////////////////////////////
router
	.route('/ultimos-cinco-pedidos-por-entregar/:clientId')
	.get(authController.protect, 
		authController.restrictTo ('admin', 'vendedor'),
		saleController.getUltimosCincoPedidosPorEntregar); 


router
	.route('/createBulkSale/:fechaInicio/:fechaFin')
	.get(authController.protect, 
		authController.restrictTo ('admin'), 
		saleController.createBulkSale); 
			
			

///////////////////////////////////////////////////////////////////
// Esta function me regesa de la BD un pedido en especifico
// le mando el clientId y la fecha en que se creo el pedido
// Esto me sirve para mostrarle al Client un pedido
// que quiera actualizar, ya sea modificar los productos, su cantidad
// su EstatusPedido o borrarlo
///////////////////////////////////////////////////////////////////
router
	.route('/update-order/client/:clientId/fecha/:fecha')
	.get(authController.protect, 
		authController.restrictTo ('admin', 'vendedor'),
		saleController.getUpdateOrderClientFecha); 



///////////////////////////////////////////////////////////////////
// /whole-year-sales/:year
// 
// Cargo las Ventas de la Dulceria de un solo año, para eso le mando
// el param :year
// i.e. /whole-year-sales/2022 
// Me regresa
// 2022 Ventas: $300,000
///////////////////////////////////////////////////////////////////
router
.route('/ticket-from-server/:orderId')
.get(authController.protect, 
	authController.restrictTo ('admin', 'vendedor'),
	saleController.getTicketFromServer); 


// ahora exporto el router para impotarlo en app.js
// cuando solo tengo una cosa que exportar hago asi
module.exports = router;

