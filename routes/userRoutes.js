const express = require('express');

const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);

// Aqui es un GET porque NO mando nada al server junto con el request, solo recibo 
// la cookie
router.get('/logout', authController.logout);
router.post('/forgotPassword', authController.forgotPassword);

// resetPassword que recibira el token y el nuevo password
router.patch('/resetPassword/:resetToken', authController.resetPassword);


// Con esta linea me aseguro que todas las lineas siguientes debe estar loggeado
//  un user para que se puedan ejecutar las siguientes lineas de codigo, recuerda 
// que es un Middleware y por lo tanto actua en secuencia
router.use(authController.protect);


router
	.route('/updateMyPassword')
	.patch(authController.updateMyPassword);


router.patch('/updateMe', 
			userController.uploadUserPhoto, 
			userController.uploadImageToCloudinary,
			userController.updateMe);


router.delete('/deleteMe', userController.deleteMe);
router.get('/me', userController.getMe, userController.getUser);

// Ahora las siguientes acciones solo deben ser ejecutadas por Admins y puedo usar
//  la misma tecnica anterior

router.use(authController.restrictTo ('admin'));

router
    .route('/')
    .get(userController.getAllUsers)
    .post(userController.createUser);

router
    .route('/:id')
    .get(userController.getUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);


// ahora exporto el router para impotarlo en app.js
// cuando solo tengo una cosa que exportar hago asi
module.exports = router;




///////////////////////////////////////////////////////////////////
// Lecture-135 Password Reset Functionality: Reset Token
///////////////////////////////////////////////////////////////////
/*

En esta leccion y las siguientes voy a implementar una funcionalidad amigable para 
Resetear el Password, que es estandar en la mayoria de las web apps

Para resetear el password necesitas dar tu email y recibes un correo con un link que 
das click y te lleva a una pagina donde pones un nuevo password

Hay dos pasos:
1. El user manda un post request a una Route llamada fort password con su direccion 
de correo en ella

Esto crea un reset token y se le envia a la direccion de correo que fue dada,
Es un simple randon token NO un JSON Web Token

2. En la segunda parte que sera la proxima leccion el User envia ese token desde su 
email junto con el nuevo password para actualizar su password



Y voy a implementar estas dos Routes y esto es en userRoutes.js

// forgotPassword que recibira la email address
router.post(‘/forgotPassword, authController.forgotPassword);

// resetPassword que recibira el token y el nuevo password
router.post('/resetPassword’, authController.resetPassword);


En authController.js implemento
// este es el primer paso
exports.forgotPassword =  catchAync( async (req, res, next) => {
	// 1. Get user based on POSTed email
	// Uso findOne no findById porque no conozco el User Id y el usuario tampoco sabe su Id 
	const user = await User.findOne( { email: req.body.email } );

	// Verifico si el User se encontró
	if (!user) {
		// 404 statusCode Not Found
		return next ( new AppError(‘There is no user with that email address’, 404 ) );
	}

	// 2. Generate the random token
	// para esto necesito un Instanced method en userModel.js
	// esta linea modifica el Schema: passwordResetExpires y passwordResetTOken
	// falta grabarlo en la BD 
	const resetToken = user.createPasswordResetToken();
	
	// 
	await user.save();

	// 3. Send it to user’s email	
});

// este es el segundo paso
exports.resetPassword = (req, res, next) => {
	
}

En userModel.js


// esta built-in en express o NodeJS no estoy seguro pero por eso no es un package de 3eros y no tengo que instalarlo
const crypto = require (‘crypto’);

// actualizco el User Schema
// el Reset Token expirara por seguridad despues de cierto tiempo como seguridad, tendras como 10 minutos 
passwordResetToken: String,
passwordResetExpires: Date


userSchema.methods.createPasswordResetToken = function () {
	// El PasswordResetToken debe ser un random string pero al mismo tiempo no tiene que ser tan criptograficamente  fuerte como el password hash que cree antes

	// Puedo usar la muy simple random bytes function del built-in crypto module osea crypto
	// y necesito darle require
	// Ahora si genero el token con crypto.randomBytes y especifico el numero de caracteres
	// y al final lo convierto a un hexadecimal string
	const resetToken = crypto.randomBytes(32).toString(‘hex’);
	
	// este token es lo que voy a enviar al User y es como un reset password que el User puede usar para crear un password verdadero y por supuesto solo este User tendra acceso a este token y por lo tanto se comporta como un password 

	// Y ya que es un password significa que si un hacker tuviera acceso a la BD eso le permitira al hacker tener acceso a la cuenta al poner un nuevo password, si fuera a guardar este reset token en la BD , si un hacker tiene acceso a la BD pudieran usar ese token y crear un nuevo password usando dicho token en lugar del User. En fecto podrian controlar la cuenta del User. 

	// Igual que un password nunca se debe de guardar el reset token sin encriptar en la BD, asi que la encriptare, pero igual que con el password no tiene que ser criptograficamente fuerte, porque estos reset token son un punto de ataque mucho menos peligrosos

	// y donde voy a guardar este reset token? voy a crear un nuevo field en el User Schema
	// lo quiero guardar en la BD para compararlo con el token que el User provee
	this.passwordResetToken = crypto.createHash(’sha256’).update(resetToken).digest(‘hex’);

	// quiero que expire en 10 minutos, 10 por 60 segundos por 1000 milisegundos
	passwordResetExpires = Date.now() + 10 * 60 * 1000;

	// Quiero regresar el reset token sin encriptar porque eso es lo que voy a enviar
	// por correo, de tal forma que tengo guardado en la BD el reset token encriptado y al User
	// le mando el reset token sin encriptar, el encriptado es inutil para cambiar el password, es lo 
	// mismo que cuando guardé el password encriptado en la BD cuando hice el Sign Up

	// si hago console.log como un Objeto osea {resetToken} me dice el nombre de la variable
	// y su valor
	console.log( {resetToken} , this.passwordResetToken   ); 

	return resetToken;

}
*/



