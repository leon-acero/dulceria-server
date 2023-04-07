const express = require('express');
const path = require ('path'); 
const morgan = require('morgan');
const rateLimit = require ('express-rate-limit');
const helmet = require ('helmet');
const mongoSanitize= require ('express-mongo-sanitize');
const xss = require ('xss-clean');
const hpp = require('hpp');
const cookieParser = require ('cookie-parser');
const compression = require ('compression');
const cors = require ('cors');

const AppError = require ('./Utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const userRouter = require('./routes/userRoutes');
const productRouter = require('./routes/productRoutes');
const clientRouter = require('./routes/clientRoutes');
const saleRouter = require('./routes/saleRoutes');


// Start Express App
const app = express();


//////////////////////////////////////////////////////////////////
// Lecture-224 Testing for Secure HTTPS Connections
//////////////////////////////////////////////////////////////////

// Trust proxies, esto ya lo tiene Express para estas situaciones
app.enable('trust proxy');

// app.set('view engine', 'pug');
app.set('view engine', 'ejs');

// 1. PRIMERO PONGO LOS MIDDLEWARES

///////////////////////////////////////////////////////////////////////////
// RECUERDA QUE LOS MIDDLEWARE SE VAN EJECUTANDO EN EL ORDEN EN EL QUE
// ESTAN CODIFICADOS
// (COOM)

//////////////////////////////////////////////////////////////////
// Lecture-176 Setting Up Pug in Express
//////////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname, 'public' )));


///////////////////////////////////////////////////////////////////
// 1. PRIMERO PONGO LOS GLOBAL MIDDLEWARES

/*
ESTE ES UN CODIGO QUE VI EN EL CURSO DE UDEMY
I found that when typing in my heroku url that if I did not specify the https it would 
defualt to an http connection in the browser. I found this code to add to our app.js 
to always force an http connection. Hope this helps!

source with explanation here https://jaketrent.com/post/https-redirect-node-heroku
*/

if(process.env.NODE_ENV === 'production') { 
  app.use((req, res, next) => { 
    if (req.header('x-forwarded-proto') !== 'https') 
      res.redirect(`https://${req.header('host')}${req.url}`) 
    else 
      next();
  }) 
}


if(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') { 
    
    const whiteList = ['https://eljuanjo-dulceria.onrender.com', 'http://127.0.0.1:3000', 'http://localhost:3000', 'http://127.0.0.1:8000', 'http://localhost:8000'];

    const corsOptions = {
      credentials: true,
      origin: (origin, callback) => {
        
        console.log("originSS", origin);
        
        if (whiteList.indexOf(origin) !== -1 || !origin) {
          callback (null, true);
        }
        else {
          callback(new Error ('Not Allowed by CORS, man'));
        }
      },
      optionsSuccessStatus: 200
    }
    app.use(cors(corsOptions));

}

app.options ('*', cors());


///////////////////////////////////////////////////////////////////
// Lecture-144 Setting Security HTTP Headers
///////////////////////////////////////////////////////////////////

// Further HELMET configuration for Security Policy (CSP)
const scriptSrcUrls = [
    'https://unpkg.com/',
    'https://tile.openstreetmap.org',
    'https://js.stripe.com',
    'https://m.stripe.network',
    'https://*.cloudflare.com'
];

const styleSrcUrls = [
  'https://unpkg.com/',
  'https://tile.openstreetmap.org',
  'https://fonts.googleapis.com/'
];

const connectSrcUrls = [
  'https://unpkg.com',
  'https://tile.openstreetmap.org',
  'https://*.stripe.com',
  'https://bundle.js:*',
  'ws://127.0.0.1:*/'
];

const fontSrcUrls = ['fonts.googleapis.com', 'fonts.gstatic.com'];
   
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", 'data:', 'blob:', 'https:', 'ws:'],
      baseUri: ["'self'"],
      fontSrc: ["'self'", ...fontSrcUrls],
      scriptSrc: ["'self'", 'https:', 'http:', 'blob:', ...scriptSrcUrls],
      frameSrc: ["'self'", 'https://js.stripe.com'],
      objectSrc: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
      workerSrc: ["'self'", 'blob:', 'https://m.stripe.network'],
      childSrc: ["'self'", 'blob:'],
      imgSrc: ["'self'", 'blob:', 'data:', 'https:'],
      formAction: ["'self'"],
      connectSrc: [
        "'self'",
        "'unsafe-inline'",
        'data:',
        'blob:',
        ...connectSrcUrls
      ],
      upgradeInsecureRequests: []
    }
  })
);


