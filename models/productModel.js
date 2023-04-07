const mongoose = require('mongoose');
const slugify = require('slugify');

///////////////////////////////////////////////////////////////////
// Modelling The Products
///////////////////////////////////////////////////////////////////

const productSchema = new mongoose.Schema( 
  { 
    // trim solo funciona para Strings, quita los white spaces al inicio y 
    // final del String, ejemplo: "  Este Product me gusto porque     "
    // tambien agregar trim a productName
    productName: { 
        type: String,
        required: [true, 'El producto debe tener nombre'],
        unique: true,
        trim: true,
        maxlength: [ 40, 'El nombre del producto debe ser menor o igual a 40 letras.'],
        minlength: [ 5, 'El nombre del producto debe ser mayor o igual a 5 letras.']
    },  
    
    slug: String,

    sku: {
        type: Number,
        unique: true,
        required: [true, 'El producto debe tener SKU.']
    },

    priceMenudeo: { 
        type: Number,
        required: [true, 'El producto debe tener precio de Menudeo.']
    },

    priceMayoreo: { 
        type: Number,
   },

    costo: Number,

    inventarioActual: Number,

    inventarioMinimo: Number,

    imageCover: {
        type: String,
        default: ''
    },

    // Es un timestamp en milisegundos que se configura en el momento en el que 
    // el usuario obtiene un nuevo Product, esto se hace en automatico en el 
    // momento que un Product es creado, pero en mongoose se guarda como una fecha normal
    createdAt: {
        type: Date,
        default: Date.now(),
        select: false
    },   
}, 
  { 
    toJSON: { virtuals: true } ,  
    toObject: { virtuals: true } 
});


productSchema.pre('save', function(next) {
  
  this.slug = slugify(this.productName, { lower: true });

  next();
});


const Product = mongoose.model('Product', productSchema)

module.exports = Product;