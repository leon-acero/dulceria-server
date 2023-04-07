const multer = require ('multer');
const sharp = require ('sharp');
const cloudinary = require('../Utils/cloudinary')

const Product = require('../models/productModel');
const catchAsync = require('../Utils/catchAsync');
const AppError = require('../Utils/appError');
const factory = require('./handlerFactory');



exports.updateProduct = factory.updateOne(Product);
exports.deleteProduct = factory.deleteOne(Product);
exports.createProduct = factory.createOne(Product);
exports.getProduct = factory.getOne(Product);
exports.getAllProducts = factory.getAll(Product);


///////////////////////////////////////////////////////////////////
// Guardo la foto osea imageCover en Memoria ya que antes de guardarla
// en el disco duro del Web Server (File System) voy a darle
// un Resize, a convertirlo a webP y a comprimir la foto para que
// ocupe el menor espacio posible
///////////////////////////////////////////////////////////////////
const multerStorage = multer.memoryStorage();

///////////////////////////////////////////////////////////////////
// Me aseguro de solo aceptar archivos para imageCover que sean imagenes
// de cualquier tipo, el usuario puede seleccionar cualquier tipo de imagen
// de todos modos lo convertire a webP
// Si el archivo no es imagen mando error
///////////////////////////////////////////////////////////////////
const multerFilter = (req, file, cb) => {

	// uso el mimetype
	if (file.mimetype.startsWith('image')) {
		cb (null, true);
	}
	else {
		cb ( new AppError ('El archivo no es una imagen! Solo usa imágenes por favor.', 400), false);
	}	
}

///////////////////////////////////////////////////////////////////
// Defino como usare a multer, mandando llamar a multerStorage
// y multerFilter
///////////////////////////////////////////////////////////////////
const upload = multer({
	storage: multerStorage,
	fileFilter: multerFilter
});


///////////////////////////////////////////////////////////////////
// Me encargo de subir una sola foto proveniente de req.body.photo
// se llama photo porque asi lo escogi desde el product.jsx del Client
// o bien de NewProduct.jsx
///////////////////////////////////////////////////////////////////
exports.uploadProductPhoto = upload.single('photo');


///////////////////////////////////////////////////////////////////
// Aqui me encargo de actualizar el slug, lo tengo que hacer aparte de
// exports.updateProduct = factory.updateOne(Product)
// porque necesito usar findById y luego .save para ejeutar el metodo del slug
// si lo hago con findByIdAndUpdate el .save NO se ejecuta
///////////////////////////////////////////////////////////////////
exports.updateSlugProduct = catchAsync( async (req, res, next) => {

	// const product = await Product.findOne( { sku: req.body.sku } );
	const product = await Product.findById( { _id: req.body._id } );


	if (!product) {
		return next (new AppError ('El Producto no existe' ,400));
	}

	product.productName = req.body.productName;


	// Recuuerda que uso save y NO findOneAndUpdate porque con save puedo ejecitar 
	// validaciones y PRE save middlewares, por ejemplo donde se encriptan los passwords
	await product.save();

	next();
});


///////////////////////////////////////////////////////////////////
// Hago el upload de la foto a Cloudinary, ahora los procesos de resize
// los hago en Cloudinary, ya no es necesario usar el sharp package
// Convierto la imagen a webP
// Guardo la imagen en el Web Server (File System)
// Le pongo nombre a la imagen osea a imageCover 
///////////////////////////////////////////////////////////////////
exports.uploadImageToCloudinary = catchAsync( async (req, res, next) => {

	if (!req.file) {
		return next();
	}

	// uploadRes tiene los detalles de la imagen, width, height, url
	// subo la imagen a Cloudinary

	// Hago la conversión a base64 para poder subir la imagen a Cloudinary
	const imageBase64 = req.file.buffer.toString('base64');
	const uploadStr = `data:${req.file.mimetype};base64,${imageBase64}`;

	const uploadRes = await cloudinary.uploader.upload (uploadStr,
		{
			upload_preset: 'onlineElJuanjoProducts'
		}
	);

	// Actualizo el nombre de imageCover en la Collection Clients
	// En el Middleware que sigue donde se actualiza toda la informacion del Cliente
	// se actualizara el imageCover
	if (uploadRes) {
		req.body.imageCover = uploadRes.secure_url;
	}

	next();
});


///////////////////////////////////////////////////////////////////
// Hago el resize de la foto
// Convierto la imagen a webP
// Guardo la imagen en el Web Server (File System)
// Le pongo nombre a la imagen osea a imageCover 
///////////////////////////////////////////////////////////////////
exports.resizeProductImages = catchAsync( async (req, res, next) => {


	if (!req.file) {
		return next();
	}

	req.file.filename = `product-${Date.now()}.webp`;

	await sharp( req.file.buffer)
				.resize(700, 700)
				.toFormat('webp')
				.webp( {quality: 30 } )
				.toFile(`./public/img/products/${req.file.filename}`);	
				// .toFile(`client/public/img/products/${req.file.filename}`);	

	// Actualizo el nombre de imageCover en la Collection Products
	req.body.imageCover = req.file.filename;
	
	next();
});



exports.aliasProductByProductName = (req, res, next) => {
	
	req.query = {
		productName: {
			regex: `(?i)${req.params.byProductName}`
		},
		sort: 'productName'
	}
	next(); 
}