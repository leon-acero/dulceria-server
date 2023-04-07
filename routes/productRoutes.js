const express = require('express');
const productController = require('../controllers/productController');

// como convencion cambiare el nombre de productRouter a router
const router = express.Router();
const authController = require('../controllers/authController');


router
	.route('/')
	.get( authController.protect, 
		authController.restrictTo ('admin', 'vendedor'),
		productController.getAllProducts)

	.post(authController.protect, 
		authController.restrictTo ('admin'), 
		productController.uploadProductPhoto,
		productController.uploadImageToCloudinary,
		productController.createProduct);


router
	.route('/:id')
	.get( authController.protect, 
		authController.restrictTo ('admin'),
		productController.getProduct)

	.patch(authController.protect, 
             authController.restrictTo ('admin'),
             productController.uploadProductPhoto,
             productController.uploadImageToCloudinary,
             productController.updateSlugProduct,
             productController.updateProduct)
 
	.delete(authController.protect, 
			authController.restrictTo('admin'),
			productController.deleteProduct);


			///////////////////////////////////////////////////////////////////
// Hago la búsqueda de un producto usando su nombre
  
router
	.route('/search-product/:byProductName')
	.get( authController.protect, 
		authController.restrictTo ('admin', 'vendedor'),
		productController.aliasProductByProductName, 
		productController.getAllProducts)


// ahora exporto el router para impotarlo en app.js
// cuando solo tengo una cosa que exportar hago asi
module.exports = router;