// 3rd Party
const multer = require ('multer');
const sharp = require ('sharp');

// Models
const Client = require('../models/clientModel');

// Utils
const cloudinary = require('../Utils/cloudinary')
const catchAsync = require('../Utils/catchAsync');
const AppError = require('../Utils/appError');


const factory = require('./handlerFactory');
exports.updateClient = factory.updateOne(Client);
exports.deleteClient = factory.deleteOne(Client);
exports.createClient = factory.createOne(Client);
exports.getClient = factory.getOne(Client);
exports.getAllClients = factory.getAll(Client);



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
// se llama photo porque asi lo escogi desde el Client.jsx del Client
// o bien de NewClient.jsx
///////////////////////////////////////////////////////////////////
exports.uploadClientPhoto = upload.single('photo');


///////////////////////////////////////////////////////////////////
// Aqui me encargo de actualizar el slug, lo tengo que hacer aparte de
// exports.updateClient = factory.updateOne(Client)
// porque necesito usar findById y luego .save para ejeutar el metodo del slug
// si lo hago con findByIdAndUpdate el .save NO se ejecuta
///////////////////////////////////////////////////////////////////
exports.updateSlugClient = catchAsync( async (req, res, next) => {

	// const client = await Client.findOne( { sku: req.body.sku } );
	const client = await Client.findById( { _id: req.body._id } );

	// console.log("req.body", req.body)

	if (!client) {
		return next (new AppError ('El Cliente no existe' ,400));
	}

	// Si no hubo error entonces cambio el slug
	client.businessName = req.body.businessName;
	// console.log("client.businessName", client.businessName)
	// actualizo el Producto

	// Recuuerda que uso save y NO findOneAndUpdate porque con save puedo ejecitar 
	// validaciones y PRE save middlewares, por ejemplo donde se encriptan los passwords
	await client.save();

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
			upload_preset: 'onlineElJuanjoClients'
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
// Hago el resize de la foto al File System de donde guardo las páginas
// Este método YA NO lo uso porque descubri que me borraba algunas fotos
// cuando actualizaba las paginas en el servidor ya sea en Heroku o render.com
// y como tuve que usar ahora Cloudinary, ahora uso otro codigo para guardar
// las fotos, Aun asi dejo este codigo como referencia porque sirve
// Convierto la imagen a webP
// Guardo la imagen en el Web Server (File System)
// Le pongo nombre a la imagen osea a imageCover 
///////////////////////////////////////////////////////////////////
exports.resizeClientImagesAndUploadToFileSystem = catchAsync( async (req, res, next) => {

	// si tengo multiples archivos hago esto, req.files y no req.file
	
	if (!req.file) {
		return next();
	}

	// req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
	// req.file.filename = `client-${Date.now()}.jpeg`;
	req.file.filename = `client-${Date.now()}.webp`;


	await sharp( req.file.buffer)
				.resize(500, 500)
				.toFormat('webp')
				.webp( {quality: 30 })
				.toFile(`./public/img/clients/${req.file.filename}`);
				
	req.body.imageCover = req.file.filename;

	
	next();
});

///////////////////////////////////////////////////////////////////
// Making The API Better: Aliasing
///////////////////////////////////////////////////////////////////
exports.aliasClientByBusinessName = (req, res, next) => {
	
	req.query = {
		businessName: {
			regex: `(?i)${req.params.byBusinessName}`
		},
		sort: 'businessName'
	}
	next(); 
}