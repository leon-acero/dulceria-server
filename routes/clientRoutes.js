const express = require('express');
const clientController = require('../controllers/clientController');

// como convencion cambiare el nombre de clientRouter a router
const router = express.Router();
const authController = require('../controllers/authController');

router
	.route('/')
	.get( authController.protect, 
		authController.restrictTo ('admin', 'vendedor'),
		clientController.getAllClients)

	.post(authController.protect, 
		authController.restrictTo ('admin'),
		clientController.uploadClientPhoto,
		clientController.uploadImageToCloudinary,
		clientController.createClient);


router
	.route('/:id')
	.get( authController.protect, 
			authController.restrictTo ('admin', 'vendedor'),
			clientController.getClient)

	.patch(authController.protect, 
				authController.restrictTo ('admin'),
				clientController.uploadClientPhoto,
				clientController.uploadImageToCloudinary,
				clientController.updateSlugClient,
				clientController.updateClient)

	.delete(authController.protect, 
			authController.restrictTo('admin'), 
			clientController.deleteClient);


			
///////////////////////////////////////////////////////////////////
// Hago la búsqueda de un cliente usando su nombre de negocio
// este es el primer paso para levantar el pedido para un cliente
// es decir buscarlo por el nombre del Negocio 
// el segundo paso es abrir el cliente seleccionado
// el tercer paso es crear un Pedido Nuevo, o si tiene un Pedido Por Entregar
// puede actualizarlo o borrarlo    
router
      .route('/search-client/:byBusinessName')
      .get( authController.protect, 
            authController.restrictTo ('admin', 'vendedor'),
            clientController.aliasClientByBusinessName, 
            clientController.getAllClients)


// ahora exporto el router para impotarlo en app.js
// cuando solo tengo una cosa que exportar hago asi
module.exports = router;