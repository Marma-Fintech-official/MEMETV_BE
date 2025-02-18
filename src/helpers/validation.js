const { Joi, Segments } = require('celebrate')

const payloadValidation = {
  commonPayload: {
    [Segments.BODY]: Joi.object().keys({
      encryptedData: Joi.string().required(),
      iv: Joi.required()
    })
  }
}

module.exports = payloadValidation 
