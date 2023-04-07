const nodemailer = require ('nodemailer');
const pug = require ('pug');
const htmlToText = require ('html-to-text');


module.exports = class Email {
	// el constructor es la function que se ejecutara cuando se cree un object d esta class
	constructor(user, url) {
		this.to = user.email;
		this.firstName = user.name.split(' ')[0];
		this.url = url;
		this.from = `Abdel Yussuf <${process.env.EMAIL_FROM}>`;
	} 

	//////////////////////////////////////////////////////////////////////
	// método: newTransport
	newTransport () {
		// QUiero tener diferentes Trasports dependiendo si estoy en Production o Development
		// En Production quiero mandar emails reales usando SendGrid y en Development uso
		// MailTrap

		if (process.env.NODE_ENV === 'production') {
			return nodemailer.createTransport({
				service: 'SendinBlue',
				auth: {
					user: process.env.SENDINBLUE_USERNAME,
					pass: process.env.SENDINBLUE_PASSWORD
				}
			});
		}

		return nodemailer.createTransport({
			service: 'SendinBlue',
			auth: {
				user: process.env.SENDINBLUE_USERNAME,
				pass: process.env.SENDINBLUE_PASSWORD
			}
		});

		// return nodemailer.createTransport({
		// 	service: 'SendGrid',
		// 	auth: {
		// 		user: process.env.SENDGRID_USERNAME,
		// 		pass: process.env.SENDGRID_PASSWORD
		// 	}
		// });
  	
		// return nodemailer.createTransport ({
		// 	host: process.env.EMAIL_HOST,
		//   port: process.env.EMAIL_PORT,
		//   auth: {  
		//       user: process.env.EMAIL_USERNAME,
		//       pass: process.env.EMAIL_PASSWORD
		//   }
		// });		
	}

	//////////////////////////////////////////////////////////////////////
	// método: send

	// este es el metodo que enviara el email y recibicra un template y el subject
	// este es un metodo general
	async send( template, subject) {
		
		// Recuerda que voy a tener un metodo llamado sendWelcome y otro llamado 
		// setResetPassword

		// 1. Pintar el HTML para el email basado en el pug template

		try {
			const html = pug.renderFile(`${__dirname}/../views/emails/${template}.pug`, {
				firstName: this.firstName,
				url: this.url,
				subject
			});

			// ahora para el welcome email que el pug template en el folder 
			// /views/emails y el nombre del archivo sera welcome.pug

			// 2. Definir email Options

			// es importante tener una version de texto en el email por que es mejor para email delivery rates y para spam folders
			// para convertir de HTML a texto instalare un package llamado 
			// html-to-text
			// En la Terminal
			// npm i html-to-text
			const mailOptions = {
				from: this.from,
				to: this.to,
				subject,
				html,
				text: htmlToText.fromString(html)
			}

			// 3. Crear un Transport y enviar email
			// PREGUNTA COMO PUDO encadenar .sendMail??
			// Este if es porque si existe la Promise entonces regreso true
			// significa que NO hubo problemas al enviar el Email
			// si regresa false es que SI hubo problemas al enviar el Email
			const Promise = await this.newTransport().sendMail(mailOptions);

			// console.log('Promise', Promise);
			if(Promise)
				return true;
				
			return false;

		}
		catch (err){
			console.log('Error Email', err);
			// si regresa false es que SI hubo problemas al enviar el Email
			return false;
		}
	}


	// metodos eespecificos

	//////////////////////////////////////////////////////////////////////
	// método: sendWelcome
	async sendWelcome() {
		// como this.send es AWAIT / SYNC entonces esta function TAMBIEN DEBE SERLO
		// porque estoyr usando this.end

		// Este if es porque si existe la Promise entonces regreso true
		// significa que NO hubo problemas al enviar el Email
		// si regresa false es que SI hubo problemas al enviar el Email

		if(await this.send ('welcome', 'Welcome to the Natours Family!'))
			return true;
		
		return false;
	}

	//////////////////////////////////////////////////////////////////////
	// método: sendPasswordReset

  	async sendPasswordReset () {
		if (await this.send('passwordReset', 'Tu solicitud para cambiar de password de El Juanjo | Dulcería (solo válido por 10 minutos)'))
			return true;

		return false;
	} 

} 