///////////////////////////////////////////////////////////////////
// Lecture-143 Implementing Rate Limiting
///////////////////////////////////////////////////////////////////

// MIDDLEWARE: LIMIT REQUESTS FROM SAME /API
const limiter = rateLimit ( { 
	max: 401,
	windowMs: 60 * 60 * 1000,
	message: 'Too many requests from this IP, please try again in an hour'
});

// lo que quiero es limitar el acceso a mi API route, esto afectara a todas las 
// routes dentro de /api
app.use ('/api', limiter);


///////////////////////////////////////////////////////////////////
// Lecture-67 Environment Variables
// MIDDLEWARE: DEVELOPMENT LOGGING
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}


///////////////////////////////////////////////////////////////////
// Lecture-227 Finishing Payments with Stripe Webhooks
///////////////////////////////////////////////////////////////////
// PONER ESTO Antes del Body Parser

// BODY PARSER, READING DATA FROM THE BODY INTO req.body
// Aqui puedo implementar otra medida de seguridad en el que limito la cantidad de 
// datos que estan en el Body, si recibo un Body de mas de 10kb el Body NO sera aceptado
app.use(express.json( { limit: '10kb' } ));


///////////////////////////////////////////////////////////////////
// Lecture-195 Updating User Data
///////////////////////////////////////////////////////////////////
app.use(express.urlencoded( { extended: true, limit: '10kb' }));


///////////////////////////////////////////////////////////////////
// Lecture-189 Logging in Users with Our API - Part 1
///////////////////////////////////////////////////////////////////
app.use(cookieParser());


///////////////////////////////////////////////////////////////////
// Lecture-145 Data Sanitization
///////////////////////////////////////////////////////////////////

// DATA SANITIZATION AGAINST NOSQL QUERY INJECTION
app.use(mongoSanitize());

// DATA SANITIZATION AGAINST XSS ATTACKS
app.use(xss());


///////////////////////////////////////////////////////////////////
// Lecture-146 Preventing Parameter Pollution
///////////////////////////////////////////////////////////////////

// Ponerlo al final ya que limpia el Query String
// MIDDLEWARE: PREVENT PARAMETER POLLUTION
app.use(hpp( {
			whitelist: [
				'duration',
				'ratingsQuantity',
				'ratingsAverage',
				'maxGroupSize',
				'difficulty',
				'price'
			]
}));


///////////////////////////////////////////////////////////////////
// Lecture-222 Preparing Our App for Deployment
///////////////////////////////////////////////////////////////////
app.use (compression());


// (COOM)
// MIDDLEWARE: TEST MIDDLEWARE
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log('req.headers', req.headers);
  // console.log('req.cookies',req.cookies);
  next();
});


// MIDDLEWARE: MOUNTING THE ROUTER
app.use('/api/v1/users', userRouter); // a esto se llama Mounting the Router
app.use('/api/v1/products', productRouter); // a esto se llama Mounting the Router
app.use('/api/v1/clients', clientRouter); // a esto se llama Mounting the Router
app.use('/api/v1/sales', saleRouter); // a esto se llama Mounting the Router


///////////////////////////////////////////////////////////////////
// Para el Deployment
app.use(express.static(path.join(__dirname, 'public')));


// Y aqui con el * le digo que cuando le lleue cualquier request lo va a redireccionar a este path
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});


///////////////////////////////////////////////////////////////////
// Lecture-112 Handling Unhandled Routes
///////////////////////////////////////////////////////////////////

app.all('*', (req, res, next) => {
	next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});


///////////////////////////////////////////////////////////////////
// Lecture-114 Implementing a Global Error Handling Middleware
///////////////////////////////////////////////////////////////////
app.use(globalErrorHandler);

module.exports = app;
