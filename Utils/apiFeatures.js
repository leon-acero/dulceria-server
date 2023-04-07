///////////////////////////////////////////////////////////////////
// Refactoring API Features
///////////////////////////////////////////////////////////////////

class APIFeatures {
	// query viene siendo Tour.find()
	// queryString viene siento req.query

	constructor(query, queryString) {
		this.query = query;
		this.queryString = queryString;
	}

    
	// ahora creare un metodo por cada una de las funcionalidades del API

    //////////////////////////////////////////////////////////////////////
	// método: filter
	filter() {
        // 1A. Filtering

        const queryObj = { ... this.queryString };
        const excludedFields = [ 'page', 'sort' , 'limit', 'fields' ];
        excludedFields.forEach (current => delete queryObj[current]);

        // 1B. Advanced Filtering
        // Primero Convierto el Object a String
        let queryStr = JSON.stringify(queryObj);

        // Ahora puedo usar metodos de String, para agregar el $ y
        // los operadores gte, gt, lte, lt, para eso voy a usar un regular
        // expression
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt|regex)\b/g, match => `$${match}`);

        //Hago JSON.parse para convertir el String en Objeto
            // console.log("queryStr: ", queryStr);
        // AUN asi hay algo mas que necesito hacer en el codigo para implementar 
        // estas funcionalidades.
        // Como funcionan los queries en mongoose??
        
        // Recuerda que el await Tour.find() metodo va a regresar un Query y es 
        // la razon de que puedo encadenar otros metodos asi: 
        // Tour.find().where().equals()… 

        // Ahora la parte importante: en cuanto usamos await para el query.. 
        // el query se ejecutara y regresara con Documents, si lo hacemos asi:

        // en esta clase NO puedo tener nada de un Resource
        //let query = Tour.find(JSON.parse(queryStr));

		this.query = this.query.find(JSON.parse(queryStr));

        // YA NO HAY forma de implementar sorting o pagination u otra 
        // funcionalidad, entonces lo que tendre que hacer es grabar esta parte 
        //        Tour.find(queryObj);

        // en un query, y uego al final, en cuanto cambie todos los metodos 
        // al query que necesito , solo al final puedo darle await a ese query, 
        // por ejemplo voy a usar el sort method, el predict method, el limit method, 
        // y muchas mas y los vamos a encadenar a este query
        //        Tour.find(queryObj);

        // Y eso serua imposible hacer si le doy await al query desde el inicio, 
        // entonces asi sera:

		// Regreso el Objeto Completo!
		return this;
	}


    //////////////////////////////////////////////////////////////////////
	// método: sort
	sort() {

	  if (this.queryString.sort) {
		// .split regresa un Array con todos los strings y lo guarda en sortBy
        // y luego los vuelvo a unir con .join, pero los uno espacio
        const sortBy = this.queryString.sort.split(',').join(' ');

            // esto es sort, por ejemplo: 'price'
            this.query = this.query.sort(sortBy);
            // si por alguna razon quiero agregar un segundo criterio de sorting
            // lo hago asi
            // .sort('price ratingsAverage')
            // pero desde POSTMAN NO puedo ponerle espacio sino una coma (,)
            // y cuando llegue al código de Express JS, convierto la coma a espacio
        }
        else {
                // Este sera un Sorting Default, -createdAt
                // Los tours mas nuevos aparecen primero
                this.query = this.query.sort('price');
   	 	}

		// Regreso el Objeto Completo!
		return this;
    }


    //////////////////////////////////////////////////////////////////////
	// método: limitFields
	limitFields () {
        if (this.queryString.fields) {
            // Igual que con sorting, mongoose necesita que los fields esten
            // separados por espacios, y desde Postman se mandan separados por comas
            // Esta operacion de seleccionar solo ciertos fields se llama PROJECTING
            // query = query.select('name price difficulty duration');
            const fields = this.queryString.fields.split(',').join(' ');

            this.query = this.query.select(fields);
        }
        else {
            // Por default mando todo EXCEPTO __v
            this.query = this.query.select('-__v');
        }

		return this;
	}

    //////////////////////////////////////////////////////////////////////
	// método: pagination
	pagination () {
        const page = this.queryString.page * 1 || 1;
        const limit  = this.queryString.limit * 1 || 100;

        const skip = (page - 1) * limit;
        this.query = this.query.skip(skip).limit(limit);

		return this;	
	}
}

module.exports = APIFeatures;