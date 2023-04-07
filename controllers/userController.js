const multer = require ('multer');
const sharp = require ('sharp');
const cloudinary = require('../Utils/cloudinary');


const User = require('../models/userModel');
const catchAsync = require('../Utils/catchAsync');
const AppError = require ('../Utils/appError');
const factory = require ('./handlerFactory');


exports.createUser = (req, res) => {
  res.status(500).json( {
    status: 'error',
		message: 'This route is not defined! Please use /signup instead'
  });
}


exports.deleteUser = factory.deleteOne(User);


exports.deleteMe = catchAsync( async (req, res, next) => {

	await User.findByIdAndUpdate( req.user.id, { active: false } );
	
	res.status(204).json({
		status: 'success',
		data: null
	});
	
});


const filterObj = (objBody, ...allowedFields) => {

	const newObj = {};

	// una de las formas mas facil de hacer un loop a un OBJETO en Javascript
	// esto es un loop a un Objeto NO a un Array
	// Object.keys(objBody) y esto regresa un Array conteniendo los Key names y con eso
	// ya puedo hacerle un forEach porque regresa un Array

	Object.keys(objBody).forEach(current => {

		if (allowedFields.includes(current)) {
			// si el current element existe en allowedFields lo agrego a un Objeto
			// recuerda que current es key: value, NO es un index
			newObj[current] = objBody[current];
		}
	})

	return newObj;
}


exports.updateMe = catchAsync( async (req, res, next) => {
	// Por ahora el User solo puede actualizar su name y su email address
	// Es una costumbre que actualizar el password de un User se hace en un lugar y la informacion de su cuenta en otro lado

	// console.log('req.file', req.file);
	// console.log(req.body);

	// 1. Create error if the user POSTs password data
	if (req.body.password || req.body.confirmPassword) {
		// 400 Bad Request
		return next (new AppError ('This route is not for password updates. Please use /updateMyPassword', 400));
	}


	// 2. Filtered out unwanted fields names that are not allowed to be updated
	const filteredBody = filterObj(req.body, 'name', 'email');

	if (req.file){
		filteredBody.photo = req.file.filename;
	}

	// 3. Update the User Document
	const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, 
			{ new: true, runValidators: true });

	res.status(200).json({
		status: 'success',
		data: {
			user: updatedUser
		}
	});

});


exports.updateUser = factory.updateOne(User);
exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);


exports.getMe = (req, res, next) => {
	req.params.id = req.user.id;

	next();
}


const multerStorage = multer.memoryStorage();


const multerFilter = (req, file, cb) => {

	// uso el mimetype
	if (file.mimetype.startsWith('image')) {
		cb (null, true);
	}
	else {
		cb ( new AppError ('Not an image! Please upload only', 400), false);
	}	
}


const upload = multer({
	storage: multerStorage,
	fileFilter: multerFilter
});

///////////////////////////////////////////////////////////////////
// Hago el upload de la foto a Cloudinary, ahora los procesos de resize
// los hago en Cloudinary, ya no es necesario usar el sharp package
// Convierto la imagen a webP
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
			upload_preset: 'onlineElJuanjoUsers'
		}
	);

	// Actualizo el nombre de imageCover en la Collection Clients
	// En el Middleware que sigue donde se actualiza toda la informacion del Cliente
	// se actualizara el imageCover
	if (uploadRes) {
		req.file.filename = uploadRes.secure_url;
	}

	next();
});


exports.uploadUserPhoto = upload.single('photo');


exports.resizeUserPhoto = catchAsync( async (req, res, next) => {
	
	// si no se mando una foto en el request me brinco al proximo Middleware
	if (!req.file) {
		return next();
	}

	// este paso es necesario aqui porque en .updateMe uso req.file.filename
	req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

	await sharp( req.file.buffer)
				.resize(500, 500)
				.toFormat('jpeg')
				.jpeg( {quality: 90 } )
				.toFile(`public/img/users/${req.file.filename}`);

	next();
});