///////////////////////////////////////////////////////////////////
// Lecture-199 Image Uploads Using Multer: Users
///////////////////////////////////////////////////////////////////

/*


Voy a implementar image uploads para User fotos usando un package llamado Multer

Multer es un Middleware muy popular para manejar multi-part form data, que se usa para 
subir archivos desde una Form, recuerda como en la seccion anterior use un URL encoded 
para actualizar User data y para eso tuve que incluir un Middleware especial y Multer 
es un Middleware para multi-part Form data

Voy a permitir al User subir una foto en el /updateMe route

En la Terminal

	npm i multer


En userRoutes.js
	
	const multer = require (‘multer’);

Ahora necesito configurar Multer upload y luego usarlo

// este es el folder donde quiero guardar las imagenes que se subiran al server y en 
// la proxima leccion veremos una configuracion mas compleja, estas imagenes no se 
// guardan en la BD, se guardan en el FIle System y en la BD pongo un link a esa imagen
const upload = multer( { dest: 'public/img/users' });


Ahora uso la variable upload para crear un Middleware function que pueda poner en 
el /updateMe route

// es .single porque solo quiero actualizar una imagen y como parametro le paso el nombre 
// del field que va a tener la imagen a subir, y al decir field, se refiere al field en 
// la Form que va a subir la imagen
// Asi que este Middleware upload.single es el que se encarga de tomar el archivo y 
// copiarlo al destino que especifique
// El Middleware upload.single tambien pondra algo de informacion sobre el archivo en 
// el request object 
router.patch('/updateMe', upload.single('photo'), userController.updateMe);


En userController.js

exports.updateMe = catchAsync( async (req, res, next) => {

	console.log(req.file);
	console.log(req.body);



Voy y lo pruebo en POSTMAN 

VOy a actualizar un User llamado Leo, primero me Loggeo como él usando 
	{{URL}}api/v1/users/login

{
	“email”: “leo@example.com”,
	“password”: {{password}}

}

EXITO al loggear

Ahora actualizo
		{{URL}}api/v1/users/updateMe

En vez de usar Body -> raw, voy a usar Body -> form data, porque esta es la manera en que puedo enviar multi-part Form data


	Key: “name”
	Value:  “Leo J. Gillespie”
	Key: “photo”
	Value: (En lugar de texto especifico File): Y aqui me aparece una ventana para 
	seleccionar el archivo que quiero subir: natours -> dev-data -> img -> leo.jpg

Le doy SEND request

{
    "status": "success",
    "data": {
        "user": {
            "role": "guide",
            "_id": "5c8a1f292f8fb814b56fa184",
            "name": "Leo J. Gillespie",
            "email": "leo@example.com",
            "photo": "user-5.jpg",
            "__v": 0,
            "id": "5c8a1f292f8fb814b56fa184"
        }
    }
}

aqui No actualizo la foto en la BD, eso es en la proxima leccion, por ahora subi 
la foto de mi laptop al server en el folder que especifique

En la console me sale esta informacion
{
  fieldname: 'photo',
  originalname: 'leo.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  destination: 'public/img/users',
  filename: '7c411154c94ff8a05ae02107873b1a56',
  path: 'public/img/users/7c411154c94ff8a05ae02107873b1a56',
  size: 207078
}
[Object: null prototype] { name: 'Leo J. Gillespie' }

El body es solo el name, porque el body parser no puede manejar archivos y es 
por eso que necesito el multer package

Ahora si voy en VSCode a public/img/users/ ahi debe estar el archivo que subi

Pero necesito darle un mejor nombre
*/