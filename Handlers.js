const AddressClient = require('./AddressClient')
const Lokka = require('lokka').Lokka
const Speech = require('ssml-builder')
const Transport = require('lokka-transport-http').Transport

const YELP_KEY = process.env.YELP_KEY
const YELP_URL = 'https://api.yelp.com/v3/graphql'
const SKILL_NAME = 'Food Hero'
const DINNER_MESSAGE_PREFIXES = [
  'Here\'s what you should eat: ',
  'How about: ',
  'This looks good: ',
  'Yum. How about this: '
]
const MISSING_PERMISSION = 'To find food near you, I need your permission to view your zipcode'
const PERMISSIONS = ['read::alexa:device:all:address:country_and_postal_code']
const HELP_MESSAGE = 'I can tell you what to eat?'
const HELP_REPROMPT = 'What can I help you with?'
const STOP_MESSAGE = 'Goodbye!'

function getYelpHeaders () {
  const headers = {
    'Authorization': 'Bearer ' + YELP_KEY
  }
  return { headers }
}

function getYelpClient () {
  return new Lokka({
    transport: new Transport(YELP_URL, getYelpHeaders())
  })
}

function getConsentToken (user) {
  try {
    return user.permissions.consentToken
  } catch (e) {
    console.log('unable to access a consentToken')
    return null
  }
}

function getAddressClient (system, consentToken) {
  try {
    const deviceId = system.device.deviceId
    const apiEndpoint = system.apiEndpoint
    return new AddressClient(apiEndpoint, deviceId, consentToken)
  } catch (e) {
    console.log('failed to get address client', system, e)
    return null
  }
}

function handleAddressResponse (addressResponse) {
  if (addressResponse.statusCode === 200) {
    return addressResponse.address.postalCode
  }

  this.emit(':tell', 'Sorry I was unable to retreive your postal code')
  throw new Error('Failed postal lookup')
}

function query (postalCode, yelpClient) {
  return yelpClient.query(`
    {
      search(location: "${postalCode}", limit: 20, sort_by: "rating", categories: "restaurants") {
        business {
          name
        }
      }
    }
  `)
}

function getPrefix () {
  const i = Math.floor(Math.random() * DINNER_MESSAGE_PREFIXES.length)
  return DINNER_MESSAGE_PREFIXES[i]
}

function handleQueryResults (response) {
  const places = response.search.business

  if (!places.length) {
    this.emit(':tell', 'Sorry I was unable to retreive any food given your postal code')
    return
  }

  const placeIndex = Math.floor(Math.random() * places.length)
  const place = places[placeIndex].name
  const speech = new Speech()

  speech.say(getPrefix() + place)
  const speechOutput = speech.ssml(true)
  this.emit(':tellWithCard', speechOutput, SKILL_NAME, place)
}

function GetDinnerIntent () {
  const yelpClient = getYelpClient()
  const consentToken = getConsentToken(this.event.context.System.user)
  const addressClient = getAddressClient(this.event.context.System, consentToken)

  if (!consentToken || !addressClient) {
    this.emit(':tellWithPermissionCard', MISSING_PERMISSION, PERMISSIONS)
    return
  }

  addressClient.getCountryAndPostalCode()
    .then(handleAddressResponse.bind(this))
    .then(postalCode => query(postalCode, yelpClient))
    .then(handleQueryResults.bind(this))
    .catch(e => {
      console.log('error!', e)
      this.emit(':tell', 'Uh oh, I was not able to find your dinner. Try again later.')
    })
}

module.exports = {
  'LaunchRequest': function () {
    this.emit('GetDinnerIntent')
  },
  'GetDinnerIntent': GetDinnerIntent,
  'AMAZON.HelpIntent': function () {
    this.emit(':ask', HELP_MESSAGE, HELP_REPROMPT)
  },
  'AMAZON.CancelIntent': function () {
    this.emit(':tell', STOP_MESSAGE)
  },
  'AMAZON.StopIntent': function () {
    this.emit(':tell', STOP_MESSAGE)
  }
}
