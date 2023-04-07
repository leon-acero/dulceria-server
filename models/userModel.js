const crypto = require ('crypto');
const mongoose = require ('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');


const userSchema = new mongoose.Schema (
  {
    name: {
      type: String,
      required: [true, 'Por favor escribe tu nombre.']
    },
    email: {
      type: String,
      required: [true, 'Por favor escribe tu correo electrónico.'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Por favor escribe un correo electrónico válido.']
    },
    photo: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      enum: [ 'user', 'guide', 'lead-guide', 'admin', 'vendedor' ],
      default: 'vendedor'
    },    
    password: {
      type: String,
      required: [true, 'Por favor escribe un password.'],
      minlength: 8,
      ///////////////////////////////////////////////////////////////////
      // Lecture-130 Logging in Users
      // select: false para SEGURIDAD, no mandar password al Client
      ///////////////////////////////////////////////////////////////////
      select: false
    },
    confirmPassword: {
      type: String,
      required: [true, 'Por favor confirma el password.'],
      validate: {
        validator: function (current) {
          // recuerda que en el validator debo usar una function normal NO un 
          // Arrow function para poder usar el this keyword
          // del validator function debo regresar true o false, si es false 
          // significa que hay un error en la validacion
          // current es confirmPassword
          // IMPORTANTE: Esta validacion de confirmPassword funciona en Save o Create, 
          // NO en Update, es por 
          // esto que si quiero actualizar un User debo usar Save y NO findOneAndUpdate
          return current === this.password;
        },
        message: 'Los passwords no son el mismo.'
      }
    },
    slug: String,

    passwordChangedAt: Date,

    ///////////////////////////////////////////////////////////////////
    // Lecture-135 Password Reset Functionality: Reset Token
    ///////////////////////////////////////////////////////////////////
    // el Reset Token expirara por seguridad despues de cierto tiempo como seguridad, tendras como 10 minutos 
    passwordResetToken: String,
    passwordResetExpires: Date,

    active: {
      type: Boolean,
      default: true,
      select: false
    }
  },
  { 
    toJSON: { virtuals: true } ,  
    toObject: { virtuals: true } 
  }
);



userSchema.pre('save', async function (next) {
	
	if (!this.isModified('password')) {
		return next();	
	}

	this.password = await bcrypt.hash (this.password, 12);

	this.confirmPassword = undefined;
	next();
});


userSchema.pre('save', function (next) {

	if (!this.isModified ('password') || this.isNew) {
		return next();	
	}

  this.passwordChangedAt = Date.now() - 1000;
	next();

});


userSchema.pre(/^find/, function (next) {

	this.find ( { active: { $ne: false}  } );

	next();
});


userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
	return await bcrypt.compare(candidatePassword, userPassword);
}


userSchema.methods.changedPasswordAfter = function (JWTTimeStamp) {
	
	// como acabo de crear esta property passwordChangedAt y puede haber Documents
	// que NO la tengan primero checo si existe la property para el Document actual
	if (this.passwordChangedAt) {
		const changedTimeStamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
		// console.log(changedTimeStamp, JWTTimeStamp);

		// Si es true hubo un cambio en el password
		return JWTTimeStamp < changedTimeStamp;
	}

	// False significa que NO hubo cambio de password
	return false;
}



///////////////////////////////////////////////////////////////////
// Lecture-135 Password Reset Functionality: Reset Token
///////////////////////////////////////////////////////////////////
userSchema.methods.createPasswordResetToken = function () {
  /*
	El PasswordResetToken debe ser un random string pero al mismo tiempo no tiene 
  que ser tan criptograficamente  fuerte como el password hash que cree antes

	Puedo usar la muy simple random bytes function del built-in crypto module osea crypto
	y necesito darle require
	Ahora si genero el token con crypto.randomBytes y especifico el numero de caracteres
	y al final lo convierto a un hexadecimal string
  */
	const resetToken = crypto.randomBytes(32).toString('hex');
	
  /*
	este token es lo que voy a enviar al User y es como un reset password que el User
  puede usar para crear un password verdadero y por supuesto solo este User tendra 
  acceso a este token y por lo tanto se comporta como un password 

	Y ya que es un password significa que si un hacker tuviera acceso a la BD eso le 
  permitira al hacker tener acceso a la cuenta al poner un nuevo password, si fuera 
  a guardar este reset token en la BD , si un hacker tiene acceso a la BD pudieran 
  usar ese token y crear un nuevo password usando dicho token en lugar del User. 
  En fecto podrian controlar la cuenta del User. 

	Igual que un password nunca se debe de guardar el reset token sin encriptar en la 
  BD, asi que la encriptare, pero igual que con el password no tiene que ser 
  criptograficamente fuerte, porque estos reset token son un punto de ataque mucho 
  menos peligrosos

	y donde voy a guardar este reset token? voy a crear un nuevo field en el User Schema
	lo quiero guardar en la BD para compararlo con el token que el User provee
  */

	this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

	// quiero que expire en 10 minutos, 10 por 60 segundos por 1000 milisegundos
  let dateNow = Date.now();
  dateNow += 10 * 60 * 1000;
	this.passwordResetExpires = new Date(dateNow).toString();
	// this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  ///////////////////////////////////////////////////////////////////
  // PROBLEMASCONLASFECHASRESUELTO
  // let dateNow = Date.now();
  // console.log('Date.now()', dateNow.toString());

  // console.log('Datenow ToString + 10 ', new Date(Date.now() + 10 * 60 * 1000));
  // la hora correcta es 13:37:45
  // let DateNow = Date.now();
  // console.log('DateNow', new Date(DateNow).toString());

  // DateNow += 10 * 60 * 1000;
  // console.log('DateNow + 10', new Date(DateNow).toString());
  // Date.now() Sat Jun 25 2022 13:37:45 GMT-0500 (Central Daylight Time)
  // console.log('Date.now()', new Date(DateNow).toString())
  // console.log('new Date(Date.now()).toString()', new Date(Date.now()).toString())

  // new Date 2022-06-25T18:37:45.205Z
  // console.log('new Date', new Date);
  // let date = new Date;
  // date = date.toString();
  // new Date.toString() Sat Jun 25 2022 13:37:45 GMT-0500 (Central Daylight Time)
  // console.log('new Date.toString()', date);
  // let ISOdate = new Date().toISOString();
  // console.log('new Date.toISOString()', ISOdate);
  ///////////////////////////////////////////////////////////////////

  /*
	Quiero regresar el reset token sin encriptar porque eso es lo que voy a enviar
	por correo, de tal forma que tengo guardado en la BD el reset token encriptado y 
  al User le mando el reset token sin encriptar, el encriptado es inutil para cambiar
   el password, es lo mismo que cuando guardé el password encriptado en la BD 
  cuando hice el Sign Up

	si hago console.log como un Objeto osea {resetToken} me dice el nombre de la variable y su valor
  pormientras
  */
	// console.log( {resetToken} , this.passwordResetToken ); 

	return resetToken;

}


// AQUI CREO EL MODEL
const User = mongoose.model('User', userSchema);

// AQUI EXPORTO EL MODEL
module.exports = User;

