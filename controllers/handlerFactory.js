const catchAsync = require ('../Utils/catchAsync');
const AppError = require('../Utils/appError');
const APIFeatures = require ('../Utils/apiFeatures');


exports.deleteOne = Model => catchAsync(async (req, res, next) => {
  
  // en este caso al borrar un Document NO le mando nada al cliente
  // por lo que no tengo que poner const document = await....
  const deletedDocument = await Model.findByIdAndDelete(req.params.id);

  // si no existe deletedDocument es que es null
  if (!deletedDocument) {
    return next(new AppError ('No Document found with that Id', 404));
  }

  res.status(204).json( {
    status: 'success',
    data: null
  });
 
});



exports.updateOne = Model => catchAsync(async (req, res, next) => {

  // new: true, significa que me va a regresar el Document YA actualizado

  const updatedModel = await Model.findByIdAndUpdate(req.params.id, req.body, 
    { 
      new: true, 
      runValidators: true 
    });

  // si no existe updatedModel es que es null
  if (!updatedModel) {
    return next(new AppError ('No Document found with that Id', 404));
  }

  res.status(200).json( {
    status: 'success',
    data: {
      data: updatedModel
    }
  }); 
});



exports.createOne = Model => catchAsync( async (req, res, next) => {

    const newDocument = await Model.create(req.body);

    res.status(201).json( { 
      status: 'success',
      data: { 
        data: newDocument 
      }    
    });  
});



exports.getOne = (Model, popOptions) =>  catchAsync(async (req, res, next) => {

  let query = Model.findById(req.params.id);

  if (popOptions) {
	  query = query.populate(popOptions);
  }

  const getDocument = await query;

  // si no existe getDocument es que es null
  if (! getDocument) {
      return next(new AppError ('No Document found with that Id', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: getDocument
    }
  });
});



exports.getAll = Model => catchAsync( async (req, res, next) => {

  // To allow for NESTED Get Reviews on Tour
  let filter = {};
	
  if (req.params.tourId) 
		filter = { tour: req.params.tourId };

  const features = new APIFeatures (Model.find(filter), req.query)
              .filter()
              .sort()
              .limitFields()
              .pagination();

  // const allDocuments = await features.query.explain();
  const allDocuments = await features.query;


  // SEND RESPONSE
  res.status(200).json({
      status: 'success',
      results: allDocuments.length,
      data: {
        data: allDocuments
      }
  })  
});
