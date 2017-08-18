const Handlers = require('./Handlers')
const Alexa = require('alexa-sdk')
const APP_ID = process.env.APP_ID

exports.handler = function (event, context, callback) {
  console.log('new event', event)
  const alexa = Alexa.handler(event, context)
  alexa.APP_ID = APP_ID
  alexa.registerHandlers(Handlers)
  alexa.execute()
}
